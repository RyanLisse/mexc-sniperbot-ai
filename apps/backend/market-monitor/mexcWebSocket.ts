import log from "encore.dev/log";
import WebSocket from "ws";
import { calculateBackoffDelay } from "./backoff";
import { detectListing, initializeListingCache, type ListingSource } from "./listingDetector";

const MEXC_WS_URL = "wss://wbs.mexc.com/ws";

/**
 * MEXC ticker message structure
 */
interface MEXCTickerMessage {
  c: string; // channel
  d: {
    s: string; // symbol
    p: string; // lastPrice
    t: number; // timestamp
    [key: string]: any;
  };
}

/**
 * WebSocket connection states
 */
type ConnectionState = "disconnected" | "connecting" | "connected" | "reconnecting";

/**
 * MEXC WebSocket client with automatic reconnection
 */
export class MEXCWebSocketClient {
  private ws: WebSocket | null = null;
  private state: ConnectionState = "disconnected";
  private reconnectAttempt: number = 0;
  private readonly maxReconnectAttempts = 10;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;

  constructor() {}

  /**
   * Initialize connection and cache
   */
  async initialize(): Promise<void> {
    log.info("Initializing MEXC WebSocket client");
    
    // Preload listing cache for fast deduplication
    await initializeListingCache();
    
    await this.connect();
  }

  /**
   * Connect to MEXC WebSocket
   */
  private async connect(): Promise<void> {
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
      this.ws.on("message", (data: WebSocket.Data) => this.handleMessage(data));
      this.ws.on("error", (error) => this.handleError(error));
      this.ws.on("close", (code, reason) => this.handleClose(code, reason));
    } catch (error) {
      log.error("Failed to create WebSocket connection", { error });
      this.scheduleReconnect();
    }
  }

  /**
   * Handle WebSocket open event
   */
  private handleOpen(): void {
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
  private subscribe(): void {
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
  private setupPing(): void {
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
  private async handleMessage(data: WebSocket.Data): Promise<void> {
    try {
      const message = JSON.parse(data.toString()) as MEXCTickerMessage;

      // Handle ticker updates
      if (message.c === "spot@public.miniTicker.v3.api") {
        await this.processTicker(message.d);
      }
    } catch (error) {
      log.error("Error handling WebSocket message", { error, data: data.toString().substring(0, 200) });
    }
  }

  /**
   * Process ticker update and detect new listings
   */
  private async processTicker(ticker: any): Promise<void> {
    try {
      const symbol = ticker.s;
      const timestamp = ticker.t ? new Date(ticker.t) : new Date();

      // Detect listing
      const result = await detectListing({
        symbol,
        listedAt: timestamp,
        source: "mexc_websocket" as ListingSource,
      });

      // Log if new listing (not duplicate)
      if (!result.duplicate) {
        log.info("New listing detected from WebSocket", {
          symbol,
          listingId: result.listingId,
          price: ticker.p,
        });
      }
    } catch (error) {
      log.error("Error processing ticker", { error, symbol: ticker.s });
    }
  }

  /**
   * Handle WebSocket error
   */
  private handleError(error: Error): void {
    log.error("WebSocket error", { 
      error: error.message,
      state: this.state 
    });
  }

  /**
   * Handle WebSocket close event
   */
  private handleClose(code: number, reason: Buffer): void {
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
  private scheduleReconnect(): void {
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
  async shutdown(): Promise<void> {
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
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * Check if WebSocket is connected
   */
  isConnected(): boolean {
    return this.state === "connected" && this.ws?.readyState === WebSocket.OPEN;
  }
}
