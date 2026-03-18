// src/hooks/stations/useNearbyStations.ts
import { useState, useCallback, useEffect } from 'react';
import { StationWithDetails } from '@/types/station';
import { useStations } from './useStations';
import { auth } from '@/lib/firebase/config';
import { getApiUsage, canUseApi, incrementApiUsage, QUOTAS } from '@/lib/firebase/apiUsage';

const MAX_DRIVING_KM = 20;
const MAX_DEST_PER_REQUEST = 25;
const CACHE_TTL_MS = 1000 * 60 * 5;

const distanceCache = new Map<string, { distanceKm: number; timestamp: number }>();

function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}

function getHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function computeBoundingBox(lat: number, lon: number, km: number) {
  const latDelta = km / 110.574;
  const lonDelta = km / (111.32 * Math.cos(deg2rad(lat)));
  return {
    minLat: lat - latDelta,
    maxLat: lat + latDelta,
    minLon: lon - lonDelta,
    maxLon: lon + lonDelta,
  };
}

function cacheKey(originLat: number, originLng: number, destLat: number, destLng: number): string {
  return `${originLat.toFixed(6)},${originLng.toFixed(6)}|${destLat.toFixed(6)},${destLng.toFixed(6)}`;
}

export function useNearbyStations() {
  const { stations, loading: stationsLoading, error: stationsError } = useStations();
  const [nearbyStations, setNearbyStations] = useState<(StationWithDetails & { distance: number })[]>([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyError, setNearbyError] = useState<string | null>(null);

  useEffect(() => {
    if (stationsError) {
      setNearbyError(`Erreur de chargement des stations: ${stationsError}`);
    }
  }, [stationsError]);

  const fetchNearbyStations = useCallback(
    async (latitude: number, longitude: number) => {
      if (stationsLoading || stations.length === 0) return;

      setNearbyLoading(true);
      setNearbyError(null);

      try {
        if (!isFinite(latitude) || !isFinite(longitude)) {
          throw new Error('Coordonnées invalides.');
        }
        
        const roundedLat = Number(latitude.toFixed(6));
        const roundedLng = Number(longitude.toFixed(6));

        // 1. Fast Pre-filter: Bounding Box
        const bbox = computeBoundingBox(roundedLat, roundedLng, MAX_DRIVING_KM);
        const bboxCandidates = stations.filter(s => {
          const lat = s.station.Latitude;
          const lon = s.station.Longitude;
          return lat && lon && lat >= bbox.minLat && lat <= bbox.maxLat && lon >= bbox.minLon && lon <= bbox.maxLon;
        });
        
        // 2. Accurate Pre-filter: Haversine Distance
        const haversineCandidates = bboxCandidates
          .map(s => ({
            station: s,
            haversineDistance: getHaversineDistance(roundedLat, roundedLng, s.station.Latitude!, s.station.Longitude!),
          }))
          .filter(x => x.haversineDistance <= MAX_DRIVING_KM);
        
        if (haversineCandidates.length === 0) {
          setNearbyStations([]);
          return;
        }

        // 3. Check API quota before proceeding
        const usage = await getApiUsage();
        const finalResults: (StationWithDetails & { distance: number })[] = [];
        const destinationsToFetch: typeof haversineCandidates = [];
        const now = Date.now();

        // Check cache first
        for (const candidate of haversineCandidates) {
          const key = cacheKey(roundedLat, roundedLng, candidate.station.station.Latitude!, candidate.station.station.Longitude!);
          const cached = distanceCache.get(key);

          if (cached && (now - cached.timestamp < CACHE_TTL_MS)) {
            if (cached.distanceKm <= MAX_DRIVING_KM) {
              finalResults.push({ ...candidate.station, distance: cached.distanceKm });
            }
          } else {
            destinationsToFetch.push(candidate);
          }
        }

        // 4. Calculate total requests needed (1 request per destination with Routes API)
        const totalRequests = destinationsToFetch.length;
        
        // Check if we have enough quota
        if (!canUseApi('routes_api', usage.routes_api, totalRequests)) {
          setNearbyError(
            `Quota Routes API dépassé. Limite quotidienne atteinte (${usage.routes_api}/${QUOTAS.routes_api}). Réinitialisation à minuit.`
          );
          setNearbyStations([]);
          return;
        }

        // 5. Fetch Distances for Non-Cached Stations in Chunks
        for (let i = 0; i < destinationsToFetch.length; i += MAX_DEST_PER_REQUEST) {
          const chunk = destinationsToFetch.slice(i, i + MAX_DEST_PER_REQUEST);
          
          const origin = {
            lat: roundedLat,
            lng: roundedLng
          };
          
          const destinations = chunk.map(c => ({
            lat: c.station.station.Latitude!,
            lng: c.station.station.Longitude!
          }));
          
          const url = `/api/routes`;
          const token = await auth.currentUser?.getIdToken();
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ origin, destinations })
          });
          
          if (!response.ok) {
            const errorData = await response.json();
            if (errorData.error && errorData.error.includes('Rate limit')) {
              setNearbyError(errorData.error);
              setNearbyStations([]);
              return;
            }
            throw new Error('Erreur de l\'API Routes.');
          }
          
          const data = await response.json();
          
          if (data.status !== 'OK') {
            throw new Error(`API Error: ${data.status}`);
          }
          
          // Increment usage for this chunk (1 request per destination)
          await incrementApiUsage('routes_api', chunk.length);
          
          const results: Array<{ status?: string; distance?: number }> = data.results;
          results.forEach((result, index: number) => {
            const correspondingStation = chunk[index];
            let distanceKm = Infinity;

            if (result.status === 'OK' && typeof result.distance === 'number') {
              distanceKm = result.distance / 1000; // Convert meters to km
            }
            
            // Add to cache
            const key = cacheKey(
              roundedLat, 
              roundedLng, 
              correspondingStation.station.station.Latitude!, 
              correspondingStation.station.station.Longitude!
            );
            distanceCache.set(key, { distanceKm, timestamp: Date.now() });

            // Add to results if within range
            if (distanceKm <= MAX_DRIVING_KM) {
              finalResults.push({ ...correspondingStation.station, distance: distanceKm });
            }
          });
        }
        
        // 6. Sort and Set Final State
        finalResults.sort((a, b) => a.distance - b.distance);
        setNearbyStations(finalResults);

        if (finalResults.length === 0) {
          setNearbyError(`Aucune station trouvée à moins de ${MAX_DRIVING_KM} km par la route.`);
        }

      } catch (err: unknown) {
        console.error('Erreur lors de la recherche des stations à proximité:', err);
        if (err instanceof Error) {
          setNearbyError(err.message || 'Erreur inconnue.');
        } else {
          setNearbyError('Erreur inconnue.');
        }
      } finally {
        setNearbyLoading(false);
      }
    },
    [stations, stationsLoading]
  );

  return {
    nearbyStations,
    nearbyLoading,
    nearbyError,
    fetchNearbyStations,
    stationsLoading,
    stationsError,
  };
}