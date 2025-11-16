export interface DashboardEvent {
    type: "listing" | "market" | "trade" | "health";
    timestamp: Date;
    data: unknown;
}
export declare const dashboardStream: any;
