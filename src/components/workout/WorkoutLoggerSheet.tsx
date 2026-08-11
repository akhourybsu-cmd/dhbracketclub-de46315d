import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { WorkoutLogger, type LoggerLogOpts } from './WorkoutLoggers';
import { MEASUREMENT_META } from '@/lib/workout/measurement';
import type { WorkoutExercise } from '@/lib/workout/types';

/**
 * Bottom-sheet host for a workout's logger. Portaled to <body> so the
 * fixed positioning escapes any transformed ancestor (PageTransition), per
 * the DH bottom-sheet convention.
 */
export function WorkoutLoggerSheet({
  exercise, goal, weekTotal, personalBest, records, nextMilestone, onClose, onLog, onUndo, canUndo,
}: {
  exercise: WorkoutExercise | null;
  goal: number | null;
  weekTotal: number;
  personalBest?: number | null;
  records?: { label: string; value: string }[];
  nextMilestone?: string | null;
  onClose: () => void;
  onLog: (rawValue: number, opts?: LoggerLogOpts) => Promise<unknown> | void;
  onUndo?: () => Promise<unknown> | void;
  canUndo?: boolean;
}) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <AnimatePresence>
      {exercise && (
        <motion.div
          className="fixed inset-0 z-[60] flex flex-col justify-end"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
          <motion.div
            role="dialog" aria-modal="true" aria-label={`Log ${exercise.name}`}
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 420, damping: 38 }}
            className="relative bg-background rounded-t-3xl border-t border-border/20 shadow-2xl px-5 pt-3"
            style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))', maxHeight: '90dvh', overflowY: 'auto' }}
          >
            <div className="w-10 h-1.5 rounded-full bg-muted-foreground/25 mx-auto mb-3" aria-hidden />
            <div className="flex items-center justify-between mb-2">
              <div className="min-w-0">
                <h2 className="text-[17px] font-black tracking-tight truncate">{exercise.name}</h2>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground/55">
                  {MEASUREMENT_META[exercise.measurement_type].label}
                </p>
              </div>
              <button onClick={onClose} aria-label="Close" className="w-10 h-10 -mr-1 rounded-full flex items-center justify-center hover:bg-muted/50 btn-press flex-shrink-0">
                <X className="w-5 h-5 text-muted-foreground/70" />
              </button>
            </div>
            {exercise.instructions && (
              <p className="text-[12px] text-muted-foreground/70 leading-snug mb-3">{exercise.instructions}</p>
            )}
            <div className="pb-2">
              <WorkoutLogger
                exercise={exercise}
                goal={goal}
                weekTotal={weekTotal}
                personalBest={personalBest}
                onLog={onLog}
                onUndo={onUndo}
                canUndo={canUndo}
              />

              {(records?.length || nextMilestone) && (
                <div className="mt-5 pt-4 border-t border-border/10">
                  {records && records.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {records.slice(0, 3).map(r => (
                        <div key={r.label} className="rounded-xl bg-muted/25 px-2 py-2 text-center">
                          <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground/55">{r.label}</p>
                          <p className="text-[15px] font-black tabular-nums mt-0.5">{r.value}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {nextMilestone && (
                    <p className="text-[12px] text-center text-muted-foreground/70">
                      Next milestone: <span className="font-extrabold text-foreground/85">{nextMilestone}</span>
                    </p>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
