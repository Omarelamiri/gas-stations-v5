import { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { Province } from '@/types/station';
import { getReferenceData, invalidateReferenceData } from '@/lib/referenceCache';

const COLLECTIONS = { PROVINCES: 'provinces' };

export function useProvinces() {
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProvinces = async (forceRefresh = false) => {
    setLoading(true);
    try {
      const data = await getReferenceData<Province>(
        'provinces:all',
        async () => {
          const q = query(collection(db, COLLECTIONS.PROVINCES), orderBy('NomProvince'));
          const snap = await getDocs(q);
          return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Province) })) as Province[];
        },
        undefined,
        forceRefresh
      );
      setProvinces(data);
    } catch (e) {
      console.error('Error fetching provinces', e);
      setProvinces([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProvinces();
  }, []);

  return {
    provinces,
    loading,
    refetch: () => fetchProvinces(true),
    invalidate: () => invalidateReferenceData('provinces:'),
  };
}