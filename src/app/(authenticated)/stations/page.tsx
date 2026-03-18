// src\app\(authenticated)\stations\page.tsx
"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useStations } from "@/hooks/stations/useStations";
import { useDeleteStation } from "@/hooks/stations/useDeleteStation";
import { useAnalysesIndex } from "@/hooks/useStationData/useAnalysesIndex";
import StationsTable from "@/components/stations/StationsTable";
import { StationForm } from "@/components/stations/StationForm";
import TableActions from "@/components/stations/TableActions";
import { EmptyState } from "@/components/stations/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SortConfig, FilterConfig } from "@/types/table";
import { StationWithDetails } from "@/types/station";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
// import ExcelJS from 'exceljs'; // Removed top-level import
import { saveAs } from 'file-saver';
import { getProprietaireName } from '@/utils/format';
import { getCellValue } from '@/components/stations/StationsTable';
import { FilterTags } from '@/components/stations/FilterTags';

interface FileSystemHandle {
  kind: 'file' | 'directory';
  name: string;
}

interface FileSystemFileHandle extends FileSystemHandle {
  kind: 'file';
  getFile(): Promise<File>;
  createWritable(): Promise<FileSystemWritableFileStream>;
}

interface FileSystemWritableFileStream extends WritableStream {
  write(data: any): Promise<void>;
  seek(position: number): Promise<void>;
  truncate(size: number): Promise<void>;
}

interface SaveFilePickerOptions {
  suggestedName?: string;
  types?: Array<{
    description: string;
    accept: Record<string, string[]>;
  }>;
}

interface ExtendedWindow extends Window {
  showSaveFilePicker?: (options?: SaveFilePickerOptions) => Promise<FileSystemFileHandle>;
}

declare let window: ExtendedWindow;

function safeFullName(first?: string, last?: string) {
  return `${first || ''} ${last || ''}`.trim() || '-';
}

// Dynamic import for ExcelJS to prevent bundling during compilation
let ExcelJS: typeof import("exceljs");

async function loadExcel() {
  if (!ExcelJS) {
    ExcelJS = await import("exceljs");
  }
  return ExcelJS;
}

const exportToExcel = async (stations: StationWithDetails[], filename: string) => {
  const Excel = await loadExcel();

  const workbook = new Excel.Workbook();
  const worksheet = workbook.addWorksheet('Stations');

  worksheet.columns = [
    { header: 'Code', key: 'Code', width: 15 },
    { header: 'Marque', key: 'Marque', width: 20 },
    { header: 'Raison Sociale', key: 'RaisonSociale', width: 25 },
    { header: 'Nom Station', key: 'NomStation', width: 25 },
    { header: 'Propriétaire', key: 'Proprietaire', width: 25 },
    { header: 'Gérant', key: 'Gerant', width: 20 },
    { header: 'CIN Gérant', key: 'CINGerant', width: 15 },
    { header: 'Téléphone', key: 'Telephone', width: 15 },
    { header: 'Adresse', key: 'Adresse', width: 30 },
    { header: 'Province', key: 'NomProvince', width: 15 },
    { header: 'Commune', key: 'NomCommune', width: 15 },
    { header: 'Latitude', key: 'Latitude', width: 10 },
    { header: 'Longitude', key: 'Longitude', width: 10 },
    { header: 'Type', key: 'Type', width: 15 },
    { header: 'Capacité SSP', key: 'CapaciteSSP', width: 15 },
    { header: 'Capacité Gasoil', key: 'CapaciteGasoil', width: 15 },
    { header: 'Statut', key: 'Statut', width: 15 },
    { header: 'Type de Gérance', key: 'TypeGerance', width: 15 },
    { header: 'N° Création', key: 'NumeroCreation', width: 15 },
    { header: 'Date Création', key: 'DateCreation', width: 15 },
    { header: 'N° Mise en service', key: 'NumeroMiseEnService', width: 15 },
    { header: 'Date Mise en service', key: 'DateMiseEnService', width: 15 },
    { header: 'Commentaires', key: 'Commentaires', width: 30 },
    { header: 'Nombre Volucompteur', key: 'NombreVolucompteur', width: 15 },
  ];

  stations.forEach(station => {
    worksheet.addRow({
      Code: station.station.Code || '',
      Marque: station.marque?.Marque || '',
      RaisonSociale: station.marque?.RaisonSociale || '',
      NomStation: station.station.NomStation || '',
      Proprietaire: getProprietaireName(station) || '',
      Gerant: safeFullName(station.gerant?.PrenomGerant, station.gerant?.NomGerant),
      CINGerant: station.gerant?.CINGerant || '',
      Telephone: station.gerant?.Telephone || '',
      Adresse: station.station.Adresse || '',
      NomProvince: station.province?.NomProvince || '',
      NomCommune: station.commune?.NomCommune || '',
      Latitude: station.station.Latitude || '',
      Longitude: station.station.Longitude || '',
      Type: station.station.Type || '',
      CapaciteSSP: station.capacites
        .filter(c => c.TypeCarburant === 'SSP')
        .reduce((sum, c) => sum + (c.CapaciteLitres || 0), 0),
      CapaciteGasoil: station.capacites
        .filter(c => c.TypeCarburant === 'Gasoil')
        .reduce((sum, c) => sum + (c.CapaciteLitres || 0), 0),
      Statut: station.station.Statut || '',
      TypeGerance: station.station.TypeGerance || '',
      NumeroCreation: station.creationAutorisation?.NumeroAutorisation || '',
      DateCreation: station.creationAutorisation?.DateAutorisation
        ? new Date(station.creationAutorisation.DateAutorisation).toLocaleDateString()
        : '',
      NumeroMiseEnService: station.miseEnServiceAutorisation?.NumeroAutorisation || '',
      DateMiseEnService: station.miseEnServiceAutorisation?.DateAutorisation
        ? new Date(station.miseEnServiceAutorisation.DateAutorisation).toLocaleDateString()
        : '',
      Commentaires: station.station.Commentaires || '',
      NombreVolucompteur: station.station.NombreVolucompteur || '',
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `${filename}.xlsx`);
};

export default function StationsPage() {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [editingStation, setEditingStation] = useState<StationWithDetails | undefined>(undefined);
  const [stationToDelete, setStationToDelete] = useState<StationWithDetails | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'Code', direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [columnFilters, setColumnFilters] = useState<FilterConfig[]>([{ key: 'Statut', value: 'en activité' }]);
  const [analysisStatus, setAnalysisStatus] = useState<'all' | 'analysed' | 'not-analysed'>('all');
  const [analysisYear, setAnalysisYear] = useState<number[]>([]);
  const [triggerExport, setTriggerExport] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const { stations, loading, error, refetch } = useStations();
  const { deleteStation, loading: deleteLoading } = useDeleteStation();
  
  // Get station IDs and fetch analyses - with proper memoization
  const stationIds = useMemo(() => stations.map(s => s.station.StationID), [stations]);
  const { analyses, years, loading: analysesLoading } = useAnalysesIndex(stationIds);

  // Update stations with analyses when both data are loaded
  const stationsWithAnalyses = useMemo(() => {
    if (loading || analysesLoading) return [];
    
    return stations.map(s => ({
      ...s,
      analyses: analyses.filter(a => a.StationID === s.station.StationID)
    }));
  }, [stations, analyses, loading, analysesLoading]);

  // Helper function to check if a station has analyses in specific years
  const stationHasAnalysesInYears = useCallback((station: StationWithDetails, selectedYears: number[]) => {
    if (selectedYears.length === 0) return true; // No year filter means all years
    
    const stationAnalyses = analyses.filter(a => a.StationID === station.station.StationID);
    
    return selectedYears.some(year => 
      stationAnalyses.some(a => 
        a.DateAnalyse && 
        a.DateAnalyse instanceof Date && 
        !isNaN(a.DateAnalyse.getTime()) && 
        a.DateAnalyse.getFullYear() === year
      )
    );
  }, [analyses]);

  // Helper function to check if a station has NO analyses in ALL selected years
  const stationHasNoAnalysesInYears = useCallback((station: StationWithDetails, selectedYears: number[]) => {
    if (selectedYears.length === 0) return true; // No year filter means all years
    
    const stationAnalyses = analyses.filter(a => a.StationID === station.station.StationID);
    
    // Station must have no analyses for ALL selected years
    return selectedYears.every(year => {
      const hasAnalysisInYear = stationAnalyses.some(a => 
        a.DateAnalyse && 
        a.DateAnalyse instanceof Date && 
        !isNaN(a.DateAnalyse.getTime()) && 
        a.DateAnalyse.getFullYear() === year
      );
      return !hasAnalysisInYear;
    });
  }, [analyses]);

  const handleAddNew = () => {
    setEditingStation(undefined);
    setShowForm(true);
  };

  const handleEdit = (station: StationWithDetails) => {
    setEditingStation(station);
    setShowForm(true);
  };

  const handleDelete = (station: StationWithDetails) => {
    setStationToDelete(station);
  };

  const confirmDelete = async () => {
    if (stationToDelete) {
      try {
        await deleteStation(stationToDelete.station.StationID);
        setStationToDelete(undefined); // Close dialog on success
      } catch (err) {
        console.error('Deletion failed:', err);
      }
    }
  };

  const handleFormSaved = () => {
    setShowForm(false);
    setEditingStation(undefined);
    refetch();
  };

  const handleSortChange = (config: SortConfig) => {
    setSortConfig(config);
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleFilterChange = useCallback((key: string, value: string) => {
    setColumnFilters(prev => {
      const newFilters = prev.filter(filter => filter.key !== key);
      if (value) {
        newFilters.push({ key, value });
      }
      return newFilters;
    });
    setCurrentPage(1);
  }, []);

  const handleRefresh = () => {
    refetch();
  };

  const handleExportTrigger = () => {
    setTriggerExport(true);
    setIsExporting(true);
  };

  const handleExport = (filteredStations: StationWithDetails[]) => {
    exportToExcel(filteredStations, 'stations');
    setTriggerExport(false);
    setIsExporting(false);
  };

  const handleRowDoubleClick = (stationId: string) => {
    router.push(`/stations/${stationId}`);
  };

  // Global filtering (search + analysis filter)
  const globalFiltered = useMemo(() => {
    let result = [...stationsWithAnalyses];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(s =>
        s.station.NomStation?.toLowerCase().includes(query) ||
        s.station.Adresse?.toLowerCase().includes(query) ||
        s.marque?.Marque?.toLowerCase().includes(query) ||
        s.commune?.NomCommune?.toLowerCase().includes(query) ||
        s.province?.NomProvince?.toLowerCase().includes(query) ||
        getProprietaireName(s)?.toLowerCase().includes(query) ||
        safeFullName(s.gerant?.PrenomGerant, s.gerant?.NomGerant).toLowerCase().includes(query)
      );
    }

    // Analysis status and year filter
    if (analysisStatus !== 'all') {
      result = result.filter(s => {
        const hasAnalyses = s.analyses && s.analyses.length > 0;
        
        if (analysisStatus === 'analysed') {
          if (!hasAnalyses) return false;
          
          // If specific years are selected, check if station has analyses in those years
          if (analysisYear.length > 0) {
            return stationHasAnalysesInYears(s, analysisYear);
          }
          
          return true; // Has analyses, no specific year filter
        } else if (analysisStatus === 'not-analysed') {
          // If specific years are selected, check if station has no analyses in all those years
          if (analysisYear.length > 0) {
            return stationHasNoAnalysesInYears(s, analysisYear);
          }
          
          return !hasAnalyses; // No analyses at all
        }
        
        return true;
      });
    }

    return result;
  }, [stationsWithAnalyses, searchQuery, analysisStatus, analysisYear, stationHasAnalysesInYears, stationHasNoAnalysesInYears]);

  // Column filtering
  const allFiltered = useMemo(() => {
    if (columnFilters.length === 0) return globalFiltered;

    return globalFiltered.filter(s => 
      columnFilters.every(filter => {
        const value = getCellValue(s, filter.key).toLowerCase();
        const filterValues = filter.value.toLowerCase().split('|');
        return filterValues.some(filterValue => value.includes(filterValue));
      })
    );
  }, [globalFiltered, columnFilters]);

  const sortedStations = useMemo(() => {
    const sorted = [...allFiltered];
    sorted.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortConfig.key) {
        case 'Code':
          aValue = a.station.Code || 0;
          bValue = b.station.Code || 0;
          break;
        case 'NomStation':
          aValue = a.station.NomStation || '';
          bValue = b.station.NomStation || '';
          break;
        case 'Adresse':
          aValue = a.station.Adresse || '';
          bValue = b.station.Adresse || '';
          break;
        case 'NomCommune':
          aValue = a.commune?.NomCommune || '';
          bValue = b.commune?.NomCommune || '';
          break;
        case 'NomProvince':
          aValue = a.province?.NomProvince || '';
          bValue = b.province?.NomProvince || '';
          break;
        case 'Marque':
          aValue = a.marque?.Marque || '';
          bValue = b.marque?.Marque || '';
          break;
        case 'Gerant':
          aValue = safeFullName(a.gerant?.PrenomGerant, a.gerant?.NomGerant) || '';
          bValue = safeFullName(b.gerant?.PrenomGerant, b.gerant?.NomGerant) || '';
          break;
        case 'Proprietaire':
          aValue = getProprietaireName(a) || '';
          bValue = getProprietaireName(b) || '';
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [allFiltered, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(sortedStations.length / 7));
  const validCurrentPage = Math.min(currentPage, totalPages);

  const handleResetAllFilters = useCallback(() => {
    setColumnFilters([]);
    setSearchQuery('');
    setAnalysisStatus('all');
    setAnalysisYear([]);
    setCurrentPage(1);
    setSortConfig({ key: 'Code', direction: 'asc' });
  }, []);

  if (loading || analysesLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <ErrorMessage message={error} onRetry={refetch} />
      </div>
    );
  }

  const hasSearch = searchQuery.trim().length > 0;
  const showEmptyState = sortedStations.length === 0;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Stations-service</h1>
        <p className="text-sm text-gray-600">Gestion des stations avec structure normalisée.</p>
      </div>

      <TableActions
        onAddNew={handleAddNew}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        totalStations={allFiltered.length}
        onRefresh={handleRefresh}
        onExport={handleExportTrigger}
        isExporting={isExporting}
        analysisStatus={analysisStatus}
        onAnalysisStatusChange={setAnalysisStatus}
        analysisYear={analysisYear}
        onAnalysisYearChange={setAnalysisYear}
        years={years}
        analysesLoading={analysesLoading}
        onResetAllFilters={handleResetAllFilters}
      />

      <FilterTags 
        filters={columnFilters} 
        onRemoveFilter={(key) => handleFilterChange(key, '')} 
      />

      {showEmptyState ? (
        <EmptyState
          hasSearch={hasSearch}
          searchQuery={searchQuery}
          totalStations={stations.length}
        />
      ) : (
        <StationsTable
          stations={sortedStations}
          fullStations={globalFiltered}
          filters={columnFilters}
          onFilterChange={handleFilterChange}
          onEdit={handleEdit}
          onDelete={handleDelete}
          sortConfig={sortConfig}
          onSortChange={handleSortChange}
          currentPage={validCurrentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          pageSize={7}
          onRowDoubleClick={handleRowDoubleClick}
          onExport={handleExport}
          triggerExport={triggerExport}
        />
      )}

      <Modal
        isOpen={showForm}
        onClose={() => {
          setShowForm(false);
          setEditingStation(undefined);
        }}
        title={editingStation ? "Modifier la station" : "Créer une station"}
        size="xl"
      >
        <StationForm
          mode={editingStation ? "edit" : "create"}
          station={editingStation}
          onSaved={handleFormSaved}
          onCancel={() => {
            setShowForm(false);
            setEditingStation(undefined);
          }}
        />
      </Modal>

      <ConfirmDialog
        isOpen={!!stationToDelete}
        onClose={() => setStationToDelete(undefined)}
        onConfirm={confirmDelete}
        title="Confirmer la suppression"
        message={`Êtes-vous sûr de vouloir supprimer la station "${stationToDelete?.station.NomStation}" ? Cette action est irréversible.`}
        confirmText="Supprimer"
        cancelText="Annuler"
        isLoading={deleteLoading}
        variant="danger"
      />
    </div>
  );
}