// src/hooks/stations/useArchiveStation.ts
import { useCallback, useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { COLLECTIONS } from '@/lib/firebase/collections';

export function useArchiveStation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changeStationStatus = useCallback(async (stationId: string, statut: string) => {
    setLoading(true);
    setError(null);

    try {
      console.log(`Setting station ${stationId} status to "${statut}"...`);
      const stationRef = doc(db, COLLECTIONS.STATIONS, stationId);
      await updateDoc(stationRef, { Statut: statut });
      console.log('✅ Station status updated successfully');
    } catch (err: any) {
      console.error('Error updating station status:', err);
      setError(`Failed to update station status: ${err?.message || String(err)}`);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const archiveStation = useCallback((stationId: string) => changeStationStatus(stationId, 'archivé'), [changeStationStatus]);
  const unarchiveStation = useCallback((stationId: string) => changeStationStatus(stationId, 'en activité'), [changeStationStatus]);

  return { archiveStation, unarchiveStation, loading, error };
}