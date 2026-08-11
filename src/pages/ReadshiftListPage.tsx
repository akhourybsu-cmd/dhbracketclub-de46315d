import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { VenetianMask, Plus, ChevronRight, Users } from 'lucide-react';
import { useClub } from '@/contexts/ClubContext';
import { useReadshiftGames } from '@/hooks/useReadshift';
import { StatusPill } from '@/components/ui/status-pill';
import { Stagger, StaggerItem } from '@/components/motion/Stagger';
import { LoadingSwap } from '@/components/motion/LoadingSwap';
import type { RsGame } from '@/lib/readshift/dbTypes';
import type { Phase } from '@/lib/readshift/types';

const PHASE_META: Record<Phase, { label: string; variant: 'neutral' | 'success' | 'warning' | 'live' | 'danger' }> = {
  lobby: { label: 'Waiting for Players', variant: 'neutral' },
  shift: { label: 'Answering', variant: 'warning' },
  read: { label: 'Reading', variant: 'live' },
  reveal: { label: 'Reveal', variant: 'success' },
  completed: { label: 'Complete', variant: 'neutral' },
  paused: { label: 'Paused', variant: 'neutral' },
  cancelled: { label: 'Cancelled', variant: 'danger' },
};

function GameRow({ g }: { g: RsGame }) {
  const meta = PHASE_META[g.phase] ?? PHASE_META.lobby;
  const roundLine = ['shift', 'read', 'reveal'].includes(g.phase)
    ? `Round ${g.current_round} of ${g.total_rounds}`
    : g.phase === 'completed' ? `${g.total_rounds} rounds` : `${g.total_rounds}-round game`;
  return (
    <Link to={`/readshift/${g.id}`} className="block">
      <div className="glass-card p-4 hover-lift btn-press flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, hsl(var(--primary) / 0.2), hsl(var(--primary) / 0.05))' }}>
          <VenetianMask className="w-5 h-5" style={{ color: 'hsl(var(--primary))' }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-[14px] truncate">{g.name}</h3>
            <StatusPill variant={meta.variant} size="xs" dot={meta.variant === 'live'} pulse={meta.variant === 'live'}>{meta.label}</StatusPill>
          </div>
          <p className="text-[11px] text-muted-foreground/70 mt-0.5">{roundLine}</p>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground/50 flex-shrink-0" />
      </div>
    </Link>
  );
}

export default function ReadshiftListPage() {
  const { club } = useClub();
  const { games, loading } = useReadshiftGames(club?.id);

  const active = games.filter((g) => ['lobby', 'shift', 'read', 'reveal', 'paused'].includes(g.phase));
  const past = games.filter((g) => ['completed', 'cancelled'].includes(g.phase));

  return (
    <div className="pb-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="page-header">
          <div className="page-header-icon" style={{ background: 'linear-gradient(135deg, hsl(var(--primary) / 0.2), hsl(var(--primary) / 0.05))' }}>
            <VenetianMask className="w-5 h-5" style={{ color: 'hsl(var(--primary))' }} />
          </div>
          <div>
            <h1 className="page-header-title">READSHIFT</h1>
            <p className="page-header-subtitle">Async social deduction</p>
          </div>
        </div>

        <Link to="/readshift/create" className="block mb-4">
          <button className="w-full h-11 rounded-xl font-bold btn-press flex items-center justify-center gap-2 bg-primary text-primary-foreground">
            <Plus className="w-4 h-4" /> New Game
          </button>
        </Link>

        <LoadingSwap
          loading={loading}
          skeleton={
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="glass-card p-4"><div className="h-4 w-1/3 rounded skeleton-shimmer mb-2" /><div className="h-3 w-1/2 rounded skeleton-shimmer" /></div>
              ))}
            </div>
          }
        >
          {games.length === 0 ? (
            <div className="glass-card p-8 text-center">
              <div className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ background: 'hsl(var(--primary) / 0.12)' }}>
                <Users className="w-6 h-6" style={{ color: 'hsl(var(--primary))' }} />
              </div>
              <p className="text-sm font-bold mb-1">No games yet</p>
              <p className="text-[12px] text-muted-foreground/70">Create a game and invite 4+ friends to start reading each other.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {active.length > 0 && (
                <Stagger className="space-y-3">
                  {active.map((g) => <StaggerItem key={g.id}><GameRow g={g} /></StaggerItem>)}
                </Stagger>
              )}
              {past.length > 0 && (
                <div>
                  <h2 className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted-foreground/60 mb-2">History</h2>
                  <Stagger className="space-y-3">{past.map((g) => <StaggerItem key={g.id}><GameRow g={g} /></StaggerItem>)}</Stagger>
                </div>
              )}
            </div>
          )}
        </LoadingSwap>
      </motion.div>
    </div>
  );
}
