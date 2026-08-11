import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { withTimeout, QUERY_TIMEOUT_MS, HYDRATE_TIMEOUT_MS } from '@/lib/asyncGuards';
import type {
  WorkoutExercise, WorkoutWeek, WeekStatus, WeekExerciseWithDef,
} from '@/lib/workout/types';

const sb = supabase as any;

export interface WeekWithExercises extends WorkoutWeek {
  exercises: WeekExerciseWithDef[];
}

export interface WeekExerciseInput {
  exercise_id: string;
  goal: number | null;
  scoring_config: Record<string, unknown>;
  sort_order: number;
}

/** Admin data + CRUD for exercises and competition weeks. */
export function useWorkoutAdmin(clubId: string | undefined, userId: string | undefined) {
  const [exercises, setExercises] = useState<WorkoutExercise[]>([]);
  const [weeks, setWeeks] = useState<WeekWithExercises[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!clubId) { setLoading(false); return; }
    try {
      const [{ data: exRows }, { data: weekRows }] = await withTimeout(Promise.all([
        withTimeout(sb.from('workout_exercises').select('*').eq('club_id', clubId).order('sort_order').order('created_at'), QUERY_TIMEOUT_MS, 'admin exercises'),
        withTimeout(sb.from('workout_weeks').select('*').eq('club_id', clubId).order('starts_at', { ascending: false }), QUERY_TIMEOUT_MS, 'admin weeks'),
      ]), HYDRATE_TIMEOUT_MS, 'workout admin hydrate');

      const wks = (weekRows || []) as WorkoutWeek[];
      let joined: WeekWithExercises[] = wks.map(w => ({ ...w, exercises: [] }));
      if (wks.length > 0) {
        const { data: weRows } = await withTimeout(
          sb.from('workout_week_exercises').select('*, exercise:workout_exercises(*)').in('week_id', wks.map(w => w.id)).order('sort_order'),
          QUERY_TIMEOUT_MS, 'admin week exercises',
        );
        const byWeek = new Map<string, WeekExerciseWithDef[]>();
        for (const r of (weRows || []) as WeekExerciseWithDef[]) {
          if (!r.exercise) continue;
          if (!byWeek.has(r.week_id)) byWeek.set(r.week_id, []);
          byWeek.get(r.week_id)!.push(r);
        }
        joined = wks.map(w => ({ ...w, exercises: byWeek.get(w.id) ?? [] }));
      }
      setExercises((exRows || []) as WorkoutExercise[]);
      setWeeks(joined);
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Failed to load admin data');
    } finally {
      setLoading(false);
    }
  }, [clubId]);

  useEffect(() => { setLoading(true); refresh(); }, [refresh]);

  // ─── Exercises ────────────────────────────────────────────────────
  const createExercise = useCallback(async (payload: Partial<WorkoutExercise>) => {
    if (!clubId) return;
    const { error: e } = await sb.from('workout_exercises').insert({ ...payload, club_id: clubId, created_by: userId });
    if (e) throw e;
    await refresh();
  }, [clubId, userId, refresh]);

  const updateExercise = useCallback(async (id: string, patch: Partial<WorkoutExercise>) => {
    const { error: e } = await sb.from('workout_exercises').update(patch).eq('id', id);
    if (e) throw e;
    await refresh();
  }, [refresh]);

  const deleteExercise = useCallback(async (id: string) => {
    const { error: e } = await sb.from('workout_exercises').delete().eq('id', id);
    if (e) throw e;
    await refresh();
  }, [refresh]);

  // ─── Weeks ────────────────────────────────────────────────────────
  const createWeek = useCallback(async (
    week: { title: string; theme: string | null; starts_at: string; ends_at: string; status: WeekStatus },
    items: WeekExerciseInput[],
    groupGoal?: { exercise_id: string; title: string; target: number } | null,
  ) => {
    if (!clubId) return;
    const { data, error: e } = await sb.from('workout_weeks')
      .insert({ ...week, club_id: clubId, created_by: userId }).select('*').single();
    if (e || !data) throw e || new Error('create week failed');
    if (items.length) {
      const rows = items.map(it => ({ ...it, week_id: data.id }));
      const { error: e2 } = await sb.from('workout_week_exercises').insert(rows);
      if (e2) throw e2;
    }
    if (groupGoal) {
      const { error: e3 } = await sb.from('workout_group_goals').insert({
        club_id: clubId, week_id: data.id, created_by: userId,
        exercise_id: groupGoal.exercise_id, title: groupGoal.title, target: groupGoal.target,
      });
      if (e3) throw e3;
    }
    await refresh();
    return data as WorkoutWeek;
  }, [clubId, userId, refresh]);

  const setWeekStatus = useCallback(async (weekId: string, status: WeekStatus) => {
    const { error: e } = await sb.from('workout_weeks').update({ status }).eq('id', weekId);
    if (e) throw e;
    await refresh();
  }, [refresh]);

  const deleteWeek = useCallback(async (weekId: string) => {
    const { error: e } = await sb.from('workout_weeks').delete().eq('id', weekId);
    if (e) throw e;
    await refresh();
  }, [refresh]);

  const setWeekExercises = useCallback(async (weekId: string, items: WeekExerciseInput[]) => {
    await sb.from('workout_week_exercises').delete().eq('week_id', weekId);
    if (items.length) {
      const { error: e } = await sb.from('workout_week_exercises').insert(items.map(it => ({ ...it, week_id: weekId })));
      if (e) throw e;
    }
    await refresh();
  }, [refresh]);

  return {
    exercises, weeks, loading, error, refresh,
    createExercise, updateExercise, deleteExercise,
    createWeek, setWeekStatus, deleteWeek, setWeekExercises,
  };
}
