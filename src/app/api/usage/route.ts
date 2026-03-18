// src/app/api/usage/route.ts
import { NextResponse } from 'next/server';
import { getApiUsage } from '@/lib/firebase/apiUsage';
import { rateLimit, rateLimitResponse } from '@/lib/rateLimit';
import { verifyAuthToken } from '@/lib/auth/serverAuth';

export async function GET(request: Request) {
  const rate = rateLimit(request, 40, 60 * 1000);
  if (!rate.allowed) return rateLimitResponse(rate.remaining, rate.resetInMs);

  const uid = await verifyAuthToken(request);
  if (!uid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const usage = await getApiUsage();
    return NextResponse.json({
      maps: usage.maps_js_api,
      routes: usage.routes_api ?? 0, // Handle old field
    });
  } catch (error) {
    console.error('Error fetching API usage:', error);
    return NextResponse.json(
      { error: 'Failed to fetch usage data' },
      { status: 500 }
    );
  }
}