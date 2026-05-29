interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

/**
 * Basic high-performance in-memory rate limiter for Next.js middleware and API controllers.
 * 
 * @param ip Client IP address to identify the rate-limit window context.
 * @param limit Total allowed requests within the rate limit window. Default is 5.
 * @param windowMs Duration of the rate limit window in milliseconds. Default is 60,000 (1 minute).
 */
export async function rateLimit(
  ip: string,
  limit: number = 5,
  windowMs: number = 60000
): Promise<RateLimitResult> {
  const now = Date.now();
  const clientKey = ip;

  const record = rateLimitStore.get(clientKey);

  if (!record || now > record.resetTime) {
    // Window expired or new requester window initialized
    const resetTime = now + windowMs;
    rateLimitStore.set(clientKey, { count: 1, resetTime });
    return {
      success: true,
      limit,
      remaining: limit - 1,
      reset: resetTime,
    };
  }

  // Increment incoming count
  record.count += 1;

  const success = record.count <= limit;
  const remaining = Math.max(0, limit - record.count);

  return {
    success,
    limit,
    remaining,
    reset: record.resetTime,
  };
}
