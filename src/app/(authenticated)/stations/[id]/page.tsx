'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import { StationWithDetails, Analyse } from '@/types/station';
import { useStations } from '@/hooks/stations/useStations';
import { Card, CardHeader, CardContent, CardTitle, Button, LoadingSpinner, ErrorMessage } from '@/components/ui';
import dynamic from 'next/dynamic';
import { formatDate, getProprietaireName } from '@/utils/format';
import { StationForm } from '@/components/stations/StationForm';
import { Modal } from '@/components/ui/Modal';
import { useAnalysesIndex } from '@/hooks/useStationData/useAnalysesIndex';
import AnalyseTable from '@/components/stations/AnalyseTable';
import AnalyseForm from '@/components/stations/AnalyseForm';
import { useArchiveStation } from '@/hooks/stations/useArchiveStation';

const GoogleMap = dynamic(() => import('@/components/dashboard/MapPreview'), { ssr: false });

export default function StationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { stations, loading: stationsLoading, error: stationsError, refetch } = useStations();
  const { analyses, loading: analysesLoading, error: analysesError, refetch: refetchAnalyses } = useAnalysesIndex(id);
  const { archiveStation, unarchiveStation, loading: archiveLoading } = useArchiveStation();

  const [station, setStation] = useState<StationWithDetails | null>(null);
  const [showStationForm, setShowStationForm] = useState(false);
  const [editingStation, setEditingStation] = useState<StationWithDetails | undefined>(undefined);
  const [showAnalyseForm, setShowAnalyseForm] = useState(false);
  const [analyseFormMode, setAnalyseFormMode] = useState<'create' | 'edit'>('create');
  const [editingAnalyse, setEditingAnalyse] = useState<Analyse | undefined>(undefined);

  const stationAnalyses = analyses || [];

  // Memoize initialAnalyses to prevent new array creation on each render
  const initialAnalyses = useMemo(() => (editingAnalyse ? [editingAnalyse] : []), [editingAnalyse]);

  useEffect(() => {
    if (stations.length > 0) {
      const found = stations.find((s) => s.station.StationID === id);
      setStation(found || null);
    }
  }, [stations, id]);

  const handleEditStation = () => {
    setEditingStation(station || undefined);
    setShowStationForm(true);
  };

  const handleStationFormSaved = async () => {
    setShowStationForm(false);
    setEditingStation(undefined);
    await refetch();
  };

  const handleCreateAnalyse = () => {
    setAnalyseFormMode('create');
    setEditingAnalyse(undefined);
    setShowAnalyseForm(true);
  };

  const handleEditAnalyse = (analyse: Analyse) => {
    setAnalyseFormMode('edit');
    setEditingAnalyse(analyse);
    setShowAnalyseForm(true);
  };

  const handleAnalyseFormSaved = async () => {
    setShowAnalyseForm(false);
    setEditingAnalyse(undefined);
    await refetchAnalyses();
  };

  const handleAnalyseFormCancel = () => {
    setShowAnalyseForm(false);
    setEditingAnalyse(undefined);
  };

  const handleArchive = async () => {
    if (!station || archiveLoading) return;

    const willUnarchive = station.station.Statut === 'archivé';
    const confirmMsg = willUnarchive
      ? "Êtes-vous sûr de vouloir déarchiver cette station ?"
      : "Êtes-vous sûr de vouloir archiver cette station ?";

    if (!confirm(confirmMsg)) return;

    try {
      if (willUnarchive) {
        await unarchiveStation(station.station.StationID);
      } else {
        await archiveStation(station.station.StationID);
      }
      await refetch();
    } catch (error) {
      console.error('Failed to change station status:', error);
    }
  };

  useEffect(() => {
    console.log('Current station:', station);
    console.log('Current analyses:', analyses);
  }, [station, analyses]);

  if (stationsLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  if (stationsError) {
    return (
      <div className="p-6">
        <ErrorMessage message={stationsError} />
      </div>
    );
  }

  if (!station) {
    return (
      <div className="p-6">
        <ErrorMessage message="Station introuvable." />
      </div>
    );
  }

  const isArchived = station.station.Statut === 'archivé';

  return (
    <div className="p-6 space-y-6 text-gray-900">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">{station.station.NomStation}</h1>
          {isArchived && (
            <span className="inline-block mt-2 px-3 py-1 text-sm font-medium text-gray-600 bg-gray-200 rounded-full">
              Archivé
            </span>
          )}
        </div>
        <div className="space-x-2">
          <Button onClick={handleEditStation} disabled={isArchived}>
            Modifier la station
          </Button>
          <Button
            onClick={handleArchive}
            variant={isArchived ? 'default' : 'danger'}
            disabled={archiveLoading}
          >
            {archiveLoading ? (isArchived ? 'Déarchivage...' : 'Archivage...') : (isArchived ? 'Déarchiver' : 'Archiver')}
          </Button>
        </div>
      </div>

      {/* Informations générales */}
      <Card>
        <CardHeader>
          <CardTitle>Informations générales</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 text-sm">
            <div><strong>Code:</strong> {station.station.Code || 'N/A'}</div>
            <div><strong>Nom de la station:</strong> {station.station.NomStation}</div>
            <div><strong>Statut:</strong> <span className="capitalize">{station.station.Statut || 'N/A'}</span></div>
            <div><strong>Marque:</strong> {station.marque.Marque}</div>
            <div><strong>Raison Sociale:</strong> {station.marque.RaisonSociale || 'N/A'}</div>
            <div><strong>Type:</strong> <span className="capitalize">{station.station.Type}</span></div>
            <div><strong>Propriétaire:</strong> {getProprietaireName(station)}</div>
            <div className="col-span-2"><strong>Gérant:</strong> {station.gerant.fullName} (CIN: {station.gerant.CINGerant || 'N/A'}, Tél: {station.gerant.Telephone || 'N/A'})</div>
            <div><strong>Type de Gérance:</strong> <span className="capitalize">{station.station.TypeGerance}</span></div>
            <div className="col-span-3 border-t pt-4 mt-2"><strong>Adresse:</strong> {station.station.Adresse}</div>
            <div><strong>Province:</strong> {station.province.NomProvince}</div>
            <div><strong>Commune:</strong> {station.commune.NomCommune}</div>
            <div><strong>Latitude:</strong> {station.station.Latitude}</div>
            <div><strong>Longitude:</strong> {station.station.Longitude}</div>
            <div><strong>Commentaire:</strong> {station.station.Commentaires || 'N/A'}</div>
            <div><strong>Nombre Volucompteur:</strong> {station.station.NombreVolucompteur ?? 'N/A'}</div>
          </div>
        </CardContent>
      </Card>

      {/* Autorisations */}
      {(station.autorisations?.length > 0 || station.creationAutorisation || station.miseEnServiceAutorisation) && (
        <Card>
          <CardHeader>
            <CardTitle>Autorisations</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-6 text-sm">
              {station.creationAutorisation && (
                <li>
                  Création – N° {station.creationAutorisation.NumeroAutorisation} (du {formatDate(station.creationAutorisation.DateAutorisation)})
                </li>
              )}
              {station.miseEnServiceAutorisation && (
                <li>
                  Mise en service – N° {station.miseEnServiceAutorisation.NumeroAutorisation} (du {formatDate(station.miseEnServiceAutorisation.DateAutorisation)})
                </li>
              )}
              {station.autorisations
                .filter(a => a.TypeAutorisation !== 'création' && a.TypeAutorisation !== 'mise en service')
                .map((a) => (
                  <li key={a.AutorisationID}>
                    {a.TypeAutorisation} – N° {a.NumeroAutorisation} (du {formatDate(a.DateAutorisation)})
                  </li>
                ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Capacités */}
      {station.capacites?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Capacités de stockage</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-6 text-sm">
              {station.capacites.map((c) => (
                <li key={c.CapaciteID}>
                  {c.TypeCarburant} – {c.CapaciteLitres.toLocaleString('fr-FR')} tonnes
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Localisation */}
      {(station.station.Latitude || station.station.Longitude) && (
        <Card>
          <CardHeader>
            <CardTitle>Localisation</CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ height: '400px', width: '100%' }}>
              <GoogleMap stations={[station]} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Analyses */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Analyses</CardTitle>
            <Button onClick={handleCreateAnalyse} disabled={isArchived}>
              Ajouter une analyse
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {analysesLoading && <LoadingSpinner />}
          {analysesError && <ErrorMessage message={analysesError} />}
          {!analysesLoading && !analysesError && (
            <AnalyseTable
              analyses={stationAnalyses}
              onEdit={handleEditAnalyse}
            />
          )}
        </CardContent>
      </Card>

      <Modal isOpen={showStationForm} onClose={() => setShowStationForm(false)} size="lg">
        <StationForm
          mode={editingStation ? 'edit' : 'create'}
          station={editingStation}
          onSaved={handleStationFormSaved}
          onCancel={() => setShowStationForm(false)}
        />
      </Modal>

      <Modal isOpen={showAnalyseForm} onClose={handleAnalyseFormCancel}>
        <AnalyseForm
          mode={analyseFormMode}
          stationId={id}
          stationCode={String(station.station.Code) || 'N/A'}
          initialAnalyses={initialAnalyses}
          onSaved={handleAnalyseFormSaved}
          onCancel={handleAnalyseFormCancel}
        />
      </Modal>
    </div>
  );
}