import { Effect } from "effect";
import { TradingError } from "../lib/effect";
import {
  exchangeRulesCache,
  type ValidationRules,
} from "./exchange-rules-cache";

/**
 * Order validation result
 */
export type ValidationResult = {
  valid: boolean;
  errors: string[];
};

/**
 * Order validator for client-side pre-validation
 * Prevents rejected orders and saves ~100ms per trade
 */
export class OrderValidator {
  /**
   * Validate order parameters before submission
   */
  validate = (
    symbol: string,
    price: number,
    quantity: number
  ): Effect.Effect<ValidationResult, TradingError> => {
    return Effect.gen(function* () {
      // Ensure rules are loaded
      yield* exchangeRulesCache.loadRules();

      const rules = exchangeRulesCache.getRules(symbol);
      if (!rules) {
        throw new TradingError({
          message: `No validation rules found for symbol: ${symbol}`,
          code: "NO_RULES_FOUND",
          timestamp: new Date(),
        });
      }

      const errors: string[] = [];

      // Validate quantity
      if (quantity < rules.minQty) {
        errors.push(`Quantity ${quantity} is below minimum ${rules.minQty}`);
      }

      if (quantity > rules.maxQty) {
        errors.push(`Quantity ${quantity} exceeds maximum ${rules.maxQty}`);
      }

      // Validate step size
      if (rules.stepSize > 0) {
        const remainder = quantity % rules.stepSize;
        if (remainder > Number.EPSILON) {
          errors.push(
            `Quantity ${quantity} must be a multiple of step size ${rules.stepSize}`
          );
        }
      }

      // Validate notional value
      const notional = price * quantity;
      if (notional < rules.minNotional) {
        errors.push(
          `Notional value ${notional} is below minimum ${rules.minNotional}`
        );
      }

      // Validate tick size
      if (rules.tickSize > 0) {
        const remainder = price % rules.tickSize;
        if (remainder > Number.EPSILON) {
          errors.push(
            `Price ${price} must be a multiple of tick size ${rules.tickSize}`
          );
        }
      }

      // Validate symbol status
      if (rules.status !== "ENABLED") {
        errors.push(
          `Symbol ${symbol} is not enabled for trading (status: ${rules.status})`
        );
      }

      return {
        valid: errors.length === 0,
        errors,
      };
    });
  };

  /**
   * Validate order with detailed error messages
   */
  validateWithDetails = (
    symbol: string,
    price: number,
    quantity: number
  ): Effect.Effect<
    { valid: boolean; errors: string[]; rules?: ValidationRules },
    TradingError
  > =>
    Effect.gen(
      function* () {
        yield* exchangeRulesCache.loadRules();

        const rules = exchangeRulesCache.getRules(symbol);
        if (!rules) {
          throw new TradingError({
            message: `No validation rules found for symbol: ${symbol}`,
            code: "NO_RULES_FOUND",
            timestamp: new Date(),
          });
        }

        const result = yield* this.validate(symbol, price, quantity);

        return {
          ...result,
          rules,
        };
      }.bind(this)
    );

  /**
   * Check if symbol is enabled for trading
   */
  isSymbolEnabled = (symbol: string): Effect.Effect<boolean, TradingError> =>
    Effect.gen(function* () {
      yield* exchangeRulesCache.loadRules();

      const rules = exchangeRulesCache.getRules(symbol);
      return rules?.status === "ENABLED" ?? false;
    });

  /**
   * Get minimum order size for a symbol
   */
  getMinOrderSize = (symbol: string): Effect.Effect<number, TradingError> =>
    Effect.gen(function* () {
      yield* exchangeRulesCache.loadRules();

      const rules = exchangeRulesCache.getRules(symbol);
      if (!rules) {
        throw new TradingError({
          message: `No validation rules found for symbol: ${symbol}`,
          code: "NO_RULES_FOUND",
          timestamp: new Date(),
        });
      }

      return rules.minQty;
    });

  /**
   * Adjust quantity to valid step size
   */
  adjustQuantity = (
    symbol: string,
    quantity: number
  ): Effect.Effect<number, TradingError> => {
    return Effect.gen(function* () {
      yield* exchangeRulesCache.loadRules();

      const rules = exchangeRulesCache.getRules(symbol);
      if (!rules || rules.stepSize === 0) {
        return quantity;
      }

      // Round down to nearest step size
      return Math.floor(quantity / rules.stepSize) * rules.stepSize;
    });
  };

  /**
   * Adjust price to valid tick size
   */
  adjustPrice = (
    symbol: string,
    price: number
  ): Effect.Effect<number, TradingError> => {
    return Effect.gen(function* () {
      yield* exchangeRulesCache.loadRules();

      const rules = exchangeRulesCache.getRules(symbol);
      if (!rules || rules.tickSize === 0) {
        return price;
      }

      // Round down to nearest tick size
      return Math.floor(price / rules.tickSize) * rules.tickSize;
    });
  };
}

// Export singleton instance
export const orderValidator = new OrderValidator();
