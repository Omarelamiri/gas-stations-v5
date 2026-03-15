// Revised src/hooks/ReferenceData/useProprietaireCRUD.ts

import { useCallback, useState } from 'react';
import {
  collection,
  doc,
  writeBatch,
  query,
  where,
  getDocs,
  getDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { invalidateReferenceData } from '@/lib/referenceCache';
import {
  Proprietaire,
  ProprietairePhysique,
  ProprietaireMorale,
} from '@/types/station';
import { generateUUID } from '@/utils/uuid';

const COLLECTIONS = {
  PROPRIETAIRES: 'proprietaires',
  PROPRIETAIRES_PHYSIQUES: 'proprietaires_physiques',
  PROPRIETAIRES_MORALES: 'proprietaires_morales',
};

export function useProprietaireCRUD() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createProprietaire = useCallback(async (data: {
    TypeProprietaire: 'Physique' | 'Morale';
    NomProprietaire?: string;
    PrenomProprietaire?: string;
    NomEntreprise?: string;
  }) => {
    setLoading(true);
    setError(null);
    const batch = writeBatch(db);
    try {
      const proprietaireId = generateUUID();
      const proprietaireRef = doc(db, COLLECTIONS.PROPRIETAIRES, proprietaireId);
      const proprietaire: Proprietaire = {
        ProprietaireID: proprietaireId,
        TypeProprietaire: data.TypeProprietaire,
      };
      batch.set(proprietaireRef, { ...proprietaire, updatedAt: serverTimestamp() });

      if (data.TypeProprietaire === 'Physique' && data.NomProprietaire && data.PrenomProprietaire) {
        const physiqueId = generateUUID();
        const physiqueRef = doc(db, COLLECTIONS.PROPRIETAIRES_PHYSIQUES, physiqueId);
        const physique: ProprietairePhysique = {
          ProprietaireID: proprietaireId,
          NomProprietaire: data.NomProprietaire,
          PrenomProprietaire: data.PrenomProprietaire,
        };
        batch.set(physiqueRef, physique);
      } else if (data.TypeProprietaire === 'Morale' && data.NomEntreprise) {
        const moraleId = generateUUID();
        const moraleRef = doc(db, COLLECTIONS.PROPRIETAIRES_MORALES, moraleId);
        const morale: ProprietaireMorale = {
          ProprietaireID: proprietaireId,
          NomEntreprise: data.NomEntreprise,
        };
        batch.set(moraleRef, morale);
      }

      await batch.commit();
      invalidateReferenceData('proprietaires:');
      invalidateReferenceData('proprietaires_physiques:');
      invalidateReferenceData('proprietaires_morales:');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to create proprietaire: ${message}`);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateProprietaire = useCallback(async (
    id: string,
    data: {
      TypeProprietaire: 'Physique' | 'Morale';
      NomProprietaire?: string;
      PrenomProprietaire?: string;
      NomEntreprise?: string;
    },
  ) => {
    setLoading(true);
    setError(null);
    const batch = writeBatch(db);
    try {
      const proprietaireRef = doc(db, COLLECTIONS.PROPRIETAIRES, id);
      const proprietaireSnap = await getDoc(proprietaireRef);
      const oldType = proprietaireSnap.data()?.TypeProprietaire;

      batch.update(proprietaireRef, { TypeProprietaire: data.TypeProprietaire, updatedAt: serverTimestamp() });

      // Delete old details if type changed
      if (oldType && oldType !== data.TypeProprietaire) {
        if (oldType === 'Physique') {
          const physiqueSnapshot = await getDocs(
            query(collection(db, COLLECTIONS.PROPRIETAIRES_PHYSIQUES), where('ProprietaireID', '==', id)),
          );
          physiqueSnapshot.docs.forEach(d => batch.delete(d.ref));
        } else if (oldType === 'Morale') {
          const moraleSnapshot = await getDocs(
            query(collection(db, COLLECTIONS.PROPRIETAIRES_MORALES), where('ProprietaireID', '==', id)),
          );
          moraleSnapshot.docs.forEach(d => batch.delete(d.ref));
        }
      }

      if (data.TypeProprietaire === 'Physique' && data.NomProprietaire && data.PrenomProprietaire) {
        const physiqueSnapshot = await getDocs(
          query(collection(db, COLLECTIONS.PROPRIETAIRES_PHYSIQUES), where('ProprietaireID', '==', id)),
        );
        if (!physiqueSnapshot.empty) {
          batch.update(physiqueSnapshot.docs[0].ref, { 
            NomProprietaire: data.NomProprietaire,
            PrenomProprietaire: data.PrenomProprietaire
          });
        } else {
          const physiqueId = generateUUID();
          const physiqueRef = doc(db, COLLECTIONS.PROPRIETAIRES_PHYSIQUES, physiqueId);
          const physique: ProprietairePhysique = {
            ProprietaireID: id,
            NomProprietaire: data.NomProprietaire,
            PrenomProprietaire: data.PrenomProprietaire,
          };
          batch.set(physiqueRef, physique);
        }
      } else if (data.TypeProprietaire === 'Morale' && data.NomEntreprise) {
        const moraleSnapshot = await getDocs(
          query(collection(db, COLLECTIONS.PROPRIETAIRES_MORALES), where('ProprietaireID', '==', id)),
        );
        if (!moraleSnapshot.empty) {
          batch.update(moraleSnapshot.docs[0].ref, { NomEntreprise: data.NomEntreprise });
        } else {
          const moraleId = generateUUID();
          const moraleRef = doc(db, COLLECTIONS.PROPRIETAIRES_MORALES, moraleId);
          const morale: ProprietaireMorale = {
            ProprietaireID: id,
            NomEntreprise: data.NomEntreprise,
          };
          batch.set(moraleRef, morale);
        }
      }

      await batch.commit();
      invalidateReferenceData('proprietaires:');
      invalidateReferenceData('proprietaires_physiques:');
      invalidateReferenceData('proprietaires_morales:');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to update proprietaire: ${message}`);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteProprietaire = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    const batch = writeBatch(db);
    try {
      batch.delete(doc(db, COLLECTIONS.PROPRIETAIRES, id));

      const physiqueSnapshot = await getDocs(
        query(collection(db, COLLECTIONS.PROPRIETAIRES_PHYSIQUES), where('ProprietaireID', '==', id)),
      );
      physiqueSnapshot.docs.forEach(d => batch.delete(d.ref));

      const moraleSnapshot = await getDocs(
        query(collection(db, COLLECTIONS.PROPRIETAIRES_MORALES), where('ProprietaireID', '==', id)),
      );
      moraleSnapshot.docs.forEach(d => batch.delete(d.ref));

      await batch.commit();
      invalidateReferenceData('proprietaires:');
      invalidateReferenceData('proprietaires_physiques:');
      invalidateReferenceData('proprietaires_morales:');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to delete proprietaire: ${message}`);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { createProprietaire, updateProprietaire, deleteProprietaire, loading, error };
}