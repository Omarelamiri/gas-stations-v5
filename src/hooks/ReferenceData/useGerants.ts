'use client';

import { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { Gerant } from '@/types/station';
import { getReferenceData, invalidateReferenceData } from '@/lib/referenceCache';

const COLLECTIONS = {
  GERANTS: 'gerants',
};

export function useGerants() {
  const [gerants, setGerants] = useState<Gerant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGerants = async (forceRefresh = false) => {
    setLoading(true);
    try {
      const data = await getReferenceData<Gerant>(
        'gerants:all',
        async () => {
          const q = query(collection(db, COLLECTIONS.GERANTS), orderBy('NomGerant'));
          const snap = await getDocs(q);
          return snap.docs.map((doc) => {
            const data = doc.data();
            return {
              GerantID: doc.id,
              CINGerant: data.CINGerant || '',
              PrenomGerant: data.PrenomGerant || '',
              NomGerant: data.NomGerant || '',
              Telephone: data.Telephone || '',
            } as Gerant;
          });
        },
        undefined,
        forceRefresh
      );
      setGerants(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching gerants:', err);
      setError(err instanceof Error ? err.message : 'Unknown error fetching gerants');
      setGerants([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGerants();
  }, []);

  return {
    gerants,
    loading,
    error,
    refetch: () => fetchGerants(true),
    invalidate: () => invalidateReferenceData('gerants:'),
  };
}