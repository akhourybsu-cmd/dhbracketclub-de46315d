// Workout Competition — shared domain types.
//
// These mirror the `workout_*` tables. The whole module is engine-driven:
// an exercise's `measurement_type` + JSONB configs decide which logger UI
// renders and how activity is scored. Adding a workout is configuration,
// not a new page.

export type MeasurementType =
  | 'reps'
  | 'timed_hold'
  | 'duration'
  | 'countdown'
  | 'distance'
  | 'steps'
  | 'sets_reps'
  | 'rounds'
  | 'completion';

export type ExerciseCategory =
  | 'upper_body'
  | 'lower_body'
  | 'core'
  | 'cardio'
  | 'mobility'
  | 'full_body'
  | 'other';

export type TimerMode = 'stopwatch' | 'countdown';

/** One item inside a circuit round (measurement_type = 'rounds'). */
export interface RoundItem {
  label: string;
  value?: number;
  unit?: string;
}

/** Per-exercise logging behaviour. Only the fields relevant to the
 *  exercise's measurement_type are read by its logger. */
export interface LoggingConfig {
  /** Quick-add amounts for rep exercises, e.g. [1, 5, 10]. */
  quick_add?: number[];
  timer_mode?: TimerMode;
  allow_pause?: boolean;
  allow_manual?: boolean;
  /** Countdown target, in seconds (measurement_type = 'countdown'). */
  countdown_seconds?: number;
  /** Minimum / maximum single-log value (canonical unit). */
  min_value?: number;
  max_value?: number;
  /** Circuit round definition (measurement_type = 'rounds'). */
  round_definition?: { label?: string; items: RoundItem[] };
  /** Sets×Reps defaults. */
  default_sets?: number;
  default_reps?: number;
  allow_weight?: boolean;
  /** Distance unit for display/entry (canonical stored unit is miles). */
  distance_unit?: 'mi' | 'km';
}

/** How raw activity converts to competition points + XP. */
export interface ScoringConfig {
  /** Competition points per canonical unit (rep, second, mile, …). */
  points_per_unit?: number;
  /** Hard cap on competition points this exercise can contribute per
   *  week — keeps one easy activity from dominating. Null = uncapped. */
  max_weekly_points?: number | null;
  /** XP per canonical unit. Defaults to points_per_unit when omitted. */
  xp_per_unit?: number;
}

export interface MilestoneConfig {
  /** Lifetime thresholds in the canonical unit (e.g. total push-ups). */
  lifetime?: number[];
  /** Single-session thresholds (e.g. plank hold seconds). */
  session?: number[];
}

export interface WorkoutExercise {
  id: string;
  club_id: string;
  name: string;
  short_description: string | null;
  instructions: string | null;
  category: ExerciseCategory | string;
  measurement_type: MeasurementType;
  unit: string;
  logging_config: LoggingConfig;
  scoring_config: ScoringConfig;
  default_weekly_goal: number | null;
  milestone_config: MilestoneConfig;
  icon_name: string | null;
  active: boolean;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type WeekStatus = 'upcoming' | 'active' | 'completed';

export interface WorkoutWeek {
  id: string;
  club_id: string;
  title: string;
  theme: string | null;
  starts_at: string;
  ends_at: string;
  status: WeekStatus;
  scoring_config: ScoringConfig;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkoutWeekExercise {
  id: string;
  week_id: string;
  exercise_id: string;
  goal: number | null;
  scoring_config: ScoringConfig;
  sort_order: number;
  created_at: string;
}

/** A week exercise joined with its exercise definition — the shape the
 *  week screen and loggers consume. */
export interface WeekExerciseWithDef extends WorkoutWeekExercise {
  exercise: WorkoutExercise;
}

export interface WorkoutGroupGoal {
  id: string;
  club_id: string;
  week_id: string;
  exercise_id: string;
  title: string;
  target: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** A group goal joined with its exercise definition. */
export interface GroupGoalWithDef extends WorkoutGroupGoal {
  exercise: WorkoutExercise;
}

export type ActivitySource =
  | 'manual'
  | 'apple_health'
  | 'health_connect'
  | 'fitbit'
  | 'garmin'
  | 'other';

export interface WorkoutActivity {
  id: string;
  club_id: string;
  user_id: string;
  week_id: string | null;
  exercise_id: string;
  measurement_type: MeasurementType;
  raw_value: number;
  unit: string;
  started_at: string | null;
  ended_at: string | null;
  logged_at: string;
  activity_local_date: string;
  source_type: ActivitySource;
  source_activity_id: string | null;
  metadata: Record<string, unknown>;
  competition_points: number | null;
  xp_awarded: number | null;
  status: 'active' | 'voided';
  created_at: string;
}

/** Payload the client submits to log activity. Note: NO computed points —
 *  the client only ever supplies the raw honor-system value + timing.
 *  Points/XP are derived on read from the exercise's scoring config. */
export interface LogActivityInput {
  exercise: WorkoutExercise;
  weekId: string | null;
  rawValue: number;
  startedAt?: string | null;
  endedAt?: string | null;
  metadata?: Record<string, unknown>;
  source?: ActivitySource;
  sourceActivityId?: string | null;
}
