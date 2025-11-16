'use client';

import { useState } from 'react';
import { useNearbyStations } from '@/hooks/stations/useNearbyStations';
import NearbyStationsTable from '@/components/stations/NearbyStationsTable';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileSpreadsheet } from 'lucide-react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import proj4 from 'proj4';
import { formatDate } from '@/utils/format'; // Import formatDate function
import { getProprietaireName } from '@/utils/format';

// Define projections for ESPG:26191 (Merchich) and WGS84
proj4.defs('EPSG:26191', '+proj=lcc +lat_1=33.3 +lat_0=33.3 +lon_0=-5.4 +k_0=0.999625769 +x_0=500000 +y_0=300000 +ellps=clrk80ign +towgs84=31,146,47,0,0,0,0 +units=m +no_defs');
proj4.defs('EPSG:4326', '+proj=longlat +datum=WGS84 +no_defs');

// Helper function to format number with thousand separator (space)
const formatNumberWithSpaces = (value: string): string => {
  const numericValue = value.replace(/\D/g, ''); // Remove non-digits
  return numericValue.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};

// Helper function to parse number with spaces
const parseNumberWithSpaces = (value: string): string => {
  return value.replace(/\s/g, ''); // Remove spaces
};

export default function NearbyStationsPage() {
  const [coordinateSystem, setCoordinateSystem] = useState<'geographic' | 'lambert'>('geographic');
  const [latitude, setLatitude] = useState<string>('');
  const [longitude, setLongitude] = useState<string>('');
  const [xCoord, setXCoord] = useState<string>('');
  const [yCoord, setYCoord] = useState<string>('');
  const [latitudeError, setLatitudeError] = useState<string>('');
  const [longitudeError, setLongitudeError] = useState<string>('');
  const [xError, setXError] = useState<string>('');
  const [yError, setYError] = useState<string>('');
  const [isExporting, setIsExporting] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const { nearbyStations, nearbyLoading, nearbyError, fetchNearbyStations, stationsLoading, stationsError } = useNearbyStations();

  // Handle export with specified columns
  const handleExport = async () => {
    if (nearbyStations.length === 0) return;

    setIsExporting(true);
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Stations à proximité');

      worksheet.columns = [
        { header: 'Code', key: 'code', width: 15 },
        { header: 'Marque', key: 'marque', width: 20 },
        { header: 'Type', key: 'type', width: 15 },
        { header: 'Latitude', key: 'latitude', width: 15 },
        { header: 'Longitude', key: 'longitude', width: 15 },
        { header: 'Province', key: 'province', width: 15 },
        { header: 'Commune', key: 'commune', width: 25 },
        { header: 'Propriétaire', key: 'Proprietaire', width: 25 },
        { header: 'Gérant', key: 'gerant', width: 25 },
        { header: 'Distance (km)', key: 'distance', width: 15 },
        { header: 'Nombre de volucompteur', key: 'nombreVolucompteur', width: 20 },
        { header: 'Capacité Gasoil', key: 'capaciteGasoil', width: 15 },
        { header: 'Capacité SSP', key: 'capaciteSSP', width: 15 },
        { header: 'Statut', key: 'statut', width: 15 },
      ];

      nearbyStations.forEach(station => {
        const distanceValue = typeof station.distance === 'number' && !isNaN(station.distance)
          ? station.distance.toFixed(2)
          : 'N/A';

        // Find Gasoil and SSP capacities
        const capaciteGasoil = station.capacites.find(c => c.TypeCarburant === 'Gasoil')?.CapaciteLitres || 0;
        const capaciteSSP = station.capacites.find(c => c.TypeCarburant === 'SSP')?.CapaciteLitres || 0;

        worksheet.addRow({
          code: station.station.Code || '-',
          marque: station.marque?.Marque || '-',
          type: station.station.Type || '-',
          latitude: station.station.Latitude || '-',
          longitude: station.station.Longitude || '-',
          province: station.province.NomProvince || '-',
          commune: station.commune.NomCommune || '-',
          Proprietaire: getProprietaireName(station) || '',
          gerant: station.gerant?.fullName || `${station.gerant?.PrenomGerant || ''} ${station.gerant?.NomGerant || ''}`.trim() || '-',
          distance: distanceValue,
          nombreVolucompteur: station.station.NombreVolucompteur || 0,
          capaciteGasoil: capaciteGasoil || '-',
          capaciteSSP: capaciteSSP || '-',
          statut: station.station.Statut || '-',
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      saveAs(blob, `stations-proximite-${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (error) {
      console.error('Export error:', error);
      alert('Une erreur est survenue lors de l\'exportation');
    } finally {
      setIsExporting(false);
    }
  };

  const handleSearch = () => {
    setLatitudeError('');
    setLongitudeError('');
    setXError('');
    setYError('');
    setHasSearched(true);

    let lat: number, lng: number;

    if (coordinateSystem === 'geographic') {
      lat = parseFloat(latitude);
      lng = parseFloat(longitude);

      if (isNaN(lat)) {
        setLatitudeError('Veuillez entrer une latitude valide.');
        setHasSearched(false);
        return;
      }
      if (lat < -90 || lat > 90) {
        setLatitudeError('La latitude doit être comprise entre -90 et 90.');
        setHasSearched(false);
        return;
      }
      if (isNaN(lng)) {
        setLongitudeError('Veuillez entrer une longitude valide.');
        setHasSearched(false);
        return;
      }
      if (lng < -180 || lng > 180) {
        setLongitudeError('La longitude doit être comprise entre -180 et 180.');
        setHasSearched(false);
        return;
      }
    } else {
      const x = parseFloat(parseNumberWithSpaces(xCoord));
      const y = parseFloat(parseNumberWithSpaces(yCoord));

      if (isNaN(x)) {
        setXError('Veuillez entrer une coordonnée X valide.');
        setHasSearched(false);
        return;
      }
      if (x < 0 || x > 920000) {
        setXError('La coordonnée X doit être comprise entre 0 et 920000.');
        setHasSearched(false);
        return;
      }
      if (isNaN(y)) {
        setYError('Veuillez entrer une coordonnée Y valide.');
        setHasSearched(false);
        return;
      }
      if (y < 0 || y > 591000) {
        setYError('La coordonnée Y doit être comprise entre 0 et 591000.');
        setHasSearched(false);
        return;
      }

      try {
        const [lon, latConverted] = proj4('EPSG:26191', 'EPSG:4326', [x, y]);
        if (isNaN(latConverted) || isNaN(lon)) {
          setXError('Erreur lors de la conversion des coordonnées.');
          setHasSearched(false);
          return;
        }
        lat = latConverted;
        lng = lon;
        setLatitude(lat.toFixed(6));
        setLongitude(lng.toFixed(6));
      } catch (error) {
        console.error('Conversion error:', error);
        setXError('Erreur lors de la conversion des coordonnées.');
        setHasSearched(false);
        return;
      }
    }

    fetchNearbyStations(lat, lng);
  };

  const handleCoordinateSystemChange = (value: 'geographic' | 'lambert') => {
    setCoordinateSystem(value);
    setLatitude('');
    setLongitude('');
    setXCoord('');
    setYCoord('');
    setLatitudeError('');
    setLongitudeError('');
    setXError('');
    setYError('');
    setHasSearched(false);
  };

  // Handle X and Y input changes with formatting
  const handleXCoordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const parsedValue = parseNumberWithSpaces(value);
    setXCoord(parsedValue);
  };

  const handleYCoordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const parsedValue = parseNumberWithSpaces(value);
    setYCoord(parsedValue);
  };

  const isGeographic = coordinateSystem === 'geographic';
  const isSearchDisabled = nearbyLoading || 
    (isGeographic ? (!latitude || !longitude) : (!xCoord || !yCoord));

  if (stationsLoading) {
    return <div className="p-4">Chargement des stations...</div>;
  }

  if (stationsError) {
    return <div className="p-4 text-red-600">Erreur: {stationsError}</div>;
  }

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-2xl font-bold">Stations à proximité</CardTitle>
            {nearbyStations.length > 0 && (
              <Button
                onClick={handleExport}
                disabled={isExporting}
                className="bg-[#217346] hover:bg-[#1a5c38] text-white flex items-center gap-2"
              >
                <FileSpreadsheet className="w-4 h-4" />
                {isExporting ? 'Exportation...' : 'Exporter'}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2" htmlFor="coordinate-system">
              Système de Coordonnées
            </label>
            <Select 
              value={coordinateSystem} 
              onValueChange={handleCoordinateSystemChange}
            >
              <SelectTrigger id="coordinate-system" className="w-full sm:w-[300px]">
                <SelectValue placeholder="Sélectionnez le système de coordonnées" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="geographic">Coordonnées géographiques</SelectItem>
                <SelectItem value="lambert">Coordonnée lamberts (ESPG:26191 - Merchich - Meter)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="mb-6">
            {!isGeographic && (
              <div className="flex flex-col md:flex-row gap-4 mb-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-1">X (Easting)</label>
                  <Input
                    type="text"
                    placeholder="X (84 026 ... 350 738)"
                    value={xCoord ? formatNumberWithSpaces(xCoord) : ''}
                    onChange={handleXCoordChange}
                    className={`w-full ${xError ? 'border-red-500' : ''}`}
                  />
                  {xError && <p className="mt-1 text-sm text-red-600">{xError}</p>}
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-1">Y (Northing)</label>
                  <Input
                    type="text"
                    placeholder="Y (21 241 ... 255 390)"
                    value={yCoord ? formatNumberWithSpaces(yCoord) : ''}
                    onChange={handleYCoordChange}
                    className={`w-full ${yError ? 'border-red-500' : ''}`}
                  />
                  {yError && <p className="mt-1 text-sm text-red-600">{yError}</p>}
                </div>
              </div>
            )}
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">Latitude</label>
                <Input
                  type="number"
                  step="any"
                  placeholder="Latitude (32.815146...30.772873)"
                  value={latitude}
                  onChange={(e) => isGeographic && setLatitude(e.target.value)}
                  readOnly={!isGeographic}
                  className={`w-full ${latitudeError ? 'border-red-500' : ''} ${!isGeographic ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                />
                {latitudeError && <p className="mt-1 text-sm text-red-600">{latitudeError}</p>}
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">Longitude</label>
                <Input
                  type="number"
                  step="any"
                  placeholder="Longitude (-9.843138...-6.992879)"
                  value={longitude}
                  onChange={(e) => isGeographic && setLongitude(e.target.value)}
                  readOnly={!isGeographic}
                  className={`w-full ${longitudeError ? 'border-red-500' : ''} ${!isGeographic ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                />
                {longitudeError && <p className="mt-1 text-sm text-red-600">{longitudeError}</p>}
              </div>
            </div>
          </div>

          <div className="mb-6">
            <Button onClick={handleSearch} disabled={isSearchDisabled}>
              {nearbyLoading ? 'Recherche...' : 'Rechercher'}
            </Button>
          </div>

          {nearbyError && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {nearbyError}
            </div>
          )}

          {nearbyStations.length > 0 ? (
            <NearbyStationsTable stations={nearbyStations} />
          ) : (
            !nearbyLoading && (
              hasSearched ? (
                <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                  Aucune station ne se trouve dans un rayon de 20 Km de ce point !
                </div>
              ) : (
                <p className="text-gray-500">Entrez des coordonnées et recherchez pour voir les stations proches.</p>
              )
            )
          )}
        </CardContent>
      </Card>
    </div>
  );
}