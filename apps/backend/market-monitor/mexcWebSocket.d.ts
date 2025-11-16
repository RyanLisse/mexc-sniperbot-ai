/**
 * WebSocket connection states
 */
type ConnectionState = "disconnected" | "connecting" | "connected" | "reconnecting";
/**
 * MEXC WebSocket client with automatic reconnection
 */
export declare class MEXCWebSocketClient {
    private ws;
    private state;
    private reconnectAttempt;
    private readonly maxReconnectAttempts;
    private reconnectTimeout;
    private pingInterval;
    constructor();
    /**
     * Initialize connection and cache
     */
    initialize(): Promise<void>;
    /**
     * Connect to MEXC WebSocket
     */
    private connect;
    /**
     * Handle WebSocket open event
     */
    private handleOpen;
    /**
     * Subscribe to all symbols ticker stream
     */
    private subscribe;
    /**
     * Setup periodic ping to keep connection alive
     */
    private setupPing;
    /**
     * Handle incoming WebSocket messages
     */
    private handleMessage;
    /**
     * Process ticker update and detect new listings
     */
    private processTicker;
    /**
     * Handle WebSocket error
     */
    private handleError;
    /**
     * Handle WebSocket close event
     */
    private handleClose;
    /**
     * Schedule reconnection with exponential backoff
     */
    private scheduleReconnect;
    /**
     * Shutdown WebSocket connection gracefully
     */
    shutdown(): Promise<void>;
    /**
     * Get current connection state
     */
    getState(): ConnectionState;
    /**
     * Check if WebSocket is connected
     */
    isConnected(): boolean;
}
export {};
