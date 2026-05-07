import IORedis from "ioredis";

// =============================================================================
// Redis Connection — Shared by BullMQ Queue and Worker
// =============================================================================

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

let connection: IORedis | null = null;

export function getRedisConnection(): IORedis {
  if (!connection) {
    connection = new IORedis(REDIS_URL, {
      maxRetriesPerRequest: null, // Required by BullMQ
      enableReadyCheck: false,
    });

    connection.on("error", (err) => {
      console.error("[Redis] Connection error:", err.message);
    });

    connection.on("connect", () => {
      console.log("[Redis] Connected to", REDIS_URL);
    });
  }

  return connection;
}

export function createRedisConnection(): IORedis {
  return new IORedis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}
