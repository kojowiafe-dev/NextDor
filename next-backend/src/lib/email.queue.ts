/**
 * Background Email Dispatch Queue (Fix #13 & Sprint 2)
 *
 * Uses BullMQ backed by Redis (`redisForQueue`) to asynchronously dispatch emails
 * so HTTP request handlers are never blocked by external Resend API latency.
 *
 * Supports all transactional email flows:
 * - verification
 * - password_reset
 * - order_confirmation
 * - vendor_new_order
 * - payment_receipt
 * - order_status_update
 * - package_ready
 *
 * Fallback: If Redis is unavailable or BullMQ fails, it gracefully falls back
 * to non-blocking setImmediate() background execution with retry logging.
 */

import { Queue, Worker, type Job } from "bullmq";
import { redisForQueue } from "./redis.js";
import { EmailService } from "./email.js";
import { logger } from "./logger.js";

export type EmailJobData =
  | { type: "verification"; email: string; name: string; code: string }
  | { type: "password_reset"; email: string; name: string; code: string }
  | {
      type: "order_confirmation";
      params: Parameters<typeof EmailService.sendOrderConfirmation>[0];
    }
  | {
      type: "vendor_new_order";
      params: Parameters<typeof EmailService.sendVendorNewOrderNotification>[0];
    }
  | {
      type: "payment_receipt";
      params: Parameters<typeof EmailService.sendPaymentReceipt>[0];
    }
  | {
      type: "order_status_update";
      params: Parameters<typeof EmailService.sendOrderStatusUpdate>[0];
    }
  | {
      type: "package_ready";
      params: Parameters<typeof EmailService.sendPackageReadyNotification>[0];
    };

async function processEmailJob(data: EmailJobData): Promise<boolean> {
  switch (data.type) {
    case "verification":
      return EmailService.sendVerificationCode(data.email, data.name, data.code);
    case "password_reset":
      return EmailService.sendPasswordResetCode(data.email, data.name, data.code);
    case "order_confirmation":
      return EmailService.sendOrderConfirmation(data.params);
    case "vendor_new_order":
      return EmailService.sendVendorNewOrderNotification(data.params);
    case "payment_receipt":
      return EmailService.sendPaymentReceipt(data.params);
    case "order_status_update":
      return EmailService.sendOrderStatusUpdate(data.params);
    case "package_ready":
      return EmailService.sendPackageReadyNotification(data.params);
    default:
      logger.warn({ data }, "Unknown email job type received");
      return false;
  }
}

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
      await processEmailJob(job.data);
    },
    { connection: redisForQueue as any }
  );

  emailWorker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, type: job?.data?.type, err }, "BullMQ: email worker job failed");
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
      logger.warn({ err, type: data.type }, "BullMQ: queue add failed, falling back to direct background dispatch");
    }
  }

  // Graceful fallback: non-blocking background dispatch
  setImmediate(async () => {
    try {
      await processEmailJob(data);
    } catch (err) {
      logger.error({ err, type: data.type }, "Direct background email dispatch failed");
    }
  });
}

/**
 * Gracefully shuts down the BullMQ email worker and queue.
 */
export async function closeEmailQueue(): Promise<void> {
  try {
    if (emailWorker) {
      await emailWorker.close();
    }
    if (emailQueue) {
      await emailQueue.close();
    }
  } catch (err) {
    logger.warn({ err }, "Error while closing email worker or queue");
  }
}

