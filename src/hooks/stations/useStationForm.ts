// src/hooks/stations/useStationForm.ts
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { StationWithDetails, StationFormData, Gerant, Proprietaire, ProprietairePhysique, ProprietaireMorale } from '@/types/station';
import { stationWithDetailsToFormData } from '@/utils/stationFormUtils';
import { validateStationData } from '@/lib/validations/stationValidation';
import { useCreateStation } from '@/hooks/stations/useCreateStation';
import { useUpdateStation } from '@/hooks/stations/useUpdateStation';
import { useGerants } from '@/hooks/ReferenceData/useGerants';
import { useProprietaires } from '@/hooks/ReferenceData/useProprietaires';

type Mode = 'create' | 'edit';

type AutorisationError = Partial<Record<'TypeAutorisation' | 'NumeroAutorisation' | 'DateAutorisation', string>>;

type StationFormErrors = Partial<{
  [K in keyof StationFormData]: K extends 'autorisations' ? string | AutorisationError[] : string;
}> & {
  __form?: string;
  submit?: string;
};

export function useStationForm(mode: Mode, station?: StationWithDetails) {
  const { createStation, loading: creating, error: createError } = useCreateStation();
  const { updateStation, loading: updating, error: updateError } = useUpdateStation();
  const { gerants, loading: gerantsLoading, error: gerantsError } = useGerants();
  const { proprietaires, loading: proprietairesLoading, error: proprietairesError } = useProprietaires();

  const empty: StationFormData = useMemo(
    () => ({
      NomStation: '',
      Adresse: '',
      Latitude: '0',
      Longitude: '0',
      Type: 'service',
      Marque: '',
      RaisonSociale: '',
      Commune: '',
      Province: '',
      PrenomGerant: '',
      NomGerant: '',
      CINGerant: '',
      Telephone: '',
      TypeProprietaire: 'Physique',
      PrenomProprietaire: '',
      NomProprietaire: '',
      NomEntreprise: '',
      autorisations: [{ TypeAutorisation: 'création', NumeroAutorisation: '', DateAutorisation: '' }],
      CapaciteGasoil: '0',
      CapaciteSSP: '0',
      TypeGerance: 'libre',
      Statut: 'en activité',
      Commentaires: '',
      NombreVolucompteur: '0',
    }),
    []
  );

  const [form, setForm] = useState<StationFormData>(empty);
  const [errors, setErrors] = useState<StationFormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [gerantSuggestions, setGerantSuggestions] = useState<Gerant[]>([]);
  const [proprietaireSuggestions, setProprietaireSuggestions] = useState<(Proprietaire & { details: ProprietairePhysique | ProprietaireMorale | null })[]>([]);

  const loading = creating || updating || gerantsLoading || proprietairesLoading;
  const error = createError || updateError || gerantsError || proprietairesError;

  useEffect(() => {
    setForm(station ? stationWithDetailsToFormData(station) : empty);
    setErrors({});
  }, [station, empty]);

  // Filter Gérant suggestions
  useEffect(() => {
    if (form.CINGerant || form.PrenomGerant || form.NomGerant) {
      const cin = form.CINGerant.toLowerCase().trim();
      const prenom = form.PrenomGerant.toLowerCase().trim();
      const nom = form.NomGerant.toLowerCase().trim();
      const filtered = gerants.filter(g =>
        g.GerantID && // Ensure GerantID exists
        (
          (cin && g.CINGerant?.toLowerCase?.().includes(cin)) ||
          (prenom && g.PrenomGerant?.toLowerCase?.().includes(prenom)) ||
          (nom && g.NomGerant?.toLowerCase?.().includes(nom))
        )
      );
      setGerantSuggestions(filtered.slice(0, 5)); // Limit to 5 suggestions
    } else {
      setGerantSuggestions([]);
    }
  }, [form.CINGerant, form.PrenomGerant, form.NomGerant, gerants]);

  // Filter Propriétaire suggestions
  useEffect(() => {
    if (form.TypeProprietaire === 'Physique' && (form.PrenomProprietaire || form.NomProprietaire)) {
      const prenom = form.PrenomProprietaire.toLowerCase().trim();
      const nom = form.NomProprietaire.toLowerCase().trim();
      const fullName = `${prenom} ${nom}`.trim();
      const filtered = proprietaires.filter(p =>
        p.ProprietaireID && // Ensure ProprietaireID exists
        p.TypeProprietaire === 'Physique' &&
        p.details &&
        `${(p.details as ProprietairePhysique).PrenomProprietaire?.toLowerCase?.() || ''} ${(p.details as ProprietairePhysique).NomProprietaire?.toLowerCase?.() || ''}`.trim().includes(fullName)
      );
      setProprietaireSuggestions(filtered.slice(0, 5));
    } else if (form.TypeProprietaire === 'Morale' && form.NomEntreprise) {
      const entreprise = form.NomEntreprise.toLowerCase().trim();
      const filtered = proprietaires.filter(p =>
        p.ProprietaireID && // Ensure ProprietaireID exists
        p.TypeProprietaire === 'Morale' &&
        p.details &&
        (p.details as ProprietaireMorale).NomEntreprise?.toLowerCase?.().includes(entreprise)
      );
      setProprietaireSuggestions(filtered.slice(0, 5));
    } else {
      setProprietaireSuggestions([]);
    }
  }, [form.TypeProprietaire, form.PrenomProprietaire, form.NomProprietaire, form.NomEntreprise, proprietaires]);

  // General field updater
  const updateField = useCallback((key: keyof StationFormData, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  // Select a Gérant suggestion
  const selectGerant = useCallback((gerant: Gerant) => {
    setForm((prev) => ({
      ...prev,
      PrenomGerant: gerant.PrenomGerant || '',
      NomGerant: gerant.NomGerant || '',
      CINGerant: gerant.CINGerant || '',
      Telephone: gerant.Telephone || '',
    }));
    setGerantSuggestions([]);
  }, []);

  // Select a Propriétaire suggestion
  const selectProprietaire = useCallback((proprietaire: Proprietaire & { details: ProprietairePhysique | ProprietaireMorale | null }) => {
    setForm((prev) => ({
      ...prev,
      TypeProprietaire: proprietaire.TypeProprietaire,
      PrenomProprietaire: proprietaire.TypeProprietaire === 'Physique' && proprietaire.details ? (proprietaire.details as ProprietairePhysique).PrenomProprietaire || '' : '',
      NomProprietaire: proprietaire.TypeProprietaire === 'Physique' && proprietaire.details ? (proprietaire.details as ProprietairePhysique).NomProprietaire || '' : '',
      NomEntreprise: proprietaire.TypeProprietaire === 'Morale' && proprietaire.details ? (proprietaire.details as ProprietaireMorale).NomEntreprise || '' : '',
    }));
    setProprietaireSuggestions([]);
  }, []);

  // Specific handler for updating an autorisation in the array
  const updateAutorisationField = useCallback(
    (index: number, key: 'TypeAutorisation' | 'NumeroAutorisation' | 'DateAutorisation', value: string) => {
      setForm((prev) => {
        const newAutorisations = [...prev.autorisations];
        newAutorisations[index] = { ...newAutorisations[index], [key]: value };
        return { ...prev, autorisations: newAutorisations };
      });
    },
    []
  );

  // Add a new autorisation entry
  const addAutorisation = useCallback(() => {
    setForm((prev) => ({
      ...prev,
      autorisations: [...prev.autorisations, { TypeAutorisation: 'création', NumeroAutorisation: '', DateAutorisation: '' }],
    }));
  }, []);

  // Remove an autorisation entry by index
  const removeAutorisation = useCallback((index: number) => {
    setForm((prev) => ({
      ...prev,
      autorisations: prev.autorisations.filter((_, i) => i !== index),
    }));
  }, []);

  const submit = useCallback(async () => {
    setSubmitting(true);
    setErrors({});
    const { isValid, errors: fieldErrors } = validateStationData(form);

    if (!isValid) {
      setErrors({ ...fieldErrors, __form: 'Veuillez corriger les erreurs du formulaire.' });
      setSubmitting(false);
      return false;
    }

    try {
      if (mode === 'create') {
        await createStation(form);
      } else if (mode === 'edit' && station?.station.StationID) {
        await updateStation(station.station.StationID, form);
      }
      setSubmitting(false);
      return true;
    } catch (err) {
      console.error(err);
      setErrors({ __form: "Une erreur est survenue lors de l'enregistrement." });
      setSubmitting(false);
      return false;
    }
  }, [form, mode, station?.station.StationID, createStation, updateStation]);

  return {
    form,
    updateField,
    submit,
    loading,
    submitting,
    errors,
    error,
    updateAutorisationField,
    addAutorisation,
    removeAutorisation,
    gerantSuggestions,
    setGerantSuggestions,
    proprietaireSuggestions,
    setProprietaireSuggestions,
    selectGerant,
    selectProprietaire,
  };
}