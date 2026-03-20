// src/components/stations/TableActions.tsx
'use client';

import { SearchInput, Button } from '@/components/ui';
import { RefreshCcw, FileSpreadsheet } from 'lucide-react';
import { MultiSelectYearDropdown } from '@/components/stations/AnalyseFilter';

interface TableActionsProps {
  onAddNew: () => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  totalStations: number;
  onRefresh: () => void;
  onExport: () => void;
  isExporting: boolean;
  analysisStatus: 'all' | 'analysed' | 'not-analysed';
  onAnalysisStatusChange: (status: 'all' | 'analysed' | 'not-analysed') => void;
  analysisYear: number[];
  onAnalysisYearChange: (years: number[]) => void;
  years: number[];
  analysesLoading?: boolean;
  onResetAllFilters: () => void;
}

const generateYearRange = (start: number, end: number): number[] => {
  const years: number[] = [];
  for (let year = start; year <= end; year++) {
    years.push(year);
  }
  return years.reverse(); // Most recent first
};

export default function TableActions({
  onAddNew,
  searchQuery,
  onSearchChange,
  totalStations,
  onRefresh,
  onExport,
  isExporting,
  analysisStatus,
  onAnalysisStatusChange,
  analysisYear,
  onAnalysisYearChange,
  years,
  analysesLoading,
  onResetAllFilters,
}: TableActionsProps) {
  // Compute year options based on a given status
  const computeYearOptions = (status: 'all' | 'analysed' | 'not-analysed') => {
    if (status === 'analysed') {
      return years.length > 0 ? [...years].sort((a, b) => b - a) : generateYearRange(2020, new Date().getFullYear());
    } else if (status === 'not-analysed') {
      return generateYearRange(2020, new Date().getFullYear());
    }
    return [];
  };

  // Generate year options based on analysis status
  const getYearOptions = () => {
    return computeYearOptions(analysisStatus);
  };

  const yearOptions = getYearOptions();

  const handleAnalysisStatusChange = (newStatus: 'all' | 'analysed' | 'not-analysed') => {
    const availableYears = computeYearOptions(newStatus);
    onAnalysisStatusChange(newStatus);
    
    if (newStatus !== 'all') {
      // Set current year as default when switching to analysed or not-analysed
      const currentYear = new Date().getFullYear();
      
      if (availableYears.includes(currentYear)) {
        onAnalysisYearChange([currentYear]);
      } else if (availableYears.length > 0) {
        // If current year not available, select the most recent year
        onAnalysisYearChange([availableYears[0]]);
      } else {
        onAnalysisYearChange([]);
      }
    } else {
      // Reset years when switching to 'all'
      onAnalysisYearChange([]);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-lg border">
      <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto min-w-0">
        <Button 
          onClick={onAddNew}
          variant="default" 
          className="min-w-[150px] bg-black hover:bg-gray-800"
        >
          Ajouter une station
        </Button>
        <Button
          onClick={onExport}
          disabled={isExporting}
          className="bg-[#217346] hover:bg-[#1a5c38] text-white flex items-center gap-2"
        >
          <FileSpreadsheet className="w-4 h-4" />
          {isExporting ? 'Exportation...' : 'Exporter le tableau'}
        </Button>
        <Button
          onClick={onResetAllFilters}
          variant="secondary"
          className="flex items-center gap-2"
        >
          <RefreshCcw className="w-4 h-4" />
          Rafraîchir
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 w-full md:w-auto min-w-0">
        <span className="text-sm font-medium text-gray-700">Analyses PP :</span>
        <select
          value={analysisStatus}
          onChange={(e) => {
            handleAnalysisStatusChange(e.target.value as 'all' | 'analysed' | 'not-analysed');
          }}
          className="w-[200px] px-3 py-1.5 border rounded text-sm"
          disabled={analysesLoading}
        >
          <option value="all">Toutes les stations</option>
          <option value="analysed">Stations Analysées</option>
          <option value="not-analysed">Stations Non Analysées</option>
        </select>

        {analysisStatus !== 'all' && (
          <MultiSelectYearDropdown
            selectedYears={analysisYear}
            onYearsChange={(years) => {
              if (years.length === 0) {
                // Reset analysis status when removing last year
                onAnalysisStatusChange('all');
                onAnalysisYearChange([]);
              } else {
                onAnalysisYearChange(years);
              }
            }}
            yearOptions={yearOptions}
            disabled={analysesLoading}
            className="w-[200px]"
          />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 w-full md:w-auto min-w-0 justify-end">
        <SearchInput
          value={searchQuery}
          onChange={onSearchChange}
          placeholder="Rechercher une station..."
          className="min-w-[180px]"
        />
        <div className="text-sm text-gray-500 whitespace-nowrap">
          {totalStations} station{totalStations !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  );
}