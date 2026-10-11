import { createClient, type RedisClientType } from "redis";

const globalRedis = globalThis as typeof globalThis & { doctorSiteRedis?: RedisClientType; doctorSiteMemoryCache?: Map<string, { value: string; expiresAt?: number }> };
const memory = globalRedis.doctorSiteMemoryCache || new Map<string, { value: string; expiresAt?: number }>();
if (process.env.NODE_ENV !== "production") globalRedis.doctorSiteMemoryCache = memory;

let connecting: Promise<RedisClientType | null> | null = null;

function assertFallbackAllowed() {
  if (process.env.NODE_ENV === "production" && !process.env.REDIS_URL) throw new Error("REDIS_URL is required in production");
}

export async function getRedis(): Promise<RedisClientType | null> {
  if (!process.env.REDIS_URL) return null;
  if (globalRedis.doctorSiteRedis?.isReady) return globalRedis.doctorSiteRedis;
  if (globalRedis.doctorSiteRedis?.isOpen) return globalRedis.doctorSiteRedis;
  if (!connecting) {
    connecting = (async () => {
      const client = createClient({
        url: process.env.REDIS_URL,
        socket: {
          connectTimeout: 5_000,
          reconnectStrategy: (retries) => Math.min(100 * 2 ** retries, 5_000),
        },
      });
      client.on("error", (error) => console.error("Redis error", error.message));
      try { await client.connect(); globalRedis.doctorSiteRedis = client; return client; }
      catch { return null; }
    })().finally(() => { connecting = null; });
  }
  return connecting;
}

export async function cacheGet(key: string): Promise<string | null> {
  assertFallbackAllowed();
  const redis = await getRedis();
  if (redis) return redis.get(key);
  const entry = memory.get(key);
  if (!entry || (entry.expiresAt && entry.expiresAt <= Date.now())) { memory.delete(key); return null; }
  return entry.value;
}

export async function cacheSet(key: string, value: string, ttlSeconds?: number) {
  assertFallbackAllowed();
  const redis = await getRedis();
  if (redis) { if (ttlSeconds) await redis.set(key, value, { EX: ttlSeconds }); else await redis.set(key, value); return; }
  memory.set(key, { value, expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined });
}

export async function cacheDelete(key: string) {
  assertFallbackAllowed();
  const redis = await getRedis();
  if (redis) await redis.del(key); else memory.delete(key);
}

export async function cacheIncrement(key: string, ttlSeconds: number): Promise<number> {
  assertFallbackAllowed();
  const redis = await getRedis();
  if (redis) {
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, ttlSeconds);
    return count;
  }
  const current = Number(await cacheGet(key) || 0) + 1;
  await cacheSet(key, String(current), ttlSeconds);
  return current;
}
