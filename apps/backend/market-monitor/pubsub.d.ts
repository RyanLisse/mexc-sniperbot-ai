import { Topic } from "encore.dev/pubsub";
import type { NewListing, MarketSnapshot } from "./types";
export declare const newListingTopic: Topic<NewListing>;
export declare const marketDataTopic: Topic<MarketSnapshot>;
