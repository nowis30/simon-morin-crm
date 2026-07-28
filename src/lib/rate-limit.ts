const attempts = new Map<string, { count: number; expiresAt: number }>();

export function checkRateLimit(key: string, max = 5, windowMs = 15 * 60 * 1000) {
  const now = Date.now();
  const current = attempts.get(key);

  if (!current || current.expiresAt < now) {
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