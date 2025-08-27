﻿'use client';
import { GoogleMap, Marker, InfoWindow, useJsApiLoader } from '@react-google-maps/api';
import { useState, useEffect, useRef } from 'react';
import { GasStation } from '@/types/station'; // Changed import path

interface MapProps {
  stations: GasStation[];
}

const containerStyle = {
  width: '100%',
  height: '100%',
};

// Function to find nearest station using DistanceMatrixService
function findNearestStation(
  origin: { lat: number; lng: number },
  stations: { id: string; name: string; location: { latitude: number; longitude: number } }[],
  callback: (nearest: any) => void
) {
  if (!window.google?.maps) return;

  const service = new window.google.maps.DistanceMatrixService();

  service.getDistanceMatrix(
    {
      origins: [origin],
      destinations: stations.map(s => ({
        lat: s.location.latitude,
        lng: s.location.longitude,
      })),
      travelMode: window.google.maps.TravelMode.DRIVING,
      unitSystem: window.google.maps.UnitSystem.METRIC,
    },
    (response, status) => {
      if (status !== 'OK' || !response) {
        console.error('DistanceMatrixService error:', status);
        return;
      }

      const distances = response.rows[0].elements.map((el: any, i: number) => ({
        station: stations[i],
        distanceMeters: el.distance?.value,
        durationSeconds: el.duration?.value,
      }));

      distances.sort((a, b) => a.distanceMeters - b.distanceMeters);

      callback(distances[0]); // nearest station
    }
  );
}

export default function GasStationMap({ stations }: MapProps) {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
  });

  const [selectedStation, setSelectedStation] = useState<GasStation | null>(null);
  const [nearestStation, setNearestStation] = useState<any>(null);
  const mapRef = useRef<google.maps.Map | null>(null);

  // useEffect to adjust map zoom and center
  useEffect(() => {
    if (mapRef.current && stations.length > 0) {
      const bounds = new window.google.maps.LatLngBounds();
      stations.forEach(station => {
        bounds.extend({
          lat: station.location.latitude,
          lng: station.location.longitude,
        });
      });
      mapRef.current.fitBounds(bounds);
    }
  }, [stations]);

  const center = stations.length
    ? { lat: stations[0].location.latitude, lng: stations[0].location.longitude }
    : { lat: 34.020882, lng: -6.841650 }; // Default to Rabat, Morocco

  if (!isLoaded) return <p>Loading map...</p>;

  const handleMarkerClick = (station: GasStation) => {
    setSelectedStation(station);

    // Exclude clicked station itself when finding nearest
    const otherStations = stations.filter(s => s.id !== station.id);

    findNearestStation(
      { lat: station.location.latitude, lng: station.location.longitude },
      otherStations,
      (nearest) => {
        setNearestStation(nearest);
      }
    );
  };

  const onLoad = (mapInstance: google.maps.Map) => {
    mapRef.current = mapInstance;
  };

  return (
    <GoogleMap
      mapContainerStyle={containerStyle}
      center={center}
      zoom={12}
      onLoad={onLoad}
    >
      {stations.map(station => (
        <Marker
          key={station.id}
          position={{ lat: station.location.latitude, lng: station.location.longitude }}
          onClick={() => handleMarkerClick(station)}
        />
      ))}

      {selectedStation && (
        <InfoWindow
          position={{
            lat: selectedStation.location.latitude,
            lng: selectedStation.location.longitude,
          }}
          onCloseClick={() => {
            setSelectedStation(null);
            setNearestStation(null);
          }}
        >
          <div>
            <h3 className="font-bold">{selectedStation.name}</h3>
            <p>{selectedStation.address}</p>
            <p>{selectedStation.city}</p>
            {nearestStation && (
              <p className="mt-2 text-sm text-gray-700">
                Nearest station: {nearestStation.station.name} (~{Math.round(nearestStation.distanceMeters / 1000)} km)
              </p>
            )}
          </div>
        </InfoWindow>
      )}
    </GoogleMap>
  );
}