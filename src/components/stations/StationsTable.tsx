// src\components\stations\StationsTable.tsx
'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { StationWithDetails } from '@/types/station';
import { SortConfig, FilterConfig } from '@/types/table';
import TableHeader from './TableHeader';
import TablePagination from './TablePagination';
import { getProprietaireName } from '@/utils/format';
import { formatDate } from '@/utils/format';

export interface StationsTableProps {
  stations: StationWithDetails[];
  fullStations: StationWithDetails[];
  filters: FilterConfig[];
  onFilterChange: (key: string, value: string) => void;
  onEdit: (station: StationWithDetails) => void;
  onDelete: (station: StationWithDetails) => void;
  sortConfig: SortConfig;
  onSortChange: (config: SortConfig) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageSize?: number;
  onRowDoubleClick: (stationId: string) => void;
  onExport: (filteredStations: StationWithDetails[]) => void;
  triggerExport: boolean;
}

export const getCellValue = (station: StationWithDetails, key: string): string => {
  switch (key) {
    case 'Code':
      return String(station.station.Code || '');
    case 'NomStation':
      return station.station.NomStation || '';
    case 'Adresse':
      return station.station.Adresse || '';
    case 'NomCommune':
      return station.commune?.NomCommune || '';
    case 'NomProvince':
      return station.province?.NomProvince || '';
    case 'Marque':
      return station.marque?.Marque || '';
    case 'Gerant':
      return safeFullName(station.gerant?.PrenomGerant, station.gerant?.NomGerant) || '';
    case 'Proprietaire':
      return getProprietaireName(station) || '';
    case 'Type':
      return station.station.Type || '';
    case 'Statut':
      return station.station.Statut || '';
    case 'TypeGerance':
      return station.station.TypeGerance || '';
    case 'CapaciteSSP':
      return String(
        station.capacites
          .filter(c => c.TypeCarburant === 'SSP')
          .reduce((sum, c) => sum + (c.CapaciteLitres || 0), 0)
      );
    case 'CapaciteGasoil':
      return String(
        station.capacites
          .filter(c => c.TypeCarburant === 'Gasoil')
          .reduce((sum, c) => sum + (c.CapaciteLitres || 0), 0)
      );
    case 'NumeroCreation':
      return station.creationAutorisation?.NumeroAutorisation || '';
    case 'DateCreation':
      return station.creationAutorisation?.DateAutorisation
        ? formatDate(station.creationAutorisation.DateAutorisation)
        : '';
    case 'NumeroMiseEnService':
      return station.miseEnServiceAutorisation?.NumeroAutorisation || '';
    case 'DateMiseEnService':
      return station.miseEnServiceAutorisation?.DateAutorisation
        ? formatDate(station.miseEnServiceAutorisation.DateAutorisation)
        : '';
    case 'Commentaire':
      return station.station.Commentaires || '';
    case 'NombreVolucompteur':
      return String(station.station.NombreVolucompteur ?? '');
    case 'Latitude':
      return String(station.station.Latitude || '');
    case 'Longitude':
      return String(station.station.Longitude || '');
    default:
      return '';
  }
};

function safeFullName(first?: string, last?: string) {
  return `${first || ''} ${last || ''}`.trim() || '-';
}

export default function StationsTable({
  stations,
  fullStations,
  filters,
  onFilterChange,
  onEdit,
  onDelete,
  sortConfig,
  onSortChange,
  currentPage,
  totalPages,
  onPageChange,
  pageSize = 7,
  onRowDoubleClick,
  onExport,
  triggerExport,
}: StationsTableProps) {
  const filterValues = useMemo(() => {
    // Start with the filtered stations based on current filters
    let filteredStations = fullStations;

    // Apply existing filters to get dependent values
    filters.forEach(filter => {
      filteredStations = filteredStations.filter(station => {
        const value = getCellValue(station, filter.key).toLowerCase();
        const filterValues = filter.value.toLowerCase().split('|');
        return filterValues.some(filterValue => value.includes(filterValue));
      });
    });

    return {
      Code: [...new Set(filteredStations.map(s => String(s.station.Code || '')))].sort(),
      NomStation: [...new Set(filteredStations.map(s => s.station.NomStation || ''))].sort(),
      Adresse: [...new Set(filteredStations.map(s => s.station.Adresse || ''))].sort(),
      NomCommune: [...new Set(filteredStations.map(s => s.commune?.NomCommune || ''))].sort(),
      NomProvince: [...new Set(filteredStations.map(s => s.province?.NomProvince || ''))].sort(),
      Marque: [...new Set(filteredStations.map(s => s.marque?.Marque || ''))].sort(),
      Gerant: [...new Set(filteredStations.map(s => 
        safeFullName(s.gerant?.PrenomGerant, s.gerant?.NomGerant) || ''
      ))].sort(),
      Proprietaire: [...new Set(filteredStations.map(s => getProprietaireName(s) || ''))].sort(),
      Type: [...new Set(filteredStations.map(s => s.station.Type || ''))].sort(),
      Statut: [...new Set(filteredStations.map(s => s.station.Statut || ''))].sort(),
      TypeGerance: [...new Set(filteredStations.map(s => s.station?.TypeGerance || ''))].sort(),
      CapaciteSSP: [...new Set(filteredStations.map(s => 
        String(s.capacites
          .filter(c => c.TypeCarburant === 'SSP')
          .reduce((sum, c) => sum + (c.CapaciteLitres || 0), 0))
      ))].sort(),
      CapaciteGasoil: [...new Set(filteredStations.map(s => 
        String(s.capacites
          .filter(c => c.TypeCarburant === 'Gasoil')
          .reduce((sum, c) => sum + (c.CapaciteLitres || 0), 0))
      ))].sort(),
      NumeroCreation: [...new Set(filteredStations.map(s => 
        s.creationAutorisation?.NumeroAutorisation || ''
      ))].sort(),
      DateCreation: [...new Set(filteredStations.map(s => 
        s.creationAutorisation?.DateAutorisation ? 
          formatDate(s.creationAutorisation.DateAutorisation) : ''
      ))].sort(),
      NumeroMiseEnService: [...new Set(filteredStations.map(s => 
        s.miseEnServiceAutorisation?.NumeroAutorisation || ''
      ))].sort(),
      DateMiseEnService: [...new Set(filteredStations.map(s => 
        s.miseEnServiceAutorisation?.DateAutorisation ? 
          formatDate(s.miseEnServiceAutorisation.DateAutorisation) : ''
      ))].sort(),
      Commentaire: [...new Set(filteredStations.map(s => s.station.Commentaires || ''))].sort(),
      NombreVolucompteur: [...new Set(filteredStations.map(s => 
        String(s.station.NombreVolucompteur ?? '')
      ))].sort(),
      Latitude: [...new Set(filteredStations.map(s => String(s.station.Latitude || '')))].sort(),
      Longitude: [...new Set(filteredStations.map(s => String(s.station.Longitude || '')))].sort(),
    };
  }, [fullStations, filters]); // Add filters as dependency

  const getFilterValue = (key: string) => {
    return filters.find(filter => filter.key === key)?.value || '';
  };

  const sortedStations = stations;
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const visible = sortedStations.slice(startIndex, endIndex);

  const actualCurrentPage = currentPage;
  const actualTotalPages = totalPages;

  useEffect(() => {
    if (triggerExport) {
      onExport(sortedStations);
    }
  }, [triggerExport, onExport, sortedStations]);

  if (visible.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <TableHeader label="Code" sortKey="Code" sortConfig={sortConfig} onSortChange={onSortChange} width="80px" />
              <TableHeader label="Marque" sortKey="Marque" sortConfig={sortConfig} onSortChange={onSortChange} filterValues={filterValues.Marque} selectedFilterValue={getFilterValue('Marque')} onFilterChange={onFilterChange} />
              <TableHeader label="Nom Station" sortKey="NomStation" sortConfig={sortConfig} onSortChange={onSortChange} />
              <TableHeader label="Propriétaire" sortKey="Proprietaire" sortConfig={sortConfig} onSortChange={onSortChange} />
              <TableHeader label="Gérant" sortKey="Gerant" sortConfig={sortConfig} onSortChange={onSortChange} />
              <TableHeader label="Adresse" sortKey="Adresse" sortConfig={sortConfig} onSortChange={onSortChange} />
              <TableHeader label="Province" sortKey="NomProvince" sortConfig={sortConfig} onSortChange={onSortChange} filterValues={filterValues.NomProvince} selectedFilterValue={getFilterValue('NomProvince')} onFilterChange={onFilterChange} />
              <TableHeader label="Commune" sortKey="NomCommune" sortConfig={sortConfig} onSortChange={onSortChange} filterValues={filterValues.NomCommune} selectedFilterValue={getFilterValue('NomCommune')} onFilterChange={onFilterChange} />
              <TableHeader label="Latitude" sortKey="Latitude" sortConfig={sortConfig} onSortChange={onSortChange} />
              <TableHeader label="Longitude" sortKey="Longitude" sortConfig={sortConfig} onSortChange={onSortChange} />
              <TableHeader label="Type" sortKey="Type" sortConfig={sortConfig} onSortChange={onSortChange} filterValues={filterValues.Type} selectedFilterValue={getFilterValue('Type')} onFilterChange={onFilterChange} />
              <TableHeader label="Cap SSP" sortKey="CapaciteSSP" sortConfig={sortConfig} onSortChange={onSortChange} />
              <TableHeader label="Cap Gasoil" sortKey="CapaciteGasoil" sortConfig={sortConfig} onSortChange={onSortChange} />
              <TableHeader label="Statut" sortKey="Statut" sortConfig={sortConfig} onSortChange={onSortChange} filterValues={filterValues.Statut} selectedFilterValue={getFilterValue('Statut')} onFilterChange={onFilterChange} />
              <TableHeader label="Gérance" sortKey="TypeGerance" sortConfig={sortConfig} onSortChange={onSortChange} filterValues={filterValues.TypeGerance} selectedFilterValue={getFilterValue('TypeGerance')} onFilterChange={onFilterChange} />
              <TableHeader label="N° Création" sortKey="NumeroCreation" sortConfig={sortConfig} onSortChange={onSortChange} />
              <TableHeader label="Date Création" sortKey="DateCreation" sortConfig={sortConfig} onSortChange={onSortChange} />
              <TableHeader label="N° MES" sortKey="NumeroMiseEnService" sortConfig={sortConfig} onSortChange={onSortChange} />
              <TableHeader label="Date MES" sortKey="DateMiseEnService" sortConfig={sortConfig} onSortChange={onSortChange} />
              <TableHeader label="Commentaire" sortKey="Commentaire" sortConfig={sortConfig} onSortChange={onSortChange} />
              <TableHeader label="Nombre de Volucompteur" sortKey="NombreVolucompteur" sortConfig={sortConfig} onSortChange={onSortChange} />
              <th className="px-4 py-3 w-24 sticky top-0 bg-gray-50"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {visible.map((s) => {
              const capSSP = s.capacites.filter(c => c.TypeCarburant === 'SSP').reduce((sum, c) => sum + (c.CapaciteLitres || 0), 0) || '-';
              const capGasoil = s.capacites.filter(c => c.TypeCarburant === 'Gasoil').reduce((sum, c) => sum + (c.CapaciteLitres || 0), 0) || '-';

              return (
                <tr
                  key={s.station.StationID}
                  className="hover:bg-gray-50 cursor-pointer"
                  onDoubleClick={() => onRowDoubleClick(s.station.StationID)}
                >
                  <td className="px-4 py-3 truncate" title={s.station.Code?.toString()}>
                    <div className="text-sm text-gray-900">{s.station.Code || '-'}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-900 truncate" title={s.marque?.Marque}>{s.marque?.Marque || '-'}</div>
                    {s.marque?.RaisonSociale && (
                      <div className="text-xs text-gray-500 truncate" title={s.marque.RaisonSociale}>{s.marque.RaisonSociale}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 truncate" title={s.station.NomStation}>{s.station.NomStation || '-'}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-900 truncate" title={getProprietaireName(s)}>{getProprietaireName(s)}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-900 truncate">
                      {safeFullName(s.gerant?.PrenomGerant, s.gerant?.NomGerant)}
                    </div>
                    {s.gerant && (
                      <div className="text-xs text-gray-500 truncate">
                        {[s.gerant.CINGerant].filter(Boolean) || '-'}
                        <br />
                        {[s.gerant.Telephone].filter(Boolean) || '-'}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-900 truncate" title={s.station.Adresse}>{s.station.Adresse || '-'}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-900 truncate" title={s.province?.NomProvince}>{s.province?.NomProvince || '-'}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-900 truncate" title={s.commune?.NomCommune}>{s.commune?.NomCommune || '-'}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-900 truncate" title={s.station.Latitude?.toString()}>{s.station.Latitude || '-'}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-900 truncate" title={s.station.Longitude?.toString()}>{s.station.Longitude || '-'}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      s.station.Type === 'service'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {s.station.Type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-900">{capSSP}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-900">{capGasoil}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-900 truncate" title={s.station.Statut}>{s.station.Statut || '-'}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-900 truncate" title={s.station.TypeGerance}>
                      {s.station.TypeGerance || '-'}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-900 truncate" title={s.creationAutorisation?.NumeroAutorisation}>
                      {s.creationAutorisation?.NumeroAutorisation || '-'}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-900 truncate" title={s.creationAutorisation?.DateAutorisation ? formatDate(s.creationAutorisation.DateAutorisation) : '-'}>
                      {s.creationAutorisation?.DateAutorisation ? formatDate(s.creationAutorisation.DateAutorisation) : '-'}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-900 truncate" title={s.miseEnServiceAutorisation?.NumeroAutorisation}>
                      {s.miseEnServiceAutorisation?.NumeroAutorisation || '-'}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-900 truncate" title={s.miseEnServiceAutorisation?.DateAutorisation ? formatDate(s.miseEnServiceAutorisation.DateAutorisation) : '-'}>
                      {s.miseEnServiceAutorisation?.DateAutorisation ? formatDate(s.miseEnServiceAutorisation.DateAutorisation) : '-'}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-900 truncate" title={s.station.Commentaires}>
                      {s.station.Commentaires || '-'}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-900 truncate" title={String(s.station.NombreVolucompteur ?? '-')}>
                      {s.station.NombreVolucompteur ?? '-'}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => onEdit(s)}
                      className="text-blue-600 hover:text-blue-900 text-sm font-medium"
                    >
                      Modifier
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {visible.length > 0 && (
        <div className="px-4 py-3 border-t border-gray-200">
          <TablePagination
            currentPage={actualCurrentPage}
            totalPages={actualTotalPages}
            onPageChange={onPageChange}
          />
        </div>
      )}
    </div>
  );
}