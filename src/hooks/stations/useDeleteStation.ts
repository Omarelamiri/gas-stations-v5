// src/hooks/stations/useDeleteStation.ts
import { useCallback, useState } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { COLLECTIONS } from '@/lib/firebase/collections';
import { invalidateStationsCache } from './useStations';

export function useDeleteStation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deleteStation = useCallback(async (stationId: string) => {
    setLoading(true);
    setError(null);
    const batch = writeBatch(db);

    try {
      // Get a reference to the station document
      const stationRef = doc(db, COLLECTIONS.STATIONS, stationId);
      
      // Delete related autorisations (these belong only to this station)
      const autorisationsSnapshot = await getDocs(
        query(collection(db, COLLECTIONS.AUTORISATIONS), where('StationID', '==', stationId))
      );
      autorisationsSnapshot.docs.forEach(d => {
        batch.delete(d.ref);
      });

      // Delete related capacites (these belong only to this station)
      const capacitesSnapshot = await getDocs(
        query(collection(db, COLLECTIONS.CAPACITES_STOCKAGE), where('StationID', '==', stationId))
      );
      capacitesSnapshot.docs.forEach(d => {
        batch.delete(d.ref);
      });

      // Delete related analyses (these belong only to this station)
      const analysesSnap = await getDocs(
        query(collection(db, COLLECTIONS.ANALYSES), where('StationID', '==', stationId))
      );
      analysesSnap.forEach(d => batch.delete(d.ref));

      batch.delete(stationRef);
      
      await batch.commit();
      invalidateStationsCache();
      
    } catch (err: any) {
      console.error('Error deleting station:', err);
      setError(`Failed to delete station: ${err.message}`);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { deleteStation, loading, error };
}