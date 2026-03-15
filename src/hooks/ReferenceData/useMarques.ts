import { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { Marque } from '@/types/station';
import { getReferenceData, invalidateReferenceData } from '@/lib/referenceCache';

const COLLECTIONS = {
  MARQUES: 'marques'
};

export function useMarques() {
  const [marques, setMarques] = useState<Marque[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMarques = async (forceRefresh = false) => {
    setLoading(true); // Added for consistency
    try {
      const data = await getReferenceData<Marque>(
        'marques:all',
        async () => {
          const snapshot = await getDocs(query(collection(db, COLLECTIONS.MARQUES), orderBy('Marque')));
          return snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Omit<Marque, 'id'>) } as Marque));
        },
        undefined,
        forceRefresh
      );
      setMarques(data);
    } catch (error) {
      console.error('Error fetching marques:', error);
      setMarques([]); // Set empty array on error for consistency
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMarques();
  }, []);

  return {
    marques,
    loading,
    refetch: () => fetchMarques(true),
    invalidate: () => invalidateReferenceData('marques:'),
  };
}