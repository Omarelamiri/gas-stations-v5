'use client';
import { useState, useCallback } from 'react';
import {
  doc,
  getDoc,
  getDocs,
  writeBatch,
  collection,
  query,
  where,
} from 'firebase/firestore';

function cleanFirestoreData<T extends Record<string, any>>(data: T): Partial<T> {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)) as Partial<T>;
}
import { db } from '@/lib/firebase/config';
import { COLLECTIONS } from '@/lib/firebase/collections';
import {
  Marque,
  Commune,
  Province,
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
  communeConverter,
  provinceConverter,
  gerantConverter,
  proprietaireConverter,
  proprietairePhysiqueConverter,
  proprietaireMoraleConverter,
  autorisationConverter,
  capaciteConverter,
} from '@/lib/firebase/converters';
import { parseDateString } from '@/utils/format';
import { generateUUID } from '@/utils/uuid';

export function useUpdateStation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateStation = useCallback(async (stationId: string, formData: StationFormData) => {
    setLoading(true);
    setError(null);
    const batch = writeBatch(db);

    try {
      // Fetch current station to get existing ProprietaireID
      const stationRef = doc(db, COLLECTIONS.STATIONS, stationId).withConverter(stationConverter);
      const stationSnap = await getDoc(stationRef);
      if (!stationSnap.exists()) {
        throw new Error('Station not found');
      }
      const currentStation = stationSnap.data();
      const oldProprietaireId = currentStation?.ProprietaireID || '';
      
      // Check if StationID field is missing and add it if needed
      const needsStationIdFix = !currentStation?.StationID;
      const stationIdToUse = currentStation?.StationID || generateUUID();

      /** -------------------------------
       * 1. Update Marque
       * ------------------------------ */
      let marqueId: string;
      const marqueQuery = query(
        collection(db, COLLECTIONS.MARQUES).withConverter(marqueConverter),
        where('Marque', '==', formData.Marque.trim())
      );
      const marqueSnap = await getDocs(marqueQuery);

      if (!marqueSnap.empty) {
        marqueId = marqueSnap.docs[0].id;
        batch.update(marqueSnap.docs[0].ref, {
          RaisonSociale: formData.RaisonSociale.trim(),
        });
      } else {
        marqueId = generateUUID();
        const newRef = doc(db, COLLECTIONS.MARQUES, marqueId).withConverter(marqueConverter);
        const newMarque: Marque = {
          MarqueID: marqueId,
          Marque: formData.Marque.trim(),
          RaisonSociale: formData.RaisonSociale.trim(),
        };
        batch.set(newRef, newMarque);
      }

      /** -------------------------------
       * 2. Update Province & Commune
       * ------------------------------ */
      let provinceId: string;
      const provinceQuery = query(
        collection(db, COLLECTIONS.PROVINCES).withConverter(provinceConverter),
        where('NomProvince', '==', formData.Province.trim())
      );
      const provinceSnap = await getDocs(provinceQuery);

      if (!provinceSnap.empty) {
        provinceId = provinceSnap.docs[0].id;
      } else {
        provinceId = generateUUID();
        const newRef = doc(db, COLLECTIONS.PROVINCES, provinceId).withConverter(provinceConverter);
        const newProvince: Province = {
          ProvinceID: provinceId,
          NomProvince: formData.Province.trim(),
        };
        batch.set(newRef, newProvince);
      }

      let communeId: string;
      const communeQuery = query(
        collection(db, COLLECTIONS.COMMUNES).withConverter(communeConverter),
        where('NomCommune', '==', formData.Commune.trim()),
        where('ProvinceID', '==', provinceId)
      );
      const communeSnap = await getDocs(communeQuery);

      if (!communeSnap.empty) {
        communeId = communeSnap.docs[0].id;
      } else {
        communeId = generateUUID();
        const newRef = doc(db, COLLECTIONS.COMMUNES, communeId).withConverter(communeConverter);
        const newCommune: Commune = {
          CommuneID: communeId,
          NomCommune: formData.Commune.trim(),
          ProvinceID: provinceId,
        };
        batch.set(newRef, newCommune);
      }

      /** -------------------------------
       * 3. Update Gérant
       * ------------------------------ */
      let gerantId: string;
      const gerantQuery = query(
        collection(db, COLLECTIONS.GERANTS).withConverter(gerantConverter),
        where('CINGerant', '==', formData.CINGerant.trim())
      );
      const gerantSnap = await getDocs(gerantQuery);

      if (!gerantSnap.empty) {
        gerantId = gerantSnap.docs[0].id;
        const gerantUpdate: Partial<Gerant> = {
          NomGerant: formData.NomGerant.trim(),
          PrenomGerant: formData.PrenomGerant.trim(),
        };
        if (formData.Telephone.trim()) {
          gerantUpdate.Telephone = formData.Telephone.trim();
        }
        batch.update(gerantSnap.docs[0].ref, cleanFirestoreData(gerantUpdate));
      } else {
        gerantId = generateUUID();
        const newRef = doc(db, COLLECTIONS.GERANTS, gerantId).withConverter(gerantConverter);
        const newGerant: Gerant = {
          GerantID: gerantId,
          NomGerant: formData.NomGerant.trim(),
          PrenomGerant: formData.PrenomGerant.trim(),
          CINGerant: formData.CINGerant.trim(),
        };
        if (formData.Telephone.trim()) {
          newGerant.Telephone = formData.Telephone.trim();
        }
        batch.set(newRef, cleanFirestoreData(newGerant));
      }

      /** -------------------------------
       * 4. Update Proprietaire - FIXED VERSION
       * ------------------------------ */
      let proprietaireId: string | undefined;
      const proprietaireName =
        formData.TypeProprietaire === 'Physique'
          ? formData.NomProprietaire.trim()
          : formData.NomEntreprise.trim();

      if (!proprietaireName) {
        // Unlink owner if no name provided
        proprietaireId = '';
        // Delete old owner details if they exist
        if (oldProprietaireId) {
          const oldPropRef = doc(db, COLLECTIONS.PROPRIETAIRES, oldProprietaireId).withConverter(proprietaireConverter);
          const oldPropSnap = await getDoc(oldPropRef);
          if (oldPropSnap.exists()) {
            const oldType = oldPropSnap.data().TypeProprietaire;
            const oldDetailsCollection = oldType === 'Physique' ? COLLECTIONS.PROPRIETAIRES_PHYSIQUES : COLLECTIONS.PROPRIETAIRES_MORALES;
            const oldDetailsQuery = query(
              collection(db, oldDetailsCollection),
              where('ProprietaireID', '==', oldProprietaireId)
            );
            const oldDetailsSnap = await getDocs(oldDetailsQuery);
            oldDetailsSnap.forEach((docSnap) => batch.delete(docSnap.ref));
            batch.delete(oldPropRef);
          }
        }
      } else {
        // Check if we're updating an existing proprietaire or creating a new one
        let shouldCreateNew = false;
        let existingDetailsDocId: string | undefined;
        
        if (oldProprietaireId) {
          const oldPropRef = doc(db, COLLECTIONS.PROPRIETAIRES, oldProprietaireId).withConverter(proprietaireConverter);
          const oldPropSnap = await getDoc(oldPropRef);
          
          if (oldPropSnap.exists()) {
            const oldType = oldPropSnap.data().TypeProprietaire;
            const isTypeChanged = oldType !== formData.TypeProprietaire;

            // If type changed, we need to delete old details and create new ones
            if (isTypeChanged) {
              batch.update(oldPropRef, { TypeProprietaire: formData.TypeProprietaire });
              
              // Delete old type details
              const oldDetailsCollection = oldType === 'Physique' ? COLLECTIONS.PROPRIETAIRES_PHYSIQUES : COLLECTIONS.PROPRIETAIRES_MORALES;
              const oldDetailsQuery = query(
                collection(db, oldDetailsCollection),
                where('ProprietaireID', '==', oldProprietaireId)
              );
              const oldDetailsSnap = await getDocs(oldDetailsQuery);
              oldDetailsSnap.forEach((docSnap) => batch.delete(docSnap.ref));
            }

            proprietaireId = oldProprietaireId;

            // Get existing details document (if same type and not changed)
            if (!isTypeChanged) {
              const detailsCollection = formData.TypeProprietaire === 'Physique' 
                ? COLLECTIONS.PROPRIETAIRES_PHYSIQUES 
                : COLLECTIONS.PROPRIETAIRES_MORALES;
              
              const detailsQuery = query(
                collection(db, detailsCollection),
                where('ProprietaireID', '==', proprietaireId)
              );
              const detailsSnap = await getDocs(detailsQuery);
              
              if (!detailsSnap.empty) {
                existingDetailsDocId = detailsSnap.docs[0].id;
              }
            }
          } else {
            // Old proprietaire doesn't exist, create new
            shouldCreateNew = true;
          }
        } else {
          // No old proprietaire, create new
          shouldCreateNew = true;
        }

        // Create new proprietaire if needed
        if (shouldCreateNew) {
          proprietaireId = generateUUID();
          const newPropRef = doc(db, COLLECTIONS.PROPRIETAIRES, proprietaireId).withConverter(proprietaireConverter);
          const newProp: Proprietaire = {
            ProprietaireID: proprietaireId,
            TypeProprietaire: formData.TypeProprietaire,
          };
          batch.set(newPropRef, newProp);
        }

        // Now update or create the details document
        if (formData.TypeProprietaire === 'Physique') {
          if (existingDetailsDocId) {
            // Update existing Physique details using document ID
            const detailsRef = doc(db, COLLECTIONS.PROPRIETAIRES_PHYSIQUES, existingDetailsDocId);
            batch.update(detailsRef, {
              ProprietaireID: proprietaireId,
              NomProprietaire: formData.NomProprietaire.trim(),
              PrenomProprietaire: formData.PrenomProprietaire.trim(),
            });
          } else {
            // Create new Physique details
            const newDetailsRef = doc(collection(db, COLLECTIONS.PROPRIETAIRES_PHYSIQUES));
            const physData: ProprietairePhysique = {
              ProprietaireID: proprietaireId!,
              NomProprietaire: formData.NomProprietaire.trim(),
              PrenomProprietaire: formData.PrenomProprietaire.trim(),
            };
            batch.set(newDetailsRef, physData);
          }
        } else {
          if (existingDetailsDocId) {
            // Update existing Morale details using document ID
            const detailsRef = doc(db, COLLECTIONS.PROPRIETAIRES_MORALES, existingDetailsDocId);
            batch.update(detailsRef, {
              ProprietaireID: proprietaireId,
              NomEntreprise: formData.NomEntreprise.trim(),
            });
          } else {
            // Create new Morale details
            const newDetailsRef = doc(collection(db, COLLECTIONS.PROPRIETAIRES_MORALES));
            const morData: ProprietaireMorale = {
              ProprietaireID: proprietaireId!,
              NomEntreprise: formData.NomEntreprise.trim(),
            };
            batch.set(newDetailsRef, morData);
          }
        }
      }

      /** -------------------------------
       * 5. Update Station
       * ------------------------------ */
      const stationUpdateData: any = {
        StationID: stationIdToUse, // Ensure StationID is always set
        Code: currentStation?.Code, // Preserve the Code
        NomStation: formData.NomStation.trim(),
        Adresse: formData.Adresse.trim(),
        Latitude: formData.Latitude ? parseFloat(formData.Latitude) : 0,
        Longitude: formData.Longitude ? parseFloat(formData.Longitude) : 0,
        Type: formData.Type,
        TypeGerance: formData.TypeGerance,
        Statut: formData.Statut,
        NombreVolucompteur: formData.NombreVolucompteur ? parseInt(formData.NombreVolucompteur, 10) : 0, 
        Commentaires: formData.Commentaires.trim() || '', 
        MarqueID: marqueId,
        CommuneID: communeId,
        GerantID: gerantId,
        ProprietaireID: proprietaireId || '',
      };

      batch.update(stationRef, cleanFirestoreData(stationUpdateData));

      /** -------------------------------
       * 6. Update Autorisations
       * ------------------------------ */
      const oldAutorisationsQuery = query(
        collection(db, COLLECTIONS.AUTORISATIONS),
        where('StationID', '==', stationId)
      );
      const oldAutorisationsSnap = await getDocs(oldAutorisationsQuery);
      oldAutorisationsSnap.forEach((docSnap) => batch.delete(docSnap.ref));

      for (const autoData of formData.autorisations) {
        if (autoData.NumeroAutorisation.trim()) {
          const autoId = generateUUID();
          const newRef = doc(db, COLLECTIONS.AUTORISATIONS, autoId).withConverter(autorisationConverter);
          const parsedDate = autoData.DateAutorisation ? parseDateString(autoData.DateAutorisation) : null;
          const newAutorisation: Autorisation = {
            AutorisationID: autoId,
            StationID: stationId,
            TypeAutorisation: autoData.TypeAutorisation,
            NumeroAutorisation: autoData.NumeroAutorisation.trim(),
            DateAutorisation: parsedDate,
          };
          batch.set(newRef, newAutorisation);
        }
      }

      /** -------------------------------
       * 7. Update Capacités
       * ------------------------------ */
      const capacitesQuery = query(
        collection(db, COLLECTIONS.CAPACITES_STOCKAGE),
        where('StationID', '==', stationId)
      );
      const capacitesSnap = await getDocs(capacitesQuery);
      capacitesSnap.forEach((docSnap) => batch.delete(docSnap.ref));

      if (formData.CapaciteGasoil.trim()) {
        const gasoilId = generateUUID();
        const gasoilRef = doc(db, COLLECTIONS.CAPACITES_STOCKAGE, gasoilId).withConverter(capaciteConverter);
        const gasoil: CapaciteStockage = {
          CapaciteID: gasoilId,
          StationID: stationId,
          TypeCarburant: 'Gasoil',
          CapaciteLitres: parseFloat(formData.CapaciteGasoil),
        };
        batch.set(gasoilRef, gasoil);
      }

      if (formData.CapaciteSSP.trim()) {
        const sspId = generateUUID();
        const sspRef = doc(db, COLLECTIONS.CAPACITES_STOCKAGE, sspId).withConverter(capaciteConverter);
        const ssp: CapaciteStockage = {
          CapaciteID: sspId,
          StationID: stationId,
          TypeCarburant: 'SSP',
          CapaciteLitres: parseFloat(formData.CapaciteSSP),
        };
        batch.set(sspRef, ssp);
      }

      /** -------------------------------
       * Commit
       * ------------------------------ */
      await batch.commit();

    } catch (err: any) {
      console.error('Failed to update station:', err);
      setError(`Failed to update station: ${err.message}`);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { updateStation, loading, error };
}