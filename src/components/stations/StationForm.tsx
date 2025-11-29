// src/components/stations/StationForm.tsx
'use client';

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { StationWithDetails, StationFormData } from '@/types/station';
import { useStationForm } from '@/hooks/stations/useStationForm';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { useMarques } from '@/hooks/ReferenceData/useMarques';
import { useProvinces } from '@/hooks/ReferenceData/useProvinces';
import { useCommunes } from '@/hooks/ReferenceData/useCommunes';
import { useGerants } from '@/hooks/ReferenceData/useGerants';
import { useProprietaires } from '@/hooks/ReferenceData/useProprietaires';

type AutorisationError = Partial<Record<'TypeAutorisation' | 'NumeroAutorisation' | 'DateAutorisation', string>>;

export interface StationFormProps {
  mode: 'create' | 'edit';
  station?: StationWithDetails | null;
  onSaved?: () => void;
  onCancel?: () => void;
}

// small helper to render label with optional required asterisk
const FieldLabel: React.FC<{ label: string; required?: boolean; className?: string }> = ({ label, required, className }) => (
  <label className={`text-sm font-medium text-gray-900 mb-1 ${className || ''}`}>
    {label} {required && <span className="text-red-600" title="Requis">*</span>}
  </label>
);

// Reusable Select component with consistent styling and optional hint
const Select: React.FC<{
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: { value: string; label: string; id?: string }[];
  error?: string;
  disabled?: boolean;
  name?: string;
  className?: string;
  required?: boolean;
  hint?: string;
}> = ({ label, value, onChange, options, error, disabled, name, className, required, hint }) => (
  <div className="flex flex-col">
    <FieldLabel label={label} required={required} />
    <select
      name={name}
      value={value}
      onChange={onChange}
      disabled={disabled}
      className={`flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm ${className || ''}`}
    >
      {options.map((opt, idx) => (
        <option key={opt.id || `${opt.value}-${idx}`} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
    {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
    {error && <span className="text-red-600 text-xs mt-1">{error}</span>}
  </div>
);

// Autocomplete Input Component with improved suggestion UI
const AutocompleteInput: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  onSelect: (item: any) => void;
  suggestions: any[];
  getSuggestionText: (item: any) => string;
  error?: string;
  name?: string;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
}> = ({ 
  label, 
  value, 
  onChange, 
  onSelect, 
  suggestions, 
  getSuggestionText, 
  error, 
  name,
  placeholder,
  disabled,
  readOnly,
  required
}) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<any[]>([]);

  useEffect(() => {
    if (value.trim() && showSuggestions) {
      const filtered = suggestions.filter((item) =>
        getSuggestionText(item).toLowerCase().includes(value.toLowerCase())
      );
      setFilteredSuggestions(filtered);
    } else {
      setFilteredSuggestions([]);
    }
  }, [value, showSuggestions, suggestions, getSuggestionText]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    setShowSuggestions(true);
  };

  const handleSelect = (item: any) => {
    onSelect(item);
    setShowSuggestions(false);
  };

  return (
    <div className="flex flex-col relative">
      <FieldLabel label={label} required={required} />
      <input
        name={name}
        type="text"
        value={value}
        onChange={handleInputChange}
        onFocus={() => setShowSuggestions(true)}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
        className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
        aria-autocomplete="list"
        autoComplete="off"
      />
      {error && <span className="text-sm text-red-500 mt-1">{error}</span>}
      {showSuggestions && filteredSuggestions.length > 0 && (
        <ul className="absolute top-full left-0 right-0 z-50 mt-1 max-h-44 overflow-auto rounded-md border border-gray-200 bg-white shadow-lg">
          {filteredSuggestions.map((item, index) => (
            <li
              key={index}
              onMouseDown={() => handleSelect(item)}
              className="cursor-pointer px-3 py-2 hover:bg-gray-100 text-sm flex items-center gap-2"
            >
              <span className="text-gray-700">{getSuggestionText(item)}</span>
            </li>
          ))}
        </ul>
      )}
      {showSuggestions && filteredSuggestions.length === 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-md border border-gray-200 bg-white p-2 text-sm text-gray-500">
          Aucun résultat
        </div>
      )}
    </div>
  );
};

export function StationForm({ mode, station, onSaved, onCancel }: StationFormProps) {
  const { 
    form, 
    updateField, 
    submit, 
    loading, 
    submitting, 
    errors, 
    updateAutorisationField, 
    addAutorisation, 
    removeAutorisation 
  } = useStationForm(mode, station || undefined);
  
  const { marques } = useMarques();
  const { provinces } = useProvinces();
  const { gerants } = useGerants();
  const { proprietaires } = useProprietaires();

  const selectedProvinceId = useMemo(() => {
    const p = provinces.find(p => p.NomProvince === form.Province);
    return p?.ProvinceID;
  }, [form.Province, provinces]);

  const { communes } = useCommunes(selectedProvinceId);

  const selectedMarqueRaisonSociale = useMemo(() => {
    const selectedMarque = marques.find(m => m.Marque === form.Marque);
    return selectedMarque?.RaisonSociale || '';
  }, [form.Marque, marques]);

  useEffect(() => {
    updateField('RaisonSociale', selectedMarqueRaisonSociale);
  }, [selectedMarqueRaisonSociale, updateField]);

  const autorisations = form.autorisations ?? [];

  // Get available autorisation types based on already selected types
  const getAvailableAutorisationTypes = useCallback((currentIndex: number) => {
    const selectedTypes = autorisations
      .map((a, idx) => idx !== currentIndex ? a.TypeAutorisation : null)
      .filter(Boolean);

    const allTypes: Array<'création' | 'mise en service'> = ['création', 'mise en service'];
    return allTypes.filter(type => !selectedTypes.includes(type));
  }, [autorisations]);

  // Handle autorisation type change with automatic adjustment
  const handleAutorisationTypeChange = useCallback((index: number, newType: 'création' | 'mise en service') => {
    updateAutorisationField(index, 'TypeAutorisation', newType);

    // If there's another autorisation, update it to the opposite type
    autorisations.forEach((auto, idx) => {
      if (idx !== index) {
        const oppositeType = newType === 'création' ? 'mise en service' : 'création';
        updateAutorisationField(idx, 'TypeAutorisation', oppositeType);
      }
    });
  }, [autorisations, updateAutorisationField]);

  // Handle adding autorisation - automatically set to opposite type
  const handleAddAutorisation = useCallback(() => {
    // Check what type is already used
    const existingType = autorisations[0]?.TypeAutorisation;
    const newType = existingType === 'création' ? 'mise en service' : 'création';
    
    // Add the autorisation with the opposite type
    addAutorisation();
    
    // Set the new autorisation to the opposite type after a brief delay
    // to ensure the new autorisation is added to the form state
    setTimeout(() => {
      updateAutorisationField(autorisations.length, 'TypeAutorisation', newType);
    }, 0);
  }, [autorisations, addAutorisation, updateAutorisationField]);

  // Handle gérant autocomplete selection
  const handleGerantSelect = useCallback((gerant: any) => {
    updateField('PrenomGerant', gerant.PrenomGerant || '');
    updateField('NomGerant', gerant.NomGerant || '');
    updateField('CINGerant', gerant.CINGerant || '');
    updateField('Telephone', gerant.Telephone || '');
  }, [updateField]);

  // Handle proprietaire autocomplete selection
  const handleProprietaireSelect = useCallback((prop: any) => {
    if (prop.TypeProprietaire === 'Physique') {
      updateField('TypeProprietaire', 'Physique');
      updateField('PrenomProprietaire', prop.details?.PrenomProprietaire || '');
      updateField('NomProprietaire', prop.details?.NomProprietaire || '');
      updateField('NomEntreprise', '');
    } else {
      updateField('TypeProprietaire', 'Morale');
      updateField('NomEntreprise', prop.details?.NomEntreprise || '');
      updateField('PrenomProprietaire', '');
      updateField('NomProprietaire', '');
    }
  }, [updateField]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await submit();
    if (ok) {
      onSaved?.();
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
  };

  // Filter proprietaires by type
  const filteredProprietaires = useMemo(() => {
    return proprietaires.filter(p => p.TypeProprietaire === form.TypeProprietaire);
  }, [proprietaires, form.TypeProprietaire]);

  // Create options with unique IDs for communes to avoid duplicate key warnings
  const communeOptions = useMemo(() => {
    return [
      { value: '', label: '-- choisir --', id: 'commune-empty' },
      ...communes.map((c, idx) => ({ 
        value: c.NomCommune, 
        label: c.NomCommune,
        id: c.CommuneID || `commune-${idx}` 
      }))
    ];
  }, [communes]);

  return (
    <form onSubmit={onSubmit} className="space-y-6 text-gray-900 station-form">

      {errors.__form && <ErrorMessage error={errors.__form} />}

      {/* General Information */}
      <fieldset className="space-y-4 bg-white p-4 rounded-lg shadow-sm border">
        <legend className="text-lg font-semibold pb-1 flex items-center gap-2">
          <span className="text-2xl">⛽</span>
          <span>Informations Générales</span>
        </legend>
        <p className="text-sm text-gray-500">Renseignez les informations de base de la station.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
          <Input
            label="Nom de la station"
            name="NomStation"
            value={form.NomStation || ''}
            onChange={(e) => updateField('NomStation', e.target.value)}
            error={errors.NomStation}
            placeholder="Ex: Station Centrale"
          />
          <Input
            label="Adresse"
            name="Adresse"
            value={form.Adresse || ''}
            onChange={(e) => updateField('Adresse', e.target.value)}
            error={errors.Adresse}
            placeholder="Rue, numéro, quartier"
          />
          <Input
            label="Latitude"
            name="Latitude"
            value={form.Latitude || ''}
            onChange={(e) => updateField('Latitude', e.target.value)}
            error={errors.Latitude}
            placeholder="Ex: 34.12345"
          />
          <Input
            label="Longitude"
            name="Longitude"
            value={form.Longitude || ''}
            onChange={(e) => updateField('Longitude', e.target.value)}
            error={errors.Longitude}
            placeholder="Ex: -6.12345"
          />
          <Select
            label="Type"
            value={form.Type || ''}
            onChange={(e) => updateField('Type', e.target.value)}
            options={[
              { value: 'service', label: 'Service', id: 'type-service' },
              { value: 'remplissage', label: 'Remplissage', id: 'type-remplissage' },
            ]}
            error={errors.Type}
          />
          <Select
            label="Marque"
            value={form.Marque || ''}
            onChange={(e) => updateField('Marque', e.target.value)}
            options={[
              { value: '', label: '-- choisir --', id: 'marque-empty' },
              ...marques.map(m => ({ value: m.Marque, label: m.Marque, id: m.MarqueID }))
            ]}
            error={errors.Marque}
            hint="Sélectionnez la marque si applicable"
          />
          <div className="md:col-span-2">
            <FieldLabel label="Raison Sociale" />
            <input
              type="text"
              readOnly
              disabled
              value={selectedMarqueRaisonSociale}
              className="mt-1 w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700"
              placeholder="La raison sociale apparaît ici après sélection de la marque"
            />
            {errors.RaisonSociale && <span className="text-red-600 text-xs mt-1">{errors.RaisonSociale}</span>}
          </div>
          <Select
            label="Province"
            value={form.Province || ''}
            onChange={(e) => updateField('Province', e.target.value)}
            options={[
              { value: '', label: '-- choisir --', id: 'province-empty' },
              ...provinces.map(p => ({ 
                value: p.NomProvince, 
                label: p.NomProvince,
                id: p.ProvinceID 
              }))
            ]}
            error={errors.Province}
            hint="Choisir la province permet de filtrer les communes"
          />
          <Select
            label="Commune"
            value={form.Commune || ''}
            onChange={(e) => updateField('Commune', e.target.value)}
            disabled={!selectedProvinceId}
            options={communeOptions}
            error={errors.Commune}
          />
        </div>
      </fieldset>

      {/* Gérant */}
      <fieldset className="space-y-4 bg-white p-4 rounded-lg shadow-sm border">
        <legend className="text-lg font-semibold pb-1 flex items-center gap-2">
          <span className="text-2xl">👤</span>
          <span>Gérant</span>
        </legend>
        <p className="text-sm text-gray-500">Sélectionnez un gérant existant ou tapez pour en créer un nouveau.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
          <AutocompleteInput
            label="Prénom du gérant"
            name="PrenomGerant"
            value={form.PrenomGerant || ''}
            onChange={(value) => updateField('PrenomGerant', value)}
            onSelect={handleGerantSelect}
            suggestions={gerants}
            getSuggestionText={(g) => `${g.PrenomGerant} ${g.NomGerant} (${g.CINGerant})`}
            error={errors.PrenomGerant}
            placeholder="Rechercher prénom ou sélectionner"
          />
          <AutocompleteInput
            label="Nom du gérant"
            name="NomGerant"
            value={form.NomGerant || ''}
            onChange={(value) => updateField('NomGerant', value)}
            onSelect={handleGerantSelect}
            suggestions={gerants}
            getSuggestionText={(g) => `${g.PrenomGerant} ${g.NomGerant} (${g.CINGerant})`}
            error={errors.NomGerant}
            placeholder="Rechercher nom ou sélectionner"
          />
          <AutocompleteInput
            label="CIN du gérant"
            name="CINGerant"
            value={form.CINGerant || ''}
            onChange={(value) => updateField('CINGerant', value)}
            onSelect={handleGerantSelect}
            suggestions={gerants}
            getSuggestionText={(g) => `${g.CINGerant} - ${g.PrenomGerant} ${g.NomGerant}`}
            error={errors.CINGerant}
            placeholder="Ex: AA123456"
          />
          <AutocompleteInput
            label="Téléphone"
            name="Telephone"
            value={form.Telephone || ''}
            onChange={(value) => updateField('Telephone', value)}
            onSelect={handleGerantSelect}
            suggestions={gerants}
            getSuggestionText={(g) => `${g.Telephone || ''} - ${g.PrenomGerant} ${g.NomGerant}`}
            error={errors.Telephone}
            placeholder="Ex: +212600000000"
          />
        </div>
      </fieldset>

      {/* Propriétaire */}
      <fieldset className="space-y-4 bg-white p-4 rounded-lg shadow-sm border">
        <legend className="text-lg font-semibold pb-1 flex items-center gap-2">
          <span className="text-2xl">🏢</span>
          <span>Propriétaire</span>
        </legend>
        <p className="text-sm text-gray-500">Indiquez si le propriétaire est une personne physique ou une entreprise.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
          <Select
            label="Type de propriétaire"
            value={form.TypeProprietaire || 'Physique'}
            onChange={(e) => updateField('TypeProprietaire', e.target.value)}
            options={[
              { value: 'Physique', label: 'Physique', id: 'prop-physique' },
              { value: 'Morale', label: 'Morale', id: 'prop-morale' }
            ]}
            error={errors.TypeProprietaire}
            hint="Le type permet d'afficher les champs appropriés"
          />
          {form.TypeProprietaire === 'Physique' ? (
            <>
              <AutocompleteInput
                label="Prénom du propriétaire"
                name="PrenomProprietaire"
                value={form.PrenomProprietaire || ''}
                onChange={(value) => updateField('PrenomProprietaire', value)}
                onSelect={handleProprietaireSelect}
                suggestions={filteredProprietaires}
                getSuggestionText={(p) => 
                  p.details?.PrenomProprietaire && p.details?.NomProprietaire
                    ? `${p.details.PrenomProprietaire} ${p.details.NomProprietaire}`
                    : ''
                }
                error={errors.PrenomProprietaire}
                placeholder="Rechercher propriétaire"
              />
              <AutocompleteInput
                label="Nom du propriétaire"
                name="NomProprietaire"
                value={form.NomProprietaire || ''}
                onChange={(value) => updateField('NomProprietaire', value)}
                onSelect={handleProprietaireSelect}
                suggestions={filteredProprietaires}
                getSuggestionText={(p) => 
                  p.details?.PrenomProprietaire && p.details?.NomProprietaire
                    ? `${p.details.PrenomProprietaire} ${p.details.NomProprietaire}`
                    : ''
                }
                error={errors.NomProprietaire}
                placeholder="Rechercher propriétaire"
              />
            </>
          ) : (
            <AutocompleteInput
              label="Nom de l'entreprise (morale)"
              name="NomEntreprise"
              value={form.NomEntreprise || ''}
              onChange={(value) => updateField('NomEntreprise', value)}
              onSelect={handleProprietaireSelect}
              suggestions={filteredProprietaires}
              getSuggestionText={(p) => p.details?.NomEntreprise || ''}
              error={errors.NomEntreprise}
              placeholder="Nom de l'entreprise"
            />
          )}
        </div>
      </fieldset>

      {/* Autorisations */}
      <fieldset className="space-y-4 bg-white p-4 rounded-lg shadow-sm border">
        <legend className="text-lg font-semibold pb-1 flex items-center gap-2">
          <span className="text-2xl">📜</span>
          <span>Autorisations</span>
        </legend>
        <p className="text-sm text-gray-500">Ajoutez jusqu'à 2 autorisations. Les types s'ajustent automatiquement.</p>

        {autorisations.length > 0 ? (
          autorisations.map((auto, index) => {
            const availableTypes = getAvailableAutorisationTypes(index);
            return (
              <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 border rounded-md relative bg-gray-50">
                <Select
                  label="Type"
                  value={auto.TypeAutorisation || 'création'}
                  onChange={(e) => handleAutorisationTypeChange(index, e.target.value as 'création' | 'mise en service')}
                  options={availableTypes.map(type => ({ 
                    value: type, 
                    label: type === 'création' ? 'Création' : 'Mise en service',
                    id: `auto-${index}-${type}` 
                  }))}
                  error={(errors.autorisations as AutorisationError[] | undefined)?.[index]?.TypeAutorisation}
                />
                <Input
                  label="Numéro"
                  value={auto.NumeroAutorisation || ''}
                  onChange={(e) => updateAutorisationField(index, 'NumeroAutorisation', e.target.value)}
                  error={(errors.autorisations as AutorisationError[] | undefined)?.[index]?.NumeroAutorisation}
                  placeholder="Ex: A-2025-001"
                />
                <Input
                  label="Date"
                  value={auto.DateAutorisation || ''}
                  onChange={(e) => {
                    let value = e.target.value;
                    value = value.replace(/[^\d/]/g, '');
                    const parts = value.split('/');
                    let formatted = '';
                    if (parts[0]) {
                      let day = parts[0].slice(0, 2);
                      if (parseInt(day) > 31) day = '31';
                      formatted = day;
                      if (parts.length > 1) {
                        formatted += '/';
                        let month = parts[1].slice(0, 2);
                        if (parseInt(month) > 12) month = '12';
                        formatted += month;
                        if (parts.length > 2) {
                          formatted += '/';
                          formatted += parts[2].slice(0, 4);
                        }
                      }
                    }
                    if (formatted.length <= 10) {
                      updateAutorisationField(index, 'DateAutorisation', formatted);
                    }
                  }}
                  placeholder="JJ/MM/AAAA"
                  maxLength={10}
                  error={(errors.autorisations as AutorisationError[] | undefined)?.[index]?.DateAutorisation}
                />
                {autorisations.length > 1 && (
                  <div className="flex items-end">
                    <Button type="button" variant="danger" size="sm" onClick={() => removeAutorisation(index)}>
                      Supprimer
                    </Button>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <p className="text-sm text-gray-500">Aucune autorisation enregistrée.</p>
        )}
        {typeof errors.autorisations === 'string' && errors.autorisations && (
          <div>
            <span className="text-sm text-red-500">{errors.autorisations}</span>
          </div>
        )}
        {autorisations.length < 2 && (
          <div>
            <Button type="button" variant="secondary" onClick={handleAddAutorisation}>
              Ajouter une autre autorisation
            </Button>
          </div>
        )}
      </fieldset>

      {/* Capacités de Stockage */}
      <fieldset className="space-y-4 bg-white p-4 rounded-lg shadow-sm border">
        <legend className="text-lg font-semibold pb-1 flex items-center gap-2">
          <span className="text-2xl">🧱</span>
          <span>Capacités de Stockage</span>
        </legend>
        <p className="text-sm text-gray-500">Entrez les capacités en tonnes.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
          <Input
            label="Capacité Gasoil (Tonnes)"
            name="CapaciteGasoil"
            type="number"
            min="0"
            value={form.CapaciteGasoil || '0'}
            onChange={(e) => updateField('CapaciteGasoil', e.target.value)}
            error={errors.CapaciteGasoil}
            placeholder="0"
          />
          <Input
            label="Capacité SSP (Tonnes)"
            name="CapaciteSSP"
            type="number"
            min="0"
            value={form.CapaciteSSP || '0'}
            onChange={(e) => updateField('CapaciteSSP', e.target.value)}
            error={errors.CapaciteSSP}
            placeholder="0"
          />
        </div>
      </fieldset>

      {/* Autres Informations */}
      <fieldset className="space-y-4 bg-white p-4 rounded-lg shadow-sm border">
        <legend className="text-lg font-semibold pb-1 flex items-center gap-2">
          <span className="text-2xl">ℹ️</span>
          <span>Autres Informations</span>
        </legend>
        <p className="text-sm text-gray-500">Informations additionnelles pour la fiche station.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
          <Select
            label="Type de Gérance"
            value={form.TypeGerance || ''}
            onChange={(e) => updateField('TypeGerance', e.target.value)}
            options={[
              { value: 'libre', label: 'Libre', id: 'gerance-libre' },
              { value: 'direct', label: 'Direct', id: 'gerance-direct' },
              { value: 'partenariat', label: 'Partenariat', id: 'gerance-partenariat' }
            ]}
            error={errors.TypeGerance}
          />
          <Select
            label="Statut"
            value={form.Statut || ''}
            onChange={(e) => updateField('Statut', e.target.value)}
            options={[
              { value: 'en activité', label: 'En activité', id: 'statut-activite' },
              { value: 'en projet', label: 'En projet', id: 'statut-projet' },
              { value: 'en arrêt', label: 'En arrêt', id: 'statut-arret' },
              { value: 'archivé', label: 'Archivé', id: 'statut-archive' }
            ]}
            error={errors.Statut}
          />
          <Input
            label="Nombre de Volucompteurs"
            name="NombreVolucompteur"
            type="number"
            min="0"
            value={form.NombreVolucompteur || '0'}
            onChange={(e) => updateField('NombreVolucompteur', e.target.value)}
            error={errors.NombreVolucompteur}
            placeholder="0"
          />
          <div className="col-span-2">
            <Textarea
              label="Commentaires"
              name="Commentaires"
              value={form.Commentaires || ''}
              onChange={(e) => updateField('Commentaires', e.target.value)}
              error={errors.Commentaires}
              // @ts-ignore - pass placeholder prop if Textarea supports it
              placeholder="Notes internes, remarques, etc."
            />
          </div>
        </div>
      </fieldset>

      <div className="flex flex-col md:flex-row items-center gap-3">
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={submitting || loading}>
            {mode === 'create' ? 'Créer la station' : 'Enregistrer les modifications'}
          </Button>
          <Button type="button" variant="outline" onClick={handleCancel} disabled={submitting || loading}>
            Annuler
          </Button>
        </div>
        <div className="mt-2 md:mt-0 md:ml-auto text-sm text-gray-500">
          {submitting && <span>Enregistrement…</span>}
          {!submitting && <span>Vérifiez les champs avant d'enregistrer</span>}
        </div>
      </div>
    </form>
  );
}

export default StationForm;