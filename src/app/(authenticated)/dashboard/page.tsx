// src/app/(authenticated)/dashboard/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useStations } from '@/hooks/stations/useStations';
import { StationWithDetails } from '@/types/station';

// Import dashboard components
import StationFilters from '@/components/dashboard/StationFilters';
import StationsByBrandChart from '@/components/dashboard/StationsByBrandChart';
import StatsCards from '@/components/dashboard/StatsCards';
import MapPreview from '@/components/dashboard/MapPreview';

// Import from the UI barrel file
import { Card, CardHeader, CardContent, CardTitle, LoadingSpinner, ErrorMessage } from '@/components/ui';

export default function DashboardPage() {
  const { stations, loading, error } = useStations();
  const [filteredStations, setFilteredStations] = useState<StationWithDetails[]>([]);

  useEffect(() => {
    // Initialize filteredStations with all stations when stations are loaded
    if (!loading && stations.length > 0) {
      setFilteredStations(stations);
    }
  }, [stations, loading]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <ErrorMessage message={error} />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header Section */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Stations-service Dashboard</h1>
        <p className="text-sm text-gray-600 mt-1">Vue d'ensemble avec des filtres interactifs.</p>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Filters Panel - Takes ~1/3 (2/5) of the screen on desktop */}
        <div className="lg:col-span-2">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle>Filtres</CardTitle>
            </CardHeader>
            <CardContent className="max-h-[calc(100vh-180px)] overflow-auto min-w-0"> 
              <div className="min-w-0">
                <StationFilters 
                  stations={stations} 
                  onFilterChange={setFilteredStations} 
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Panel - Takes ~2/3 (3/5) of the screen on desktop */}
        <div className="lg:col-span-3 space-y-6">
          {/* Stats Cards Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Number of stations card will take 1/3 of space */}
            <div className="md:col-span-1">
              <StatsCards stations={filteredStations} mode="count" />
            </div>
            {/* Storage capacity card will take 2/3 of space */}
            <div className="md:col-span-2">
              <StatsCards stations={filteredStations} mode="capacity" />
            </div>
          </div>

          {/* Chart Card */}
          <Card>
            <CardHeader>
              <CardTitle>Distribution par Marque</CardTitle>
            </CardHeader>
            <CardContent>
              <StationsByBrandChart stations={filteredStations} />
            </CardContent>
          </Card>

          {/* Map Card */}
          <Card>
            <CardHeader>
              <CardTitle>Carte des stations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[500px] rounded-lg overflow-hidden">
                {process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ? (
                  <MapPreview stations={filteredStations} />
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-500 bg-gray-100">
                    Clé API Google Maps manquante.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}