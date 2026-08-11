import { useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ChevronLeft, Plus, Pencil, Trash2, Dumbbell, CalendarPlus, Play, Flag, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useClub } from '@/contexts/ClubContext';
import { useClubAssets } from '@/hooks/useClubAssets';
import { useWorkoutAdmin, type WeekExerciseInput } from '@/hooks/useWorkoutAdmin';
import { ExerciseForm } from '@/components/workout/ExerciseForm';
import { MEASUREMENT_META, categoryLabel } from '@/lib/workout/measurement';
import type { WorkoutExercise, WeekStatus } from '@/lib/workout/types';

type Tab = 'exercises' | 'weeks';
const inputCls = 'w-full h-11 rounded-xl bg-muted/30 border border-border/25 px-3.5 text-[14px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30';

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const STATUS_META: Record<WeekStatus, { label: string; cls: string }> = {
  upcoming:  { label: 'Upcoming',  cls: 'bg-muted/50 text-muted-foreground/80' },
  active:    { label: 'Active',    cls: 'bg-primary/15 text-primary' },
  completed: { label: 'Completed', cls: 'bg-muted/40 text-muted-foreground/60' },
};

export default function WorkoutAdminPage() {
  const { user } = useAuth();
  const { club, isClubAdmin } = useClub();
  const { isInstalled, loading: assetsLoading } = useClubAssets();
  const installed = isInstalled('workout-competition');

  const admin = useWorkoutAdmin(club?.id, user?.id);
  const [tab, setTab] = useState<Tab>('exercises');
  const [exForm, setExForm] = useState<{ open: boolean; editing?: WorkoutExercise }>({ open: false });
  const [weekFormOpen, setWeekFormOpen] = useState(false);

  if (!assetsLoading && !installed) return <Navigate to="/dashboard" replace />;
  if (!isClubAdmin) return <Navigate to="/workouts" replace />;

  const activeExercises = useMemo(() => admin.exercises.filter(e => e.active), [admin.exercises]);

  return (
    <div className="pb-6">
      <div className="flex items-center gap-2 mb-4">
        <Link to="/workouts" className="w-9 h-9 rounded-xl bg-muted/50 flex items-center justify-center btn-press flex-shrink-0"><ChevronLeft className="w-5 h-5" /></Link>
        <div className="page-header mb-0">
          <div className="page-header-icon"><Dumbbell className="w-5 h-5" style={{ color: 'hsl(var(--primary))' }} /></div>
          <div><h1 className="page-header-title">Manage Arena</h1><p className="page-header-subtitle">Workouts & competition weeks</p></div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-muted/30 mb-4 w-fit">
        {(['exercises', 'weeks'] as Tab[]).map(t => (
          <button key={t} onClick={() => { setTab(t); setExForm({ open: false }); setWeekFormOpen(false); }}
            className={cn('px-4 h-8 rounded-lg text-[12px] font-bold capitalize transition-colors', tab === t ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground/70')}>
            {t}
          </button>
        ))}
      </div>

      {admin.error && <p className="text-[12px] text-destructive/80 mb-3">{admin.error}</p>}

      {tab === 'exercises' && (
        exForm.open ? (
          <div className="glass-card p-4">
            <ExerciseForm
              initial={exForm.editing}
              onCancel={() => setExForm({ open: false })}
              onSubmit={async (payload) => {
                try {
                  if (exForm.editing) await admin.updateExercise(exForm.editing.id, payload);
                  else await admin.createExercise(payload);
                  toast.success(exForm.editing ? 'Workout updated' : 'Workout created');
                  setExForm({ open: false });
                } catch { toast.error('Could not save workout'); }
              }}
            />
          </div>
        ) : (
          <>
            <button onClick={() => setExForm({ open: true })} className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-black text-[14px] btn-press inline-flex items-center justify-center gap-2 mb-4">
              <Plus className="w-4 h-4" /> New workout
            </button>
            {admin.loading ? (
              <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="glass-card h-16 skeleton-shimmer" />)}</div>
            ) : admin.exercises.length === 0 ? (
              <div className="glass-card p-8 text-center text-[13px] text-muted-foreground/70">No workouts yet. Create your first — a rep exercise like push-ups is a good start.</div>
            ) : (
              <div className="space-y-2">
                {admin.exercises.map(ex => (
                  <div key={ex.id} className="glass-card p-3.5 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-primary/10 text-primary"><Dumbbell className="w-5 h-5" /></div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-extrabold text-[14px] truncate">{ex.name}</h4>
                        {!ex.active && <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground/70">Off</span>}
                      </div>
                      <p className="text-[11px] text-muted-foreground/60">{MEASUREMENT_META[ex.measurement_type].label} · {categoryLabel(ex.category)}</p>
                    </div>
                    <button onClick={() => setExForm({ open: true, editing: ex })} aria-label="Edit" className="w-9 h-9 rounded-lg bg-muted/40 flex items-center justify-center btn-press"><Pencil className="w-4 h-4 text-muted-foreground/75" /></button>
                    <button
                      onClick={async () => { if (confirm(`Delete "${ex.name}"? This removes it from any weeks.`)) { try { await admin.deleteExercise(ex.id); toast.success('Deleted'); } catch { toast.error('Delete failed'); } } }}
                      aria-label="Delete" className="w-9 h-9 rounded-lg bg-muted/40 flex items-center justify-center btn-press"><Trash2 className="w-4 h-4 text-muted-foreground/75" /></button>
                  </div>
                ))}
              </div>
            )}
          </>
        )
      )}

      {tab === 'weeks' && (
        weekFormOpen ? (
          <WeekForm
            exercises={activeExercises}
            onCancel={() => setWeekFormOpen(false)}
            onSubmit={async (week, items, groupGoal) => {
              try { await admin.createWeek(week, items, groupGoal); toast.success('Competition week created'); setWeekFormOpen(false); }
              catch { toast.error('Could not create week'); }
            }}
          />
        ) : (
          <>
            <button onClick={() => setWeekFormOpen(true)} disabled={activeExercises.length === 0}
              className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-black text-[14px] btn-press inline-flex items-center justify-center gap-2 mb-2 disabled:opacity-40">
              <CalendarPlus className="w-4 h-4" /> New competition week
            </button>
            {activeExercises.length === 0 && <p className="text-[12px] text-muted-foreground/60 mb-3">Create at least one active workout first.</p>}
            {admin.loading ? (
              <div className="space-y-2">{[1, 2].map(i => <div key={i} className="glass-card h-24 skeleton-shimmer" />)}</div>
            ) : admin.weeks.length === 0 ? (
              <div className="glass-card p-8 text-center text-[13px] text-muted-foreground/70">No competition weeks yet.</div>
            ) : (
              <div className="space-y-2.5">
                {admin.weeks.map(w => (
                  <div key={w.id} className="glass-card p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-black text-[15px] truncate">{w.title}</h4>
                          <span className={cn('text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded', STATUS_META[w.status].cls)}>{STATUS_META[w.status].label}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground/60">
                          {new Date(w.starts_at).toLocaleDateString()} – {new Date(w.ends_at).toLocaleDateString()} · {w.exercises.length} workouts
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {w.status !== 'active' && (
                        <button onClick={async () => { try { await admin.setWeekStatus(w.id, 'active'); toast.success('Published'); } catch { toast.error('Failed'); } }}
                          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-primary text-primary-foreground text-[12px] font-bold btn-press"><Play className="w-3.5 h-3.5 fill-current" /> Publish</button>
                      )}
                      {w.status === 'active' && (
                        <button onClick={async () => { try { await admin.setWeekStatus(w.id, 'completed'); toast.success('Marked complete'); } catch { toast.error('Failed'); } }}
                          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-muted/50 text-[12px] font-bold btn-press"><Flag className="w-3.5 h-3.5" /> End week</button>
                      )}
                      {w.status === 'completed' && (
                        <button onClick={async () => { try { await admin.setWeekStatus(w.id, 'upcoming'); toast.success('Reopened'); } catch { toast.error('Failed'); } }}
                          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-muted/50 text-[12px] font-bold btn-press"><RotateCcw className="w-3.5 h-3.5" /> Reopen</button>
                      )}
                      <button onClick={async () => { if (confirm(`Delete "${w.title}"?`)) { try { await admin.deleteWeek(w.id); toast.success('Deleted'); } catch { toast.error('Failed'); } } }}
                        className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-muted/40 text-[12px] font-bold btn-press ml-auto"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )
      )}
    </div>
  );
}

// ─── Week builder ───────────────────────────────────────────────────

function WeekForm({
  exercises, onSubmit, onCancel,
}: {
  exercises: WorkoutExercise[];
  onSubmit: (
    week: { title: string; theme: string | null; starts_at: string; ends_at: string; status: WeekStatus },
    items: WeekExerciseInput[],
    groupGoal?: { exercise_id: string; title: string; target: number } | null,
  ) => Promise<void> | void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState('');
  const [theme, setTheme] = useState('');
  const [start, setStart] = useState(() => toLocalInput(new Date()));
  const [end, setEnd] = useState(() => toLocalInput(new Date(Date.now() + 7 * 86400000)));
  const [saving, setSaving] = useState(false);
  const [picked, setPicked] = useState<Record<string, { on: boolean; goal: string }>>({});
  // Optional collaborative group goal.
  const [ggOn, setGgOn] = useState(false);
  const [ggExercise, setGgExercise] = useState('');
  const [ggTitle, setGgTitle] = useState('');
  const [ggTarget, setGgTarget] = useState('');

  const toggle = (ex: WorkoutExercise) => setPicked(p => {
    const cur = p[ex.id];
    if (cur?.on) return { ...p, [ex.id]: { ...cur, on: false } };
    const isTime = MEASUREMENT_META[ex.measurement_type].isTime;
    const natural = ex.default_weekly_goal != null ? (isTime ? ex.default_weekly_goal / 60 : ex.default_weekly_goal) : '';
    return { ...p, [ex.id]: { on: true, goal: String(natural) } };
  });

  const chosen = exercises.filter(e => picked[e.id]?.on);
  const canSave = title.trim().length > 0 && chosen.length > 0 && new Date(end) > new Date(start) && !saving;

  const submit = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const items: WeekExerciseInput[] = chosen.map((ex, i) => {
        const isTime = MEASUREMENT_META[ex.measurement_type].isTime;
        const raw = parseFloat(picked[ex.id].goal);
        const goal = isFinite(raw) && raw > 0 ? (isTime ? raw * 60 : raw) : null;
        return { exercise_id: ex.id, goal, scoring_config: {}, sort_order: i };
      });
      let groupGoal: { exercise_id: string; title: string; target: number } | null = null;
      if (ggOn && ggExercise && ggTitle.trim() && parseFloat(ggTarget) > 0) {
        const ex = chosen.find(e => e.id === ggExercise);
        const isTime = ex ? MEASUREMENT_META[ex.measurement_type].isTime : false;
        const t = parseFloat(ggTarget);
        groupGoal = { exercise_id: ggExercise, title: ggTitle.trim(), target: isTime ? t * 60 : t };
      }
      await onSubmit(
        { title: title.trim(), theme: theme.trim() || null, starts_at: new Date(start).toISOString(), ends_at: new Date(end).toISOString(), status: 'upcoming' },
        items,
        groupGoal,
      );
    } finally { setSaving(false); }
  };

  return (
    <div className="glass-card p-4 space-y-3.5">
      <h3 className="text-[16px] font-black mb-1">New competition week</h3>
      <div><label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground/60 mb-1.5">Title</label><input className={inputCls} value={title} onChange={e => setTitle(e.target.value)} placeholder="Full Body Blitz" /></div>
      <div><label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground/60 mb-1.5">Theme (optional)</label><input className={inputCls} value={theme} onChange={e => setTheme(e.target.value)} placeholder="Week 1" /></div>
      <div className="grid grid-cols-2 gap-2.5">
        <div><label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground/60 mb-1.5">Starts</label><input type="datetime-local" className={inputCls} value={start} onChange={e => setStart(e.target.value)} /></div>
        <div><label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground/60 mb-1.5">Ends</label><input type="datetime-local" className={inputCls} value={end} onChange={e => setEnd(e.target.value)} /></div>
      </div>

      <div>
        <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground/60 mb-1.5">Workouts &amp; goals</label>
        <div className="space-y-1.5">
          {exercises.map(ex => {
            const p = picked[ex.id];
            const isTime = MEASUREMENT_META[ex.measurement_type].isTime;
            return (
              <div key={ex.id} className={cn('rounded-xl border p-2.5 transition-colors', p?.on ? 'border-primary/40 bg-primary/[0.05]' : 'border-border/20')}>
                <div className="flex items-center gap-2.5">
                  <button onClick={() => toggle(ex)} className={cn('w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 btn-press', p?.on ? 'bg-primary text-primary-foreground' : 'bg-muted/50')}>
                    {p?.on ? '✓' : ''}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-bold truncate">{ex.name}</p>
                    <p className="text-[10px] text-muted-foreground/55">{MEASUREMENT_META[ex.measurement_type].label}</p>
                  </div>
                  {p?.on && (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <input type="number" min={0} className="w-20 h-9 rounded-lg bg-muted/40 border border-border/20 px-2 text-[13px] text-center" value={p.goal}
                        onChange={e => setPicked(prev => ({ ...prev, [ex.id]: { ...prev[ex.id], goal: e.target.value } }))} placeholder="Goal" />
                      <span className="text-[11px] font-bold text-muted-foreground/55 w-8">{isTime ? 'min' : ''}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Optional club group goal */}
      <div className="rounded-xl border border-border/20 p-3">
        <button onClick={() => setGgOn(v => !v)} className="w-full flex items-center justify-between">
          <span className="text-[13px] font-bold text-foreground/85">Add a club group goal</span>
          <span className={cn('w-11 h-6 rounded-full transition-colors relative flex-shrink-0', ggOn ? 'bg-primary' : 'bg-muted/60')}>
            <span className={cn('absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform', ggOn ? 'translate-x-[22px]' : 'translate-x-0.5')} />
          </span>
        </button>
        {ggOn && (
          <div className="mt-3 space-y-2.5">
            {chosen.length === 0 ? (
              <p className="text-[12px] text-muted-foreground/60">Pick at least one workout above first.</p>
            ) : (
              <>
                <select className={inputCls} value={ggExercise} onChange={e => setGgExercise(e.target.value)}>
                  <option value="">Choose a workout…</option>
                  {chosen.map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
                </select>
                <input className={inputCls} value={ggTitle} onChange={e => setGgTitle(e.target.value)} placeholder="e.g. 10,000 squats together" />
                <div className="flex items-center gap-2">
                  <input type="number" min={0} className={cn(inputCls, 'w-40')} value={ggTarget} onChange={e => setGgTarget(e.target.value)} placeholder="Combined target" />
                  <span className="text-[12px] font-bold text-muted-foreground/55">
                    {(() => { const ex = chosen.find(e => e.id === ggExercise); return ex && MEASUREMENT_META[ex.measurement_type].isTime ? 'min (combined)' : 'combined'; })()}
                  </span>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-2.5 pt-2">
        <button onClick={onCancel} className="flex-1 h-12 rounded-xl bg-muted/50 font-bold text-[14px] btn-press">Cancel</button>
        <button onClick={submit} disabled={!canSave} className="flex-1 h-12 rounded-xl bg-primary text-primary-foreground font-black text-[14px] btn-press disabled:opacity-40">
          {saving ? 'Creating…' : 'Create week'}
        </button>
      </div>
    </div>
  );
}
