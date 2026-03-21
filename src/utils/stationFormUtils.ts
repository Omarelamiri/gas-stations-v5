// src/utils/stationFormUtils.ts
import { StationWithDetails, StationFormData } from '@/types/station';

/**
 * Format a Date object to DD/MM/YYYY string for form input
 */
function formatDateForInput(date: Date | null): string {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) return '';
  
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  
  return `${day}/${month}/${year}`;
}

export function stationWithDetailsToFormData(stationData: StationWithDetails): StationFormData {
  const { station, marque, commune, province, gerant, proprietaire, autorisations, capacites } = stationData;

  // Get capacities by type
  const gasoilCapacity = capacites?.find(c => c.TypeCarburant === 'Gasoil');
  const sspCapacity = capacites?.find(c => c.TypeCarburant === 'SSP');

  return {
    id: station.StationID,
    NomStation: station.NomStation || '',
    Adresse: station.Adresse || '',
    Latitude: station.Latitude ? station.Latitude.toString() : '0',
    Longitude: station.Longitude ? station.Longitude.toString() : '0',
    Type: station.Type || 'service',
    Marque: marque?.Marque || '',
    RaisonSociale: marque?.RaisonSociale || '',
    Province: province?.NomProvince || '',
    Commune: commune?.NomCommune || '',
    PrenomGerant: gerant?.PrenomGerant || '',
    NomGerant: gerant?.NomGerant || '',
    CINGerant: gerant?.CINGerant || '',
    Telephone: gerant?.Telephone || '',
    TypeProprietaire: proprietaire?.base?.TypeProprietaire || 'Physique',
    PrenomProprietaire: proprietaire?.base?.TypeProprietaire === 'Physique'
      ? (proprietaire.details as any)?.PrenomProprietaire || ''
      : '',
    NomProprietaire: proprietaire?.base?.TypeProprietaire === 'Physique'
      ? (proprietaire.details as any)?.NomProprietaire || ''
      : '',
    NomEntreprise: proprietaire?.base?.TypeProprietaire === 'Morale'
      ? (proprietaire.details as any)?.NomEntreprise || ''
      : '',
    autorisations: autorisations?.length > 0 
      ? [...autorisations]
          .sort((a, b) => {
            if (a.TypeAutorisation === 'création') return -1;
            if (b.TypeAutorisation === 'création') return 1;
            return 0;
          })
          .map(a => ({
            TypeAutorisation: a.TypeAutorisation,
            NumeroAutorisation: a.NumeroAutorisation || '',
            DateAutorisation: formatDateForInput(a.DateAutorisation)
          }))
      : [{ TypeAutorisation: 'création', NumeroAutorisation: '', DateAutorisation: '' }],
    CapaciteGasoil: gasoilCapacity?.CapaciteLitres?.toString() || '0',
    CapaciteSSP: sspCapacity?.CapaciteLitres?.toString() || '0',
    TypeGerance: station.TypeGerance || 'libre',
    Statut: station.Statut || 'en activité',
    Commentaires: station.Commentaires || '',
    NombreVolucompteur: station.NombreVolucompteur ? station.NombreVolucompteur.toString() : '0'
  };
}