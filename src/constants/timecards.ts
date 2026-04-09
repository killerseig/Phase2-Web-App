export const DEFAULT_PRODUCTION_BURDEN = 0.33

export const TIMECARD_OCCUPATIONS = [
  'AC Foreman',
  'Acoustic Installer',
  'Apprentice - Finisher',
  'Apprentice - Frame/Rock',
  'Apprentice - Paint',
  'Construction Laborer',
  'Drywall Finisher-Tool',
  'DW Foreman',
  'Finish Foreman',
  'Framer & Rocker',
  'Paint Foreman',
  'Painter',
  'Shop',
  'Superintendent',
  'Top of Wall Installer',
] as const

export type TimecardOccupation = typeof TIMECARD_OCCUPATIONS[number]

export function getTimecardOccupationOptions(currentValue?: string | null): string[] {
  const normalized = String(currentValue || '').trim()
  if (!normalized) return [...TIMECARD_OCCUPATIONS]
  if (TIMECARD_OCCUPATIONS.includes(normalized as TimecardOccupation)) {
    return [...TIMECARD_OCCUPATIONS]
  }
  return [normalized, ...TIMECARD_OCCUPATIONS]
}

export function normalizeProductionBurden(value: unknown): number {
  const burden = Number(value)
  if (!Number.isFinite(burden) || Number.isNaN(burden) || burden < 0) {
    return DEFAULT_PRODUCTION_BURDEN
  }
  return burden
}

export function getProductionMultiplier(productionBurden: number | null | undefined): number {
  return 1 + normalizeProductionBurden(productionBurden)
}

export function formatProductionBurdenInput(value: number | null | undefined): string {
  return normalizeProductionBurden(value).toFixed(2)
}
