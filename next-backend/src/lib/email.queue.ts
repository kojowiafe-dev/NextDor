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
  | { type: "welcome_customer"; email: string; customerName: string }
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
    }
  | {
      type: "delivery_confirmation";
      params: Parameters<typeof EmailService.sendDeliveryConfirmation>[0];
    }
  | {
      type: "return_request_submitted";
      params: Parameters<typeof EmailService.sendReturnRequestConfirmation>[0];
    }
  | {
      type: "refund_processed";
      params: Parameters<typeof EmailService.sendRefundProcessedNotification>[0];
    }
  | {
      type: "return_disputed";
      params: Parameters<typeof EmailService.sendReturnDisputedNotification>[0];
    }
  | {
      type: "low_stock_alert";
      params: Parameters<typeof EmailService.sendLowStockAlert>[0];
    };

async function processEmailJob(data: EmailJobData): Promise<boolean> {
  switch (data.type) {
    case "verification":
      return EmailService.sendVerificationCode(data.email, data.name, data.code);
    case "password_reset":
      return EmailService.sendPasswordResetCode(data.email, data.name, data.code);
    case "welcome_customer":
      return EmailService.sendWelcomeCustomer(data.email, data.customerName);
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
    case "delivery_confirmation":
      return EmailService.sendDeliveryConfirmation(data.params);
    case "return_request_submitted":
      return EmailService.sendReturnRequestConfirmation(data.params);
    case "refund_processed":
      return EmailService.sendRefundProcessedNotification(data.params);
    case "return_disputed":
      return EmailService.sendReturnDisputedNotification(data.params);
    case "low_stock_alert":
      return EmailService.sendLowStockAlert(data.params);
    default:
      logger.warn({ data }, "Unknown email job type received");
      return false;
  }
}

// ── In-Memory Resilient Queue Fallback ──────────────────────────────────────────
// Ensures high throughput, concurrency protection, and automatic retries even
// when Redis is not available or undergoing maintenance.
interface InMemoryJob {
  id: string;
  data: EmailJobData;
  attempts: number;
  maxAttempts: number;
}

const memoryQueue: InMemoryJob[] = [];
let activeWorkers = 0;
const MAX_CONCURRENT_MEM_WORKERS = 5;
let processedCount = 0;
let failedCount = 0;

function pumpMemoryQueue() {
  while (activeWorkers < MAX_CONCURRENT_MEM_WORKERS && memoryQueue.length > 0) {
    const job = memoryQueue.shift()!;
    activeWorkers++;

    (async () => {
      try {
        const success = await processEmailJob(job.data);
        if (success) {
          processedCount++;
        } else {
          throw new Error("Email provider returned non-success status");
        }
      } catch (err: any) {
        job.attempts++;
        if (job.attempts < job.maxAttempts) {
          const delayMs = Math.min(1000 * Math.pow(2, job.attempts), 10000);
          logger.warn(
            { jobId: job.id, type: job.data.type, attempt: job.attempts, delayMs },
            "In-memory email dispatch failed; scheduling retry"
          );
          setTimeout(() => {
            memoryQueue.push(job);
            pumpMemoryQueue();
          }, delayMs);
        } else {
          failedCount++;
          logger.error(
            { jobId: job.id, type: job.data.type, err: err?.message },
            "DEAD LETTER: In-memory email job failed all retry attempts"
          );
        }
      } finally {
        activeWorkers--;
        pumpMemoryQueue();
      }
    })();
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
      logger.warn({ err, type: data.type }, "BullMQ: queue add failed, falling back to resilient in-memory dispatch");
    }
  }

  // Resilient throttled in-memory fallback
  memoryQueue.push({
    id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    data,
    attempts: 0,
    maxAttempts: 3,
  });
  pumpMemoryQueue();
}

/**
 * Exposes telemetry metrics on email queue health and throughput.
 */
export function getEmailQueueTelemetry() {
  return {
    bullmqConnected: Boolean(emailQueue),
    memoryQueueLength: memoryQueue.length,
    activeWorkers,
    processedCount,
    failedCount,
  };
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


