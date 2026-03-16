import { useCallback, useState } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  writeBatch,
  runTransaction,
} from 'firebase/firestore';

function cleanFirestoreData<T extends Record<string, any>>(data: T): Partial<T> {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)) as Partial<T>;
}
import { parseDateString } from '@/utils/format';
import { db } from '@/lib/firebase/config';
import {
  Station,
  Marque,
  Province,
  Commune,
  Gerant,
  Proprietaire,
  ProprietairePhysique,
  ProprietaireMorale,
  Autorisation,
  CapaciteStockage,
  StationFormData,
} from '@/types/station';
import {
  stationConverter,
  marqueConverter,
  provinceConverter,
  communeConverter,
  gerantConverter,
  proprietaireConverter,
  proprietairePhysiqueConverter,
  proprietaireMoraleConverter,
  autorisationConverter,
  capaciteConverter,
} from '@/lib/firebase/converters';
import { COLLECTIONS } from '@/lib/firebase/collections';
import { generateUUID } from '@/utils/uuid';

// Helper to atomically get the next station code (serial)
async function getNextStationCode(): Promise<number> {
  const { doc, increment } = await import('firebase/firestore');
  return await runTransaction(db, async (tx) => {
    const counterRef = doc(db, 'meta', 'counters');
    const snap = await tx.get(counterRef);
    const base = 1000;
    if (!snap.exists()) {
      const next = base + 1;
      tx.set(counterRef, { stationCode: next });
      return next;
    } else {
      const current = (snap.data() as any).stationCode ?? base;
      const next = current + 1;
      tx.update(counterRef, { stationCode: next });
      return next;
    }
  });
}

export function useCreateStation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createStation = useCallback(async (formData: StationFormData) => {
    setLoading(true);
    setError(null);
    const batch = writeBatch(db);

    try {
      // 1. Marque
      let marqueId: string;
      const marqueSnap = await getDocs(
        query(
          collection(db, COLLECTIONS.MARQUES).withConverter(marqueConverter),
          where('Marque', '==', formData.Marque.trim())
        )
      );

      if (!marqueSnap.empty) {
        marqueId = marqueSnap.docs[0].id;
        if (formData.RaisonSociale.trim()) {
          batch.update(marqueSnap.docs[0].ref, {
            RaisonSociale: formData.RaisonSociale.trim(),
          });
        }
      } else {
        marqueId = generateUUID();
        const marqueRef = doc(db, COLLECTIONS.MARQUES, marqueId).withConverter(marqueConverter);
        const marque: Marque = {
          MarqueID: marqueId,
          Marque: formData.Marque.trim(),
          RaisonSociale: formData.RaisonSociale.trim(),
        };
        batch.set(marqueRef, marque);
      }

      // 2. Province
      let provinceId: string;
      const provSnap = await getDocs(
        query(
          collection(db, COLLECTIONS.PROVINCES).withConverter(provinceConverter),
          where('NomProvince', '==', formData.Province.trim())
        )
      );

      if (!provSnap.empty) {
        provinceId = provSnap.docs[0].id;
      } else {
        provinceId = generateUUID();
        const provRef = doc(db, COLLECTIONS.PROVINCES, provinceId).withConverter(provinceConverter);
        const province: Province = {
          ProvinceID: provinceId,
          NomProvince: formData.Province.trim(),
        };
        batch.set(provRef, province);
      }

      // 3. Commune
      let communeId: string;
      const commSnap = await getDocs(
        query(
          collection(db, COLLECTIONS.COMMUNES).withConverter(communeConverter),
          where('NomCommune', '==', formData.Commune.trim()),
          where('ProvinceID', '==', provinceId)
        )
      );

      if (!commSnap.empty) {
        communeId = commSnap.docs[0].id;
      } else {
        communeId = generateUUID();
        const commRef = doc(db, COLLECTIONS.COMMUNES, communeId).withConverter(communeConverter);
        const commune: Commune = {
          CommuneID: communeId,
          NomCommune: formData.Commune.trim(),
          ProvinceID: provinceId,
        };
        batch.set(commRef, commune);
      }

      // 4. Gerant
      let gerantId: string;
      const gerantSnap = await getDocs(
        query(
          collection(db, COLLECTIONS.GERANTS).withConverter(gerantConverter),
          where('CINGerant', '==', formData.CINGerant.trim())
        )
      );

      if (!gerantSnap.empty) {
        gerantId = gerantSnap.docs[0].id;
        const gerantUpdate: Partial<Gerant> = {
          PrenomGerant: formData.PrenomGerant.trim(),
          NomGerant: formData.NomGerant.trim(),
        };
        if (formData.Telephone.trim()) {
          gerantUpdate.Telephone = formData.Telephone.trim();
        }
        batch.update(gerantSnap.docs[0].ref, cleanFirestoreData(gerantUpdate));
      } else {
        gerantId = generateUUID();
        const gerantRef = doc(db, COLLECTIONS.GERANTS, gerantId).withConverter(gerantConverter);
        const gerant: Gerant = {
          GerantID: gerantId,
          PrenomGerant: formData.PrenomGerant.trim(),
          NomGerant: formData.NomGerant.trim(),
          CINGerant: formData.CINGerant.trim(),
        };
        if (formData.Telephone.trim()) {
          gerant.Telephone = formData.Telephone.trim();
        }
        batch.set(gerantRef, cleanFirestoreData(gerant));
      }

      // 5. Proprietaire - FIXED VERSION with UUID
      let proprietaireId: string | undefined;
      const proprietaireName =
        formData.TypeProprietaire === 'Physique'
          ? formData.NomProprietaire.trim()
          : formData.NomEntreprise.trim();

      if (
        proprietaireName &&
        (formData.TypeProprietaire !== 'Physique' || formData.PrenomProprietaire.trim())
      ) {
        // Check for existing owner by searching in detail collections
        let existingPropId: string | undefined;
        
        if (formData.TypeProprietaire === 'Physique') {
          const physQuery = query(
            collection(db, COLLECTIONS.PROPRIETAIRES_PHYSIQUES).withConverter(proprietairePhysiqueConverter),
            where('NomProprietaire', '==', formData.NomProprietaire.trim()),
            where('PrenomProprietaire', '==', formData.PrenomProprietaire.trim())
          );
          const physSnap = await getDocs(physQuery);
          if (!physSnap.empty) {
            existingPropId = physSnap.docs[0].data().ProprietaireID;
          }
        } else {
          const morQuery = query(
            collection(db, COLLECTIONS.PROPRIETAIRES_MORALES).withConverter(proprietaireMoraleConverter),
            where('NomEntreprise', '==', formData.NomEntreprise.trim())
          );
          const morSnap = await getDocs(morQuery);
          if (!morSnap.empty) {
            existingPropId = morSnap.docs[0].data().ProprietaireID;
          }
        }

        if (existingPropId) {
          // Use existing ProprietaireID
          proprietaireId = existingPropId;
          console.log('Reusing existing proprietaire with ID:', proprietaireId);
        } else {
          // Create new proprietaire with UUID
          proprietaireId = generateUUID();
          
          const proprietaire: Proprietaire = {
            ProprietaireID: proprietaireId,
            TypeProprietaire: formData.TypeProprietaire,
          };
          console.log('Creating new proprietaire with ID:', proprietaireId);
          
          // Use proprietaireId as document ID
          const propRefWithId = doc(db, COLLECTIONS.PROPRIETAIRES, proprietaireId).withConverter(proprietaireConverter);
          batch.set(propRefWithId, proprietaire);

          // Create detail document with ProprietaireID field
          if (formData.TypeProprietaire === 'Physique') {
            const physRef = doc(collection(db, COLLECTIONS.PROPRIETAIRES_PHYSIQUES));
            const physique: ProprietairePhysique = {
              ProprietaireID: proprietaireId,
              NomProprietaire: formData.NomProprietaire.trim(),
              PrenomProprietaire: formData.PrenomProprietaire.trim(),
            };
            console.log('Creating proprietaire_physique with ProprietaireID:', proprietaireId);
            batch.set(physRef, physique);
          } else {
            const morRef = doc(collection(db, COLLECTIONS.PROPRIETAIRES_MORALES));
            const morale: ProprietaireMorale = {
              ProprietaireID: proprietaireId,
              NomEntreprise: formData.NomEntreprise.trim(),
            };
            console.log('Creating proprietaire_morale with ProprietaireID:', proprietaireId, 'NomEntreprise:', formData.NomEntreprise.trim());
            batch.set(morRef, morale);
          }
        }
      }

      // 6. Station with UUID
      const stationId = generateUUID();
      const stationRef = doc(db, COLLECTIONS.STATIONS, stationId).withConverter(stationConverter);
      const station: Station = {
        StationID: stationId,
        Code: await getNextStationCode(),
        Statut: formData.Statut,
        NomStation: formData.NomStation.trim(),
        Adresse: formData.Adresse.trim(),
        Latitude: formData.Latitude ? parseFloat(formData.Latitude) : 0,
        Longitude: formData.Longitude ? parseFloat(formData.Longitude) : 0,
        Type: formData.Type,
        MarqueID: marqueId,
        CommuneID: communeId,
        GerantID: gerantId,
        ProprietaireID: proprietaireId || '',
        TypeGerance: formData.TypeGerance,
        Commentaires: formData.Commentaires.trim() || '',
        NombreVolucompteur: formData.NombreVolucompteur ? parseInt(formData.NombreVolucompteur) : 0,
      };
      console.log('Creating station with StationID:', stationId, 'ProprietaireID:', proprietaireId);
      batch.set(stationRef, station);

      // 7. Autorisation with UUID
      for (const autoData of formData.autorisations) {
        if (autoData.NumeroAutorisation.trim()) {
          const autoId = generateUUID();
          const autoRef = doc(db, COLLECTIONS.AUTORISATIONS, autoId).withConverter(autorisationConverter);
          const parsedDate = autoData.DateAutorisation ? parseDateString(autoData.DateAutorisation) : null;
          const autorisation: Autorisation = {
            AutorisationID: autoId,
            StationID: stationId,
            TypeAutorisation: autoData.TypeAutorisation,
            NumeroAutorisation: autoData.NumeroAutorisation.trim(),
            DateAutorisation: parsedDate,
          };
          batch.set(autoRef, autorisation);
        }
      }

      // 8. Capacites with UUID
      if (formData.CapaciteGasoil.trim()) {
        const capId = generateUUID();
        const capRef = doc(db, COLLECTIONS.CAPACITES_STOCKAGE, capId).withConverter(capaciteConverter);
        const cap: CapaciteStockage = {
          CapaciteID: capId,
          StationID: stationId,
          TypeCarburant: 'Gasoil',
          CapaciteLitres: parseFloat(formData.CapaciteGasoil),
        };
        batch.set(capRef, cap);
      }

      if (formData.CapaciteSSP.trim()) {
        const capId = generateUUID();
        const capRef = doc(db, COLLECTIONS.CAPACITES_STOCKAGE, capId).withConverter(capaciteConverter);
        const cap: CapaciteStockage = {
          CapaciteID: capId,
          StationID: stationId,
          TypeCarburant: 'SSP',
          CapaciteLitres: parseFloat(formData.CapaciteSSP),
        };
        batch.set(capRef, cap);
      }

      console.log('Committing batch for station creation');
      await batch.commit();
      console.log('Batch committed successfully');
    } catch (err: any) {
      console.error('Error creating station:', err);
      setError(`Failed to create station: ${err.message}`);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { createStation, loading, error };
}