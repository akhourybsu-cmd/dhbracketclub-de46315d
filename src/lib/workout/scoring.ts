// Workout Competition — scoring & derivation engine.
//
// The authoritative record is `workout_activities` (raw values only).
// Competition score, XP, progress, leaderboard, records, streaks and
// milestones are ALL derived here from those raw rows + each exercise's
// scoring config. The client never submits computed totals, so results
// can't be spoofed by tampering with a number in the request.

import type {
  ScoringConfig, WorkoutActivity, WeekExerciseWithDef, WorkoutExercise, MilestoneConfig,
} from './types';

// ─── Scoring config resolution ──────────────────────────────────────

/** Later configs win. Used to layer a week-exercise override on top of
 *  the exercise's own scoring config. */
export function mergeScoring(...configs: (ScoringConfig | undefined | null)[]): ScoringConfig {
  const out: ScoringConfig = {};
  for (const c of configs) {
    if (!c) continue;
    if (c.points_per_unit != null) out.points_per_unit = c.points_per_unit;
    if (c.max_weekly_points !== undefined) out.max_weekly_points = c.max_weekly_points;
    if (c.xp_per_unit != null) out.xp_per_unit = c.xp_per_unit;
  }
  return out;
}

/** Competition points a summed raw value earns, respecting the weekly cap. */
export function cappedPoints(scoring: ScoringConfig, totalRaw: number): number {
  const ppu = scoring.points_per_unit ?? 1;
  const raw = Math.max(0, totalRaw) * ppu;
  const cap = scoring.max_weekly_points;
  const capped = cap != null ? Math.min(raw, cap) : raw;
  return Math.round(capped);
}

export function xpForRaw(scoring: ScoringConfig, raw: number): number {
  const xpu = scoring.xp_per_unit ?? scoring.points_per_unit ?? 1;
  return Math.round(Math.max(0, raw) * xpu);
}

// ─── Aggregation helpers ────────────────────────────────────────────

const active = (a: WorkoutActivity) => a.status === 'active';

export function sumRaw(activities: WorkoutActivity[]): number {
  return activities.reduce((t, a) => (active(a) ? t + Number(a.raw_value) : t), 0);
}

/** Sum raw value for one user + one exercise within a set of activities. */
export function userExerciseTotal(activities: WorkoutActivity[], userId: string, exerciseId: string): number {
  return sumRaw(activities.filter(a => a.user_id === userId && a.exercise_id === exerciseId));
}

// ─── Per-exercise weekly progress ───────────────────────────────────

export interface ExerciseProgress {
  exerciseId: string;
  totalRaw: number;
  goal: number | null;
  goalPct: number;      // 0..1 (clamped)
  points: number;       // capped competition points contributed
  maxPoints: number | null;
  sessionCount: number;
}

export function computeExerciseProgress(
  we: WeekExerciseWithDef,
  userActivities: WorkoutActivity[],
): ExerciseProgress {
  const acts = userActivities.filter(a => a.exercise_id === we.exercise_id && active(a));
  const totalRaw = sumRaw(acts);
  const goal = we.goal ?? we.exercise.default_weekly_goal ?? null;
  const scoring = mergeScoring(we.exercise.scoring_config, we.scoring_config);
  return {
    exerciseId: we.exercise_id,
    totalRaw,
    goal,
    goalPct: goal && goal > 0 ? Math.min(1, totalRaw / goal) : (totalRaw > 0 ? 1 : 0),
    points: cappedPoints(scoring, totalRaw),
    maxPoints: scoring.max_weekly_points ?? null,
    sessionCount: acts.length,
  };
}

// ─── Leaderboard ────────────────────────────────────────────────────

export interface LeaderRow {
  userId: string;
  score: number;
  completionPct: number; // 0..1 average goal completion across exercises
  rank: number;
}

/**
 * Build the weekly leaderboard from all activities in the week. Score is
 * the sum of each exercise's capped points; completion is the average
 * per-exercise goal fraction. `extraUserIds` seeds zero-score rows for
 * members who haven't logged yet (so "You" always appears).
 */
export function buildLeaderboard(
  weekExercises: WeekExerciseWithDef[],
  activities: WorkoutActivity[],
  extraUserIds: string[] = [],
): LeaderRow[] {
  const userIds = new Set<string>(extraUserIds);
  for (const a of activities) if (active(a)) userIds.add(a.user_id);

  const rows: LeaderRow[] = [...userIds].map(userId => {
    const mine = activities.filter(a => a.user_id === userId && active(a));
    let score = 0;
    let pctSum = 0;
    for (const we of weekExercises) {
      const p = computeExerciseProgress(we, mine);
      score += p.points;
      pctSum += p.goalPct;
    }
    return {
      userId,
      score,
      completionPct: weekExercises.length ? pctSum / weekExercises.length : 0,
      rank: 0,
    };
  });

  rows.sort((a, b) =>
    b.score - a.score ||
    b.completionPct - a.completionPct ||
    a.userId.localeCompare(b.userId));
  rows.forEach((r, i) => { r.rank = i + 1; });
  return rows;
}

/** Total weekly score for one user (sum of capped per-exercise points). */
export function userWeekScore(weekExercises: WeekExerciseWithDef[], userActivities: WorkoutActivity[]): number {
  return weekExercises.reduce((t, we) => t + computeExerciseProgress(we, userActivities).points, 0);
}

// ─── XP (does not reset) ────────────────────────────────────────────

/** Lifetime XP for a user across ALL their activities. */
export function lifetimeXp(exercisesById: Map<string, WorkoutExercise>, activities: WorkoutActivity[]): number {
  let xp = 0;
  for (const a of activities) {
    if (!active(a)) continue;
    const ex = exercisesById.get(a.exercise_id);
    if (!ex) continue;
    xp += xpForRaw(ex.scoring_config, Number(a.raw_value));
  }
  return xp;
}

/** Simple level curve: level N needs 100·N·(N-1)/2 cumulative XP. */
export function levelFromXp(xp: number): { level: number; into: number; span: number; pct: number } {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  const base = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const span = next - base;
  const into = xp - base;
  return { level, into, span, pct: span > 0 ? into / span : 0 };
}
function xpForLevel(level: number): number {
  const n = Math.max(1, level) - 1;
  return 100 * (n * (n + 1)) / 2;
}

// ─── Streak (timezone-correct: uses local activity dates) ───────────

/** Consecutive-day streak ending today or yesterday. Dates are the
 *  user-local `activity_local_date` strings (YYYY-MM-DD). */
export function computeStreak(localDates: string[], todayLocal: string): number {
  const days = new Set(localDates);
  if (days.size === 0) return 0;
  // Anchor at today if active today, else yesterday (grace for "not yet today").
  let cursor = days.has(todayLocal) ? todayLocal : addDays(todayLocal, -1);
  if (!days.has(cursor)) return 0;
  let streak = 0;
  while (days.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

function addDays(iso: string, delta: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

// ─── Records (derived from authoritative activity) ──────────────────

export interface RecordStat { key: string; label: string; value: number; }

/** Personal records appropriate to the exercise's measurement type. */
export function computeRecords(exercise: WorkoutExercise, userActivities: WorkoutActivity[]): RecordStat[] {
  const acts = userActivities.filter(a => a.exercise_id === exercise.id && a.status === 'active');
  if (acts.length === 0) return [];
  const type = exercise.measurement_type;
  const values = acts.map(a => Number(a.raw_value));
  const lifetime = values.reduce((t, v) => t + v, 0);
  const maxSingle = Math.max(...values);
  const byDay = bucketByDay(acts);
  const maxDay = Math.max(...byDay.values());

  switch (type) {
    case 'timed_hold':
    case 'countdown':
      return [
        { key: 'longest', label: 'Longest Hold', value: maxSingle },
        { key: 'lifetime', label: 'Lifetime', value: lifetime },
      ];
    case 'duration':
      return [
        { key: 'longest', label: 'Longest Session', value: maxSingle },
        { key: 'lifetime', label: 'Lifetime', value: lifetime },
      ];
    case 'distance':
      return [
        { key: 'longest', label: 'Longest', value: maxSingle },
        { key: 'day', label: 'Best Day', value: maxDay },
        { key: 'lifetime', label: 'Lifetime', value: lifetime },
      ];
    case 'steps':
      return [
        { key: 'day', label: 'Best Day', value: maxDay },
        { key: 'lifetime', label: 'Lifetime', value: lifetime },
      ];
    case 'rounds':
    case 'completion':
      return [
        { key: 'day', label: 'Best Day', value: maxDay },
        { key: 'lifetime', label: 'Lifetime', value: lifetime },
      ];
    // reps + sets_reps
    default:
      return [
        { key: 'single', label: 'Largest Log', value: maxSingle },
        { key: 'day', label: 'Best Day', value: maxDay },
        { key: 'lifetime', label: 'Lifetime', value: lifetime },
      ];
  }
}

function bucketByDay(acts: WorkoutActivity[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const a of acts) m.set(a.activity_local_date, (m.get(a.activity_local_date) ?? 0) + Number(a.raw_value));
  return m;
}

// ─── Milestones ─────────────────────────────────────────────────────

export interface MilestoneState {
  scope: 'lifetime' | 'session';
  threshold: number;
  reached: boolean;
}

export function computeMilestones(
  config: MilestoneConfig,
  lifetimeTotal: number,
  bestSession: number,
): { states: MilestoneState[]; nextLifetime: number | null; nextSession: number | null } {
  const lifetime = (config.lifetime ?? []).slice().sort((a, b) => a - b);
  const session = (config.session ?? []).slice().sort((a, b) => a - b);
  const states: MilestoneState[] = [
    ...lifetime.map(t => ({ scope: 'lifetime' as const, threshold: t, reached: lifetimeTotal >= t })),
    ...session.map(t => ({ scope: 'session' as const, threshold: t, reached: bestSession >= t })),
  ];
  return {
    states,
    nextLifetime: lifetime.find(t => lifetimeTotal < t) ?? null,
    nextSession: session.find(t => bestSession < t) ?? null,
  };
}
