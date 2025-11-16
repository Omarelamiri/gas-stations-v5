// src/app/api/route-matrix/route.ts
import { NextResponse } from 'next/server';

const MAX_DESTINATIONS = 25;
const CACHE_TTL_MS = 1000 * 60 * 5;

type CacheEntry = { data: any; timestamp: number };
const cache = (globalThis as any).__routeMatrixCache ||= new Map<string, CacheEntry>();

function cleanupCache() {
  const now = Date.now();
  for (const [key, value] of cache.entries()) {
    if (now - value.timestamp > CACHE_TTL_MS) {
      cache.delete(key);
    }
  }
}
setInterval(cleanupCache, CACHE_TTL_MS);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { origins, destinations, mode = 'DRIVE', units = 'METRIC', language = 'fr' } = body;

    if (!origins || !destinations) {
      return NextResponse.json({ error: 'Missing origins or destinations' }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Missing API key' }, { status: 400 });
    }

    const destinationCount = destinations.split('|').length;
    if (destinationCount > MAX_DESTINATIONS) {
      return NextResponse.json({ error: `Exceeds max ${MAX_DESTINATIONS} destinations.` }, { status: 400 });
    }

    const cacheKey = `${origins}|${destinations}|${mode}|${units}|${language}`;
    const cachedEntry = cache.get(cacheKey);
    const now = Date.now();

    if (cachedEntry && (now - cachedEntry.timestamp < CACHE_TTL_MS)) {
      console.log('Serving from cache:', cacheKey);
      return NextResponse.json(cachedEntry.data);
    }

    // Parse origins and destinations into correct nested format
    const [originLat, originLng] = origins.split(',').map(Number);
    const destArray = destinations.split('|').map((d: string) => {
      const [lat, lng] = d.split(',').map(Number);
      return { lat, lng };
    });

    // Build nested request body
    const requestBody = {
      origins: [
        {
          waypoint: {
            location: {
              latLng: {
                latitude: originLat,
                longitude: originLng
              }
            }
          }
        }
      ],
      destinations: destArray.map(({ lat, lng }: { lat: number; lng: number }) => ({
        waypoint: {
          location: {
            latLng: {
              latitude: lat,
              longitude: lng
            }
          }
        }
      })),
      travelMode: mode.toUpperCase(), // e.g., 'DRIVE'
      languageCode: language,
      units: units.toUpperCase() // 'METRIC' or 'IMPERIAL'
    };

    console.log('Fetching from Routes API...');
    const response = await fetch('https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'originIndex,destinationIndex,distanceMeters,duration,condition' // Optimize fields
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('API HTTP Error:', response.status, response.statusText, data);
      if (response.status === 429) {
        return NextResponse.json({ error: 'Rate limit exceeded. Try later.' }, { status: 429 });
      }
      return NextResponse.json({ error: `HTTP Error: ${response.status} - ${data.error?.message || 'Unknown'}` }, { status: response.status });
    }

    if (data) { // Routes API uses HTTP codes; data may not have 'status'
      console.log('Storing in cache:', cacheKey);
      cache.set(cacheKey, { data, timestamp: Date.now() });
    } else {
      console.error('API Error:', data.error?.message);
    }

    return NextResponse.json(data);

  } catch (error: any) {
    console.error('Routes API proxy error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}