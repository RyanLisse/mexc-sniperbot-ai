/**
 * Market data processor with memory optimization
 * Uses TypedArrays to reduce GC pressure
 */

export type ProcessedMarketData = {
  prices: Float64Array;
  volumes: Float64Array;
  timestamps: Int32Array;
  count: number;
};

/**
 * Pre-allocated buffers for market data processing
 */
const PRICE_BUFFER_SIZE = 1000;
const priceBuffer = new Float64Array(PRICE_BUFFER_SIZE);
const volumeBuffer = new Float64Array(PRICE_BUFFER_SIZE);
const timestampBuffer = new Int32Array(PRICE_BUFFER_SIZE);

/**
 * Process market data ticks using TypedArrays
 * Reduces GC pressure by avoiding object allocations
 */
export function processMarketDataOptimized(
  ticks: Array<{
    price: number | string;
    volume: number | string;
    timestamp: number;
  }>
): ProcessedMarketData {
  const count = Math.min(ticks.length, PRICE_BUFFER_SIZE);

  for (let i = 0; i < count; i++) {
    const tick = ticks[i];
    priceBuffer[i] =
      typeof tick.price === "string"
        ? Number.parseFloat(tick.price)
        : tick.price;
    volumeBuffer[i] =
      typeof tick.volume === "string"
        ? Number.parseFloat(tick.volume)
        : tick.volume;
    timestampBuffer[i] = tick.timestamp;
  }

  return {
    prices: priceBuffer.subarray(0, count),
    volumes: volumeBuffer.subarray(0, count),
    timestamps: timestampBuffer.subarray(0, count),
    count,
  };
}

/**
 * Calculate simple moving average from processed data
 */
export function calculateSMA(
  data: ProcessedMarketData,
  period: number
): number {
  if (data.count < period) {
    return 0;
  }

  let sum = 0;
  const start = data.count - period;
  for (let i = start; i < data.count; i++) {
    sum += data.prices[i];
  }

  return sum / period;
}

/**
 * Calculate volume-weighted average price (VWAP)
 */
export function calculateVWAP(data: ProcessedMarketData): number {
  if (data.count === 0) {
    return 0;
  }

  let totalValue = 0;
  let totalVolume = 0;

  for (let i = 0; i < data.count; i++) {
    const value = data.prices[i] * data.volumes[i];
    totalValue += value;
    totalVolume += data.volumes[i];
  }

  return totalVolume > 0 ? totalValue / totalVolume : 0;
}
