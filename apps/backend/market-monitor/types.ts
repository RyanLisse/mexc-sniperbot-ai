export interface NewListing {
  symbol: string;
  baseCurrency: string;
  quoteCurrency: string;
  firstPrice?: number;
  listingSource: string;
  metadata?: Record<string, unknown>;
}

export interface MarketSnapshot {
  symbol: string;
  price: number;
  volume?: number;
  bidPrice?: number;
  askPrice?: number;
  timestamp: Date;
}

export interface MEXCTicker {
  symbol: string;
  lastPrice: string;
  volume: string;
  bidPrice?: string;
  askPrice?: string;
}

export interface MEXCSymbolInfo {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  status: string;
}
