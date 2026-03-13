const requestCounts = new Map<string, { count: number; resetTime: number }>();

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxRequests: 10,
  windowMs: 60 * 1000, // 1 minute
};

export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = DEFAULT_CONFIG,
): {
  allowed: boolean;
  remaining: number;
  resetTime: number;
} {
  const now = Date.now();
  const existing = requestCounts.get(identifier);

  if (!existing || now > existing.resetTime) {
    // Create new window
    const newEntry = {
      count: 1,
      resetTime: now + config.windowMs,
    };
    requestCounts.set(identifier, newEntry);

    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetTime: newEntry.resetTime,
    };
  }

  if (existing.count < config.maxRequests) {
    existing.count++;
    return {
      allowed: true,
      remaining: config.maxRequests - existing.count,
      resetTime: existing.resetTime,
    };
  }

  return {
    allowed: false,
    remaining: 0,
    resetTime: existing.resetTime,
  };
}

// Clean up old entries to prevent memory leaks
export function cleanupOldEntries(): void {
  const now = Date.now();
  for (const [key, value] of requestCounts.entries()) {
    if (now > value.resetTime) {
      requestCounts.delete(key);
    }
  }
}

// Run cleanup every 5 minutes
setInterval(cleanupOldEntries, 5 * 60 * 1000);
