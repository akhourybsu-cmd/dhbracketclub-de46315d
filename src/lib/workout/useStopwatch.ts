import { useCallback, useEffect, useRef, useState } from 'react';

// Timestamp-based stopwatch. The authoritative elapsed time is ALWAYS
// derived from wall-clock timestamps (epoch ms), never from counting
// ticks — so locking the phone, backgrounding the app, switching tabs, or
// a dropped rAF cannot corrupt a plank. State is persisted to
// localStorage so an in-progress hold survives even a full app reload.
//
// Persisted shape:
//   startedAt      epoch ms when the CURRENT running segment began (or null)
//   accumulatedMs  elapsed from all previously-finished (paused) segments
//   running        whether a segment is currently in progress
//   firstStartAt   epoch ms of the very first Start (→ activity started_at)

interface SwState {
  startedAt: number | null;
  accumulatedMs: number;
  running: boolean;
  firstStartAt: number | null;
}

const EMPTY: SwState = { startedAt: null, accumulatedMs: 0, running: false, firstStartAt: null };

function load(key: string): SwState {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return { ...EMPTY, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return EMPTY;
}
function save(key: string, s: SwState) {
  try { localStorage.setItem(key, JSON.stringify(s)); } catch { /* ignore */ }
}
function clear(key: string) {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

function elapsedOf(s: SwState): number {
  return s.accumulatedMs + (s.running && s.startedAt ? Date.now() - s.startedAt : 0);
}

export interface Stopwatch {
  elapsedMs: number;
  running: boolean;
  started: boolean;
  start: () => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  /** Snapshot for building the activity record on finish. */
  snapshot: () => { elapsedMs: number; startedAt: string | null; endedAt: string };
}

export function useStopwatch(storageKey: string): Stopwatch {
  const stateRef = useRef<SwState>(load(storageKey));
  const [, force] = useState(0);
  const rerender = useCallback(() => force(n => n + 1), []);

  // Re-read persisted state if the key changes (different exercise).
  useEffect(() => {
    stateRef.current = load(storageKey);
    rerender();
  }, [storageKey, rerender]);

  // Display ticker only — purely cosmetic; truth is the timestamps.
  useEffect(() => {
    if (!stateRef.current.running) return;
    const id = setInterval(rerender, 250);
    const onVis = () => rerender();
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVis); };
  }, [stateRef.current.running, rerender]);

  const commit = useCallback((next: SwState) => {
    stateRef.current = next;
    save(storageKey, next);
    rerender();
  }, [storageKey, rerender]);

  const start = useCallback(() => {
    const now = Date.now();
    commit({ startedAt: now, accumulatedMs: 0, running: true, firstStartAt: now });
  }, [commit]);

  const pause = useCallback(() => {
    const s = stateRef.current;
    if (!s.running) return;
    commit({ ...s, accumulatedMs: elapsedOf(s), startedAt: null, running: false });
  }, [commit]);

  const resume = useCallback(() => {
    const s = stateRef.current;
    if (s.running) return;
    commit({ ...s, startedAt: Date.now(), running: true, firstStartAt: s.firstStartAt ?? Date.now() });
  }, [commit]);

  const reset = useCallback(() => {
    clear(storageKey);
    commit(EMPTY);
  }, [commit, storageKey]);

  const snapshot = useCallback(() => {
    const s = stateRef.current;
    const elapsedMs = elapsedOf(s);
    return {
      elapsedMs,
      startedAt: s.firstStartAt ? new Date(s.firstStartAt).toISOString() : null,
      endedAt: new Date().toISOString(),
    };
  }, []);

  const s = stateRef.current;
  return {
    elapsedMs: elapsedOf(s),
    running: s.running,
    started: s.running || s.accumulatedMs > 0,
    start, pause, resume, reset, snapshot,
  };
}
