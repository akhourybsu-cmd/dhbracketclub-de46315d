import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Dumbbell, Settings, Trophy, ChevronRight, Flame, Timer, Play, Medal, Users } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useClub } from '@/contexts/ClubContext';
import { useClubAssets } from '@/hooks/useClubAssets';
import { useWorkoutArena } from '@/hooks/useWorkoutArena';
import { WorkoutLoggerSheet } from '@/components/workout/WorkoutLoggerSheet';
import {
  buildLeaderboard, computeExerciseProgress, userWeekScore,
  lifetimeXp, levelFromXp, computeStreak, computeRecords, computeMilestones,
} from '@/lib/workout/scoring';
import { formatValue, formatValueShort, goalUnitLabel, MEASUREMENT_META } from '@/lib/workout/measurement';
import {
  evaluateAchievements, ACHIEVEMENTS_BY_KEY, ACHIEVEMENTS,
  type AchievementContext,
} from '@/lib/workout/achievements';
import type { WeekExerciseWithDef, WorkoutExercise } from '@/lib/workout/types';

function timeRemaining(endsAt: string): string {
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return 'Ended';
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

export default function WorkoutPage() {
  const { user } = useAuth();
  const { club, isClubAdmin } = useClub();
  const { isInstalled, loading: assetsLoading } = useClubAssets();
  const installed = isInstalled('workout-competition');

  const {
    week, weekExercises, weekActivities, myActivities, members, unlocks, pastWeeks, groupGoals, loading, error,
    logActivity, undoLast, insertUnlock,
  } = useWorkoutArena(club?.id, user?.id);

  const [selected, setSelected] = useState<WeekExerciseWithDef | null>(null);
  const [, tick] = useState(0);
  useEffect(() => { const id = setInterval(() => tick(n => n + 1), 30000); return () => clearInterval(id); }, []);

  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const mem of members) m.set(mem.id, mem.display_name);
    return m;
  }, [members]);

  const myWeekActivities = useMemo(
    () => weekActivities.filter(a => a.user_id === user?.id),
    [weekActivities, user?.id],
  );

  const leaderboard = useMemo(
    () => buildLeaderboard(weekExercises, weekActivities, user?.id ? [user.id] : []),
    [weekExercises, weekActivities, user?.id],
  );
  const myScore = useMemo(() => userWeekScore(weekExercises, myWeekActivities), [weekExercises, myWeekActivities]);
  const myRank = leaderboard.find(r => r.userId === user?.id)?.rank ?? null;

  const exercisesById = useMemo(() => {
    const m = new Map<string, WorkoutExercise>();
    for (const we of weekExercises) m.set(we.exercise.id, we.exercise);
    return m;
  }, [weekExercises]);
  const myXp = useMemo(() => lifetimeXp(exercisesById, myActivities), [exercisesById, myActivities]);
  const level = useMemo(() => levelFromXp(myXp), [myXp]);
  const todayLocal = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);
  const streak = useMemo(
    () => computeStreak(myActivities.map(a => a.activity_local_date), todayLocal),
    [myActivities, todayLocal],
  );

  // Achievement detection + restrained celebration. Criteria are evaluated
  // from authoritative activity; unlocks persist so we never re-celebrate.
  const celebratedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (loading) return;
    const ctx: AchievementContext = {
      lifetime: myActivities,
      weekActivities: myWeekActivities,
      weekExercises,
      week,
      todayLocal,
    };
    const satisfied = evaluateAchievements(ctx);
    const fresh = satisfied.filter(k => !unlocks.includes(k) && !celebratedRef.current.has(k));
    fresh.forEach(async (k) => {
      celebratedRef.current.add(k);
      const isNew = await insertUnlock(k);
      if (!isNew) return;
      const def = ACHIEVEMENTS_BY_KEY[k];
      if (!def) return;
      const emoji = def.tier === 'gold' ? '🏆' : def.tier === 'silver' ? '🥈' : '🎖️';
      toast.success(`${emoji} ${def.title}`, {
        description: def.description,
        duration: def.tier === 'gold' ? 6000 : 4000,
      });
    });
  }, [loading, myActivities, myWeekActivities, weekExercises, week, unlocks, todayLocal, insertUnlock]);

  // ─── Guards ───────────────────────────────────────────────────────
  if (!assetsLoading && !installed) return <Navigate to="/dashboard" replace />;

  const weekTotalFor = (exerciseId: string) =>
    myWeekActivities.filter(a => a.exercise_id === exerciseId).reduce((t, a) => t + Number(a.raw_value), 0);
  const personalBestFor = (exerciseId: string) => {
    const vals = myActivities.filter(a => a.exercise_id === exerciseId).map(a => Number(a.raw_value));
    return vals.length ? Math.max(...vals) : null;
  };
  const recordsFor = (ex: WorkoutExercise) =>
    computeRecords(ex, myActivities).map(s => ({ label: s.label, value: formatValue(ex.measurement_type, s.value) }));
  const nextMilestoneFor = (ex: WorkoutExercise): string | null => {
    const acts = myActivities.filter(a => a.exercise_id === ex.id);
    const lifetime = acts.reduce((t, a) => t + Number(a.raw_value), 0);
    const best = acts.length ? Math.max(...acts.map(a => Number(a.raw_value))) : 0;
    const m = computeMilestones(ex.milestone_config, lifetime, best);
    const isTime = MEASUREMENT_META[ex.measurement_type].isTime;
    const next = isTime ? (m.nextSession ?? m.nextLifetime) : (m.nextLifetime ?? m.nextSession);
    return next != null ? formatValue(ex.measurement_type, next) : null;
  };

  const quickLog = async (we: WeekExerciseWithDef, amount: number) => {
    try { await logActivity({ exercise: we.exercise, weekId: week?.id ?? null, rawValue: amount }); }
    catch { toast.error('Could not log that — try again'); }
  };

  const header = (
    <div className="flex items-center justify-between mb-4">
      <div className="page-header mb-0">
        <div className="page-header-icon"><Dumbbell className="w-5 h-5" style={{ color: 'hsl(var(--primary))' }} /></div>
        <div>
          <h1 className="page-header-title">Workout Arena</h1>
          <p className="page-header-subtitle">{week ? week.title : 'Weekly fitness competition'}</p>
        </div>
      </div>
      {isClubAdmin && (
        <Link to="/workouts/admin" aria-label="Manage Workout Arena"
          className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-muted/50 hover:bg-muted text-muted-foreground/80 btn-press">
          <Settings className="w-[18px] h-[18px]" />
        </Link>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="pb-6">
        {header}
        <div className="space-y-3">
          <div className="glass-card h-28 skeleton-shimmer" />
          {[1, 2, 3].map(i => <div key={i} className="glass-card h-20 skeleton-shimmer" />)}
        </div>
      </div>
    );
  }

  if (!week) {
    return (
      <div className="pb-6">
        {header}
        <div className="glass-card p-8 text-center">
          <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center bg-primary/10">
            <Trophy className="w-7 h-7 text-primary/60" />
          </div>
          <p className="text-sm font-bold mb-1">No active competition</p>
          <p className="text-[12px] text-muted-foreground/70 mb-4">
            {isClubAdmin ? 'Create a competition week and publish it to kick things off.' : 'Check back when your club starts the next weekly competition.'}
          </p>
          {isClubAdmin && (
            <Link to="/workouts/admin" className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-primary text-primary-foreground text-[13px] font-bold btn-press">
              <Settings className="w-4 h-4" /> Set up a week
            </Link>
          )}
        </div>
        {error && <p className="text-[11px] text-destructive/80 text-center mt-3">{error}</p>}
      </div>
    );
  }

  return (
    <div className="pb-6">
      {header}

      {/* Hero: score + rank + time remaining */}
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="glass-card p-5 relative overflow-hidden mb-4"
        style={{ background: 'radial-gradient(120% 100% at 50% 0%, hsl(var(--primary) / 0.16), transparent 60%), linear-gradient(180deg, hsl(var(--card)), hsl(var(--card) / 0.6))' }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="min-w-0">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted-foreground/60">{week.theme || 'This week'}</p>
            <h2 className="text-[20px] font-black tracking-tight truncate">{week.title}</h2>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/55">Remaining</p>
            <p className="text-[15px] font-black tabular-nums">{timeRemaining(week.ends_at)}</p>
          </div>
        </div>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground/55">Your score</p>
            <p className="text-[40px] leading-none font-black tabular-nums">{myScore.toLocaleString()}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-center">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/55">Rank</p>
              <p className="text-[18px] font-black tabular-nums">{myRank ? ordinal(myRank) : '—'}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/55">Lvl</p>
              <p className="text-[18px] font-black tabular-nums">{level.level}</p>
            </div>
            {streak > 0 && (
              <div className="text-center">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/55">Streak</p>
                <p className="text-[18px] font-black tabular-nums inline-flex items-center gap-0.5"><Flame className="w-3.5 h-3.5 text-orange-500" />{streak}</p>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Club group goals — combined progress across all members */}
      {groupGoals.map((g) => {
        const combined = weekActivities.filter(a => a.exercise_id === g.exercise_id).reduce((t, a) => t + Number(a.raw_value), 0);
        const pct = g.target > 0 ? Math.min(1, combined / g.target) : 0;
        return (
          <div key={g.id} className="glass-card p-4 mb-4 border border-primary/15">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-primary" />
              <h3 className="text-[13px] font-black uppercase tracking-[0.1em]">Club Goal</h3>
              {pct >= 1 && <span className="ml-auto text-[11px] font-black text-primary">Complete 🎉</span>}
            </div>
            <p className="text-[14px] font-bold mb-2">{g.title}</p>
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-[18px] font-black tabular-nums">{formatValueShort(g.exercise.measurement_type, combined)}</span>
              <span className="text-[12px] font-bold text-muted-foreground/60 tabular-nums">/ {formatValueShort(g.exercise.measurement_type, g.target)}</span>
            </div>
            <div className="h-2.5 rounded-full bg-muted/40 overflow-hidden">
              <motion.div className="h-full rounded-full" style={{ background: 'linear-gradient(90deg, hsl(var(--primary)), hsl(var(--primary) / 0.7))' }}
                initial={false} animate={{ width: `${Math.round(pct * 100)}%` }} transition={{ type: 'spring', stiffness: 260, damping: 30 }} />
            </div>
          </div>
        );
      })}

      {/* Exercise progress rows */}
      <h3 className="section-header mb-2">This week's workouts</h3>
      <div className="space-y-2.5 mb-5">
        {weekExercises.map((we) => {
          const prog = computeExerciseProgress(we, myWeekActivities);
          const meta = MEASUREMENT_META[we.exercise.measurement_type];
          const isRepLike = meta.logger === 'rep' || meta.logger === 'round';
          const quick = we.exercise.logging_config.quick_add?.slice(0, 3) ?? [1, 5, 10];
          return (
            <div key={we.id} className="glass-card p-3.5">
              <button onClick={() => setSelected(we)} className="w-full flex items-center gap-3 text-left">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-primary/10 text-primary">
                  <Dumbbell className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-extrabold text-[14px] truncate">{we.exercise.name}</h4>
                    <span className="text-[12px] font-extrabold tabular-nums flex-shrink-0">
                      {formatValueShort(we.exercise.measurement_type, prog.totalRaw)}
                      {prog.goal ? <span className="text-muted-foreground/55"> / {formatValueShort(we.exercise.measurement_type, prog.goal)}</span> : null}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden mt-1.5">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round(prog.goalPct * 100)}%` }} />
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground/40 flex-shrink-0" />
              </button>

              {/* Few-seconds inline path */}
              <div className="flex gap-2 mt-3">
                {isRepLike ? (
                  meta.logger === 'round' ? (
                    <button onClick={() => quickLog(we, 1)} className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground font-extrabold text-[14px] btn-press active:scale-95">
                      Complete round
                    </button>
                  ) : (
                    quick.map(n => (
                      <button key={n} onClick={() => quickLog(we, n)} className="flex-1 h-11 rounded-xl bg-primary/12 text-primary font-black text-[16px] tabular-nums btn-press active:scale-95">
                        +{n}
                      </button>
                    ))
                  )
                ) : (
                  <button onClick={() => setSelected(we)} className="flex-1 h-11 rounded-xl bg-primary/12 text-primary font-extrabold text-[14px] btn-press active:scale-95 inline-flex items-center justify-center gap-2">
                    {meta.isTime ? <><Play className="w-4 h-4 fill-current" /> Start timer</> : <><Timer className="w-4 h-4" /> Log {goalUnitLabel(we.exercise.measurement_type)}</>}
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {weekExercises.length === 0 && (
          <div className="glass-card p-6 text-center text-[13px] text-muted-foreground/70">No workouts in this week yet.</div>
        )}
      </div>

      {/* Leaderboard preview */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="section-header mb-0">Leaderboard</h3>
      </div>
      <div className="glass-card overflow-hidden divide-y divide-border/10">
        {leaderboard.slice(0, 5).map((row) => {
          const isMe = row.userId === user?.id;
          return (
            <div key={row.userId} className={cn('flex items-center gap-3 px-3.5 py-2.5', isMe && 'bg-primary/[0.06]')}>
              <span className={cn('w-6 text-center text-[13px] font-black tabular-nums', row.rank <= 3 ? 'text-primary' : 'text-muted-foreground/55')}>{row.rank}</span>
              <span className="flex-1 min-w-0 truncate text-[13px] font-bold">
                {isMe ? 'You' : (nameById.get(row.userId) || 'Member')}
              </span>
              <span className="text-[11px] text-muted-foreground/55 tabular-nums">{Math.round(row.completionPct * 100)}%</span>
              <span className="text-[13px] font-black tabular-nums w-16 text-right">{row.score.toLocaleString()}</span>
            </div>
          );
        })}
        {leaderboard.length === 0 && (
          <div className="px-3.5 py-6 text-center text-[12px] text-muted-foreground/60">Be the first to log a workout.</div>
        )}
      </div>

      {/* Badges (unlocked achievements) */}
      {unlocks.length > 0 && (
        <div className="mt-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="section-header mb-0">Badges</h3>
            <span className="text-[11px] font-bold text-muted-foreground/55 tabular-nums">{unlocks.length}/{ACHIEVEMENTS.length}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {ACHIEVEMENTS.filter(a => unlocks.includes(a.key)).map(a => (
              <div key={a.key} className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg bg-primary/10 text-primary text-[12px] font-bold" title={a.description}>
                <Medal className="w-3.5 h-3.5" /> {a.title}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent completed weeks → recap */}
      {pastWeeks.length > 0 && (
        <div className="mt-5">
          <h3 className="section-header mb-2">Recent weeks</h3>
          <div className="glass-card overflow-hidden divide-y divide-border/10">
            {pastWeeks.map(w => (
              <Link key={w.id} to={`/workouts/recap/${w.id}`} className="flex items-center gap-3 px-3.5 py-3 hover:bg-muted/20 transition-colors">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-muted/40 text-muted-foreground/70"><Trophy className="w-4 h-4" /></div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold truncate">{w.title}</p>
                  <p className="text-[10px] text-muted-foreground/55">{new Date(w.ends_at).toLocaleDateString()}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground/40 flex-shrink-0" />
              </Link>
            ))}
          </div>
        </div>
      )}

      <WorkoutLoggerSheet
        exercise={selected?.exercise ?? null}
        goal={selected ? (selected.goal ?? selected.exercise.default_weekly_goal ?? null) : null}
        weekTotal={selected ? weekTotalFor(selected.exercise.id) : 0}
        personalBest={selected ? personalBestFor(selected.exercise.id) : null}
        records={selected ? recordsFor(selected.exercise) : undefined}
        nextMilestone={selected ? nextMilestoneFor(selected.exercise) : null}
        canUndo={selected ? weekTotalFor(selected.exercise.id) > 0 : false}
        onClose={() => setSelected(null)}
        onLog={async (rawValue, opts) => {
          if (!selected) return;
          try { await logActivity({ exercise: selected.exercise, weekId: week?.id ?? null, rawValue, startedAt: opts?.startedAt, endedAt: opts?.endedAt, metadata: opts?.metadata }); }
          catch { toast.error('Could not log that — try again'); }
        }}
        onUndo={selected ? async () => { try { await undoLast(selected.exercise.id); } catch { toast.error('Undo failed'); } } : undefined}
      />
    </div>
  );
}
