// The logger family. A workout's measurement_type selects which of these
// renders — the engine's whole point. Each writes the SAME normalized
// activity via `onLog(rawValue, opts)`; only the interaction differs.
//
// Kept in one module because they share a small contract and shell; split
// per-file later if any single logger grows substantially.

import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Plus, Minus, Undo2, Play, Pause, Flag, Check, Timer as TimerIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSoundEffect } from '@/hooks/useSoundEffect';
import type { WorkoutExercise } from '@/lib/workout/types';
import { formatClock, formatValueShort, goalUnitLabel, MEASUREMENT_META } from '@/lib/workout/measurement';
import { useStopwatch } from '@/lib/workout/useStopwatch';

function haptic(ms = 8) { try { navigator.vibrate?.(ms); } catch { /* ignore */ } }

export interface LoggerLogOpts {
  startedAt?: string | null;
  endedAt?: string | null;
  metadata?: Record<string, unknown>;
}

export interface LoggerProps {
  exercise: WorkoutExercise;
  goal: number | null;
  /** Accumulated raw for this exercise this week (canonical unit). */
  weekTotal: number;
  /** Best single session (for timed/distance PBs). */
  personalBest?: number | null;
  onLog: (rawValue: number, opts?: LoggerLogOpts) => Promise<unknown> | void;
  onUndo?: () => Promise<unknown> | void;
  canUndo?: boolean;
}

// ─── Shared shell ───────────────────────────────────────────────────

function GoalBar({ exercise, goal, total }: { exercise: WorkoutExercise; goal: number | null; total: number }) {
  const pct = goal && goal > 0 ? Math.min(1, total / goal) : (total > 0 ? 1 : 0);
  return (
    <div className="w-full">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground/60">Weekly goal</span>
        <span className="text-[12px] font-extrabold tabular-nums">
          {formatValueShort(exercise.measurement_type, total)}
          {goal ? <span className="text-muted-foreground/55"> / {formatValueShort(exercise.measurement_type, goal)} {goalUnitLabel(exercise.measurement_type)}</span> : null}
        </span>
      </div>
      <div className="h-2.5 rounded-full bg-muted/40 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: 'linear-gradient(90deg, hsl(var(--primary)), hsl(var(--primary) / 0.75))' }}
          initial={false}
          animate={{ width: `${Math.round(pct * 100)}%` }}
          transition={{ type: 'spring', stiffness: 260, damping: 30 }}
        />
      </div>
    </div>
  );
}

function FeedbackFlash({ label }: { label: string | null }) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence>
      {label && (
        <motion.div
          key={label}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ type: 'spring', stiffness: 420, damping: 26 }}
          className="absolute left-1/2 -translate-x-1/2 top-1 px-3 py-1 rounded-full bg-primary text-primary-foreground text-[13px] font-black shadow-lg pointer-events-none"
        >
          {label}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function useFlash() {
  const [flash, setFlash] = useState<string | null>(null);
  const show = useCallback((label: string) => {
    setFlash(label);
    window.setTimeout(() => setFlash(cur => (cur === label ? null : cur)), 900);
  }, []);
  return { flash, show };
}

// ─── Rep logger ─────────────────────────────────────────────────────

function RepLogger({ exercise, goal, weekTotal, onLog, onUndo, canUndo }: LoggerProps) {
  const { play } = useSoundEffect();
  const { flash, show } = useFlash();
  const quick = exercise.logging_config.quick_add?.length ? exercise.logging_config.quick_add : [1, 5, 10];
  // weekTotal already reflects the optimistic append (the hook updates state
  // synchronously before its network await), so no separate local counter.
  const total = weekTotal;

  const add = useCallback((n: number) => {
    haptic(); play('tap'); show(`+${n}`);
    Promise.resolve(onLog(n));
  }, [onLog, play, show]);

  const undo = useCallback(() => {
    if (!onUndo) return;
    haptic(12); play('tap');
    Promise.resolve(onUndo());
  }, [onUndo, play]);

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative w-full flex flex-col items-center pt-6">
        <FeedbackFlash label={flash} />
        <div className="text-[13px] font-bold uppercase tracking-[0.16em] text-muted-foreground/55 mb-1">This week</div>
        <motion.div key={total} initial={{ scale: 0.94 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 22 }}
          className="text-[64px] leading-none font-black tabular-nums">
          {Math.round(total)}
        </motion.div>
      </div>
      <div className="grid grid-cols-3 gap-2.5 w-full">
        {quick.slice(0, 3).map(n => (
          <button key={n} onClick={() => add(n)}
            className="h-16 rounded-2xl bg-primary text-primary-foreground font-black text-[20px] tabular-nums btn-press active:scale-95 transition-transform shadow-sm">
            +{n}
          </button>
        ))}
      </div>
      {quick.length > 3 && (
        <div className="grid grid-cols-3 gap-2.5 w-full">
          {quick.slice(3, 6).map(n => (
            <button key={n} onClick={() => add(n)}
              className="h-12 rounded-xl bg-muted/50 hover:bg-muted text-foreground font-extrabold text-[16px] tabular-nums btn-press active:scale-95 transition-transform">
              +{n}
            </button>
          ))}
        </div>
      )}
      <GoalBar exercise={exercise} goal={goal} total={total} />
      {canUndo && (
        <button onClick={undo} className="inline-flex items-center gap-1.5 text-[12px] font-bold text-muted-foreground/70 hover:text-foreground/90 h-9 px-3 rounded-lg hover:bg-muted/40 btn-press">
          <Undo2 className="w-3.5 h-3.5" /> Undo last
        </button>
      )}
    </div>
  );
}

// ─── Timer loggers (timed hold / duration stopwatch) ────────────────

function TimerBody({ exercise, goal, weekTotal, personalBest, onLog, mode }: LoggerProps & { mode: 'hold' | 'duration' }) {
  const { play } = useSoundEffect();
  const sw = useStopwatch(`dh_workout_timer_v1:${exercise.id}`);
  const allowPause = exercise.logging_config.allow_pause !== false;
  const seconds = Math.floor(sw.elapsedMs / 1000);

  const finish = useCallback(() => {
    const snap = sw.snapshot();
    const secs = Math.round(snap.elapsedMs / 1000);
    if (secs <= 0) { sw.reset(); return; }
    haptic(18); play('success');
    Promise.resolve(onLog(secs, { startedAt: snap.startedAt, endedAt: snap.endedAt }));
    sw.reset();
  }, [sw, onLog, play]);

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="text-[13px] font-bold uppercase tracking-[0.16em] text-muted-foreground/55 pt-4">
        {mode === 'hold' ? 'Hold' : 'Session'}
      </div>
      <motion.div
        className="text-[72px] leading-none font-black tabular-nums"
        animate={sw.running ? { color: 'hsl(var(--primary))' } : { color: 'hsl(var(--foreground))' }}
      >
        {formatClock(seconds)}
      </motion.div>

      {!sw.started ? (
        <button onClick={() => { haptic(); play('tap'); sw.start(); }}
          className="w-full h-16 rounded-2xl bg-primary text-primary-foreground font-black text-[20px] btn-press active:scale-95 transition-transform inline-flex items-center justify-center gap-2 shadow-sm">
          <Play className="w-5 h-5 fill-current" /> START
        </button>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 w-full">
          {allowPause && (
            sw.running
              ? <button onClick={() => { haptic(); sw.pause(); }} className="h-14 rounded-2xl bg-muted/60 font-extrabold text-[16px] btn-press active:scale-95 inline-flex items-center justify-center gap-2"><Pause className="w-4 h-4" /> Pause</button>
              : <button onClick={() => { haptic(); sw.resume(); }} className="h-14 rounded-2xl bg-muted/60 font-extrabold text-[16px] btn-press active:scale-95 inline-flex items-center justify-center gap-2"><Play className="w-4 h-4 fill-current" /> Resume</button>
          )}
          <button onClick={finish}
            className={cn('h-14 rounded-2xl bg-primary text-primary-foreground font-black text-[16px] btn-press active:scale-95 inline-flex items-center justify-center gap-2', !allowPause && 'col-span-2')}>
            <Flag className="w-4 h-4" /> FINISH
          </button>
        </div>
      )}

      <GoalBar exercise={exercise} goal={goal} total={weekTotal} />
      {personalBest ? (
        <div className="text-[12px] text-muted-foreground/70">Personal best: <span className="font-extrabold text-foreground/85">{formatClock(personalBest)}</span></div>
      ) : null}
    </div>
  );
}

function TimedHoldLogger(p: LoggerProps) { return <TimerBody {...p} mode="hold" />; }

function DurationLogger(p: LoggerProps) {
  const allowManual = p.exercise.logging_config.allow_manual !== false;
  const [manual, setManual] = useState(false);
  if (manual) return <ManualNumber {...p} unitLabel="minutes" toRaw={(v) => v * 60} placeholder="Minutes" onBack={() => setManual(false)} />;
  return (
    <div className="flex flex-col items-center gap-4">
      <TimerBody {...p} mode="duration" />
      {allowManual && (
        <button onClick={() => setManual(true)} className="inline-flex items-center gap-1.5 text-[12px] font-bold text-muted-foreground/70 hover:text-foreground/90 h-9 px-3 rounded-lg hover:bg-muted/40 btn-press">
          <TimerIcon className="w-3.5 h-3.5" /> Enter minutes manually
        </button>
      )}
    </div>
  );
}

// ─── Countdown logger ───────────────────────────────────────────────

function CountdownLogger({ exercise, goal, weekTotal, onLog }: LoggerProps) {
  const { play } = useSoundEffect();
  const target = Math.max(1, exercise.logging_config.countdown_seconds ?? 120);
  const sw = useStopwatch(`dh_workout_timer_v1:${exercise.id}`);
  const elapsed = Math.floor(sw.elapsedMs / 1000);
  const remaining = Math.max(0, target - elapsed);

  const complete = useCallback((secs: number) => {
    haptic(18); play('success');
    const snap = sw.snapshot();
    Promise.resolve(onLog(secs, { startedAt: snap.startedAt, endedAt: snap.endedAt, metadata: { target } }));
    sw.reset();
  }, [sw, onLog, play, target]);

  // Auto-complete when the countdown reaches zero — in an effect (never
  // during render), single-fire, re-armed once the timer is reset.
  const firedRef = useRef(false);
  useEffect(() => {
    if (!sw.started) { firedRef.current = false; return; }
    if (remaining <= 0 && !firedRef.current) {
      firedRef.current = true;
      complete(target);
    }
  }, [remaining, sw.started, complete, target]);

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="text-[13px] font-bold uppercase tracking-[0.16em] text-muted-foreground/55 pt-4">Target {formatClock(target)}</div>
      <motion.div className="text-[72px] leading-none font-black tabular-nums" animate={sw.running ? { color: 'hsl(var(--primary))' } : {}}>
        {formatClock(remaining)}
      </motion.div>
      {!sw.started ? (
        <button onClick={() => { haptic(); play('tap'); sw.start(); }} className="w-full h-16 rounded-2xl bg-primary text-primary-foreground font-black text-[20px] btn-press active:scale-95 inline-flex items-center justify-center gap-2 shadow-sm">
          <Play className="w-5 h-5 fill-current" /> START
        </button>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 w-full">
          <button onClick={() => sw.running ? sw.pause() : sw.resume()} className="h-14 rounded-2xl bg-muted/60 font-extrabold text-[16px] btn-press active:scale-95">
            {sw.running ? 'Pause' : 'Resume'}
          </button>
          <button onClick={() => complete(Math.min(elapsed, target))} className="h-14 rounded-2xl bg-primary text-primary-foreground font-black text-[16px] btn-press active:scale-95 inline-flex items-center justify-center gap-2">
            <Flag className="w-4 h-4" /> FINISH
          </button>
        </div>
      )}
      <GoalBar exercise={exercise} goal={goal} total={weekTotal} />
    </div>
  );
}

// ─── Manual numeric loggers (distance / steps / generic) ────────────

function ManualNumber({
  exercise, goal, weekTotal, onLog, unitLabel, placeholder, step = 1, toRaw = (v) => v, onBack,
}: LoggerProps & { unitLabel: string; placeholder: string; step?: number; toRaw?: (v: number) => number; onBack?: () => void }) {
  const { play } = useSoundEffect();
  const [val, setVal] = useState('');
  const submit = useCallback(() => {
    const n = parseFloat(val);
    if (!isFinite(n) || n <= 0) return;
    haptic(14); play('success');
    Promise.resolve(onLog(toRaw(n)));
    setVal('');
    onBack?.();
  }, [val, onLog, toRaw, play, onBack]);
  return (
    <div className="flex flex-col items-center gap-5 pt-4 w-full">
      <div className="text-[13px] font-bold uppercase tracking-[0.16em] text-muted-foreground/55">Add {unitLabel}</div>
      <input
        type="number" inputMode="decimal" autoFocus value={val} step={step} min={0}
        onChange={e => setVal(e.target.value)} placeholder={placeholder}
        onKeyDown={e => { if (e.key === 'Enter') submit(); }}
        className="w-full h-16 rounded-2xl bg-muted/30 border border-border/25 text-center text-[32px] font-black tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
      />
      <button onClick={submit} disabled={!val || parseFloat(val) <= 0}
        className="w-full h-14 rounded-2xl bg-primary text-primary-foreground font-black text-[17px] btn-press active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed">
        Add {unitLabel}
      </button>
      <GoalBar exercise={exercise} goal={goal} total={weekTotal} />
      {onBack && <button onClick={onBack} className="text-[12px] font-bold text-muted-foreground/60 h-8 px-3 rounded-lg hover:bg-muted/40">Back to timer</button>}
    </div>
  );
}

function DistanceLogger(p: LoggerProps) {
  const unit = p.exercise.logging_config.distance_unit ?? 'mi';
  // Canonical stored unit is miles; convert km entry.
  const toRaw = (v: number) => unit === 'km' ? v * 0.621371 : v;
  return <ManualNumber {...p} unitLabel={unit} placeholder={`Distance (${unit})`} step={0.1} toRaw={toRaw} />;
}

function StepsLogger(p: LoggerProps) {
  return <ManualNumber {...p} unitLabel="steps" placeholder="Steps" step={100} />;
}

// ─── Sets × reps logger ─────────────────────────────────────────────

function SetsLogger({ exercise, goal, weekTotal, onLog }: LoggerProps) {
  const { play } = useSoundEffect();
  const cfg = exercise.logging_config;
  const defaultReps = cfg.default_reps ?? 12;
  const [sets, setSets] = useState<number[]>([]);
  const [reps, setReps] = useState(defaultReps);
  const totalThisEntry = sets.reduce((t, r) => t + r, 0);

  const completeSet = useCallback(() => {
    if (reps <= 0) return;
    haptic(); play('tap');
    setSets(prev => [...prev, reps]);
  }, [reps, play]);

  const finish = useCallback(() => {
    if (totalThisEntry <= 0) return;
    haptic(16); play('success');
    Promise.resolve(onLog(totalThisEntry, { metadata: { sets } }));
    setSets([]);
  }, [totalThisEntry, sets, onLog, play]);

  return (
    <div className="flex flex-col items-center gap-4 w-full pt-3">
      <div className="flex flex-wrap gap-2 justify-center min-h-[28px]">
        {sets.map((r, i) => (
          <span key={i} className="inline-flex items-center gap-1 px-2.5 h-7 rounded-lg bg-primary/12 text-primary text-[12px] font-extrabold tabular-nums">
            <Check className="w-3 h-3" /> {r}
          </span>
        ))}
        {sets.length === 0 && <span className="text-[12px] text-muted-foreground/55">No sets yet — set your reps and complete a set.</span>}
      </div>

      <div className="text-[13px] font-bold uppercase tracking-[0.16em] text-muted-foreground/55">Set {sets.length + 1} · reps</div>
      <div className="flex items-center gap-3">
        <button onClick={() => setReps(r => Math.max(1, r - 1))} className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center btn-press active:scale-90"><Minus className="w-5 h-5" /></button>
        <div className="text-[44px] font-black tabular-nums w-20 text-center">{reps}</div>
        <button onClick={() => setReps(r => r + 1)} className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center btn-press active:scale-90"><Plus className="w-5 h-5" /></button>
      </div>

      <button onClick={completeSet} className="w-full h-14 rounded-2xl bg-primary text-primary-foreground font-black text-[16px] btn-press active:scale-95">
        Complete set
      </button>
      {sets.length > 0 && (
        <button onClick={finish} className="w-full h-12 rounded-xl bg-muted/50 font-extrabold text-[15px] btn-press active:scale-95">
          Log {totalThisEntry} reps · {sets.length} {sets.length === 1 ? 'set' : 'sets'}
        </button>
      )}
      <GoalBar exercise={exercise} goal={goal} total={weekTotal} />
    </div>
  );
}

// ─── Round logger (circuits) ────────────────────────────────────────

function RoundLogger({ exercise, goal, weekTotal, onLog }: LoggerProps) {
  const { play } = useSoundEffect();
  const def = exercise.logging_config.round_definition;
  const total = weekTotal; // reflects optimistic append synchronously

  const completeRound = useCallback(() => {
    haptic(16); play('success');
    Promise.resolve(onLog(1));
  }, [onLog, play]);

  return (
    <div className="flex flex-col items-center gap-5 pt-3 w-full">
      {def?.items?.length ? (
        <div className="w-full rounded-2xl bg-muted/25 border border-border/15 p-3.5">
          <div className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground/55 mb-2">{def.label || 'One round'}</div>
          <ul className="space-y-1.5">
            {def.items.map((it, i) => (
              <li key={i} className="flex items-center justify-between text-[14px]">
                <span className="font-semibold text-foreground/85">{it.label}</span>
                {it.value != null && <span className="font-extrabold tabular-nums text-muted-foreground/75">{it.value}{it.unit ? ` ${it.unit}` : ''}</span>}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-col items-center">
        <div className="text-[13px] font-bold uppercase tracking-[0.16em] text-muted-foreground/55 mb-1">Rounds this week</div>
        <motion.div key={total} initial={{ scale: 0.94 }} animate={{ scale: 1 }} className="text-[56px] leading-none font-black tabular-nums">{Math.round(total)}</motion.div>
      </div>

      <button onClick={completeRound} className="w-full h-16 rounded-2xl bg-primary text-primary-foreground font-black text-[18px] btn-press active:scale-95 shadow-sm">
        COMPLETE ROUND
      </button>
      <GoalBar exercise={exercise} goal={goal} total={total} />
    </div>
  );
}

// ─── Completion logger ──────────────────────────────────────────────

function CompletionLogger({ exercise, weekTotal, onLog }: LoggerProps) {
  const { play } = useSoundEffect();
  const [done, setDone] = useState(weekTotal > 0);
  const complete = useCallback(() => {
    haptic(20); play('success');
    setDone(true);
    Promise.resolve(onLog(1));
  }, [onLog, play]);
  return (
    <div className="flex flex-col items-center gap-6 pt-6">
      <motion.div
        className={cn('w-28 h-28 rounded-full flex items-center justify-center', done ? 'bg-primary text-primary-foreground' : 'bg-muted/40 text-muted-foreground/60')}
        animate={done ? { scale: [1, 1.12, 1] } : {}}
        transition={{ duration: 0.4 }}
      >
        <Check className="w-14 h-14" strokeWidth={2.5} />
      </motion.div>
      {done ? (
        <div className="text-center">
          <p className="text-[18px] font-black">Done today 🎉</p>
          <button onClick={complete} className="mt-3 text-[12px] font-bold text-muted-foreground/70 hover:text-foreground/90 h-9 px-3 rounded-lg hover:bg-muted/40 btn-press">Log again</button>
        </div>
      ) : (
        <button onClick={complete} className="w-full h-16 rounded-2xl bg-primary text-primary-foreground font-black text-[20px] btn-press active:scale-95 shadow-sm">
          COMPLETE
        </button>
      )}
    </div>
  );
}

// ─── Dispatcher ─────────────────────────────────────────────────────

export function WorkoutLogger(props: LoggerProps) {
  const logger = MEASUREMENT_META[props.exercise.measurement_type].logger;
  switch (logger) {
    case 'rep':        return <RepLogger {...props} />;
    case 'timer':      return <TimedHoldLogger {...props} />;
    case 'duration':   return <DurationLogger {...props} />;
    case 'countdown':  return <CountdownLogger {...props} />;
    case 'distance':   return <DistanceLogger {...props} />;
    case 'steps':      return <StepsLogger {...props} />;
    case 'sets':       return <SetsLogger {...props} />;
    case 'round':      return <RoundLogger {...props} />;
    case 'completion': return <CompletionLogger {...props} />;
    default:           return <RepLogger {...props} />;
  }
}
