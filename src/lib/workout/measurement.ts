// Measurement-type registry — the switchboard of the engine.
//
// Every measurement type declares which logger component renders it, its
// canonical stored unit, and how a raw numeric value is formatted for
// display. The frontend never special-cases individual exercises; it
// dispatches purely on measurement_type via this table.

import type { MeasurementType, ExerciseCategory } from './types';

export type LoggerKey =
  | 'rep' | 'timer' | 'duration' | 'countdown'
  | 'distance' | 'steps' | 'sets' | 'round' | 'completion';

export interface MeasurementMeta {
  type: MeasurementType;
  label: string;
  /** Which logger component handles this type. */
  logger: LoggerKey;
  /** Canonical unit raw_value is stored in. */
  unit: string;
  /** Lucide icon name for pickers/summary chips. */
  icon: string;
  /** One-line admin-facing description. */
  hint: string;
  /** Whether a per-second/per-unit "time" formatting applies. */
  isTime: boolean;
}

export const MEASUREMENT_META: Record<MeasurementType, MeasurementMeta> = {
  reps:       { type: 'reps',       label: 'Reps',        logger: 'rep',        unit: 'reps',        icon: 'Hash',       hint: 'Count reps with quick-add buttons.',            isTime: false },
  timed_hold: { type: 'timed_hold', label: 'Timed Hold',  logger: 'timer',      unit: 'seconds',     icon: 'Timer',      hint: 'Hold as long as possible — start/pause/finish.', isTime: true  },
  duration:   { type: 'duration',   label: 'Duration',    logger: 'duration',   unit: 'seconds',     icon: 'Clock',      hint: 'Stopwatch or manual minutes.',                  isTime: true  },
  countdown:  { type: 'countdown',  label: 'Countdown',   logger: 'countdown',  unit: 'seconds',     icon: 'TimerReset', hint: 'Count down to a target hold/time.',             isTime: true  },
  distance:   { type: 'distance',   label: 'Distance',    logger: 'distance',   unit: 'mi',          icon: 'MapPin',     hint: 'Log miles/km (sync-ready).',                    isTime: false },
  steps:      { type: 'steps',      label: 'Steps',       logger: 'steps',      unit: 'steps',       icon: 'Footprints', hint: 'Log step counts (sync-ready).',                 isTime: false },
  sets_reps:  { type: 'sets_reps',  label: 'Sets × Reps', logger: 'sets',       unit: 'reps',        icon: 'Layers',     hint: 'Track sets and reps per set.',                  isTime: false },
  rounds:     { type: 'rounds',     label: 'Rounds',      logger: 'round',      unit: 'rounds',      icon: 'RefreshCw',  hint: 'Complete circuit rounds.',                      isTime: false },
  completion: { type: 'completion', label: 'Completion',  logger: 'completion', unit: 'completions', icon: 'CircleCheck',hint: 'Mark an activity done.',                        isTime: false },
};

export const MEASUREMENT_TYPES = Object.keys(MEASUREMENT_META) as MeasurementType[];

export const CATEGORY_META: Record<ExerciseCategory, { label: string; icon: string }> = {
  upper_body: { label: 'Upper Body', icon: 'Dumbbell' },
  lower_body: { label: 'Lower Body', icon: 'Footprints' },
  core:       { label: 'Core',       icon: 'Target' },
  cardio:     { label: 'Cardio',     icon: 'HeartPulse' },
  mobility:   { label: 'Mobility',   icon: 'StretchHorizontal' },
  full_body:  { label: 'Full Body',  icon: 'PersonStanding' },
  other:      { label: 'Other',      icon: 'Shapes' },
};

export const CATEGORIES = Object.keys(CATEGORY_META) as ExerciseCategory[];

export function categoryLabel(category: string): string {
  return (CATEGORY_META as Record<string, { label: string }>)[category]?.label ?? 'Other';
}

/** Whole seconds → "m:ss" or "h:mm:ss". */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

/** Format a canonical raw value for display, per measurement type. */
export function formatValue(type: MeasurementType, value: number): string {
  const meta = MEASUREMENT_META[type];
  if (meta.isTime) return formatClock(value);
  switch (type) {
    case 'distance': return `${round(value, 2)} mi`;
    case 'steps':    return `${Math.round(value).toLocaleString()} steps`;
    case 'rounds':   return `${round(value, 0)} ${value === 1 ? 'round' : 'rounds'}`;
    case 'completion': return value >= 1 ? 'Complete' : 'Not done';
    default:         return `${round(value, 0)} ${meta.unit}`;
  }
}

/** Short value used inside tight progress rows (no unit word). */
export function formatValueShort(type: MeasurementType, value: number): string {
  const meta = MEASUREMENT_META[type];
  if (meta.isTime) return formatClock(value);
  if (type === 'distance') return `${round(value, 2)}`;
  return `${Math.round(value)}`;
}

/** Unit noun shown next to a goal, e.g. "reps", "min", "mi". */
export function goalUnitLabel(type: MeasurementType): string {
  const meta = MEASUREMENT_META[type];
  if (meta.isTime) return 'min';
  return meta.unit;
}

function round(n: number, dp: number): number {
  const f = Math.pow(10, dp);
  return Math.round(n * f) / f;
}
