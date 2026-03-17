// src/app/api/routes/route.ts
import { NextResponse } from 'next/server';
import { rateLimit, rateLimitResponse } from '@/lib/rateLimit';

// --- CONFIGURATION ---
const MAX_DESTINATIONS = 25;
const CACHE_TTL_MS = 1000 * 60 * 5;

type CacheEntry = { data: unknown; timestamp: number };
const cache = (globalThis as unknown as { __routesCache?: Map<string, CacheEntry> }).__routesCache ||= new Map<string, CacheEntry>();

function cleanupCache() {
  const now = Date.now();
  for (const [key, value] of cache.entries()) {
    if (now - value.timestamp > CACHE_TTL_MS) {
      cache.delete(key);
    }
  }
}

export async function POST(request: Request) {
  const rate = rateLimit(request, 20, 60 * 1000);
  if (!rate.allowed) {
    return rateLimitResponse(rate.remaining, rate.resetInMs);
  }

  try {
    cleanupCache();
    const body = (await request.json()) as { origin?: { lat: number; lng: number }; destinations?: Array<{ lat: number; lng: number }> };
    const { origin, destinations } = body;
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    if (!apiKey || !origin || !destinations || !Array.isArray(destinations)) {
      return NextResponse.json(
        { error: 'Missing API key, origin, or destinations' },
        { status: 400 }
      );
    }
    
    if (destinations.length > MAX_DESTINATIONS) {
      return NextResponse.json(
        { error: `Request exceeds the maximum of ${MAX_DESTINATIONS} destinations.` },
        { status: 400 }
      );
    }

    // Check cache first
    const cacheKey = `${origin.lat},${origin.lng}|${destinations.map(d => `${d.lat},${d.lng}`).join('|')}`;
    const cachedEntry = cache.get(cacheKey);
    const now = Date.now();

    if (cachedEntry && (now - cachedEntry.timestamp < CACHE_TTL_MS)) {
      console.log('Serving from cache:', cacheKey);
      return NextResponse.json(cachedEntry.data);
    }

    // Make API requests (one per destination)
    const results = await Promise.all(
      destinations.map(async (destination: { lat: number; lng: number }) => {
        const url = 'https://routes.googleapis.com/directions/v2:computeRoutes';
        
        const requestBody = {
          origin: {
            location: {
              latLng: {
                latitude: origin.lat,
                longitude: origin.lng
              }
            }
          },
          destination: {
            location: {
              latLng: {
                latitude: destination.lat,
                longitude: destination.lng
              }
            }
          },
          travelMode: 'DRIVE',
          routingPreference: 'TRAFFIC_AWARE',
          computeAlternativeRoutes: false,
          routeModifiers: {
            avoidTolls: false,
            avoidHighways: false,
            avoidFerries: false
          },
          languageCode: 'fr',
          units: 'METRIC'
        };

        console.log('Fetching from Routes API...');
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration'
          },
          body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error('Routes API HTTP Error:', response.status, response.statusText, errorData);
          
          if (response.status === 429) {
            return { error: 'Rate limit exceeded', status: 'OVER_QUERY_LIMIT' };
          }
          
          return { error: errorData.error?.message || 'Unknown error', status: 'ERROR' };
        }

        const data = await response.json();
        
        if (!data.routes || data.routes.length === 0) {
          return { status: 'ZERO_RESULTS' };
        }

        const route = data.routes[0];
        return {
          status: 'OK',
          distance: route.distanceMeters || 0,
          duration: route.duration || '0s'
        };
      })
    );

    const responseData = {
      status: 'OK',
      results
    };

    // Cache successful results
    console.log('Storing in cache:', cacheKey);
    cache.set(cacheKey, { data: responseData, timestamp: Date.now() });

    return NextResponse.json(responseData);

  } catch (error: unknown) {
    console.error('Routes API proxy error:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}