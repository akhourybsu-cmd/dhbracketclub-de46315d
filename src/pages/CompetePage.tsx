import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Trophy, BarChart3, MessageCircle, Bookmark, ChevronRight, Lock, Shield,
  Swords, TrendingUp, VenetianMask, Dumbbell,
} from 'lucide-react';
import { useClub } from '@/contexts/ClubContext';
import * as readshiftApi from '@/lib/readshift/api';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrentDay, useMyLock, useDayLocks } from '@/hooks/useLockbox';
import { useCurrentSeason, useSeasonEntries, getSeasonDraftTarget } from '@/hooks/useDraftSeasons';
import { cn } from '@/lib/utils';
import { useClubAssets } from '@/hooks/useClubAssets';
import { StatusPill } from '@/components/ui/status-pill';
import { CompeteCTAButton } from '@/components/compete/CompeteCTAButton';
import runedelveEmblem from '@/assets/runedelve-emblem.png';
import nexusEmblem from '@/assets/nexus-emblem.png';
import pickemEmblem from '@/assets/pickem-emblem.png';
import draftEmblem from '@/assets/draft-emblem.png';

/* ── Workout Arena card ── */
function WorkoutArenaCompeteCard() {
  const { club } = useClub();
  const [week, setWeek] = useState<{ title: string; ends_at: string } | null>(null);
  useEffect(() => {
    if (!club?.id) return;
    let cancelled = false;
    (async () => {
      const { data } = await (supabase as any)
        .from('workout_weeks').select('title, ends_at')
        .eq('club_id', club.id).eq('status', 'active')
        .order('starts_at', { ascending: false }).limit(1);
      if (!cancelled) setWeek(data?.[0] ?? null);
    })();
    return () => { cancelled = true; };
  }, [club?.id]);

  const remaining = week ? Math.max(0, new Date(week.ends_at).getTime() - Date.now()) : 0;
  const days = Math.floor(remaining / 86400000);
  const hours = Math.floor((remaining % 86400000) / 3600000);
  const context = week
    ? `${week.title}${remaining > 0 ? ` · ${days > 0 ? `${days}d ${hours}h` : `${hours}h`} left` : ''}`
    : 'No active week — check back soon';

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
      <div className="glass-card p-4 relative overflow-hidden border border-primary/10">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, hsl(var(--primary) / 0.2), hsl(var(--primary) / 0.05))' }}>
              <Dumbbell className="w-5 h-5" style={{ color: 'hsl(var(--primary))' }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-[15px] tracking-tight">Workout Arena</h2>
                <StatusPill variant={week ? 'live' : 'neutral'} size="xs" dot={!!week} pulse={!!week}>{week ? 'Live' : 'Weekly'}</StatusPill>
              </div>
              <p className="text-[11px] text-muted-foreground/70 truncate">{context}</p>
            </div>
          </div>
          <Link to="/workouts" className="block">
            <button className="w-full h-8 rounded-lg bg-primary/12 text-primary text-[11px] font-bold hover:bg-primary/15 transition-colors flex items-center justify-center gap-1.5">
              {week ? 'Log a workout' : 'Open'} <ChevronRight className="w-3 h-3" />
            </button>
          </Link>
        </div>
      </div>
    </motion.div>
  );
}

/* ── Lockbox card ── */
function LockboxCompeteCard() {
  const { user } = useAuth();
  const { data: day } = useCurrentDay();
  const { data: myLock } = useMyLock(day?.id);
  const { data: locks } = useDayLocks(day?.id);

  const crackedCount = (locks || []).filter((l: any) => l.myAttempt?.is_solved).length;
  const totalLocks = (locks || []).length;
  const inProgress = (locks || []).filter((l: any) => l.myAttempt && !l.myAttempt.is_solved).length;
  const dayLabel = day ? format(new Date(day.starts_at), 'MMM d') : 'Today';
  let contextLine = dayLabel;
  if (!myLock) contextLine += ' · Create your lock';
  else if (inProgress > 0) contextLine += ` · ${inProgress} in progress`;
  else if (totalLocks > 0) contextLine += ` · ${crackedCount}/${totalLocks} cracked`;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
      <div className="glass-card p-4 relative overflow-hidden border border-destructive/10">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, hsl(var(--destructive) / 0.2), hsl(var(--destructive) / 0.05))' }}>
              <Lock className="w-5 h-5" style={{ color: 'hsl(var(--destructive))' }} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-[15px] tracking-tight">DH Lockbox</h2>
                <StatusPill variant="danger" size="xs">Daily</StatusPill>
              </div>
              <p className="text-[11px] text-muted-foreground/70">{contextLine}</p>
            </div>
          </div>
          <div className="flex gap-2 mb-3">
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Shield className="w-3 h-3" />
              {myLock ? (myLock.is_cracked ? '💔 Cracked' : '🔒 Defending') : 'No lock'}
            </div>
            {totalLocks > 0 && (
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Swords className="w-3 h-3" /> {crackedCount}/{totalLocks}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Link to="/lockbox" className="flex-1">
              <button className="w-full h-8 rounded-lg bg-muted/50 text-[11px] font-bold text-foreground/80 hover:bg-muted/50 transition-colors flex items-center justify-center gap-1.5">
                Open <ChevronRight className="w-3 h-3" />
              </button>
            </Link>
            {!myLock && (
              <Link to="/lockbox">
                <button className="h-8 px-3 rounded-lg text-[11px] font-bold transition-colors flex items-center gap-1.5"
                  style={{ background: 'hsl(var(--destructive) / 0.15)', color: 'hsl(var(--destructive))' }}>
                  <Lock className="w-3 h-3" /> Create Lock
                </button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ── Rune Delve banner ── */
function RuneDelveCompeteCard() {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Link to="/rune-delve" className="block">
        <div className="relative overflow-hidden rounded-2xl btn-press"
          style={{
            background:
              'radial-gradient(ellipse 120% 80% at 50% 0%, hsl(152 72% 24% / 0.55), transparent 60%),' +
              'radial-gradient(ellipse 90% 60% at 100% 100%, hsl(152 72% 40% / 0.25), transparent 60%),' +
              'linear-gradient(180deg, hsl(160 24% 8%), hsl(160 22% 5%))',
            border: '1px solid hsl(152 50% 40% / 0.35)',
            boxShadow: '0 12px 40px hsl(152 72% 20% / 0.45), inset 0 1px 0 hsl(152 60% 60% / 0.18)',
          }}>
          <div aria-hidden className="absolute -top-12 -right-10 w-44 h-44 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, hsl(152 80% 50% / 0.35), transparent 70%)', filter: 'blur(8px)' }} />
          <div className="relative z-10 p-5 flex items-center gap-4">
            <div className="relative flex-shrink-0">
              <div aria-hidden className="absolute inset-0 rounded-full"
                style={{ background: 'radial-gradient(circle, hsl(152 80% 50% / 0.5), transparent 65%)', filter: 'blur(10px)', transform: 'scale(1.15)' }} />
              <img src={runedelveEmblem} alt="Rune Delve" width={96} height={96} loading="lazy" decoding="async"
                className="relative w-[88px] h-[88px] object-contain drop-shadow-[0_4px_18px_hsl(152_80%_45%/0.5)]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[9px] font-extrabold uppercase tracking-[0.22em]" style={{ color: 'hsl(152 70% 65%)' }}>◆ Campaign</span>
              </div>
              <h2 className="font-extrabold text-[22px] leading-none tracking-tight mb-2.5"
                style={{ background: 'linear-gradient(180deg, hsl(150 30% 98%), hsl(152 70% 70%))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', textShadow: '0 0 18px hsl(152 80% 40% / 0.4)' }}>
                Rune Delve
              </h2>
              <CompeteCTAButton accent="152 72% 46%" accentDeep="152 70% 38%">
                Enter
              </CompeteCTAButton>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

/* ── Nexus Defense banner ── */
function NexusDefenseCompeteCard() {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
      <Link to="/nexus" className="block">
        <div className="relative overflow-hidden rounded-2xl btn-press"
          style={{
            background:
              'radial-gradient(ellipse 120% 80% at 50% 0%, hsl(202 90% 28% / 0.55), transparent 60%),' +
              'radial-gradient(ellipse 90% 60% at 100% 100%, hsl(190 95% 50% / 0.25), transparent 60%),' +
              'linear-gradient(180deg, hsl(215 40% 8%), hsl(220 45% 5%))',
            border: '1px solid hsl(195 80% 55% / 0.35)',
            boxShadow: '0 12px 40px hsl(202 90% 25% / 0.45), inset 0 1px 0 hsl(190 90% 70% / 0.18)',
          }}>
          <div aria-hidden className="absolute -top-12 -right-10 w-44 h-44 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, hsl(195 95% 55% / 0.4), transparent 70%)', filter: 'blur(8px)' }} />
          <div className="relative z-10 p-5 flex items-center gap-4">
            <div className="relative flex-shrink-0">
              <div aria-hidden className="absolute inset-0 rounded-full"
                style={{ background: 'radial-gradient(circle, hsl(195 95% 55% / 0.5), transparent 65%)', filter: 'blur(10px)', transform: 'scale(1.15)' }} />
              <img src={nexusEmblem} alt="Nexus Defense" width={96} height={96} loading="lazy" decoding="async"
                className="relative w-[88px] h-[88px] object-contain drop-shadow-[0_4px_18px_hsl(195_95%_50%/0.55)]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[9px] font-extrabold uppercase tracking-[0.22em]" style={{ color: 'hsl(190 90% 72%)' }}>◆ Tower Defense</span>
              </div>
              <h2 className="font-extrabold text-[22px] leading-none tracking-tight mb-2.5"
                style={{ background: 'linear-gradient(180deg, hsl(195 30% 98%), hsl(195 90% 70%))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', textShadow: '0 0 18px hsl(195 95% 45% / 0.45)' }}>
                Nexus Defense
              </h2>
              <CompeteCTAButton accent="195 95% 52%" accentDeep="210 90% 48%" ink="215 50% 6%">
                Deploy
              </CompeteCTAButton>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

/* ── Draft Arena enter banner — context-aware subline ── */
function DraftArenaEnterBanner({ season, entries, totalDrafts, myUserId }: {
  season: any | null; entries: any[]; totalDrafts: number; myUserId?: string;
}) {
  const { subline, pulse, ctaLabel } = (() => {
    if (!season) return { subline: 'No active season — open the war room to start one', pulse: false, ctaLabel: 'Enter Arena' };
    const regular = entries.filter(e => !e.is_playoff);
    const completed = regular.filter(e => e.drafts?.status === 'complete').length;
    const live = regular.find(e => e.drafts?.status === 'in_progress');
    const playoffLive = entries.find(e => e.is_playoff && e.drafts?.status === 'in_progress');
    const seasonLabel = season.season_label || season.name?.split(' ').slice(-1)[0] || '';
    let onTheClock = false;
    if (live?.drafts && myUserId && (live.drafts as any).current_pick_user_id === myUserId) onTheClock = true;
    if (!onTheClock && playoffLive?.drafts && myUserId && (playoffLive.drafts as any).current_pick_user_id === myUserId) onTheClock = true;
    if (season.status === 'complete') return { subline: `${seasonLabel} complete — view the champion & podium`, pulse: false, ctaLabel: 'View Recap' };
    if (playoffLive) return { subline: onTheClock ? `${seasonLabel} Playoffs — you're on the clock` : `${seasonLabel} Playoffs · live match in progress`, pulse: true, ctaLabel: onTheClock ? 'Make Pick' : 'Watch Live' };
    if (season.status === 'playoffs') return { subline: `${seasonLabel} Playoffs — bracket is set`, pulse: false, ctaLabel: 'Open Bracket' };
    if (live) return { subline: onTheClock ? `${seasonLabel} · Draft ${live.week_number ?? completed + 1} of ${totalDrafts} — you're on the clock` : `${seasonLabel} · Draft ${live.week_number ?? completed + 1} of ${totalDrafts} live now`, pulse: true, ctaLabel: onTheClock ? 'Make Pick' : 'Open Draft' };
    return { subline: `${seasonLabel} · Draft ${Math.min(completed + 1, totalDrafts)} of ${totalDrafts} — ready to start`, pulse: false, ctaLabel: 'Enter Arena' };
  })();

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Link to="/drafts" className="block">
        <div className={cn('relative overflow-hidden rounded-2xl btn-press', pulse && 'da-banner-pulse')}
          style={{
            background:
              'radial-gradient(ellipse 120% 80% at 50% 0%, hsl(45 95% 45% / 0.45), transparent 60%),' +
              'radial-gradient(ellipse 90% 60% at 100% 100%, hsl(152 72% 36% / 0.22), transparent 60%),' +
              'linear-gradient(180deg, hsl(160 45% 7%), hsl(160 55% 4%))',
            border: '1px solid hsl(45 95% 55% / 0.4)',
            boxShadow: '0 12px 40px hsl(45 95% 35% / 0.4), inset 0 1px 0 hsl(45 100% 90% / 0.2)',
          }}>
          <div aria-hidden className="absolute -top-12 -right-10 w-44 h-44 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, hsl(45 95% 60% / 0.4), transparent 70%)', filter: 'blur(8px)' }} />
          <div className="relative z-10 p-5 flex items-center gap-4">
            <div className="relative flex-shrink-0">
              <div aria-hidden className="absolute inset-0 rounded-full"
                style={{ background: 'radial-gradient(circle, hsl(45 95% 60% / 0.5), transparent 65%)', filter: 'blur(10px)', transform: 'scale(1.15)' }} />
              <img src={draftEmblem} alt="Draft Arena" width={96} height={96} loading="lazy" decoding="async"
                className="relative w-[88px] h-[88px] object-contain drop-shadow-[0_4px_18px_hsl(45_95%_50%/0.55)]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[9px] font-extrabold uppercase tracking-[0.22em]" style={{ color: 'hsl(45 95% 70%)' }}>◆ Draft League</span>
              </div>
              <h2 className="font-extrabold text-[22px] leading-none tracking-tight mb-1.5"
                style={{ background: 'linear-gradient(180deg, hsl(45 30% 98%), hsl(45 95% 70%))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', textShadow: '0 0 18px hsl(45 95% 40% / 0.4)' }}>
                Draft Arena
              </h2>
              <p className="text-[10.5px] font-bold text-white/65 leading-snug mb-2.5 line-clamp-2">{subline}</p>
              <CompeteCTAButton accent="45 100% 65%" accentDeep="40 95% 50%" pulse={pulse}>
                {ctaLabel}
              </CompeteCTAButton>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

/* ── NFL Pick'em banner ── */
function PickemCompeteCard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [season, setSeason] = useState<any>(null);
  const [week, setWeek] = useState<any>(null);
  const [pickedCount, setPickedCount] = useState(0);
  const [totalGames, setTotalGames] = useState(0);
  const [myStanding, setMyStanding] = useState<any>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data: s } = await (supabase as any).from('nfl_seasons').select('*').order('year', { ascending: false }).limit(1).maybeSingle();
        if (!mounted) return;
        if (!s) { setLoading(false); return; }
        setSeason(s);
        const { data: w } = await (supabase as any).from('nfl_weeks').select('*').eq('season_id', s.id).eq('week_number', s.current_week).maybeSingle();
        if (!mounted) return;
        setWeek(w);
        if (w) {
          const { count: gameCount } = await (supabase as any).from('nfl_games').select('id', { count: 'exact', head: true }).eq('week_id', w.id);
          if (!mounted) return;
          setTotalGames(gameCount || 0);
          if (user) {
            const { count: pickCount } = await (supabase as any).from('nfl_picks').select('id', { count: 'exact', head: true }).eq('week_id', w.id).eq('user_id', user.id);
            if (!mounted) return;
            setPickedCount(pickCount || 0);
          }
        }
        if (user) {
          const { data: st } = await (supabase as any).from('nfl_season_standings').select('rank, total_correct, total_picked').eq('season_id', s.id).eq('user_id', user.id).maybeSingle();
          if (!mounted) return;
          setMyStanding(st);
        }
      } finally { if (mounted) setLoading(false); }
    })();
    return () => { mounted = false; };
  }, [user]);

  const isLive = !loading && season?.status === 'active' && week?.status !== 'upcoming';
  const remaining = Math.max(0, totalGames - pickedCount);
  const weekLabel = week?.label || (season ? `Week ${season.current_week}` : 'This week');
  const allLocked = isLive && totalGames > 0 && remaining === 0;
  const noPicksYet = isLive && pickedCount === 0 && totalGames > 0;
  const subline = !season ? 'Tuning broadcast feed…'
    : season.status === 'upcoming' ? 'Season kicks off soon — open to preview the schedule'
    : isLive ? (noPicksYet ? `${weekLabel} · Tap to make your picks (${totalGames} games)` : remaining > 0 ? `${weekLabel} · ${remaining} of ${totalGames} games left to pick` : `${weekLabel} · Locked in — tap to track live scores`)
    : `${season.name} · Tap to view final standings`;
  const ctaLabel = !season ? 'Open Pick Center' : season.status === 'upcoming' ? 'Preview Season' : isLive ? (allLocked ? 'Track Live' : noPicksYet ? 'Make My Picks' : 'Finish My Picks') : 'View Standings';

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Link to="/pickem" className="block">
        <div className="relative overflow-hidden rounded-2xl btn-press"
          style={{
            background:
              'radial-gradient(ellipse 120% 80% at 50% 0%, hsl(152 72% 22% / 0.55), transparent 60%),' +
              'radial-gradient(ellipse 90% 60% at 100% 100%, hsl(45 95% 50% / 0.28), transparent 60%),' +
              'linear-gradient(180deg, hsl(160 28% 8%), hsl(160 30% 5%))',
            border: '1px solid hsl(45 90% 55% / 0.38)',
            boxShadow: '0 12px 40px hsl(152 72% 18% / 0.5), inset 0 1px 0 hsl(45 95% 70% / 0.2)',
          }}>
          <div aria-hidden className="absolute inset-0 pointer-events-none opacity-40"
            style={{ backgroundImage: 'repeating-linear-gradient(90deg, transparent 0, transparent 36px, hsl(0 0% 100% / 0.05) 36px, hsl(0 0% 100% / 0.05) 37px)', maskImage: 'linear-gradient(180deg, transparent 0%, black 30%, black 70%, transparent 100%)', WebkitMaskImage: 'linear-gradient(180deg, transparent 0%, black 30%, black 70%, transparent 100%)' }} />
          <div aria-hidden className="absolute -top-12 -right-10 w-44 h-44 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, hsl(45 95% 55% / 0.4), transparent 70%)', filter: 'blur(8px)' }} />
          <div className="relative z-10 p-5 flex items-center gap-4">
            <div className="relative flex-shrink-0">
              <div aria-hidden className="absolute inset-0 rounded-full"
                style={{ background: 'radial-gradient(circle, hsl(45 95% 55% / 0.5), transparent 65%)', filter: 'blur(10px)', transform: 'scale(1.15)' }} />
              <img src={pickemEmblem} alt="NFL Pick Center" width={96} height={96} loading="lazy" decoding="async"
                className="relative w-[88px] h-[88px] object-contain drop-shadow-[0_4px_18px_hsl(45_95%_50%/0.55)]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[9px] font-extrabold uppercase tracking-[0.22em]" style={{ color: 'hsl(45 95% 65%)' }}>◆ NFL Pick'em</span>
                {loading ? (
                  <span aria-hidden className="inline-block h-2.5 w-10 rounded-full pk-skeleton" />
                ) : isLive ? (
                  <StatusPill variant="live" size="xs" dot pulse>Live</StatusPill>
                ) : null}
              </div>
              <h2 className="font-extrabold text-[22px] leading-none tracking-tight mb-1.5"
                style={{ background: 'linear-gradient(180deg, hsl(45 30% 98%), hsl(45 95% 65%))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Pick Center
              </h2>
              <div className="mb-2.5 h-3.5 flex items-center">
                {loading ? <span aria-hidden className="inline-block h-2.5 w-44 max-w-full rounded-full pk-skeleton" />
                  : <p className="text-[10px] font-semibold truncate" style={{ color: 'hsl(150 12% 78%)' }}>
                    {subline}{myStanding && <span className="ml-1.5" style={{ color: 'hsl(45 95% 65%)' }}>· #{myStanding.rank ?? '—'} · {myStanding.total_correct}/{myStanding.total_picked}</span>}
                  </p>}
              </div>
              <CompeteCTAButton accent="45 95% 55%" accentDeep="38 95% 48%" ink="160 40% 6%" pulse={isLive && noPicksYet}>
                {ctaLabel}
              </CompeteCTAButton>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

/* ── Portfolio Wars banner ── */
function PortfolioWarsCompeteCard() {
  const [meta, setMeta] = useState<{ status: string; week_start: string; lock_at: string; players: number } | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: ch } = await supabase.from('pw_challenges').select('id,status,week_start,lock_at').in('status', ['active', 'locked', 'upcoming']).order('week_start', { ascending: false }).limit(1).maybeSingle();
      if (cancelled || !ch) return;
      const { count } = await supabase.from('pw_entries').select('*', { count: 'exact', head: true }).eq('challenge_id', ch.id);
      if (!cancelled) setMeta({ status: ch.status, week_start: ch.week_start, lock_at: ch.lock_at, players: count || 0 });
    })();
    return () => { cancelled = true; };
  }, []);

  const subline = !meta ? 'Weekly stock-picking challenge'
    : meta.status === 'upcoming' ? `Picks lock ${format(new Date(meta.lock_at), 'EEE h:mm a')} · ${meta.players} entered`
    : meta.status === 'active' ? `Live this week · ${meta.players} players`
    : `Week of ${format(new Date(meta.week_start), 'MMM d')}`;
  const cta = meta?.status === 'upcoming' ? 'Enter Picks' : 'Open';
  const statusBadge = !meta ? null
    : meta.status === 'upcoming' ? { label: 'Picks Open', color: 'hsl(152 80% 60%)', bg: 'hsl(152 80% 50% / 0.18)' }
    : meta.status === 'locked' ? { label: 'Locked', color: 'hsl(38 100% 65%)', bg: 'hsl(38 100% 60% / 0.18)' }
    : meta.status === 'active' ? { label: 'Live', color: 'hsl(152 80% 60%)', bg: 'hsl(152 80% 50% / 0.18)' }
    : { label: 'Results In', color: 'hsl(45 95% 65%)', bg: 'hsl(45 95% 55% / 0.18)' };
  const miniTape = [{ s: 'AAPL', p: 1.24 }, { s: 'NVDA', p: -0.82 }, { s: 'MSFT', p: 0.44 }, { s: 'TSLA', p: 2.16 }, { s: 'AMZN', p: -0.31 }, { s: 'META', p: 0.91 }, { s: 'COIN', p: 3.87 }, { s: 'PLTR', p: 2.41 }, { s: 'AMD', p: -1.42 }];
  const tapeLoop = [...miniTape, ...miniTape];

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}>
      <Link to="/portfolio-wars" className="block">
        <div className="relative overflow-hidden rounded-2xl btn-press"
          style={{ background: 'radial-gradient(ellipse 100% 60% at 50% 0%, hsl(152 80% 30% / 0.30), transparent 65%), linear-gradient(180deg, hsl(220 50% 8%), hsl(220 55% 4%))', border: '1px solid hsl(152 80% 50% / 0.30)', boxShadow: '0 12px 40px hsl(220 80% 4% / 0.6), inset 0 1px 0 hsl(152 80% 60% / 0.14)' }}>
          <div className="relative h-6 overflow-hidden border-b" style={{ borderColor: 'hsl(152 80% 50% / 0.16)', background: 'hsl(220 60% 3% / 0.7)' }}>
            <div className="absolute inset-y-0 left-0 w-6 z-10 pointer-events-none" style={{ background: 'linear-gradient(90deg, hsl(220 60% 3%), transparent)' }} />
            <div className="absolute inset-y-0 right-0 w-6 z-10 pointer-events-none" style={{ background: 'linear-gradient(270deg, hsl(220 60% 3%), transparent)' }} />
            <div className="flex items-center gap-3 whitespace-nowrap h-full" style={{ animation: 'pw-card-tape 38s linear infinite' }}>
              {tapeLoop.map((t, i) => (
                <span key={i} className="flex items-center gap-1 text-[9px] font-bold font-mono">
                  <span style={{ color: 'hsl(150 15% 80%)' }}>{t.s}</span>
                  <span className="px-1 rounded tabular-nums" style={{ color: t.p >= 0 ? 'hsl(152 80% 70%)' : 'hsl(0 80% 75%)' }}>{t.p >= 0 ? '+' : ''}{t.p.toFixed(2)}%</span>
                </span>
              ))}
            </div>
            <style>{`@keyframes pw-card-tape { from { transform: translateX(0); } to { transform: translateX(-50%); } }`}</style>
          </div>
          <div className="relative z-10 p-4 flex items-center gap-3">
            <div className="relative flex-shrink-0">
              <div aria-hidden className="absolute inset-0 rounded-2xl" style={{ background: 'radial-gradient(circle, hsl(152 80% 55% / 0.5), transparent 65%)', filter: 'blur(10px)', transform: 'scale(1.15)' }} />
              <div className="relative w-[60px] h-[60px] rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, hsl(220 50% 10%), hsl(220 55% 6%))', border: '1px solid hsl(152 80% 50% / 0.45)', boxShadow: 'inset 0 0 20px hsl(152 80% 50% / 0.2)' }}>
                <TrendingUp className="w-7 h-7" style={{ color: 'hsl(152 80% 65%)', filter: 'drop-shadow(0 0 6px hsl(152 80% 50% / 0.7))' }} strokeWidth={2.5} />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[8.5px] font-black uppercase tracking-[0.22em]" style={{ color: 'hsl(152 80% 65%)' }}>◆ Stock Challenge</span>
                {statusBadge && (
                  <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[8.5px] font-black uppercase tracking-wider" style={{ background: statusBadge.bg, color: statusBadge.color }}>
                    {meta?.status === 'active' && <span className="w-1 h-1 rounded-full animate-pulse" style={{ background: statusBadge.color }} />}
                    {statusBadge.label}
                  </span>
                )}
              </div>
              <h2 className="font-black text-[18px] leading-none tracking-tight mb-1" style={{ background: 'linear-gradient(180deg, hsl(150 30% 98%), hsl(152 80% 70%))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Portfolio Wars</h2>
              <p className="text-[10px] font-semibold mb-2" style={{ color: 'hsl(150 12% 75%)' }}>Pick 3 stocks. Beat the market. Beat your friends.</p>
              <CompeteCTAButton accent="152 80% 48%" accentDeep="152 80% 38%" ink="220 60% 4%">
                {cta}
              </CompeteCTAButton>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

/* ── READSHIFT banner — async social identity game ── */
function ReadshiftCompeteCard() {
  const { club } = useClub();
  const { user } = useAuth();
  const [subline, setSubline] = useState('Read the room. Shift your voice.');
  const [cta, setCta] = useState('Play');

  useEffect(() => {
    if (!club?.id) return;
    let live = true;
    (async () => {
      try {
        const games = await readshiftApi.listClubGames(club.id);
        if (!live) return;
        const active = games.filter((g) => ['lobby', 'shift', 'read', 'reveal'].includes(g.phase));
        const mineAwaiting = active.length; // any in-flight game is worth surfacing
        if (active.some((g) => g.phase === 'lobby')) { setSubline(`${active.length} game${active.length === 1 ? '' : 's'} open · join or start one`); setCta('Join'); }
        else if (mineAwaiting > 0) { setSubline(`${mineAwaiting} game${mineAwaiting === 1 ? '' : 's'} in progress`); setCta('Open'); }
        else { setSubline('Read the room. Shift your voice.'); setCta('New Game'); }
      } catch { /* keep defaults */ }
    })();
    return () => { live = false; };
  }, [club?.id, user?.id]);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}>
      <Link to="/readshift" className="block">
        <div className="relative overflow-hidden rounded-2xl btn-press"
          style={{
            background:
              'radial-gradient(ellipse 120% 80% at 50% 0%, hsl(265 85% 32% / 0.55), transparent 60%),' +
              'radial-gradient(ellipse 90% 60% at 100% 100%, hsl(290 90% 55% / 0.22), transparent 60%),' +
              'linear-gradient(180deg, hsl(260 40% 9%), hsl(265 45% 5%))',
            border: '1px solid hsl(270 80% 60% / 0.35)',
            boxShadow: '0 12px 40px hsl(265 85% 25% / 0.45), inset 0 1px 0 hsl(280 80% 70% / 0.18)',
          }}>
          <div aria-hidden className="absolute -top-12 -right-10 w-44 h-44 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, hsl(280 90% 60% / 0.4), transparent 70%)', filter: 'blur(8px)' }} />
          <div className="relative z-10 p-5 flex items-center gap-4">
            <div className="relative flex-shrink-0">
              <div aria-hidden className="absolute inset-0 rounded-2xl"
                style={{ background: 'radial-gradient(circle, hsl(280 90% 60% / 0.5), transparent 65%)', filter: 'blur(10px)', transform: 'scale(1.15)' }} />
              <div className="relative w-[72px] h-[72px] rounded-2xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, hsl(265 45% 14%), hsl(265 50% 8%))', border: '1px solid hsl(275 80% 60% / 0.45)', boxShadow: 'inset 0 0 20px hsl(275 80% 55% / 0.25)' }}>
                <VenetianMask className="w-9 h-9" style={{ color: 'hsl(280 90% 72%)', filter: 'drop-shadow(0 0 8px hsl(280 90% 55% / 0.7))' }} strokeWidth={2} />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[9px] font-extrabold uppercase tracking-[0.22em]" style={{ color: 'hsl(280 85% 74%)' }}>◆ Social Deduction</span>
              </div>
              <h2 className="font-extrabold text-[22px] leading-none tracking-tight mb-1.5"
                style={{ background: 'linear-gradient(180deg, hsl(280 30% 98%), hsl(280 85% 74%))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', textShadow: '0 0 18px hsl(280 90% 45% / 0.4)' }}>
                READSHIFT
              </h2>
              <p className="text-[10.5px] font-bold text-white/65 leading-snug mb-2.5 line-clamp-2">{subline}</p>
              <CompeteCTAButton accent="275 85% 62%" accentDeep="265 80% 50%" ink="270 50% 8%">
                {cta}
              </CompeteCTAButton>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

/* ── Community activities compact tile grid ── */
function CommunityTilesSection({ isInstalled }: { isInstalled: (slug: string) => boolean }) {
  const tiles = [
    { path: '/brackets', slug: 'brackets', label: 'Brackets', icon: Trophy, color: 'hsl(var(--primary))' },
    { path: '/rankings', slug: 'rankings', label: 'Rankings', icon: BarChart3, color: 'hsl(var(--accent-foreground))' },
    { path: '/polls', slug: 'polls', label: 'Polls', icon: MessageCircle, color: 'hsl(var(--warning))' },
  ].filter(t => isInstalled(t.slug));

  if (tiles.length === 0) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
      <div className="glass-card p-4">
        <h3 className="font-bold text-[12px] text-muted-foreground/70 mb-3 flex items-center gap-1.5">
          <span className="w-4 h-px bg-border/40" /> More Activities
        </h3>
        <div className={cn('grid gap-2', tiles.length === 1 ? 'grid-cols-1' : tiles.length === 2 ? 'grid-cols-2' : 'grid-cols-3')}>
          {tiles.map(t => (
            <Link key={t.path} to={t.path}>
              <div className="flex flex-col items-center gap-2 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors btn-press">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${t.color}18` }}>
                  <t.icon className="w-4.5 h-4.5" style={{ color: t.color }} />
                </div>
                <span className="text-[11px] font-bold text-center leading-tight">{t.label}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════ */
export default function CompetePage() {
  const { user } = useAuth();
  const { season, loading: seasonLoading } = useCurrentSeason();
  const { entries } = useSeasonEntries(season?.id);
  const { isInstalled } = useClubAssets();
  const totalDrafts = season ? getSeasonDraftTarget(season) : 12;

  return (
    <div className="pb-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="page-header">
          <div className="page-header-icon"
            style={{ background: 'linear-gradient(135deg, hsl(var(--gold) / 0.2), hsl(var(--gold) / 0.05))' }}>
            <Swords className="w-5 h-5" style={{ color: 'hsl(var(--gold))' }} />
          </div>
          <div>
            <h1 className="page-header-title">Compete</h1>
            <p className="page-header-subtitle">Games & activities</p>
          </div>
        </div>

        <div className="space-y-3">
          {/* Draft Arena — always the lead feature */}
          <DraftArenaEnterBanner
            season={season}
            entries={entries}
            totalDrafts={totalDrafts}
            myUserId={user?.id}
          />

          {/* Other installed games */}
          {isInstalled('rune-delve') && <RuneDelveCompeteCard />}
          {isInstalled('nexus-defense') && <NexusDefenseCompeteCard />}
          {isInstalled('nfl-pickem') && <PickemCompeteCard />}
          {isInstalled('portfolio-wars') && <PortfolioWarsCompeteCard />}
          {isInstalled('readshift') && <ReadshiftCompeteCard />}
          {isInstalled('workout-competition') && <WorkoutArenaCompeteCard />}
          {isInstalled('lockbox') && <LockboxCompeteCard />}

          {/* Community activities */}
          <CommunityTilesSection isInstalled={isInstalled} />
        </div>
      </motion.div>
    </div>
  );
}
