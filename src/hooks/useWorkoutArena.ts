import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { withTimeout, QUERY_TIMEOUT_MS, HYDRATE_TIMEOUT_MS } from '@/lib/asyncGuards';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import type {
  WorkoutWeek, WorkoutExercise, WorkoutActivity, WeekExerciseWithDef,
  LogActivityInput, GroupGoalWithDef,
} from '@/lib/workout/types';

// Untyped table access — workout_* tables aren't in the generated types yet.
const sb = supabase as any;

export interface WorkoutMember {
  id: string;
  display_name: string;
  avatar_url: string | null;
}

/** Local calendar date (YYYY-MM-DD) for tz-correct streaks. */
function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Read-model for the Workout Arena: the club's active competition week,
 * its exercises, all activity in that week (for the leaderboard), the
 * current user's lifetime activity (records/XP/milestones), and club
 * members. Everything downstream is derived from these via the scoring
 * lib — nothing here trusts a client-computed total.
 */
export function useWorkoutArena(clubId: string | undefined, userId: string | undefined) {
  const [week, setWeek] = useState<WorkoutWeek | null>(null);
  const [weekExercises, setWeekExercises] = useState<WeekExerciseWithDef[]>([]);
  const [weekActivities, setWeekActivities] = useState<WorkoutActivity[]>([]);
  const [myActivities, setMyActivities] = useState<WorkoutActivity[]>([]);
  const [members, setMembers] = useState<WorkoutMember[]>([]);
  const [unlocks, setUnlocks] = useState<string[]>([]);
  const [pastWeeks, setPastWeeks] = useState<WorkoutWeek[]>([]);
  const [groupGoals, setGroupGoals] = useState<GroupGoalWithDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const exercisesById = useMemo(() => {
    const m = new Map<string, WorkoutExercise>();
    for (const we of weekExercises) m.set(we.exercise.id, we.exercise);
    return m;
  }, [weekExercises]);

  const refresh = useCallback(async () => {
    if (!clubId || !userId) { setLoading(false); return; }
    try {
      // Active week: prefer an explicitly-active row; fall back to one whose
      // window contains now (belt-and-suspenders if status wasn't flipped).
      const nowIso = new Date().toISOString();
      const { data: weeks } = await withTimeout(
        sb.from('workout_weeks').select('*')
          .eq('club_id', clubId)
          .in('status', ['active'])
          .order('starts_at', { ascending: false })
          .limit(1),
        QUERY_TIMEOUT_MS, 'workout active week',
      );
      let activeWeek: WorkoutWeek | null = (weeks && weeks[0]) || null;
      if (!activeWeek) {
        const { data: byWindow } = await withTimeout(
          sb.from('workout_weeks').select('*')
            .eq('club_id', clubId)
            .lte('starts_at', nowIso).gte('ends_at', nowIso)
            .order('starts_at', { ascending: false }).limit(1),
          QUERY_TIMEOUT_MS, 'workout week by window',
        );
        activeWeek = (byWindow && byWindow[0]) || null;
      }
      setWeek(activeWeek);

      const [{ data: memberRows }, weekBundle, { data: mine }, { data: unlockRows }, { data: pastRows }] = await withTimeout(
        Promise.all([
          withTimeout(
            sb.from('club_members').select('user_id, profiles:user_id(id, display_name, avatar_url)').eq('club_id', clubId),
            QUERY_TIMEOUT_MS, 'workout members',
          ),
          activeWeek
            ? withTimeout(Promise.all([
                sb.from('workout_week_exercises').select('*, exercise:workout_exercises(*)').eq('week_id', activeWeek.id).order('sort_order'),
                sb.from('workout_activities').select('*').eq('week_id', activeWeek.id).eq('status', 'active'),
                sb.from('workout_group_goals').select('*, exercise:workout_exercises(*)').eq('week_id', activeWeek.id),
              ]), HYDRATE_TIMEOUT_MS, 'workout week bundle')
            : Promise.resolve([{ data: [] }, { data: [] }, { data: [] }] as any),
          withTimeout(
            sb.from('workout_activities').select('*').eq('user_id', userId).eq('status', 'active').order('logged_at', { ascending: false }).limit(1000),
            QUERY_TIMEOUT_MS, 'workout my activity',
          ),
          withTimeout(
            sb.from('workout_achievement_unlocks').select('achievement_key').eq('club_id', clubId).eq('user_id', userId),
            QUERY_TIMEOUT_MS, 'workout unlocks',
          ),
          withTimeout(
            sb.from('workout_weeks').select('*').eq('club_id', clubId).eq('status', 'completed').order('ends_at', { ascending: false }).limit(6),
            QUERY_TIMEOUT_MS, 'workout past weeks',
          ),
        ]),
        HYDRATE_TIMEOUT_MS, 'workout arena hydrate',
      ) as any;

      const [{ data: weRows }, { data: actRows }, { data: ggRows }] = weekBundle as any;
      setWeekExercises((weRows || []).filter((r: any) => r.exercise) as WeekExerciseWithDef[]);
      setWeekActivities((actRows || []) as WorkoutActivity[]);
      setGroupGoals(((ggRows || []) as GroupGoalWithDef[]).filter(g => g.exercise));
      setMyActivities((mine || []) as WorkoutActivity[]);
      setUnlocks(((unlockRows || []) as any[]).map(r => r.achievement_key));
      setPastWeeks((pastRows || []) as WorkoutWeek[]);
      setMembers(
        (memberRows || [])
          .map((r: any) => r.profiles)
          .filter((p: any) => p && p.id && p.display_name)
          .map((p: any) => ({ id: p.id, display_name: p.display_name, avatar_url: p.avatar_url })),
      );
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Failed to load Workout Arena');
    } finally {
      setLoading(false);
    }
  }, [clubId, userId]);

  useEffect(() => { setLoading(true); refresh(); }, [refresh]);

  // Live leaderboard/progress: any activity change in this club re-pulls.
  useRealtimeSubscription({
    channelName: `workout-arena-${clubId ?? 'none'}`,
    configs: clubId ? [{ table: 'workout_activities', event: '*', filter: `club_id=eq.${clubId}` }] : [],
    onPayload: refresh,
    enabled: !!clubId,
  });

  // ─── Mutations (optimistic; reconcile on refresh) ─────────────────
  const logActivity = useCallback(async (input: LogActivityInput) => {
    if (!clubId || !userId) return;
    const optimistic: WorkoutActivity = {
      id: `opt-${Date.now()}`,
      club_id: clubId,
      user_id: userId,
      week_id: input.weekId,
      exercise_id: input.exercise.id,
      measurement_type: input.exercise.measurement_type,
      raw_value: input.rawValue,
      unit: input.exercise.unit,
      started_at: input.startedAt ?? null,
      ended_at: input.endedAt ?? null,
      logged_at: new Date().toISOString(),
      activity_local_date: localToday(),
      source_type: input.source ?? 'manual',
      source_activity_id: input.sourceActivityId ?? null,
      metadata: input.metadata ?? {},
      competition_points: null,
      xp_awarded: null,
      status: 'active',
      created_at: new Date().toISOString(),
    };
    const beforeWeek = weekActivities;
    const beforeMine = myActivities;
    if (input.weekId) setWeekActivities(prev => [...prev, optimistic]);
    setMyActivities(prev => [optimistic, ...prev]);

    const row = {
      club_id: clubId,
      user_id: userId,
      week_id: input.weekId,
      exercise_id: input.exercise.id,
      measurement_type: input.exercise.measurement_type,
      raw_value: input.rawValue,
      unit: input.exercise.unit,
      started_at: input.startedAt ?? null,
      ended_at: input.endedAt ?? null,
      activity_local_date: optimistic.activity_local_date,
      source_type: optimistic.source_type,
      source_activity_id: optimistic.source_activity_id,
      metadata: optimistic.metadata,
    };
    const { data, error: insErr } = await sb.from('workout_activities').insert(row).select('*').single();
    if (insErr || !data) {
      setWeekActivities(beforeWeek);
      setMyActivities(beforeMine);
      throw insErr || new Error('log failed');
    }
    // Reconcile the optimistic row with the authoritative one.
    if (input.weekId) setWeekActivities(prev => prev.map(a => a.id === optimistic.id ? (data as WorkoutActivity) : a));
    setMyActivities(prev => prev.map(a => a.id === optimistic.id ? (data as WorkoutActivity) : a));
    return data as WorkoutActivity;
  }, [clubId, userId, weekActivities, myActivities]);

  /** Undo the most recent activity the current user logged for an exercise
   *  in the active week (the "undo last" affordance on rep loggers). */
  const undoLast = useCallback(async (exerciseId: string) => {
    const mineForEx = weekActivities
      .filter(a => a.user_id === userId && a.exercise_id === exerciseId && a.status === 'active' && !a.id.startsWith('opt-'))
      .sort((a, b) => (a.logged_at < b.logged_at ? 1 : -1));
    const last = mineForEx[0];
    if (!last) return;
    const beforeWeek = weekActivities;
    const beforeMine = myActivities;
    setWeekActivities(prev => prev.filter(a => a.id !== last.id));
    setMyActivities(prev => prev.filter(a => a.id !== last.id));
    const { error: delErr } = await sb.from('workout_activities').delete().eq('id', last.id);
    if (delErr) {
      setWeekActivities(beforeWeek);
      setMyActivities(beforeMine);
      throw delErr;
    }
  }, [weekActivities, myActivities, userId]);

  /** Persist an achievement unlock (idempotent via the unique index).
   *  Returns true if this was a genuinely new unlock for the user. */
  const insertUnlock = useCallback(async (key: string): Promise<boolean> => {
    if (!clubId || !userId) return false;
    if (unlocks.includes(key)) return false;
    setUnlocks(prev => prev.includes(key) ? prev : [...prev, key]);
    const { error: e } = await sb.from('workout_achievement_unlocks')
      .insert({ club_id: clubId, user_id: userId, achievement_key: key });
    // A duplicate (already unlocked elsewhere) is fine — treat as not-new.
    if (e && !String(e.message || '').toLowerCase().includes('duplicate')) {
      setUnlocks(prev => prev.filter(k => k !== key));
      return false;
    }
    return !e;
  }, [clubId, userId, unlocks]);

  return {
    week, weekExercises, weekActivities, myActivities, members, exercisesById,
    unlocks, pastWeeks, groupGoals,
    loading, error, refresh, logActivity, undoLast, insertUnlock,
    localToday,
  };
}
