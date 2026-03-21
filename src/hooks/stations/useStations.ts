
import { useEffect, useState, useCallback } from 'react';
import {
  collection,
  getDocs,
  doc,
  getDoc,
  query,
  where,
  documentId,
  FirestoreDataConverter,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import {
  Station,
  StationWithDetails,
  Marque,
  Commune,
  Province,
  Gerant,
  Proprietaire,
  ProprietairePhysique,
  ProprietaireMorale,
  Autorisation,
  CapaciteStockage,
  Analyse,
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
  analyseConverter,
} from '@/lib/firebase/converters';
import { COLLECTIONS } from '@/lib/firebase/collections';

// Add at the top of the file, outside the hook:
let stationsCache: { data: StationWithDetails[]; timestamp: number } | null = null;
const STATIONS_CACHE_TTL = 1000 * 60 * 5; // 5 minutes

// HELPER: Chunks an array into smaller arrays of a specified size.
function chunk<T>(arr: T[], size = 10): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

// HELPER: Fetches documents in batches using their document IDs.
async function fetchDocsByIds<T>(
  collectionName: string,
  ids: string[],
  converter: FirestoreDataConverter<T>
): Promise<T[]> {
  if (ids.length === 0) return [];
  const idChunks = chunk(ids.filter(Boolean));
  const promises = idChunks.map((ch) =>
    getDocs(
      query(
        collection(db, collectionName).withConverter(converter),
        where(documentId(), 'in', ch)
      )
    )
  );
  const snaps = await Promise.all(promises);
  return snaps.flatMap((s) => s.docs.map((d) => d.data()));
}

// HELPER: Fetches documents from a collection that are related to a list of station IDs.
async function fetchByStationField<T>(
  collectionName: string,
  stationIds: string[],
  converter: FirestoreDataConverter<T>
): Promise<T[]> {
  if (stationIds.length === 0) return [];
  const chunks = chunk(stationIds);
  const results: T[] = [];
  for (const ch of chunks) {
    const snaps = await getDocs(
      query(
        collection(db, collectionName).withConverter(converter),
        where('StationID', 'in', ch)
      )
    );
    results.push(...snaps.docs.map((d) => d.data()));
  }
  return results;
}

// HELPER: Fetches proprietaire details (Physique/Morale) by their ProprietaireID.
async function fetchProprietaireDetails<T>(
  collectionName: string,
  propIds: string[],
  converter: FirestoreDataConverter<T>
): Promise<T[]> {
  if (propIds.length === 0) return [];
  const chunks = chunk(propIds);
  const promises = chunks.map((ch) =>
    getDocs(
      query(
        collection(db, collectionName).withConverter(converter),
        where('ProprietaireID', 'in', ch)
      )
    )
  );
  const snaps = await Promise.all(promises);
  return snaps.flatMap((s) => s.docs.map((d) => d.data()));
}

export function useStations() {
  const [stations, setStations] = useState<StationWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStationsWithDetails = useCallback(async (forceRefresh = false) => {
    // Check cache first
    if (!forceRefresh && stationsCache && Date.now() - stationsCache.timestamp < STATIONS_CACHE_TTL) {
      setStations(stationsCache.data);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Load base stations
      const stationsSnap = await getDocs(
        collection(db, COLLECTIONS.STATIONS).withConverter(stationConverter)
      );
      const baseStations: Station[] = stationsSnap.docs.map((d) => d.data());

      // 2. Collect all unique IDs for batch fetching
      const marqueIDs = [...new Set(baseStations.map((s) => s.MarqueID).filter(Boolean) as string[])];
      const communeIDs = [...new Set(baseStations.map((s) => s.CommuneID).filter(Boolean) as string[])];
      const gerantIDs = [...new Set(baseStations.map((s) => s.GerantID).filter(Boolean) as string[])];
      const proprietaireIDs = [...new Set(baseStations.map((s) => s.ProprietaireID).filter(Boolean) as string[])];
      const stationIDs = baseStations.map((s) => s.StationID);

      // 3. Fetch related documents in parallel batches
      const [marques, communes, gerants, proprietairesBase, autorisationsAll, capacitesAll, analysesAll] =
        await Promise.all([
          fetchDocsByIds<Marque>(COLLECTIONS.MARQUES, marqueIDs, marqueConverter),
          fetchDocsByIds<Commune>(COLLECTIONS.COMMUNES, communeIDs, communeConverter),
          fetchDocsByIds<Gerant>(COLLECTIONS.GERANTS, gerantIDs, gerantConverter),
          fetchDocsByIds<Proprietaire>(COLLECTIONS.PROPRIETAIRES, proprietaireIDs, proprietaireConverter),
          fetchByStationField<Autorisation>(COLLECTIONS.AUTORISATIONS, stationIDs, autorisationConverter),
          fetchByStationField<CapaciteStockage>(COLLECTIONS.CAPACITES_STOCKAGE, stationIDs, capaciteConverter),
          fetchByStationField<Analyse>(COLLECTIONS.ANALYSES, stationIDs, analyseConverter),
        ]);

      // 4. Handle dependent fetches (Provinces and Proprietaire details)
      const provinceIDs = [...new Set(communes.map((c) => c.ProvinceID).filter(Boolean))];
      const physiquePropIds = proprietairesBase.filter((p) => p.TypeProprietaire === 'Physique').map((p) => p.ProprietaireID);
      const moralePropIds = proprietairesBase.filter((p) => p.TypeProprietaire === 'Morale').map((p) => p.ProprietaireID);

      const [provinces, proprietairesPhysiques, proprietairesMorales] = await Promise.all([
        fetchDocsByIds<Province>(COLLECTIONS.PROVINCES, provinceIDs, provinceConverter),
        fetchProprietaireDetails<ProprietairePhysique>(COLLECTIONS.PROPRIETAIRES_PHYSIQUES, physiquePropIds, proprietairePhysiqueConverter),
        fetchProprietaireDetails<ProprietaireMorale>(COLLECTIONS.PROPRIETAIRES_MORALES, moralePropIds, proprietaireMoraleConverter),
      ]);

      // 5. Create maps and records for efficient in-memory joining
      const marqueMap = new Map(marques.map((m) => [m.MarqueID, m]));
      const communeMap = new Map(communes.map((c) => [c.CommuneID, c]));
      const provinceMap = new Map(provinces.map((p) => [p.ProvinceID, p]));
      const gerantMap = new Map(gerants.map((g) => [g.GerantID, g]));
      const proprietaireBaseMap = new Map(proprietairesBase.map((p) => [p.ProprietaireID, p]));
      const proprietairePhysiqueMap = new Map(proprietairesPhysiques.map((p) => [p.ProprietaireID, p]));
      const proprietaireMoraleMap = new Map(proprietairesMorales.map((p) => [p.ProprietaireID, p]));

      const groupByStationID = <T extends { StationID: string }>(items: T[]): Record<string, T[]> =>
        items.reduce((acc, item) => {
          (acc[item.StationID] ||= []).push(item);
          return acc;
        }, {} as Record<string, T[]>);

      const autorisationsByStation = groupByStationID(autorisationsAll);
      const capacitesByStation = groupByStationID(capacitesAll);
      const analysesByStation = groupByStationID(analysesAll);

      // Define default objects for missing data
      const defaultMarque: Marque = { MarqueID: '', Marque: 'Unknown', RaisonSociale: '' };
      const defaultCommune: Commune = { CommuneID: '', NomCommune: 'Unknown', ProvinceID: '' };
      const defaultProvince: Province = { ProvinceID: '', NomProvince: 'Unknown' };
      const defaultGerant: Gerant = { GerantID: '', NomGerant: 'Unknown', PrenomGerant: '', CINGerant: '', Telephone: '', fullName: 'Unknown' };

      // 6. Build final results by joining data in memory
      const results: StationWithDetails[] = baseStations.map((station) => {
        const commune = communeMap.get(station.CommuneID!) || defaultCommune;
        const gerantData = gerantMap.get(station.GerantID!);
        const gerant: Gerant = gerantData
          ? { ...gerantData, fullName: `${gerantData.PrenomGerant || ''} ${gerantData.NomGerant || ''}`.trim() }
          : defaultGerant;

        let proprietaire: StationWithDetails['proprietaire'] = undefined;
        const base = proprietaireBaseMap.get(station.ProprietaireID!);
        if (base) {
          if (base.TypeProprietaire === 'Physique') {
            const details = proprietairePhysiqueMap.get(base.ProprietaireID);
            if (details) proprietaire = { base, details };
          } else if (base.TypeProprietaire === 'Morale') {
            const details = proprietaireMoraleMap.get(base.ProprietaireID);
            if (details) proprietaire = { base, details };
          }
        }

        // Handle date conversions from Firestore Timestamps
        const convertedAutorisations = (autorisationsByStation[station.StationID] || []).map(a => ({
          ...a,
          DateAutorisation: (a.DateAutorisation as any)?.toDate?.() || null,
        }));

        // Find the "création" and "mise en service" authorizations
        const creationAutorisation = convertedAutorisations.find(
          (a) => a.TypeAutorisation === 'création'
        );
        const miseEnServiceAutorisation = convertedAutorisations.find(
          (a) => a.TypeAutorisation === 'mise en service'
        );

        const convertedAnalyses = (analysesByStation[station.StationID] || []).map(an => ({
          ...an,
          DateAnalyse: (an.DateAnalyse as any)?.toDate?.() || null,
        }));

        return {
          station,
          marque: marqueMap.get(station.MarqueID!) || defaultMarque,
          commune,
          province: provinceMap.get(commune.ProvinceID) || defaultProvince,
          gerant,
          proprietaire,
          autorisations: convertedAutorisations,
          capacites: capacitesByStation[station.StationID] || [],
          analyses: convertedAnalyses,
          creationAutorisation,
          miseEnServiceAutorisation,
        };
      });

      setStations(results);
      stationsCache = { data: results, timestamp: Date.now() }; // ADD THIS LINE before setStations
    } catch (err: any) {
      console.error('Failed to load stations:', err);
      setError(err?.message || 'Failed to load stations');
      setStations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStationsWithDetails();
  }, [fetchStationsWithDetails]);

  return { stations, loading, error, refetch: () => fetchStationsWithDetails(true) };
}

export function invalidateStationsCache() {
  stationsCache = null;
}