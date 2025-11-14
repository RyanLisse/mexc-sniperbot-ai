/**
 * Mock WebSocket server for testing
 * Uses jest-websocket-mock for realistic WebSocket simulation
 */

import WS from "jest-websocket-mock";

export class MockWebSocketServer {
  private server: WS | null = null;
  private readonly url: string;

  constructor(url = "ws://localhost:1234") {
    this.url = url;
  }

  /**
   * Start mock WebSocket server
   */
  start(): WS {
    if (this.server) {
      return this.server;
    }

    this.server = new WS(this.url, { jsonProtocol: true });
    return this.server;
  }

  /**
   * Stop mock WebSocket server
   */
  stop(): void {
    if (this.server) {
      WS.clean();
      this.server = null;
    }
  }

  /**
   * Send message to connected clients
   */
  send(message: unknown): void {
    if (this.server) {
      this.server.send(JSON.stringify(message));
    }
  }

  /**
   * Simulate market data update
   */
  sendMarketData(symbol: string, price: number, quantity: number): void {
    this.send({
      method: "SUBSCRIPTION",
      params: [
        `spot@public.aggre.deals.v3.api.pb@10ms@${symbol}`,
        {
          symbol,
          price: price.toString(),
          quantity: quantity.toString(),
          timestamp: Date.now(),
        },
      ],
    });
  }

  /**
   * Get server instance
   */
  getServer(): WS | null {
    return this.server;
  }
}

// Export singleton instance
export const mockWebSocketServer = new MockWebSocketServer();
