import { Topic } from "encore.dev/pubsub";
import type { NewListing, MarketSnapshot } from "./types";

export const newListingTopic = new Topic<NewListing>("new-listing", {
  deliveryGuarantee: "at-least-once",
});

export const marketDataTopic = new Topic<MarketSnapshot>("market-data", {
  deliveryGuarantee: "at-least-once",
});
