// Workout achievement definitions.
//
// Definitions live here (app logic, not admin-authored). Each criterion is
// evaluated from the authoritative activity log via a derived context, so
// unlocks can't be spoofed — only the fact + timestamp of an unlock is
// persisted (workout_achievement_unlocks). Architecture supports many more;
// this is a solid launch set.

import type { WorkoutActivity, WeekExerciseWithDef, WorkoutWeek } from './types';
import { computeExerciseProgress, computeStreak } from './scoring';

export type AchievementTier = 'bronze' | 'silver' | 'gold';

export interface AchievementDef {
  key: string;
  title: string;
  description: string;
  icon: string;         // lucide name
  tier: AchievementTier;
  test: (ctx: AchievementContext) => boolean;
}

export interface AchievementContext {
  /** The user's lifetime activity (active only). */
  lifetime: WorkoutActivity[];
  /** The user's activity in the current/active week. */
  weekActivities: WorkoutActivity[];
  /** Active week exercises (for well-rounded / iron-week). */
  weekExercises: WeekExerciseWithDef[];
  week: WorkoutWeek | null;
  /** User-local calendar date (YYYY-MM-DD). */
  todayLocal: string;
}

const isRepLike = (mt: string) => mt === 'reps' || mt === 'sets_reps';

/** Largest single-day total for any rep-like exercise. */
function bestRepDay(acts: WorkoutActivity[]): number {
  const byKey = new Map<string, number>();
  for (const a of acts) {
    if (!isRepLike(a.measurement_type)) continue;
    const k = `${a.exercise_id}:${a.activity_local_date}`;
    byKey.set(k, (byKey.get(k) ?? 0) + Number(a.raw_value));
  }
  let max = 0;
  for (const v of byKey.values()) max = Math.max(max, v);
  return max;
}

/** Largest lifetime total for any single exercise. */
function biggestExerciseTotal(acts: WorkoutActivity[]): number {
  const byEx = new Map<string, number>();
  for (const a of acts) byEx.set(a.exercise_id, (byEx.get(a.exercise_id) ?? 0) + Number(a.raw_value));
  let max = 0;
  for (const v of byEx.values()) max = Math.max(max, v);
  return max;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    key: 'first_workout', title: 'First Rep', description: 'Log your very first workout.',
    icon: 'Sparkles', tier: 'bronze',
    test: (c) => c.lifetime.length > 0,
  },
  {
    key: 'century_day', title: 'Century Club', description: 'Log 100+ reps of one workout in a single day.',
    icon: 'Hash', tier: 'silver',
    test: (c) => bestRepDay(c.lifetime) >= 100,
  },
  {
    key: 'well_rounded', title: 'Well Rounded', description: 'Make progress in every workout during a competition week.',
    icon: 'Target', tier: 'silver',
    test: (c) => c.weekExercises.length > 0 &&
      c.weekExercises.every(we => computeExerciseProgress(we, c.weekActivities).totalRaw > 0),
  },
  {
    key: 'iron_week', title: 'Iron Week', description: 'Complete every weekly goal in a competition.',
    icon: 'Trophy', tier: 'gold',
    test: (c) => c.weekExercises.length > 0 &&
      c.weekExercises.every(we => computeExerciseProgress(we, c.weekActivities).goalPct >= 1),
  },
  {
    key: 'volume_1k', title: 'Machine', description: 'Reach 1,000 lifetime total in a single workout.',
    icon: 'Dumbbell', tier: 'gold',
    test: (c) => biggestExerciseTotal(c.lifetime) >= 1000,
  },
  {
    key: 'streak_7', title: 'Week Warrior', description: 'Keep a 7-day activity streak.',
    icon: 'Flame', tier: 'silver',
    test: (c) => computeStreak(c.lifetime.map(a => a.activity_local_date), c.todayLocal) >= 7,
  },
  {
    key: 'final_push', title: 'Final Push', description: 'Log activity in the last day of a competition.',
    icon: 'Zap', tier: 'bronze',
    test: (c) => {
      if (!c.week) return false;
      const end = new Date(c.week.ends_at).getTime();
      const dayBefore = end - 86400000;
      return c.weekActivities.some(a => {
        const t = new Date(a.logged_at).getTime();
        return t >= dayBefore && t <= end;
      });
    },
  },
];

export const ACHIEVEMENTS_BY_KEY: Record<string, AchievementDef> =
  Object.fromEntries(ACHIEVEMENTS.map(a => [a.key, a]));

/** Keys of all achievements currently satisfied by the context. */
export function evaluateAchievements(ctx: AchievementContext): string[] {
  return ACHIEVEMENTS.filter(a => {
    try { return a.test(ctx); } catch { return false; }
  }).map(a => a.key);
}
