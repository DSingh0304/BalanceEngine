import { redis } from '../config/redis.js';

const DEFAULT_TTL_MS = 5000;

export const acquireLock = async (key: string, ttlMs = DEFAULT_TTL_MS): Promise<boolean> => {
  const result = await redis.set(key, '1', 'PX', ttlMs, 'NX');
  return result === 'OK';
};

export const releaseLock = async (key: string): Promise<void> => {
  await redis.del(key);
};

export const acquireAccountLocks = async (
  accountIds: string[],
  ttlMs = DEFAULT_TTL_MS,
): Promise<string[]> => {
  const sorted = [...accountIds].sort();
  const lockKeys = sorted.map((id) => `lock:account:${id}`);

  for (const key of lockKeys) {
    const acquired = await acquireLock(key, ttlMs);
    if (!acquired) {
      for (const held of lockKeys.slice(0, lockKeys.indexOf(key))) {
        await releaseLock(held);
      }
      throw new Error(
        `Concurrency conflict: account lock unavailable (${key}). Please retry.`,
      );
    }
  }

  return lockKeys;
};

export const releaseAccountLocks = async (lockKeys: string[]): Promise<void> => {
  await Promise.all(lockKeys.map((key) => releaseLock(key)));
};
