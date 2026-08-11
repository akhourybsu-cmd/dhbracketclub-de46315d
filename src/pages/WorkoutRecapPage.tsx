import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ChevronLeft, Trophy, Medal } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { withTimeout, QUERY_TIMEOUT_MS, HYDRATE_TIMEOUT_MS } from '@/lib/asyncGuards';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useClub } from '@/contexts/ClubContext';
import { useClubAssets } from '@/hooks/useClubAssets';
import { buildLeaderboard, computeExerciseProgress, computeWeeklyAwards } from '@/lib/workout/scoring';
import { formatValue, formatValueShort } from '@/lib/workout/measurement';
import type { WorkoutWeek, WeekExerciseWithDef, WorkoutActivity } from '@/lib/workout/types';

const sb = supabase as any;
const ordinal = (n: number) => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };

/** Read-only recap of a single competition week. Standings/totals derive
 *  from the same authoritative activity as the live screen — a completed
 *  week is preserved simply by keeping its activity rows. */
export default function WorkoutRecapPage() {
  const { weekId } = useParams();
  const { user } = useAuth();
  const { club } = useClub();
  const { isInstalled, loading: assetsLoading } = useClubAssets();
  const installed = isInstalled('workout-competition');

  const [week, setWeek] = useState<WorkoutWeek | null>(null);
  const [weekExercises, setWeekExercises] = useState<WeekExerciseWithDef[]>([]);
  const [activities, setActivities] = useState<WorkoutActivity[]>([]);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!weekId || !club?.id) { setLoading(false); return; }
    try {
      const [{ data: wk }, { data: weRows }, { data: acts }, { data: memberRows }] = await withTimeout(Promise.all([
        withTimeout(sb.from('workout_weeks').select('*').eq('id', weekId).maybeSingle(), QUERY_TIMEOUT_MS, 'recap week'),
        withTimeout(sb.from('workout_week_exercises').select('*, exercise:workout_exercises(*)').eq('week_id', weekId).order('sort_order'), QUERY_TIMEOUT_MS, 'recap exercises'),
        withTimeout(sb.from('workout_activities').select('*').eq('week_id', weekId).eq('status', 'active'), QUERY_TIMEOUT_MS, 'recap activity'),
        withTimeout(sb.from('club_members').select('user_id, profiles:user_id(id, display_name)').eq('club_id', club.id), QUERY_TIMEOUT_MS, 'recap members'),
      ]), HYDRATE_TIMEOUT_MS, 'recap hydrate') as any;
      setWeek((wk as WorkoutWeek) ?? null);
      setWeekExercises(((weRows || []) as WeekExerciseWithDef[]).filter(r => r.exercise));
      setActivities((acts || []) as WorkoutActivity[]);
      const m = new Map<string, string>();
      for (const r of (memberRows || []) as any[]) if (r.profiles?.id) m.set(r.profiles.id, r.profiles.display_name);
      setNames(m);
    } finally {
      setLoading(false);
    }
  }, [weekId, club?.id]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  const leaderboard = useMemo(() => buildLeaderboard(weekExercises, activities), [weekExercises, activities]);
  const awards = useMemo(
    () => week ? computeWeeklyAwards(week, weekExercises, activities, formatValue) : [],
    [week, weekExercises, activities],
  );
  const myRow = leaderboard.find(r => r.userId === user?.id);
  const myActivities = useMemo(() => activities.filter(a => a.user_id === user?.id), [activities, user?.id]);

  if (!assetsLoading && !installed) return <Navigate to="/dashboard" replace />;

  const header = (
    <div className="flex items-center gap-2 mb-4">
      <Link to="/workouts" className="w-9 h-9 rounded-xl bg-muted/50 flex items-center justify-center btn-press flex-shrink-0"><ChevronLeft className="w-5 h-5" /></Link>
      <div className="page-header mb-0">
        <div className="page-header-icon"><Trophy className="w-5 h-5" style={{ color: 'hsl(var(--primary))' }} /></div>
        <div><h1 className="page-header-title">Week Recap</h1><p className="page-header-subtitle">{week?.title ?? 'Competition results'}</p></div>
      </div>
    </div>
  );

  if (loading) {
    return <div className="pb-6">{header}<div className="space-y-3"><div className="glass-card h-24 skeleton-shimmer" />{[1, 2, 3].map(i => <div key={i} className="glass-card h-14 skeleton-shimmer" />)}</div></div>;
  }
  if (!week) {
    return <div className="pb-6">{header}<div className="glass-card p-8 text-center text-[13px] text-muted-foreground/70">This competition week could not be found.</div></div>;
  }

  const winner = leaderboard[0];

  return (
    <div className="pb-6">
      {header}

      <div className="glass-card p-5 mb-4 text-center relative overflow-hidden"
        style={{ background: 'radial-gradient(120% 100% at 50% 0%, hsl(var(--primary) / 0.16), transparent 60%), linear-gradient(180deg, hsl(var(--card)), hsl(var(--card) / 0.6))' }}>
        <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted-foreground/60">{week.theme || 'Final results'}</p>
        <h2 className="text-[22px] font-black tracking-tight">{week.title}</h2>
        <p className="text-[11px] text-muted-foreground/60 mb-3">{new Date(week.starts_at).toLocaleDateString()} – {new Date(week.ends_at).toLocaleDateString()}</p>
        {winner && (
          <div className="inline-flex items-center gap-2 h-9 px-4 rounded-full bg-primary/12 text-primary font-black text-[14px]">
            <Trophy className="w-4 h-4" /> Champion: {winner.userId === user?.id ? 'You' : (names.get(winner.userId) || 'Member')}
          </div>
        )}
        {myRow && (
          <div className="mt-4 flex items-center justify-center gap-6">
            <div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/55">Your rank</p><p className="text-[20px] font-black tabular-nums">{ordinal(myRow.rank)}</p></div>
            <div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/55">Your score</p><p className="text-[20px] font-black tabular-nums">{myRow.score.toLocaleString()}</p></div>
          </div>
        )}
      </div>

      {/* Awards */}
      {awards.length > 0 && (
        <>
          <h3 className="section-header mb-2">Awards</h3>
          <div className="grid grid-cols-2 gap-2 mb-5">
            {awards.map(a => {
              const isMe = a.winnerUserId === user?.id;
              return (
                <div key={a.key} className="glass-card p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    {a.key === 'champion'
                      ? <Trophy className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0" />
                      : <Medal className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
                    <span className="text-[11px] font-extrabold uppercase tracking-[0.08em] truncate">{a.title}</span>
                  </div>
                  <p className="text-[13px] font-bold truncate">{isMe ? 'You' : (names.get(a.winnerUserId) || 'Member')}</p>
                  <p className="text-[11px] text-muted-foreground/60 truncate">{a.detail}</p>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Full standings */}
      <h3 className="section-header mb-2">Final standings</h3>
      <div className="glass-card overflow-hidden divide-y divide-border/10 mb-5">
        {leaderboard.map(row => {
          const isMe = row.userId === user?.id;
          return (
            <div key={row.userId} className={cn('flex items-center gap-3 px-3.5 py-2.5', isMe && 'bg-primary/[0.06]')}>
              <span className={cn('w-6 text-center text-[13px] font-black tabular-nums', row.rank <= 3 ? 'text-primary' : 'text-muted-foreground/55')}>{row.rank}</span>
              {row.rank <= 3 && <Medal className={cn('w-4 h-4 flex-shrink-0', row.rank === 1 ? 'text-yellow-500' : row.rank === 2 ? 'text-slate-400' : 'text-amber-700')} />}
              <span className="flex-1 min-w-0 truncate text-[13px] font-bold">{isMe ? 'You' : (names.get(row.userId) || 'Member')}</span>
              <span className="text-[11px] text-muted-foreground/55 tabular-nums">{Math.round(row.completionPct * 100)}%</span>
              <span className="text-[13px] font-black tabular-nums w-16 text-right">{row.score.toLocaleString()}</span>
            </div>
          );
        })}
        {leaderboard.length === 0 && <div className="px-3.5 py-6 text-center text-[12px] text-muted-foreground/60">No activity was logged this week.</div>}
      </div>

      {/* Your totals per workout */}
      {myRow && (
        <>
          <h3 className="section-header mb-2">Your workout totals</h3>
          <div className="space-y-2">
            {weekExercises.map(we => {
              const prog = computeExerciseProgress(we, myActivities);
              return (
                <div key={we.id} className="glass-card p-3.5 flex items-center justify-between">
                  <span className="text-[13px] font-bold truncate">{we.exercise.name}</span>
                  <span className="text-[13px] font-extrabold tabular-nums flex-shrink-0">
                    {formatValueShort(we.exercise.measurement_type, prog.totalRaw)}
                    {prog.goal ? <span className="text-muted-foreground/55"> / {formatValueShort(we.exercise.measurement_type, prog.goal)}</span> : null}
                    <span className="text-primary ml-2">+{prog.points.toLocaleString()}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
