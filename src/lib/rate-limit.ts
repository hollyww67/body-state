import { cacheDelete, cacheIncrement } from "./redis";

export async function checkRateLimit(key: string, limit = 5, ttlSeconds = 15 * 60): Promise<boolean> {
  return (await cacheIncrement(`rate-limit:${key}`, ttlSeconds)) <= limit;
}

export async function resetRateLimit(key: string) {
  await cacheDelete(`rate-limit:${key}`);
}
