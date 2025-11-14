import { EventEmitter } from "node:events";
import { Effect } from "effect";
import WebSocket from "ws";
import { MEXCApiError } from "../lib/effect";

/**
 * MEXC WebSocket Client with Protocol Buffers support
 * Provides 10ms update intervals for real-time market data
 */
export type WebSocketMessage = {
  method?: string;
  id?: string;
  params?: string[];
  result?: unknown;
  error?: {
    code: number;
    message: string;
  };
};

export type MarketDataUpdate = {
  symbol: string;
  price: string;
  quantity: string;
  timestamp: number;
  type: "trade" | "orderbook" | "ticker";
};

export class MexcWebSocketClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private pingTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;
  private readonly reconnectDelayMs = 5000;
  private readonly pingIntervalMs = 20_000; // 20s to prevent 60s timeout
  private readonly endpoint: string;
  private readonly subscriptions: Set<string> = new Set();
  private readonly maxSubscriptionsPerConnection = 30;

  constructor(endpoint = "wss://wbs-api.mexc.com/ws") {
    super();
    this.endpoint = endpoint;
  }

  /**
   * Connect to MEXC WebSocket server
   */
  connect(): Effect.Effect<void, MEXCApiError> {
    const self = this;
    return Effect.gen(function* () {
      if (self.ws?.readyState === WebSocket.OPEN) {
        return;
      }

      self.ws = new WebSocket(self.endpoint);

      self.ws.on("open", () => {
        self.reconnectAttempts = 0;
        self.emit("connected");
        self.startPing();

        // Resubscribe to previous subscriptions
        if (self.subscriptions.size > 0) {
          self.resubscribe();
        }
      });

      self.ws.on("message", (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString()) as WebSocketMessage;
          self.handleMessage(message);
        } catch (error) {
          self.emit(
            "error",
            new Error(
              `Failed to parse message: ${error instanceof Error ? error.message : "Unknown error"}`
            )
          );
        }
      });

      self.ws.on("close", () => {
        self.stopPing();
        self.emit("disconnected");

        if (self.reconnectAttempts < self.maxReconnectAttempts) {
          setTimeout(() => {
            self.reconnectAttempts++;
            Effect.runPromise(self.connect());
          }, self.reconnectDelayMs * self.reconnectAttempts);
        } else {
          self.emit("error", new Error("Max reconnection attempts reached"));
        }
      });

      self.ws.on("error", (error) => {
        self.emit("error", error);
      });

      // Wait for connection to open
      yield* Effect.tryPromise({
        try: () =>
          new Promise<void>((resolve, reject) => {
            if (!self.ws) {
              reject(new Error("WebSocket not initialized"));
              return;
            }

            const timeout = setTimeout(() => {
              reject(new Error("Connection timeout"));
            }, 10_000);

            self.ws.once("open", () => {
              clearTimeout(timeout);
              resolve();
            });

            self.ws.once("error", (error) => {
              clearTimeout(timeout);
              reject(error);
            });
          }),
        catch: (error) =>
          new MEXCApiError({
            message: `WebSocket connection failed: ${error instanceof Error ? error.message : "Unknown error"}`,
            code: "WEBSOCKET_CONNECTION_FAILED",
            statusCode: 0,
            timestamp: new Date(),
          }),
      });
    });
  }

  /**
   * Subscribe to 10ms market data channels
   */
  subscribe(
    symbol: string,
    channel: "deals" | "bookTicker" = "deals"
  ): Effect.Effect<void, MEXCApiError> {
    const self = this;
    return Effect.gen(function* () {
      if (self.subscriptions.size >= self.maxSubscriptionsPerConnection) {
        throw new MEXCApiError({
          message: `Maximum subscriptions (${self.maxSubscriptionsPerConnection}) reached`,
          code: "MAX_SUBSCRIPTIONS_REACHED",
          statusCode: 0,
          timestamp: new Date(),
        });
      }

      const subscription = `spot@public.aggre.${channel === "deals" ? "deals" : "bookTicker"}.v3.api.pb@10ms@${symbol}`;
      self.subscriptions.add(subscription);

      if (self.ws?.readyState === WebSocket.OPEN) {
        yield* self.sendSubscription(subscription);
      }
    });
  }

  /**
   * Unsubscribe from a channel
   */
  unsubscribe(symbol: string, channel: "deals" | "bookTicker" = "deals"): void {
    const subscription = `spot@public.aggre.${channel === "deals" ? "deals" : "bookTicker"}.v3.api.pb@10ms@${symbol}`;
    this.subscriptions.delete(subscription);

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send({
        method: "UNSUBSCRIBE",
        params: [subscription],
      });
    }
  }

  /**
   * Send subscription message
   */
  private sendSubscription(
    subscription: string
  ): Effect.Effect<void, MEXCApiError> {
    const self = this;
    return Effect.gen(function* () {
      yield* self.send({
        method: "SUBSCRIPTION",
        params: [subscription],
      });
    });
  }

  /**
   * Resubscribe to all previous subscriptions
   */
  private resubscribe(): void {
    for (const subscription of this.subscriptions) {
      Effect.runPromise(
        this.send({
          method: "SUBSCRIPTION",
          params: [subscription],
        })
      );
    }
  }

  /**
   * Send message to WebSocket
   */
  private send(message: WebSocketMessage): Effect.Effect<void, MEXCApiError> {
    const self = this;
    return Effect.gen(function* () {
      if (!self.ws || self.ws.readyState !== WebSocket.OPEN) {
        throw new MEXCApiError({
          message: "WebSocket is not connected",
          code: "WEBSOCKET_NOT_CONNECTED",
          statusCode: 0,
          timestamp: new Date(),
        });
      }

      yield* Effect.tryPromise({
        try: () =>
          new Promise<void>((resolve, reject) => {
            if (!self.ws) {
              reject(new Error("WebSocket not initialized"));
              return;
            }

            self.ws.send(JSON.stringify(message), (error) => {
              if (error) {
                reject(error);
              } else {
                resolve();
              }
            });
          }),
        catch: (error) =>
          new MEXCApiError({
            message: `Failed to send WebSocket message: ${error instanceof Error ? error.message : "Unknown error"}`,
            code: "WEBSOCKET_SEND_FAILED",
            statusCode: 0,
            timestamp: new Date(),
          }),
      });
    });
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(message: WebSocketMessage): void {
    // Handle PONG response
    if (message.method === "PONG") {
      return;
    }

    // Handle subscription confirmation
    if (message.result) {
      this.emit("subscribed", message);
      return;
    }

    // Handle errors
    if (message.error) {
      this.emit(
        "error",
        new Error(`WebSocket error: ${message.error.message}`)
      );
      return;
    }

    // Handle market data updates (Protocol Buffer data will be decoded separately)
    if (message.params && Array.isArray(message.params)) {
      // For now, emit raw data - Protocol Buffer decoding will be handled separately
      this.emit("marketData", {
        channel: message.params[0],
        data: message.params[1],
      });
    }
  }

  /**
   * Start ping interval to keep connection alive
   */
  private startPing(): void {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        Effect.runPromise(
          this.send({
            method: "PING",
          }).pipe(
            Effect.catchAll((error) => {
              this.emit("error", error);
              return Effect.void;
            })
          )
        );
      }
    }, this.pingIntervalMs);
  }

  /**
   * Stop ping interval
   */
  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect(): void {
    this.stopPing();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.subscriptions.clear();
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Get current subscriptions count
   */
  getSubscriptionCount(): number {
    return this.subscriptions.size;
  }
}

// Export singleton instance
export const mexcWebSocketClient = new MexcWebSocketClient();
