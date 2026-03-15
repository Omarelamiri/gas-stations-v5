"use client";

import { ReactNode, useRef, useCallback } from 'react';
import { LoadScript } from '@react-google-maps/api';
import { incrementApiUsage } from '@/lib/firebase/apiUsage';

interface MapsProviderProps {
  children: ReactNode;
}

export default function MapsProvider({ children }: MapsProviderProps) {
  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const incrementedRef = useRef(false);

  const handleLoad = useCallback(async () => {
    if (incrementedRef.current) return;
    incrementedRef.current = true;

    try {
      await incrementApiUsage('maps_js_api');
    } catch (error) {
      console.error('Failed to increment maps usage from MapsProvider:', error);
    }
  }, []);

  if (!googleMapsApiKey) {
    return <>{children}</>;
  }

  return (
    <LoadScript googleMapsApiKey={googleMapsApiKey} onLoad={handleLoad}>
      {children}
    </LoadScript>
  );
}
