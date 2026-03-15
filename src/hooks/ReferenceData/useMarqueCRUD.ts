import { useCallback, useState } from 'react';
import { doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { Marque } from '@/types/station';
import { generateUUID } from '@/utils/uuid';
import { invalidateReferenceData } from '@/lib/referenceCache';

const COLLECTIONS = {
  MARQUES: 'marques',
};

export function useMarqueCRUD() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createMarque = useCallback(async (data: Omit<Marque, 'MarqueID'>) => {
    setLoading(true);
    setError(null);
    try {
      const marqueId = generateUUID();
      const payload: Marque = {
        MarqueID: marqueId,
        ...data
      };
      await setDoc(doc(db, COLLECTIONS.MARQUES, marqueId), payload);
      invalidateReferenceData('marques:');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to create marque: ${message}`);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateMarque = useCallback(async (id: string, data: Partial<Marque>) => {
    setLoading(true);
    setError(null);
    try {
      const payload = { ...data };
      delete payload.MarqueID; // Remove ID from update payload
      await updateDoc(doc(db, COLLECTIONS.MARQUES, id), payload);
      invalidateReferenceData('marques:');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to update marque: ${message}`);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteMarque = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      await deleteDoc(doc(db, COLLECTIONS.MARQUES, id));
      invalidateReferenceData('marques:');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to delete marque: ${message}`);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { createMarque, updateMarque, deleteMarque, loading, error };
}