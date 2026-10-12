/**
 * The weight-loss form as kept in this browser's localStorage, so a returning visitor finds their
 * values. A convenience only: the page works the same when storage is blocked or empty, and
 * anything unreadable is ignored. Pure (no DOM).
 */
import { isGranularity, type Granularity, type RawInput } from '../../../lib/health/weight-plan.ts';

export const STORAGE_KEY = 'weight-loss:v1:form';

export interface SavedForm {
  raw: RawInput;
  /** Whether the visitor typed their own intake (otherwise it follows maintenance − 500 kcal). */
  intakeEdited: boolean;
  granularity: Granularity;
}

const RAW_KEYS: ReadonlyArray<keyof RawInput> = [
  'sex',
  'age',
  'height',
  'weight',
  'target',
  'bodyFat',
  'activity',
  'formula',
  'mode',
  'intake',
  'deficit',
  'start',
];

export function serializeForm(form: SavedForm): string {
  return JSON.stringify(form);
}

/** The saved form, or null when there is none or it cannot be read. Unknown keys are dropped. */
export function parseSavedForm(text: string | null): SavedForm | null {
  if (!text) return null;
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object') return null;
  const { raw, intakeEdited, granularity } = data as Record<string, unknown>;
  if (!raw || typeof raw !== 'object') return null;
  const values = raw as Record<string, unknown>;
  const clean = {} as RawInput;
  for (const key of RAW_KEYS) {
    const value = values[key];
    if (typeof value !== 'string' || value.length > 32) return null;
    clean[key] = value;
  }
  return {
    raw: clean,
    intakeEdited: intakeEdited === true,
    granularity: isGranularity(granularity) ? granularity : 'weekly',
  };
}
