/**
 * Background Email Dispatch Queue (Fix #13)
 *
 * Uses BullMQ backed by Redis (`redisForQueue`) to asynchronously dispatch emails
 * so HTTP request handlers are never blocked by external Resend API latency.
 *
 * Fallback: If Redis is unavailable or BullMQ fails, it gracefully falls back
 * to non-blocking setImmediate() background execution.
 */

import { Queue, Worker, type Job } from "bullmq";
import { redisForQueue } from "./redis.js";
import { EmailService } from "./email.js";
import { logger } from "./logger.js";

export type EmailJobData =
  | { type: "verification"; email: string; name: string; code: string }
  | { type: "password_reset"; email: string; name: string; code: string };

let emailQueue: Queue<EmailJobData> | null = null;
let emailWorker: Worker<EmailJobData> | null = null;

try {
  emailQueue = new Queue<EmailJobData>("email-dispatch", {
    connection: redisForQueue as any,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: true,
      removeOnFail: 100,
    },
  });

  emailWorker = new Worker<EmailJobData>(
    "email-dispatch",
    async (job: Job<EmailJobData>) => {
      const data = job.data;
      if (data.type === "verification") {
        await EmailService.sendVerificationCode(data.email, data.name, data.code);
      } else if (data.type === "password_reset") {
        await EmailService.sendPasswordResetCode(data.email, data.name, data.code);
      }
    },
    { connection: redisForQueue as any },
  );

  emailWorker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err }, "BullMQ: email worker job failed");
  });
} catch (err) {
  logger.warn({ err }, "BullMQ: initialization failed, will use background async fallback");
}

/**
 * Dispatches an email asynchronously without blocking the calling request.
 */
export async function dispatchEmailAsync(data: EmailJobData): Promise<void> {
  if (emailQueue) {
    try {
      await emailQueue.add(data.type, data);
      return;
    } catch (err) {
      logger.warn({ err }, "BullMQ: queue add failed, falling back to direct background dispatch");
    }
  }

  // Graceful fallback: non-blocking background dispatch
  setImmediate(async () => {
    try {
      if (data.type === "verification") {
        await EmailService.sendVerificationCode(data.email, data.name, data.code);
      } else if (data.type === "password_reset") {
        await EmailService.sendPasswordResetCode(data.email, data.name, data.code);
      }
    } catch (err) {
      logger.error({ err, to: data.email }, "Direct background email dispatch failed");
    }
  });
}
