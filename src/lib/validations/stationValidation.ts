import { z } from 'zod';
import { StationFormData } from '@/types/station';

type AutorisationError = Partial<Record<'TypeAutorisation' | 'NumeroAutorisation' | 'DateAutorisation', string>>;

export type NormalizedFormErrors = Partial<{
  [K in keyof StationFormData]: K extends 'autorisations' ? string | AutorisationError[] : string;
}> & {
  submit?: string;
};

export const stationSchema = z.object({
  id: z.string().optional(),
  NomStation: z.string(),
  Adresse: z.string(),
  Latitude: z.string().refine((v) => {
    const n = Number(String(v).replace(',', '.'));
    return Number.isFinite(n) && n >= -90 && n <= 90;
  }, 'Latitude invalide (entre -90 et 90)'),
  Longitude: z.string().refine((v) => {
    const n = Number(String(v).replace(',', '.'));
    return Number.isFinite(n) && n >= -180 && n <= 180;
  }, 'Longitude invalide (entre -180 et 180)'),
  Type: z.enum(['remplissage', 'service']),
  Marque: z.string().min(1, 'Marque requise'),
  RaisonSociale: z.string().min(1, 'Raison sociale requise'),
  Province: z.string().min(1, 'Province requise'),
  Commune: z.string().min(1, 'Commune requise'),
  PrenomGerant: z.string(),
  NomGerant: z.string(),
  CINGerant: z.string(),
  Telephone: z.string(),
  TypeProprietaire: z.enum(['Physique', 'Morale']),
  PrenomProprietaire: z.string(),
  NomProprietaire: z.string(),
  NomEntreprise: z.string(),
  autorisations: z.array(
    z.object({
      TypeAutorisation: z.enum(['création', 'mise en service']),
      NumeroAutorisation: z.string(),
      DateAutorisation: z.string(),
    })
  ),
  CapaciteGasoil: z.string(),
  CapaciteSSP: z.string(),
  TypeGerance: z.enum(['libre', 'direct', 'partenariat']),
  Statut: z.enum(['en activité', 'en projet', 'en arrêt', 'archivé']),
  Commentaires: z.string(),
  NombreVolucompteur: z.string(),
});

export function mapZodErrorsToFormErrors(err: z.ZodError<StationFormData>): NormalizedFormErrors {
  const errors: NormalizedFormErrors = {};

  for (const issue of err.issues) {
    if (issue.path.length === 0) continue;

    if (issue.path[0] === 'autorisations' && typeof issue.path[1] === 'number') {
      const idx = issue.path[1];
      const key = issue.path[2] as keyof AutorisationError;
      if (!errors.autorisations || typeof errors.autorisations === 'string') {
        errors.autorisations = [];
      }
      const arr = errors.autorisations as AutorisationError[];
      arr[idx] ||= {};
      arr[idx][key] = issue.message;
    } else {
      const field = issue.path[0] as keyof StationFormData;
      errors[field] = issue.message;
    }
  }

  if (Object.keys(errors).length > 0) {
    errors.submit = 'Veuillez corriger les erreurs dans le formulaire avant de soumettre.';
  }

  return errors;
}

export function validateStationData(data: StationFormData): { isValid: boolean; errors: NormalizedFormErrors } {
  const parsed = stationSchema.safeParse(data);
  if (parsed.success) {
    return { isValid: true, errors: {} };
  }
  return { isValid: false, errors: mapZodErrorsToFormErrors(parsed.error) };
}
