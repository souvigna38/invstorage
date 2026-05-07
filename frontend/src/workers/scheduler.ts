import { getNightlyQueue } from "../lib/queue";

// =============================================================================
// Nightly Scan Scheduler
// =============================================================================
// Ensures the 3:00 AM cron job exists in BullMQ.
// Safe to call multiple times — uses a unique job ID to prevent duplicates.
// =============================================================================

export async function scheduleNightlyScan(): Promise<void> {
  const queue = getNightlyQueue();

  // Remove any existing repeatable job to avoid duplicates on restart
  const existingJobs = await queue.getRepeatableJobs();
  for (const job of existingJobs) {
    if (job.name === "daily-scan") {
      await queue.removeRepeatableByKey(job.key);
      console.log("[Scheduler] Removed existing daily-scan schedule");
    }
  }

  // Schedule the nightly scan at 3:00 AM every day
  await queue.add(
    "daily-scan",
    { triggeredBy: "cron", scheduledAt: new Date().toISOString() },
    {
      repeat: {
        pattern: "0 3 * * *",    // Every day at 3:00 AM
      },
      jobId: "nightly-ai-scan", // Unique ID to prevent duplicates
    }
  );

  console.log("[Scheduler] ✓ Nightly scan scheduled: 0 3 * * * (every day at 3:00 AM)");
}
