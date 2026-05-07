"use server";

import { getNightlyQueue } from "@/lib/queue";

// =============================================================================
// AI Vision Actions — Server Actions for the Dashboard
// =============================================================================

// ---------------------------------------------------------------------------
// Force Run: Trigger an immediate AI scan (pushes a job to the queue)
// ---------------------------------------------------------------------------
export async function triggerImmediateScan(): Promise<{
  success: boolean;
  jobId?: string;
  error?: string;
}> {
  try {
    const queue = getNightlyQueue();

    const job = await queue.add(
      "immediate-scan",
      {
        triggeredBy: "manual",
        triggeredAt: new Date().toISOString(),
      },
      {
        priority: 1,     // Higher priority than scheduled scans
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
      }
    );

    console.log(`[AI Action] Immediate scan queued: job ${job.id}`);
    return { success: true, jobId: job.id };
  } catch (error) {
    console.error("[AI Action] Failed to queue scan:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to queue scan",
    };
  }
}

// ---------------------------------------------------------------------------
// Get Queue Status: Check how many jobs are pending/active/completed
// ---------------------------------------------------------------------------
export async function getQueueStatus(): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}> {
  try {
    const queue = getNightlyQueue();
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);
    return { waiting, active, completed, failed, delayed };
  } catch (error) {
    console.error("[AI Action] Failed to get queue status:", error);
    return { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 };
  }
}
