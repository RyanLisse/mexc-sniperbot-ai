// Order side
export type OrderSide = "buy" | "sell";

// Order type
export type OrderType = "market" | "limit";

// Order status enum
export type OrderStatus =
  | "pending"
  | "submitted"
  | "filled"
  | "rejected"
  | "failed";

// Signal detection source
export type SignalSource = "calendar" | "ticker_diff";

// Signal confidence level
export type SignalConfidence = "high" | "medium" | "low";
