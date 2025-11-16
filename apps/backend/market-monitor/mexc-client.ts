import { secret } from "encore.dev/config";
import log from "encore.dev/log";
import WebSocket from "ws";
import type { MEXCTicker, MEXCSymbolInfo, MarketSnapshot } from "./types";
import { newListingTopic, marketDataTopic } from "./pubsub";
import { BotDB } from "../db/db";

import { Effect, Schedule, pipe } from "effect";

const mexcApiKey = secret("MEXCApiKey");
const mexcSecretKey = secret("MEXCSecretKey");

const MEXC_WS_URL = "wss://wbs.mexc.com/ws";
const MEXC_REST_URL = "https://api.mexc.com/api/v3";

class MEXCClient {
  private ws: WebSocket | null = null;
  private knownSymbols = new Set<string>();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;

  async initialize() {
    await this.loadKnownSymbols();
    await this.connect();
  }

  private async loadKnownSymbols() {
    const listings = await BotDB.queryAll<{ symbol: string }>`
      SELECT symbol FROM listings
    `;
    listings.forEach(l => this.knownSymbols.add(l.symbol));
    log.info(`Loaded ${this.knownSymbols.size} known symbols`);
  }

  private async connect() {
    try {
      this.ws = new WebSocket(MEXC_WS_URL);

      this.ws.on("open", () => {
        log.info("MEXC WebSocket connected");
        this.reconnectAttempts = 0;
        this.subscribeToAllSymbols();
      });

      this.ws.on("message", async (data: Buffer) => {
        await this.handleMessage(data);
      });

      this.ws.on("error", (error) => {
        log.error("MEXC WebSocket error:", error);
      });

      this.ws.on("close", () => {
        log.warn("MEXC WebSocket closed");
        this.reconnect();
      });
    } catch (error) {
      log.error("Failed to connect to MEXC:", error);
      this.reconnect();
    }
  }

  private reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      log.error("Max reconnection attempts reached");
      return;
    }

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;

    log.info(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    setTimeout(() => this.connect(), delay);
  }

  private async subscribeToAllSymbols() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const subscribeMsg = {
      method: "SUBSCRIPTION",
      params: ["spot@public.miniTicker.v3.api@UTC+0"],
    };

    this.ws.send(JSON.stringify(subscribeMsg));
    log.info("Subscribed to all symbols ticker stream");
  }

  private async handleMessage(data: Buffer) {
    try {
      const message = JSON.parse(data.toString());

      if (message.c === "spot@public.miniTicker.v3.api") {
        const ticker = message.d as MEXCTicker;
        await this.processTicker(ticker);
      }
    } catch (error) {
      log.error("Error handling message:", error);
    }
  }

  private async processTicker(ticker: MEXCTicker) {
    const startTime = Date.now();

    if (!this.knownSymbols.has(ticker.symbol)) {
      await this.detectNewListing(ticker);
    }

    const snapshot: MarketSnapshot = {
      symbol: ticker.symbol,
      price: parseFloat(ticker.lastPrice),
      volume: ticker.volume ? parseFloat(ticker.volume) : undefined,
      bidPrice: ticker.bidPrice ? parseFloat(ticker.bidPrice) : undefined,
      askPrice: ticker.askPrice ? parseFloat(ticker.askPrice) : undefined,
      timestamp: new Date(),
    };

    await BotDB.exec`
      INSERT INTO market_data (symbol, price, volume, bid_price, ask_price, timestamp, source)
      VALUES (${snapshot.symbol}, ${snapshot.price}, ${snapshot.volume}, ${snapshot.bidPrice}, ${snapshot.askPrice}, ${snapshot.timestamp}, 'mexc')
    `;

    await marketDataTopic.publish(snapshot);

    const latency = Date.now() - startTime;
    if (latency > 100) {
      log.warn(`High latency processing ticker: ${latency}ms`);
    }
  }

  private async detectNewListing(ticker: MEXCTicker) {
    try {
      const symbolInfo = await this.fetchSymbolInfo(ticker.symbol);
      if (!symbolInfo) return;

      this.knownSymbols.add(ticker.symbol);

      const newListing = {
        symbol: ticker.symbol,
        baseCurrency: symbolInfo.baseAsset,
        quoteCurrency: symbolInfo.quoteAsset,
        firstPrice: parseFloat(ticker.lastPrice),
        listingSource: "mexc",
        metadata: { status: symbolInfo.status },
      };

      await BotDB.exec`
        INSERT INTO listings (symbol, base_currency, quote_currency, first_price, listing_source, metadata)
        VALUES (${newListing.symbol}, ${newListing.baseCurrency}, ${newListing.quoteCurrency}, ${newListing.firstPrice}, ${newListing.listingSource}, ${JSON.stringify(newListing.metadata)})
        ON CONFLICT (symbol) DO NOTHING
      `;

      await newListingTopic.publish(newListing);

      log.info(`New listing detected: ${ticker.symbol}`, newListing);
    } catch (error) {
      log.error(`Error detecting new listing for ${ticker.symbol}:`, error);
    }
  }

  private async fetchSymbolInfo(symbol: string): Promise<MEXCSymbolInfo | null> {
    try {
      const response = await fetch(`${MEXC_REST_URL}/exchangeInfo?symbol=${symbol}`);
      if (!response.ok) return null;

      const data = await response.json() as { symbols?: MEXCSymbolInfo[] };
      return data.symbols?.[0] || null;
    } catch (error) {
      log.error(`Error fetching symbol info for ${symbol}:`, error);
      return null;
    }
  }

  async shutdown() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export const mexcClient = new MEXCClient();
