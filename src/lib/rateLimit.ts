import { NextResponse } from 'next/server';

type RateEntry = { count: number; startAt: number };

const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 30; // default limit per IP per minute

// NOTE: This in-memory rate limiter is per-instance only.
// On serverless deployments (Vercel/Firebase), multiple instances
// mean users can bypass limits by hitting different instances.
// For production hardening, replace with Redis or Upstash.
const globalAny = globalThis as unknown as { __rateLimitMap?: Map<string, RateEntry> };
const requestMap = globalAny.__rateLimitMap ||= new Map<string, RateEntry>();

function getClientIp(request: Request): string {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) {
    return xff.split(',')[0].trim();
  }
  const xri = request.headers.get('x-real-ip');
  if (xri) {
    return xri.trim();
  }
  return request.headers.get('host') ?? 'unknown';
}

export function rateLimit(request: Request, limit = RATE_LIMIT_MAX_REQUESTS, windowMs = RATE_LIMIT_WINDOW_MS) {
  const ip = getClientIp(request);
  const now = Date.now();
  const entry = requestMap.get(ip);

  if (!entry || now - entry.startAt > windowMs) {
    requestMap.set(ip, { count: 1, startAt: now });
    return { allowed: true, remaining: limit - 1, resetInMs: windowMs };
  }

  if (entry.count < limit) {
    entry.count += 1;
    requestMap.set(ip, entry);
    return { allowed: true, remaining: limit - entry.count, resetInMs: windowMs - (now - entry.startAt) };
  }

  return { allowed: false, remaining: 0, resetInMs: windowMs - (now - entry.startAt) };
}

export function rateLimitResponse(remaining: number, resetInMs: number) {
  return NextResponse.json(
    { error: 'Too many requests. Try again later.' },
    {
      status: 429,
      headers: {
        'Retry-After': Math.ceil(resetInMs / 1000).toString(),
        'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS.toString(),
        'X-RateLimit-Remaining': remaining.toString(),
      },
    }
  );
}
