import { Topic } from "encore.dev/pubsub";
export const newListingTopic = new Topic("new-listing", {
    deliveryGuarantee: "at-least-once",
});
export const marketDataTopic = new Topic("market-data", {
    deliveryGuarantee: "at-least-once",
});
//# sourceMappingURL=pubsub.js.map