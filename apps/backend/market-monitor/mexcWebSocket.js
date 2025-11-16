import log from "encore.dev/log";
import WebSocket from "ws";
import { calculateBackoffDelay } from "./backoff";
import { detectListing, initializeListingCache } from "./listingDetector";
const MEXC_WS_URL = "wss://wbs.mexc.com/ws";
/**
 * MEXC WebSocket client with automatic reconnection
 */
export class MEXCWebSocketClient {
    ws = null;
    state = "disconnected";
    reconnectAttempt = 0;
    maxReconnectAttempts = 10;
    reconnectTimeout = null;
    pingInterval = null;
    constructor() { }
    /**
     * Initialize connection and cache
     */
    async initialize() {
        log.info("Initializing MEXC WebSocket client");
        // Preload listing cache for fast deduplication
        await initializeListingCache();
        await this.connect();
    }
    /**
     * Connect to MEXC WebSocket
     */
    async connect() {
        if (this.state === "connecting" || this.state === "connected") {
            log.warn("Already connecting or connected, skipping connect attempt");
            return;
        }
        this.state = "connecting";
        try {
            log.info("Connecting to MEXC WebSocket", {
                url: MEXC_WS_URL,
                attempt: this.reconnectAttempt + 1
            });
            this.ws = new WebSocket(MEXC_WS_URL);
            this.ws.on("open", () => this.handleOpen());
            this.ws.on("message", (data) => this.handleMessage(data));
            this.ws.on("error", (error) => this.handleError(error));
            this.ws.on("close", (code, reason) => this.handleClose(code, reason));
        }
        catch (error) {
            log.error("Failed to create WebSocket connection", { error });
            this.scheduleReconnect();
        }
    }
    /**
     * Handle WebSocket open event
     */
    handleOpen() {
        this.state = "connected";
        this.reconnectAttempt = 0;
        // Observability: Log connection status as gauge metric
        log.info("MEXC WebSocket connected successfully", {
            metric: "monitor_active_connections",
            value: 1,
            state: "connected",
        });
        // Subscribe to market data stream
        this.subscribe();
        // Setup ping to keep connection alive
        this.setupPing();
    }
    /**
     * Subscribe to all symbols ticker stream
     */
    subscribe() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            log.warn("Cannot subscribe: WebSocket not open");
            return;
        }
        const subscribeMsg = {
            method: "SUBSCRIPTION",
            params: ["spot@public.miniTicker.v3.api@UTC+0"],
        };
        this.ws.send(JSON.stringify(subscribeMsg));
        log.info("Subscribed to MEXC ticker stream", {
            channel: "spot@public.miniTicker.v3.api@UTC+0"
        });
    }
    /**
     * Setup periodic ping to keep connection alive
     */
    setupPing() {
        // Clear existing ping interval
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
        }
        // Send ping every 30 seconds
        this.pingInterval = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.ping();
            }
        }, 30000);
    }
    /**
     * Handle incoming WebSocket messages
     */
    async handleMessage(data) {
        try {
            const message = JSON.parse(data.toString());
            // Handle ticker updates
            if (message.c === "spot@public.miniTicker.v3.api") {
                await this.processTicker(message.d);
            }
        }
        catch (error) {
            log.error("Error handling WebSocket message", { error, data: data.toString().substring(0, 200) });
        }
    }
    /**
     * Process ticker update and detect new listings
     */
    async processTicker(ticker) {
        try {
            const symbol = ticker.s;
            const timestamp = ticker.t ? new Date(ticker.t) : new Date();
            // Detect listing
            const result = await detectListing({
                symbol,
                listedAt: timestamp,
                source: "mexc_websocket",
            });
            // Log if new listing (not duplicate)
            if (!result.duplicate) {
                log.info("New listing detected from WebSocket", {
                    symbol,
                    listingId: result.listingId,
                    price: ticker.p,
                });
            }
        }
        catch (error) {
            log.error("Error processing ticker", { error, symbol: ticker.s });
        }
    }
    /**
     * Handle WebSocket error
     */
    handleError(error) {
        log.error("WebSocket error", {
            error: error.message,
            state: this.state
        });
    }
    /**
     * Handle WebSocket close event
     */
    handleClose(code, reason) {
        this.state = "disconnected";
        // Observability: Log disconnection as gauge metric
        log.warn("WebSocket connection closed", {
            metric: "monitor_active_connections",
            value: 0,
            state: "disconnected",
            code,
            reason: reason.toString(),
            reconnectAttempt: this.reconnectAttempt
        });
        // Clear ping interval
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
        // Schedule reconnect
        this.scheduleReconnect();
    }
    /**
     * Schedule reconnection with exponential backoff
     */
    scheduleReconnect() {
        // Check if max attempts reached
        if (this.reconnectAttempt >= this.maxReconnectAttempts) {
            log.error("Max reconnection attempts reached, giving up", {
                maxAttempts: this.maxReconnectAttempts
            });
            return;
        }
        this.state = "reconnecting";
        const delay = calculateBackoffDelay(this.reconnectAttempt);
        this.reconnectAttempt++;
        // Observability: Log as metric for monitoring reconnection count
        log.info("Scheduling reconnection", {
            metric: "websocket_reconnections_total",
            attempt: this.reconnectAttempt,
            delayMs: delay,
            maxAttempts: this.maxReconnectAttempts
        });
        // Clear existing timeout
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
        }
        // Schedule reconnect
        this.reconnectTimeout = setTimeout(() => {
            this.connect();
        }, delay);
    }
    /**
     * Shutdown WebSocket connection gracefully
     */
    async shutdown() {
        log.info("Shutting down MEXC WebSocket client");
        // Clear reconnect timeout
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        // Clear ping interval
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
        // Close WebSocket
        if (this.ws) {
            this.ws.removeAllListeners();
            if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
                this.ws.close();
            }
            this.ws = null;
        }
        this.state = "disconnected";
        this.reconnectAttempt = 0;
        log.info("MEXC WebSocket client shutdown complete");
    }
    /**
     * Get current connection state
     */
    getState() {
        return this.state;
    }
    /**
     * Check if WebSocket is connected
     */
    isConnected() {
        return this.state === "connected" && this.ws?.readyState === WebSocket.OPEN;
    }
}
//# sourceMappingURL=mexcWebSocket.js.map