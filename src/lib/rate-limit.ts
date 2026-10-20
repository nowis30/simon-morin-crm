const attempts = new Map<string, { count: number; expiresAt: number }>();
let nextCleanupAt = 0;
const MAX_KEYS = 10_000;

export function checkRateLimit(key: string, max = 5, windowMs = 15 * 60 * 1000) {
  const now = Date.now();
  if (now >= nextCleanupAt || attempts.size >= MAX_KEYS) {
    for (const [entryKey, entry] of attempts) {
      if (entry.expiresAt <= now) attempts.delete(entryKey);
    }
    nextCleanupAt = now + 60_000;
  }
  const current = attempts.get(key);

  if (!current || current.expiresAt <= now) {
    if (!current && attempts.size >= MAX_KEYS) return { allowed: false, remaining: 0 };
    attempts.set(key, { count: 1, expiresAt: now + windowMs });
    return { allowed: true, remaining: max - 1 };
  }

  if (current.count >= max) {
    return { allowed: false, remaining: 0 };
  }

  current.count += 1;
  attempts.set(key, current);
  return { allowed: true, remaining: max - current.count };
}
