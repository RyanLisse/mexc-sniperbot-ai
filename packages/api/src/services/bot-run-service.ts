import { type BotRun, botRun, db, type NewBotRun } from "@mexc-sniperbot-ai/db";
import { and, desc, eq } from "drizzle-orm";
import type { BotStatus } from "../types/bot";

/**
 * BotRun entity queries for Encore backend
 * Manages bot lifecycle tracking
 */
export class BotRunService {
  /**
   * Create a new bot run
   */
  static async create(run: NewBotRun): Promise<BotRun> {
    const [created] = await db.insert(botRun).values(run).returning();

    if (!created) {
      throw new Error("Failed to create bot run");
    }

    return created;
  }

  /**
   * Update bot run status
   */
  static async updateStatus(
    id: string,
    status: BotStatus,
    errorMessage?: string
  ): Promise<BotRun> {
    const updates: Partial<BotRun> = {
      status,
      lastHeartbeat: new Date(),
    };

    if (status === "stopped" || status === "failed") {
      updates.stoppedAt = new Date();
    }

    if (errorMessage) {
      updates.errorMessage = errorMessage;
    }

    const [updated] = await db
      .update(botRun)
      .set(updates)
      .where(eq(botRun.id, id))
      .returning();

    if (!updated) {
      throw new Error(`Bot run not found: ${id}`);
    }

    return updated;
  }

  /**
   * Get active bot run for a configuration
   */
  static async getActive(configurationId: string): Promise<BotRun | null> {
    const [run] = await db
      .select()
      .from(botRun)
      .where(
        and(
          eq(botRun.configurationId, configurationId),
          eq(botRun.status, "running")
        )
      )
      .limit(1);

    return run || null;
  }

  /**
   * Update heartbeat timestamp
   */
  static async heartbeat(id: string): Promise<void> {
    await db
      .update(botRun)
      .set({ lastHeartbeat: new Date() })
      .where(eq(botRun.id, id));
  }

  /**
   * Get latest run for a configuration
   */
  static async getLatest(configurationId: string): Promise<BotRun | null> {
    const [run] = await db
      .select()
      .from(botRun)
      .where(eq(botRun.configurationId, configurationId))
      .orderBy(desc(botRun.startedAt))
      .limit(1);

    return run || null;
  }
}
