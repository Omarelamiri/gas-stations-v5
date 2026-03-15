import { useCallback, useState } from 'react';
import { doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { Province } from '@/types/station';
import { generateUUID } from '@/utils/uuid';
import { invalidateReferenceData } from '@/lib/referenceCache';

const COLLECTIONS = {
  PROVINCES: 'provinces',
};

export function useProvinceCRUD() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createProvince = useCallback(async (data: Omit<Province, 'ProvinceID'>) => {
    setLoading(true);
    setError(null);
    try {
      const provinceId = generateUUID();
      const payload: Province = {
        ProvinceID: provinceId,
        ...data
      };
      await setDoc(doc(db, COLLECTIONS.PROVINCES, provinceId), payload);
      invalidateReferenceData('provinces:');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to create province: ${message}`);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateProvince = useCallback(async (id: string, data: Partial<Province>) => {
    setLoading(true);
    setError(null);
    try {
      const payload = { ...data };
      delete payload.ProvinceID; // Remove ID from update payload
      await updateDoc(doc(db, COLLECTIONS.PROVINCES, id), payload);
      invalidateReferenceData('provinces:');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to update province: ${message}`);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteProvince = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      await deleteDoc(doc(db, COLLECTIONS.PROVINCES, id));
      invalidateReferenceData('provinces:');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to delete province: ${message}`);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { createProvince, updateProvince, deleteProvince, loading, error };
}