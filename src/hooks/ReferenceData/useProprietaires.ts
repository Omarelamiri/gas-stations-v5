'use client';

import { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import {
  Proprietaire,
  ProprietairePhysique,
  ProprietaireMorale,
} from '@/types/station';
import { getReferenceData, invalidateReferenceData } from '@/lib/referenceCache';

const COLLECTIONS = {
  PROPRIETAIRES: 'proprietaires',
  PROPRIETAIRES_PHYSIQUES: 'proprietaires_physiques',
  PROPRIETAIRES_MORALES: 'proprietaires_morales',
};

export function useProprietaires() {
  const [proprietaires, setProprietaires] = useState<(Proprietaire & { details: ProprietairePhysique | ProprietaireMorale | null })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProprietaires = async (forceRefresh = false) => {
    setLoading(true);
    try {
      const proprietaireDocs = await getReferenceData<Proprietaire>(
        'proprietaires:all',
        async () => {
          const q = query(collection(db, COLLECTIONS.PROPRIETAIRES), orderBy('TypeProprietaire'));
          const snapshot = await getDocs(q);
          return snapshot.docs.map((doc) => ({
            ProprietaireID: doc.id,
            TypeProprietaire: doc.data().TypeProprietaire || 'Physique',
          } as Proprietaire));
        },
        undefined,
        forceRefresh
      );

      const [physiqueDetails, moraleDetails] = await Promise.all([
        getReferenceData<ProprietairePhysique>(
          'proprietaires_physiques:all',
          async () => {
            const q = query(collection(db, COLLECTIONS.PROPRIETAIRES_PHYSIQUES));
            const snapshot = await getDocs(q);
            return snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as ProprietairePhysique) } as ProprietairePhysique));
          },
          undefined,
          forceRefresh
        ),
        getReferenceData<ProprietaireMorale>(
          'proprietaires_morales:all',
          async () => {
            const q = query(collection(db, COLLECTIONS.PROPRIETAIRES_MORALES));
            const snapshot = await getDocs(q);
            return snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as ProprietaireMorale) } as ProprietaireMorale));
          },
          undefined,
          forceRefresh
        ),
      ]);

      const detailsByProprietaireId = new Map<string, ProprietairePhysique | ProprietaireMorale>();
      for (const d of physiqueDetails) {
        detailsByProprietaireId.set(d.ProprietaireID, d);
      }
      for (const d of moraleDetails) {
        detailsByProprietaireId.set(d.ProprietaireID, d);
      }

      const proprietaireList = proprietaireDocs.map((p) => ({
        ...p,
        details: detailsByProprietaireId.get(p.ProprietaireID) ?? null,
      }));

      setProprietaires(proprietaireList);
      setLoading(false);
      setError(null);
    } catch (err) {
      console.error('Error fetching proprietaires:', err);
      setError(err instanceof Error ? err.message : 'Unknown error fetching proprietaires');
      setProprietaires([]);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProprietaires();
  }, []);

  return {
    proprietaires,
    loading,
    error,
    refetch: () => fetchProprietaires(true),
    invalidate: () => {
      invalidateReferenceData('proprietaires:');
      invalidateReferenceData('proprietaires_physiques:');
      invalidateReferenceData('proprietaires_morales:');
    },
  };
}