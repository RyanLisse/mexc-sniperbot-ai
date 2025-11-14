/**
 * Object pooling for frequently created structures
 * Reduces GC pressure by reusing objects instead of allocating new ones
 */

/**
 * Generic object pool
 */
export class ObjectPool<T> {
  private readonly pool: T[] = [];
  private readonly createFn: () => T;
  private readonly resetFn?: (obj: T) => void;
  private readonly maxSize: number;

  constructor(createFn: () => T, resetFn?: (obj: T) => void, maxSize = 100) {
    this.createFn = createFn;
    this.resetFn = resetFn;
    this.maxSize = maxSize;
  }

  /**
   * Acquire an object from the pool
   */
  acquire(): T {
    if (this.pool.length > 0) {
      const obj = this.pool.pop()!;
      if (this.resetFn) {
        this.resetFn(obj);
      }
      return obj;
    }
    return this.createFn();
  }

  /**
   * Release an object back to the pool
   */
  release(obj: T): void {
    if (this.pool.length < this.maxSize) {
      if (this.resetFn) {
        this.resetFn(obj);
      }
      this.pool.push(obj);
    }
  }

  /**
   * Clear the pool
   */
  clear(): void {
    this.pool.length = 0;
  }

  /**
   * Get current pool size
   */
  size(): number {
    return this.pool.length;
  }
}

/**
 * Order object pool
 */
export type OrderObject = {
  symbol: string;
  side: string;
  type: string;
  quantity: string;
  price?: string;
  timestamp: number;
};

export const orderPool = new ObjectPool<OrderObject>(
  () => ({
    symbol: "",
    side: "",
    type: "",
    quantity: "",
    price: undefined,
    timestamp: 0,
  }),
  (obj) => {
    obj.symbol = "";
    obj.side = "";
    obj.type = "";
    obj.quantity = "";
    obj.price = undefined;
    obj.timestamp = 0;
  }
);

/**
 * Trade result object pool
 */
export type TradeResultObject = {
  success: boolean;
  orderId?: string;
  symbol: string;
  strategy: string;
  quantity: string;
  executedPrice?: string;
  executedQuantity?: string;
  error?: string;
  executionTime: number;
};

export const tradeResultPool = new ObjectPool<TradeResultObject>(
  () => ({
    success: false,
    orderId: undefined,
    symbol: "",
    strategy: "",
    quantity: "",
    executedPrice: undefined,
    executedQuantity: undefined,
    error: undefined,
    executionTime: 0,
  }),
  (obj) => {
    obj.success = false;
    obj.orderId = undefined;
    obj.symbol = "";
    obj.strategy = "";
    obj.quantity = "";
    obj.executedPrice = undefined;
    obj.executedQuantity = undefined;
    obj.error = undefined;
    obj.executionTime = 0;
  }
);
