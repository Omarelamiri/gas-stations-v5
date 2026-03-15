import { useCallback, useState } from 'react';
import { doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { Gerant } from '@/types/station';
import { generateUUID } from '@/utils/uuid';
import { invalidateReferenceData } from '@/lib/referenceCache';

const COLLECTIONS = {
  GERANTS: 'gerants',
};

export function useGerantCRUD() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createGerant = useCallback(async (data: Omit<Gerant, 'GerantID'>) => {
    setLoading(true);
    setError(null);
    try {
      const gerantId = generateUUID();
      const payload: Gerant = {
        GerantID: gerantId,
        ...data
      };
      await setDoc(doc(db, COLLECTIONS.GERANTS, gerantId), payload);
      invalidateReferenceData('gerants:');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to create gerant: ${message}`);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateGerant = useCallback(async (id: string, data: Partial<Gerant>) => {
    setLoading(true);
    setError(null);
    try {
      const payload = { ...data };
      delete payload.GerantID; // Remove ID from update payload
      await updateDoc(doc(db, COLLECTIONS.GERANTS, id), payload);
      invalidateReferenceData('gerants:');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to update gerant: ${message}`);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteGerant = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      await deleteDoc(doc(db, COLLECTIONS.GERANTS, id));
      invalidateReferenceData('gerants:');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to delete gerant: ${message}`);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { createGerant, updateGerant, deleteGerant, loading, error };
}