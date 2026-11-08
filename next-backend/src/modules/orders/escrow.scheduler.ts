import { EscrowService } from "./escrow.service.js";
import { logger } from "../../lib/logger.js";

export class EscrowScheduler {
  private static timer: NodeJS.Timeout | null = null;
  private static service = new EscrowService();

  /**
   * Run the escrow clearance and dispatch fallback jobs.
   */
  static async runJobs(): Promise<{ cleared: number; skipped: number; flagged: number }> {
    logger.info("escrow scheduler: running 48h clearance and dispatch fallback checks");
    const { cleared, skipped } = await this.service.processExpiredEscrows();
    const { flagged } = await this.service.flagStaleDispatchedOrders();
    return { cleared, skipped, flagged };
  }

  /**
   * Start recurring background interval (e.g. every 15 minutes).
   */
  static start(intervalMs = 15 * 60 * 1000): void {
    if (this.timer) return;
    this.timer = setInterval(async () => {
      try {
        await this.runJobs();
      } catch (err) {
        logger.error({ err }, "escrow scheduler: error in background job execution");
      }
    }, intervalMs);
    logger.info({ intervalMs }, "escrow scheduler started");
  }

  static stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.info("escrow scheduler stopped");
    }
  }
}
