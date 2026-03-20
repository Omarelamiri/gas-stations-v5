// src/components/dashboard/StationFilters.tsx
'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { StationWithDetails } from '@/types/station';
import { useAnalysesIndex } from '@/hooks/useStationData/useAnalysesIndex';
import { Card, Checkbox, CardHeader, CardContent, CardTitle } from '@/components/ui';
import { MultiSelectYearDropdown } from '@/components/stations/AnalyseFilter';

interface StationFiltersProps {
  stations: StationWithDetails[];
  onFilterChange: (filteredStations: StationWithDetails[]) => void;
}

const areAllSelected = (selected: string[], all: string[]) => {
  return all.length > 0 && selected.length === all.length;
};

const generateYearRange = (start: number, end: number): number[] => {
  const years: number[] = [];
  for (let year = start; year <= end; year++) {
    years.push(year);
  }
  return years.reverse(); // Most recent first
};

export default function StationFilters({ stations, onFilterChange }: StationFiltersProps) {
  // ----- Filter State -----
  const [selectedProvinces, setSelectedProvinces] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(['en activité']);
  const [selectedCommunes, setSelectedCommunes] = useState<string[]>([]);
  const [selectedMarques, setSelectedMarques] = useState<string[]>([]);
  const [analysisStatus, setAnalysisStatus] = useState<'all' | 'analysed' | 'not-analysed'>('all');
  const [analysisYear, setAnalysisYear] = useState<number[]>([]);

  // ----- Memoized Filter Options -----
  const provinces = useMemo(() => Array.from(new Set(stations.map(s => s.province.NomProvince.trim()))).sort(), [stations]);
  const marques = useMemo(() => Array.from(new Set(stations.map(s => s.marque.Marque.trim()))).sort(), [stations]);
  
  // Get all station IDs for analyses fetching
  const stationIds = useMemo(() => stations.map(s => s.station.StationID), [stations]);
  
  // Fetch all analyses
  const { analyses, years, loading: analysesLoading } = useAnalysesIndex(stationIds);

  const communes = useMemo(() => {
    if (selectedProvinces.length !== 1) return [];
    const province = selectedProvinces[0];
    const communeSet = new Set<string>();
    stations.forEach(s => {
      if (s.province.NomProvince.trim() === province) {
        communeSet.add(s.commune.NomCommune.trim());
      }
    });
    return Array.from(communeSet).sort();
  }, [stations, selectedProvinces]);

  const isCommuneFilterDisabled = selectedProvinces.length !== 1;

  // ----- Auto-select all on initial load -----
  useEffect(() => {
    if (provinces.length > 0) setSelectedProvinces(provinces);
  }, [provinces]);

  useEffect(() => {
    if (marques.length > 0) setSelectedMarques(marques);
  }, [marques]);

  useEffect(() => {
    if (!isCommuneFilterDisabled && communes.length > 0) {
      setSelectedCommunes(communes);
    }
  }, [communes, isCommuneFilterDisabled]);

  // ----- Filter Toggling Logic -----
  const toggleSelection = (setter: React.Dispatch<React.SetStateAction<string[]>>, item: string, checked: boolean) => {
    setter(prev => checked ? [...prev, item] : prev.filter(p => p !== item));
  };
  
  const handleProvinceToggle = (p: string, checked: boolean) => {
    setSelectedProvinces(prev => {
      const newSelection = checked ? [...prev, p] : prev.filter(item => item !== p);
      setSelectedCommunes([]); // Reset communes when province selection changes
      return newSelection;
    });
  };

  // ----- Analysis Filter Logic -----
  const computeYearOptions = (status: 'all' | 'analysed' | 'not-analysed') => {
    if (status === 'analysed') {
      return years.length > 0 ? [...years].sort((a, b) => b - a) : generateYearRange(2020, new Date().getFullYear());
    } else if (status === 'not-analysed') {
      return generateYearRange(2020, new Date().getFullYear());
    }
    return [];
  };

  const yearOptions = useMemo(() => computeYearOptions(analysisStatus), [analysisStatus, years]);

  const handleAnalysisStatusChange = (newStatus: 'all' | 'analysed' | 'not-analysed') => {
    const availableYears = computeYearOptions(newStatus);
    setAnalysisStatus(newStatus);
    
    if (newStatus !== 'all') {
      // Set current year as default
      const currentYear = new Date().getFullYear();
      
      if (availableYears.includes(currentYear)) {
        setAnalysisYear([currentYear]);
      } else if (availableYears.length > 0) {
        setAnalysisYear([availableYears[0]]);
      } else {
        setAnalysisYear([]);
      }
    } else {
      // Reset years when switching to 'all'
      setAnalysisYear([]);
    }
  };

  // Helper function to check if a station has analyses in specific years
  const stationHasAnalysesInYears = useCallback((station: StationWithDetails, selectedYears: number[]) => {
    if (selectedYears.length === 0) return true;
    
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
    if (selectedYears.length === 0) return true;
    
    const stationAnalyses = analyses.filter(a => a.StationID === station.station.StationID);
    
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

  // ----- Filtered Data Calculation -----
  const filteredStations = useMemo(() => {
    let result = stations.filter(s => {
      const province = s.province.NomProvince.trim();
      const commune = s.commune.NomCommune.trim();
      const marque = s.marque.Marque.trim();
      const status = s.station.Statut.trim();

      if (!selectedProvinces.includes(province)) return false;
      if (!isCommuneFilterDisabled && !selectedCommunes.includes(commune)) return false;
      if (!selectedMarques.includes(marque)) return false;
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(status)) return false;
      
      return true;
    });

    // Apply analysis filter if not loading
    if (!analysesLoading && analysisStatus !== 'all') {
      result = result.filter(s => {
        const hasAnalyses = analyses.some(a => a.StationID === s.station.StationID);
        
        if (analysisStatus === 'analysed') {
          if (!hasAnalyses) return false;
          
          if (analysisYear.length > 0) {
            return stationHasAnalysesInYears(s, analysisYear);
          }
          
          return true;
        } else if (analysisStatus === 'not-analysed') {
          if (analysisYear.length > 0) {
            return stationHasNoAnalysesInYears(s, analysisYear);
          }
          
          return !hasAnalyses;
        }
        
        return true;
      });
    }

    return result;
  }, [stations, selectedProvinces, selectedCommunes, selectedMarques, isCommuneFilterDisabled, selectedStatuses, analysesLoading, analysisStatus, analysisYear, analyses, stationHasAnalysesInYears, stationHasNoAnalysesInYears]);

  // ----- Inform Parent of Changes -----
  useEffect(() => {
    onFilterChange(filteredStations);
  }, [filteredStations, onFilterChange]);

  // Handler functions
  const handleSelectAllProvinces = (checked: boolean) => {
    setSelectedProvinces(checked ? provinces : []);
    if (!checked) setSelectedCommunes([]); // Clear communes when deselecting all provinces
  };

  const handleSelectAllCommunes = (checked: boolean) => {
    setSelectedCommunes(checked ? communes : []);
  };

  const handleSelectAllMarques = (checked: boolean) => {
    setSelectedMarques(checked ? marques : []);
  };

  const handleSelectAllStatuses = (checked: boolean) => {
    setSelectedStatuses(checked ? ['en activité', 'en projet', 'en arrêt', 'archivé'] : []);
  };

  return (
    <div className="grid grid-cols-1 gap-4 min-w-0">
      {/* Province and Commune in first row */}
      <Card className="col-span-1 min-w-0">
        <CardHeader className="border-b">
          <CardTitle>Province</CardTitle>
        </CardHeader>
        <CardContent className="h-[250px]">
          <div className="pb-2 border-b">
            <Checkbox
              id="select-all-provinces"
              checked={areAllSelected(selectedProvinces, provinces)}
              onCheckedChange={handleSelectAllProvinces}
            >
              <span className="ml-2 text-sm">
                {areAllSelected(selectedProvinces, provinces) ? "Déselectionner tous" : "Sélectionner tous"}
              </span>
            </Checkbox>
          </div>
          <div className="h-[calc(100%-2.5rem)] mt-2 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
            {provinces.map(p => (
              <div key={p} className="flex items-center py-1.5">
                <Checkbox 
                  id={`p-${p}`} 
                  checked={selectedProvinces.includes(p)} 
                  onCheckedChange={c => handleProvinceToggle(p, !!c)} 
                />
                <label htmlFor={`p-${p}`} className="ml-2 text-sm">{p}</label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="col-span-1 min-w-0">
        <CardHeader className="border-b">
          <CardTitle className={`${isCommuneFilterDisabled ? 'text-gray-400' : ''}`}>
            Commune
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[250px]">
          {!isCommuneFilterDisabled && (
            <div className="pb-2 border-b">
              <Checkbox
                id="select-all-communes"
                checked={areAllSelected(selectedCommunes, communes)}
                onCheckedChange={handleSelectAllCommunes}
              >
                <span className="ml-2 text-sm">
                  {areAllSelected(selectedCommunes, communes) ? "Déselectionner tous" : "Sélectionner tous"}
                </span>
              </Checkbox>
            </div>
          )}
          <div className={`${isCommuneFilterDisabled ? 'h-full' : 'h-[calc(100%-2.5rem)] mt-2'} overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent`}>
            {isCommuneFilterDisabled ? (
              <div className="h-full flex items-center justify-center text-sm text-gray-400 italic">
                Sélectionnez une seule province.
              </div>
            ) : (
              communes.map(c => (
                <div key={c} className="flex items-center py-1.5">
                  <Checkbox 
                    id={`c-${c}`} 
                    checked={selectedCommunes.includes(c)} 
                    onCheckedChange={s => toggleSelection(setSelectedCommunes, c, !!s)} 
                  />
                  <label htmlFor={`c-${c}`} className="ml-2 text-sm">{c}</label>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Marque and Status in second row */}
      <Card className="col-span-1 min-w-0">
        <CardHeader className="border-b">
          <CardTitle>Marque</CardTitle>
        </CardHeader>
        <CardContent className="h-[250px]">
          <div className="pb-2 border-b">
            <Checkbox
              id="select-all-marques"
              checked={areAllSelected(selectedMarques, marques)}
              onCheckedChange={handleSelectAllMarques}
            >
              <span className="ml-2 text-sm">
                {areAllSelected(selectedMarques, marques) ? "Déselectionner tous" : "Sélectionner tous"}
              </span>
            </Checkbox>
          </div>
          <div className="h-[calc(100%-2.5rem)] mt-2 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
            {marques.map(m => (
              <div key={m} className="flex items-center py-1.5">
                <Checkbox 
                  id={`m-${m}`} 
                  checked={selectedMarques.includes(m)} 
                  onCheckedChange={c => toggleSelection(setSelectedMarques, m, !!c)} 
                />
                <label htmlFor={`m-${m}`} className="ml-2 text-sm">{m}</label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="col-span-1 min-w-0">
        <CardHeader className="border-b">
          <CardTitle>Statut</CardTitle>
        </CardHeader>
        <CardContent className="h-[250px]">
          <div className="pb-2 border-b">
            <Checkbox
              id="select-all-statuses"
              checked={areAllSelected(selectedStatuses, ['en activité', 'en projet', 'en arrêt', 'archivé'])}
              onCheckedChange={handleSelectAllStatuses}
            >
              <span className="ml-2 text-sm">
                {areAllSelected(selectedStatuses, ['en activité', 'en projet', 'en arrêt', 'archivé']) 
                  ? "Déselectionner tous" 
                  : "Sélectionner tous"}
              </span>
            </Checkbox>
          </div>
          <div className="h-[calc(100%-2.5rem)] mt-2 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
            {['en activité','en projet','en arrêt','archivé'].map((s) => (
              <div key={s} className="flex items-center py-1.5">
                <Checkbox
                  id={`status-${s}`}
                  checked={selectedStatuses.includes(s)}
                  onCheckedChange={(checked) => {
                    setSelectedStatuses((prev) =>
                      checked ? [...prev, s] : prev.filter((x) => x !== s)
                    );
                  }}
                />
                <span className="ml-2 text-sm">{s}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Analysis filter takes full width */}
      <Card className="col-span-2">
        <CardHeader>
          <CardTitle>Analyse</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
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
                      setAnalysisStatus('all');
                      setAnalysisYear([]);
                    } else {
                      setAnalysisYear(years);
                    }
                  }}
                  yearOptions={yearOptions}
                  disabled={analysesLoading}
                  className="w-[200px]"
                />
              )}
            </div>
            
            {analysesLoading && (
              <div className="text-sm text-gray-500">Chargement des analyses...</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}