import { EventEmitter } from "node:events";

export type DashboardEventType =
  | "snapshot"
  | "alert"
  | "trade"
  | "listing"
  | "heartbeat";

export type DashboardEvent<TPayload = unknown> = {
  type: DashboardEventType;
  payload?: TPayload;
  timestamp: string;
};

export type DashboardEventListener = (event: DashboardEvent) => void;

class WebSocketService {
  private readonly emitter = new EventEmitter();

  subscribe(listener: DashboardEventListener) {
    this.emitter.on("event", listener);

    return () => {
      this.emitter.off("event", listener);
    };
  }

  broadcast<TPayload>(event: Omit<DashboardEvent<TPayload>, "timestamp">) {
    const enriched: DashboardEvent<TPayload> = {
      ...event,
      timestamp: new Date().toISOString(),
    };

    this.emitter.emit("event", enriched);
    return enriched;
  }
}

export const websocketService = new WebSocketService();
