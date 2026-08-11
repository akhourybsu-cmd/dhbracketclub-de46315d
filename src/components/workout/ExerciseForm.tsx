import { useMemo, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MeasurementType, ExerciseCategory, WorkoutExercise, RoundItem, LoggingConfig } from '@/lib/workout/types';
import { MEASUREMENT_META, MEASUREMENT_TYPES, CATEGORIES, CATEGORY_META } from '@/lib/workout/measurement';

// Admin exercise builder. The config fields shown below the measurement
// picker are ENTIRELY driven by the selected type — the "the exercise
// controls its interaction model" rule, applied to authoring too.

const pointsUnitHint: Record<MeasurementType, string> = {
  reps: 'per rep', timed_hold: 'per second', duration: 'per second', countdown: 'per second',
  distance: 'per mile', steps: 'per step', sets_reps: 'per rep', rounds: 'per round', completion: 'per completion',
};

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground/60 mb-1.5">{children}</label>;
}
function Field({ children }: { children: React.ReactNode }) {
  return <div className="mb-3.5">{children}</div>;
}
const inputCls = 'w-full h-11 rounded-xl bg-muted/30 border border-border/25 px-3.5 text-[14px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30';

export interface ExerciseFormValue {
  name: string;
  short_description: string;
  instructions: string;
  category: ExerciseCategory;
  measurement_type: MeasurementType;
  quick_add: string;             // comma-separated
  allow_pause: boolean;
  allow_manual: boolean;
  countdown_minutes: number;
  countdown_seconds: number;
  distance_unit: 'mi' | 'km';
  default_reps: number;
  allow_weight: boolean;
  round_label: string;
  round_items: RoundItem[];
  weekly_goal: string;           // natural unit (minutes for time)
  points_per_unit: string;
  max_weekly_points: string;
  lifetime_milestones: string;   // comma-separated
  session_milestones: string;    // comma-separated (time types, seconds)
  active: boolean;
}

function defaults(): ExerciseFormValue {
  return {
    name: '', short_description: '', instructions: '',
    category: 'full_body', measurement_type: 'reps',
    quick_add: '1, 5, 10', allow_pause: true, allow_manual: true,
    countdown_minutes: 2, countdown_seconds: 0, distance_unit: 'mi',
    default_reps: 12, allow_weight: false, round_label: 'One round', round_items: [],
    weekly_goal: '', points_per_unit: '1', max_weekly_points: '1000',
    lifetime_milestones: '', session_milestones: '', active: true,
  };
}

/** Reverse-map an existing exercise into editable form state. */
function fromExercise(ex: WorkoutExercise): ExerciseFormValue {
  const lc = ex.logging_config || {};
  const sc = ex.scoring_config || {};
  const mc = ex.milestone_config || {};
  const isTime = MEASUREMENT_META[ex.measurement_type].isTime;
  return {
    ...defaults(),
    name: ex.name,
    short_description: ex.short_description ?? '',
    instructions: ex.instructions ?? '',
    category: (ex.category as ExerciseCategory) ?? 'full_body',
    measurement_type: ex.measurement_type,
    quick_add: (lc.quick_add ?? [1, 5, 10]).join(', '),
    allow_pause: lc.allow_pause !== false,
    allow_manual: lc.allow_manual !== false,
    countdown_minutes: Math.floor((lc.countdown_seconds ?? 120) / 60),
    countdown_seconds: (lc.countdown_seconds ?? 120) % 60,
    distance_unit: lc.distance_unit ?? 'mi',
    default_reps: lc.default_reps ?? 12,
    allow_weight: !!lc.allow_weight,
    round_label: lc.round_definition?.label ?? 'One round',
    round_items: lc.round_definition?.items ?? [],
    weekly_goal: ex.default_weekly_goal != null ? String(isTime ? ex.default_weekly_goal / 60 : ex.default_weekly_goal) : '',
    points_per_unit: String(sc.points_per_unit ?? 1),
    max_weekly_points: sc.max_weekly_points != null ? String(sc.max_weekly_points) : '',
    lifetime_milestones: (mc.lifetime ?? []).join(', '),
    session_milestones: (mc.session ?? []).join(', '),
    active: ex.active,
  };
}

function parseNums(s: string): number[] {
  return s.split(',').map(x => parseFloat(x.trim())).filter(n => isFinite(n) && n > 0);
}

/** Build the DB payload from form state. Goal/milestones convert to the
 *  canonical unit (seconds for time types). */
export function buildExercisePayload(v: ExerciseFormValue): Partial<WorkoutExercise> {
  const type = v.measurement_type;
  const meta = MEASUREMENT_META[type];
  const isTime = meta.isTime;

  const logging: LoggingConfig = {};
  if (type === 'reps') logging.quick_add = parseNums(v.quick_add).map(n => Math.round(n));
  if (type === 'timed_hold' || type === 'duration' || type === 'countdown') logging.allow_pause = v.allow_pause;
  if (type === 'duration') logging.allow_manual = v.allow_manual;
  if (type === 'countdown') logging.countdown_seconds = v.countdown_minutes * 60 + v.countdown_seconds;
  if (type === 'distance') logging.distance_unit = v.distance_unit;
  if (type === 'sets_reps') { logging.default_reps = v.default_reps; logging.allow_weight = v.allow_weight; }
  if (type === 'rounds') logging.round_definition = { label: v.round_label, items: v.round_items };

  const goalNum = v.weekly_goal.trim() ? parseFloat(v.weekly_goal) : null;
  const goalCanonical = goalNum != null && isFinite(goalNum) ? (isTime ? goalNum * 60 : goalNum) : null;

  const lifetime = parseNums(v.lifetime_milestones);
  const session = parseNums(v.session_milestones);

  return {
    name: v.name.trim(),
    short_description: v.short_description.trim() || null,
    instructions: v.instructions.trim() || null,
    category: v.category,
    measurement_type: type,
    unit: meta.unit,
    logging_config: logging,
    scoring_config: {
      points_per_unit: parseFloat(v.points_per_unit) || 1,
      max_weekly_points: v.max_weekly_points.trim() ? parseFloat(v.max_weekly_points) : null,
    },
    default_weekly_goal: goalCanonical,
    milestone_config: { lifetime, session },
    active: v.active,
  };
}

export function ExerciseForm({
  initial, onSubmit, onCancel,
}: {
  initial?: WorkoutExercise;
  onSubmit: (payload: Partial<WorkoutExercise>) => Promise<void> | void;
  onCancel: () => void;
}) {
  const [v, setV] = useState<ExerciseFormValue>(initial ? fromExercise(initial) : defaults());
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof ExerciseFormValue>(k: K, val: ExerciseFormValue[K]) => setV(prev => ({ ...prev, [k]: val }));
  const type = v.measurement_type;
  const isTime = MEASUREMENT_META[type].isTime;
  const canSave = v.name.trim().length > 0 && !saving;

  const goalLabel = useMemo(() => {
    if (isTime) return 'Weekly goal (minutes)';
    switch (type) {
      case 'distance': return 'Weekly goal (miles)';
      case 'steps': return 'Weekly goal (steps)';
      case 'rounds': return 'Weekly goal (rounds)';
      case 'completion': return 'Weekly goal (times)';
      default: return 'Weekly goal (reps)';
    }
  }, [type, isTime]);

  const submit = async () => {
    if (!canSave) return;
    setSaving(true);
    try { await onSubmit(buildExercisePayload(v)); }
    finally { setSaving(false); }
  };

  const addRoundItem = () => set('round_items', [...v.round_items, { label: '', value: undefined, unit: '' }]);
  const updateRoundItem = (i: number, patch: Partial<RoundItem>) =>
    set('round_items', v.round_items.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  const removeRoundItem = (i: number) => set('round_items', v.round_items.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[16px] font-black">{initial ? 'Edit workout' : 'New workout'}</h3>
        <button onClick={onCancel} aria-label="Close" className="w-9 h-9 rounded-lg hover:bg-muted/50 flex items-center justify-center btn-press"><X className="w-4.5 h-4.5 text-muted-foreground/70" /></button>
      </div>

      <Field><Label>Name</Label><input className={inputCls} value={v.name} onChange={e => set('name', e.target.value)} placeholder="Push-Ups" /></Field>
      <Field><Label>Short description</Label><input className={inputCls} value={v.short_description} onChange={e => set('short_description', e.target.value)} placeholder="Chest and triceps" /></Field>
      <Field><Label>Instructions</Label><textarea className={cn(inputCls, 'h-20 py-2.5 resize-none')} value={v.instructions} onChange={e => set('instructions', e.target.value)} placeholder="Keep your core tight, full range of motion." /></Field>

      <Field>
        <Label>Category</Label>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => set('category', c)}
              className={cn('h-8 px-3 rounded-lg text-[12px] font-bold btn-press', v.category === c ? 'bg-primary text-primary-foreground' : 'bg-muted/40 text-foreground/70')}>
              {CATEGORY_META[c].label}
            </button>
          ))}
        </div>
      </Field>

      <Field>
        <Label>How is this measured?</Label>
        <div className="grid grid-cols-3 gap-1.5">
          {MEASUREMENT_TYPES.map(t => (
            <button key={t} onClick={() => set('measurement_type', t)}
              className={cn('h-10 rounded-lg text-[12px] font-bold btn-press', type === t ? 'bg-primary text-primary-foreground' : 'bg-muted/40 text-foreground/70')}>
              {MEASUREMENT_META[t].label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground/55 mt-1.5">{MEASUREMENT_META[type].hint}</p>
      </Field>

      {/* ─── Type-specific config ─── */}
      <div className="rounded-2xl bg-muted/20 border border-border/15 p-3.5 mb-3.5 space-y-3.5">
        {type === 'reps' && (
          <Field><Label>Quick-add buttons (comma-separated)</Label>
            <input className={inputCls} value={v.quick_add} onChange={e => set('quick_add', e.target.value)} placeholder="1, 5, 10" />
            <p className="text-[11px] text-muted-foreground/55 mt-1">Up to 6 values, e.g. jumping jacks might use 10, 25, 50.</p>
          </Field>
        )}
        {(type === 'timed_hold' || type === 'duration' || type === 'countdown') && (
          <Toggle label="Allow pause / resume" checked={v.allow_pause} onChange={val => set('allow_pause', val)} />
        )}
        {type === 'duration' && (
          <Toggle label="Allow manual minute entry" checked={v.allow_manual} onChange={val => set('allow_manual', val)} />
        )}
        {type === 'countdown' && (
          <Field><Label>Target time</Label>
            <div className="flex items-center gap-2">
              <input type="number" min={0} className={cn(inputCls, 'w-24')} value={v.countdown_minutes} onChange={e => set('countdown_minutes', Math.max(0, parseInt(e.target.value) || 0))} />
              <span className="text-[13px] font-bold text-muted-foreground/60">min</span>
              <input type="number" min={0} max={59} className={cn(inputCls, 'w-24')} value={v.countdown_seconds} onChange={e => set('countdown_seconds', Math.min(59, Math.max(0, parseInt(e.target.value) || 0)))} />
              <span className="text-[13px] font-bold text-muted-foreground/60">sec</span>
            </div>
          </Field>
        )}
        {type === 'distance' && (
          <Field><Label>Distance unit</Label>
            <div className="flex gap-1.5">
              {(['mi', 'km'] as const).map(u => (
                <button key={u} onClick={() => set('distance_unit', u)} className={cn('h-9 px-4 rounded-lg text-[13px] font-bold btn-press', v.distance_unit === u ? 'bg-primary text-primary-foreground' : 'bg-muted/40')}>{u}</button>
              ))}
            </div>
          </Field>
        )}
        {type === 'sets_reps' && (
          <>
            <Field><Label>Default reps per set</Label><input type="number" min={1} className={cn(inputCls, 'w-28')} value={v.default_reps} onChange={e => set('default_reps', Math.max(1, parseInt(e.target.value) || 1))} /></Field>
            <Toggle label="Allow optional weight" checked={v.allow_weight} onChange={val => set('allow_weight', val)} />
          </>
        )}
        {type === 'rounds' && (
          <Field><Label>What is one round?</Label>
            <input className={cn(inputCls, 'mb-2')} value={v.round_label} onChange={e => set('round_label', e.target.value)} placeholder="One round" />
            <div className="space-y-2">
              {v.round_items.map((it, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <input className={cn(inputCls, 'flex-1')} value={it.label} onChange={e => updateRoundItem(i, { label: e.target.value })} placeholder="10 push-ups" />
                  <button onClick={() => removeRoundItem(i)} className="w-10 h-10 rounded-lg bg-muted/40 flex items-center justify-center btn-press flex-shrink-0"><Trash2 className="w-4 h-4 text-muted-foreground/70" /></button>
                </div>
              ))}
            </div>
            <button onClick={addRoundItem} className="mt-2 inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-muted/40 text-[12px] font-bold btn-press"><Plus className="w-3.5 h-3.5" /> Add step</button>
          </Field>
        )}
        {type === 'steps' && <p className="text-[12px] text-muted-foreground/60">Members log step counts manually. Fitness-platform sync can populate this later — same activity model.</p>}
        {type === 'completion' && <p className="text-[12px] text-muted-foreground/60">A single tap marks this done. Great for routines and warm-ups.</p>}
      </div>

      {/* ─── Goal + scoring ─── */}
      <Field><Label>{goalLabel}</Label><input type="number" min={0} className={cn(inputCls, 'w-40')} value={v.weekly_goal} onChange={e => set('weekly_goal', e.target.value)} placeholder="250" /></Field>
      <div className="grid grid-cols-2 gap-2.5">
        <Field><Label>Points {pointsUnitHint[type]}</Label><input type="number" min={0} step="0.1" className={inputCls} value={v.points_per_unit} onChange={e => set('points_per_unit', e.target.value)} /></Field>
        <Field><Label>Max weekly points</Label><input type="number" min={0} className={inputCls} value={v.max_weekly_points} onChange={e => set('max_weekly_points', e.target.value)} placeholder="1000" /></Field>
      </div>
      <p className="text-[11px] text-muted-foreground/55 -mt-1 mb-3.5">The cap keeps one easy workout from dominating the competition. Leave max blank for uncapped.</p>

      <div className="grid grid-cols-2 gap-2.5">
        <Field><Label>Lifetime milestones</Label><input className={inputCls} value={v.lifetime_milestones} onChange={e => set('lifetime_milestones', e.target.value)} placeholder="100, 500, 1000" /></Field>
        {isTime && <Field><Label>Session milestones (sec)</Label><input className={inputCls} value={v.session_milestones} onChange={e => set('session_milestones', e.target.value)} placeholder="30, 60, 120" /></Field>}
      </div>

      <Toggle label="Active (available to members)" checked={v.active} onChange={val => set('active', val)} />

      <div className="flex gap-2.5 pt-4">
        <button onClick={onCancel} className="flex-1 h-12 rounded-xl bg-muted/50 font-bold text-[14px] btn-press">Cancel</button>
        <button onClick={submit} disabled={!canSave} className="flex-1 h-12 rounded-xl bg-primary text-primary-foreground font-black text-[14px] btn-press disabled:opacity-40">
          {saving ? 'Saving…' : initial ? 'Save changes' : 'Create workout'}
        </button>
      </div>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!checked)} className="w-full flex items-center justify-between py-1.5">
      <span className="text-[13px] font-semibold text-foreground/85">{label}</span>
      <span className={cn('w-11 h-6 rounded-full transition-colors relative flex-shrink-0', checked ? 'bg-primary' : 'bg-muted/60')}>
        <span className={cn('absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform', checked ? 'translate-x-[22px]' : 'translate-x-0.5')} />
      </span>
    </button>
  );
}
