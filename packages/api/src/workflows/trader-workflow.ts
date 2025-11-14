import { api, workflow } from "encore.dev";
import { latencyTracker } from "../lib/latency-tracker";
import { orderRetry } from "../lib/order-retry";
import { logger } from "../lib/pino-logger";
import { recvWindowValidator } from "../lib/recv-window-validator";
import { safetyChecker } from "../lib/safety-checker";
import { signalValidator } from "../lib/signal-validator";
import {
  getUnprocessedSignals,
  markSignalProcessed,
} from "../services/listing-signal-service";
import { orderExecutor } from "../services/order-executor";
import { createTradeLog } from "../services/trade-log-service";
import {
  createTradeOrder,
  updateOrderStatus,
} from "../services/trade-order-service";

type TradeWorkflowParams = {
  runId: string;
  configId: string;
  config: {
    symbols: string[];
    quoteAmount: number;
    maxTradesPerHour: number;
    maxDailySpend: number;
    recvWindow: number;
    safetyEnabled: boolean;
  };
};

/**
 * Trader Workflow
 * Orchestrates: validate signal → check safety → execute order → log
 */
export const traderWorkflow = workflow("trader", {
  handler: async (params: TradeWorkflowParams) => {
    logger.info(
      {
        event: "trader_workflow_start",
        runId: params.runId,
        configId: params.configId,
      },
      "Starting trader workflow"
    );

    try {
      // Get unprocessed signals
      const signals = await getUnprocessedSignals();

      if (signals.length === 0) {
        logger.debug({ event: "no_signals" }, "No unprocessed signals");
        return { processed: 0, executed: 0, rejected: 0 };
      }

      let processed = 0;
      let executed = 0;
      let rejected = 0;

      for (const signal of signals) {
        try {
          // Only process signals for configured symbols
          if (!params.config.symbols.includes(signal.symbol)) {
            logger.debug(
              { signal: signal.symbol },
              "Signal not in config symbols"
            );
            await markSignalProcessed(signal.id);
            processed++;
            continue;
          }

          // Validate signal
          const validation = signalValidator.validate({
            symbol: signal.symbol,
            detectionSource: signal.detectionSource,
            detectedAt: signal.detectedAt,
            freshnessDeadline: signal.freshnessDeadline,
            confidence: signal.confidence,
          });

          if (!validation.isValid) {
            logger.warn(
              {
                signal: signal.symbol,
                reason: validation.reason,
              },
              "Signal validation failed"
            );
            await markSignalProcessed(signal.id);
            processed++;
            rejected++;
            continue;
          }

          // Check recvWindow
          if (
            !recvWindowValidator.isValid(
              signal.detectedAt,
              params.config.recvWindow
            )
          ) {
            logger.warn(
              {
                signal: signal.symbol,
                age: recvWindowValidator.getAge(signal.detectedAt),
                recvWindow: params.config.recvWindow,
              },
              "Signal too old for recvWindow"
            );
            await markSignalProcessed(signal.id);
            processed++;
            rejected++;
            continue;
          }

          // Safety check (if enabled)
          if (params.config.safetyEnabled) {
            const safetyCheck = await safetyChecker.check({
              runId: params.runId,
              quoteAmount: params.config.quoteAmount,
              limits: {
                maxTradesPerHour: params.config.maxTradesPerHour,
                maxDailySpend: params.config.maxDailySpend,
              },
            });

            if (!safetyCheck.canTrade) {
              logger.warn(
                {
                  signal: signal.symbol,
                  reason: safetyCheck.reason,
                },
                "Safety check failed"
              );
              await markSignalProcessed(signal.id);
              processed++;
              rejected++;
              continue;
            }
          }

          // Create trade order
          const order = await createTradeOrder({
            runId: params.runId,
            signalId: signal.id,
            symbol: signal.symbol,
            side: "buy",
            orderType: "market",
            quoteQty: params.config.quoteAmount,
            detectedAt: signal.detectedAt,
          });

          // Execute order with retry
          const orderResult = await orderRetry.execute(
            () =>
              orderExecutor.executeMarketOrder({
                symbol: signal.symbol,
                side: "BUY",
                quoteOrderQty: params.config.quoteAmount,
                recvWindow: params.config.recvWindow,
              }),
            { orderId: order.id, symbol: signal.symbol }
          );

          const submittedAt = new Date();

          // Update order status
          await updateOrderStatus({
            orderId: order.id,
            status: "filled",
            exchangeOrderId: orderResult.orderId,
            filledQty: Number.parseFloat(orderResult.executedQty),
            avgPrice:
              Number.parseFloat(orderResult.cummulativeQuoteQty) /
              Number.parseFloat(orderResult.executedQty),
            submittedAt,
            completedAt: new Date(orderResult.transactTime),
          });

          // Track latency
          const latencyMs = latencyTracker.track({
            symbol: signal.symbol,
            detectedAt: signal.detectedAt,
            submittedAt,
            orderId: order.id,
          });

          // Create trade log
          await createTradeLog({
            orderId: order.id,
            symbol: signal.symbol,
            side: "buy",
            executedQty: Number.parseFloat(orderResult.executedQty),
            executedPrice: Number.parseFloat(
              orderResult.fills[0]?.price || "0"
            ),
            quoteQty: Number.parseFloat(orderResult.cummulativeQuoteQty),
            commission: Number.parseFloat(
              orderResult.fills[0]?.commission || "0"
            ),
            commissionAsset: orderResult.fills[0]?.commissionAsset,
            exchangeResponse: orderResult as any,
            latencyMs,
          });

          // Mark signal as processed
          await markSignalProcessed(signal.id);

          processed++;
          executed++;

          logger.info(
            {
              event: "trade_executed",
              symbol: signal.symbol,
              orderId: order.id,
              exchangeOrderId: orderResult.orderId,
              latencyMs,
            },
            `Trade executed: ${signal.symbol}`
          );
        } catch (error) {
          logger.error(
            {
              event: "trade_error",
              signal: signal.symbol,
              error: error instanceof Error ? error.message : String(error),
            },
            "Trade execution error"
          );

          // Mark as processed to avoid retry loop
          await markSignalProcessed(signal.id);
          processed++;
          rejected++;
        }
      }

      logger.info(
        {
          event: "trader_workflow_complete",
          processed,
          executed,
          rejected,
        },
        `Workflow complete: ${executed} trades executed`
      );

      return { processed, executed, rejected };
    } catch (error) {
      logger.error(
        {
          event: "trader_workflow_error",
          error: error instanceof Error ? error.message : String(error),
        },
        "Workflow failed"
      );
      throw error;
    }
  },
});

/**
 * API endpoint to trigger workflow manually (for testing)
 */
export const triggerTraderWorkflow = api(
  { expose: true, method: "POST", path: "/workflows/trader/trigger" },
  async (params: TradeWorkflowParams): Promise<{ workflowId: string }> => {
    const workflowId = await traderWorkflow(params);
    return { workflowId };
  }
);
