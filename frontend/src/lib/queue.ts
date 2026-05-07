import { Queue } from "bullmq";
import { getRedisConnection } from "./redis";

// =============================================================================
// BullMQ Queue — "nightlyQueue"
// =============================================================================
// The central job queue for the AI Vision background worker.
//
// Job types:
//   "daily-scan"     → Triggered by cron at 3:00 AM every day
//   "immediate-scan" → Triggered manually via "Scan Library" button
// =============================================================================

let _nightlyQueue: Queue | null = null;

export function getNightlyQueue(): Queue {
  if (!_nightlyQueue) {
    _nightlyQueue = new Queue("nightly-ai-scan", {
      connection: getRedisConnection(),
      defaultJobOptions: {
        removeOnComplete: { count: 50 },   // Keep last 50 completed jobs
        removeOnFail: { count: 100 },      // Keep last 100 failed jobs
        attempts: 3,                        // Retry up to 3 times
        backoff: {
          type: "exponential",
          delay: 5000,                      // 5s → 10s → 20s
        },
      },
    });
  }

  return _nightlyQueue;
}
