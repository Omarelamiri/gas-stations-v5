"use client";

import { ReactNode, useCallback, useEffect } from 'react';
import { useJsApiLoader } from '@react-google-maps/api';
import { incrementApiUsage } from '@/lib/firebase/apiUsage';

interface MapsProviderProps {
  children: ReactNode;
}

export default function MapsProvider({ children }: MapsProviderProps) {
  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: googleMapsApiKey ?? '',
  });

  const handleLoad = useCallback(async () => {
    // Only increment once per session using sessionStorage
    if (sessionStorage.getItem('maps_incremented')) return;
    sessionStorage.setItem('maps_incremented', '1');
    try {
      await incrementApiUsage('maps_js_api');
    } catch (error) {
      console.error('Failed to increment maps usage:', error);
    }
  }, []);

  useEffect(() => {
    if (isLoaded) {
      handleLoad();
    }
  }, [isLoaded, handleLoad]);

  if (!googleMapsApiKey) {
    return <>{children}</>;
  }

  // useJsApiLoader handles script injection safely and avoids double-loading.
  if (!isLoaded) return null;

  return <>{children}</>;
}
