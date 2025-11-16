import { api, StreamOut } from "encore.dev/api";
import { Subscription } from "encore.dev/pubsub";
import log from "encore.dev/log";
import { newListingTopic, marketDataTopic } from "../market-monitor/pubsub";
import type { NewListing, MarketSnapshot } from "../market-monitor/types";

export interface DashboardEvent {
  type: "listing" | "market" | "trade" | "health";
  timestamp: Date;
  data: unknown;
}

const connectedStreams: Set<StreamOut<DashboardEvent>> = new Set();

export const dashboardStream = api.streamOut<DashboardEvent>(
  { path: "/dashboard/stream", expose: true },
  async (stream) => {
    connectedStreams.add(stream);
    log.info(`Dashboard client connected. Total: ${connectedStreams.size}`);

    try {
      await stream.send({
        type: "health",
        timestamp: new Date(),
        data: { status: "connected", clients: connectedStreams.size },
      });

      await new Promise<void>((resolve) => {
        const checkInterval = setInterval(() => {
          try {
            if (!connectedStreams.has(stream)) {
              clearInterval(checkInterval);
              resolve();
            }
          } catch {
            clearInterval(checkInterval);
            resolve();
          }
        }, 1000);
      });
    } finally {
      connectedStreams.delete(stream);
      log.info(`Dashboard client disconnected. Remaining: ${connectedStreams.size}`);
    }
  }
);

async function broadcastEvent(event: DashboardEvent) {
  const disconnected: StreamOut<DashboardEvent>[] = [];

  for (const stream of connectedStreams) {
    try {
      await stream.send(event);
    } catch (error) {
      log.error("Failed to send to client:", error);
      disconnected.push(stream);
    }
  }

  disconnected.forEach((stream) => connectedStreams.delete(stream));
}

new Subscription(newListingTopic, "broadcast-listings", {
  handler: async (listing: NewListing) => {
    await broadcastEvent({
      type: "listing",
      timestamp: new Date(),
      data: listing,
    });
  },
});

new Subscription(marketDataTopic, "broadcast-market-data", {
  handler: async (snapshot: MarketSnapshot) => {
    await broadcastEvent({
      type: "market",
      timestamp: new Date(),
      data: snapshot,
    });
  },
});
