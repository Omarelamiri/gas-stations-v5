import { useCallback, useEffect, useState } from 'react';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { Commune } from '@/types/station';
import { getReferenceData, invalidateReferenceData } from '@/lib/referenceCache';

const COLLECTIONS = {
  COMMUNES: 'communes',
};

export function useCommunes(provinceId?: string) {
  const [communes, setCommunes] = useState<Commune[]>([]);
  const [loading, setLoading] = useState(true);

  const cacheKey = provinceId ? `communes:province:${provinceId}` : 'communes:all';

  const fetchCommunes = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    try {
      const data = await getReferenceData<Commune>(
        cacheKey,
        async () => {
          const base = collection(db, COLLECTIONS.COMMUNES);
          const q = provinceId
            ? query(base, where('ProvinceID', '==', provinceId), orderBy('NomCommune'))
            : query(base, orderBy('NomCommune'));
          const snap = await getDocs(q);
          return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Commune) })) as Commune[];
        },
        undefined,
        forceRefresh
      );
      setCommunes(data);
    } catch (e: unknown) {
      console.error('Error fetching communes', e);
      setCommunes([]);
    } finally {
      setLoading(false);
    }
  }, [cacheKey, provinceId]);

  useEffect(() => {
    fetchCommunes();
  }, [fetchCommunes]);

  return {
    communes,
    loading,
    refetch: () => fetchCommunes(true),
    invalidate: () => invalidateReferenceData('communes:'),
  };
}