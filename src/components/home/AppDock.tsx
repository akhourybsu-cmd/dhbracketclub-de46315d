// DH Club Home — App Dock
//
// Refined replacement for AssetLauncher + QuickBar. One coherent app
// launcher concept. Tiles are still bordered (they're interactive), but
// the carousel itself sits on the ambient page surface — no outer card,
// no eyebrow shouting.
//
// • Larger tiles, readable two-line labels (no aggressive truncation).
// • Live/urgent state shown as a small colored dot on the tile, not as
//   a full glowing border, so visual attention stays on the hero.
// • Tail "+ Add" tile for admins, "All apps" link in the section label.

import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Bookmark, TrendingUp, Lock, Trophy, MessageSquareText,
  CalendarDays, ScrollText, Newspaper, MessageCircle, BarChart3, FileText, Link2,
  Plus, Sparkles, Cake, Dumbbell,
  type LucideIcon,
} from 'lucide-react';
import type { InstalledAsset } from '@/types/assets';
import { useAssetStatuses, type AssetStatus, type AssetStatusTone } from './useAssetStatuses';
import { SectionLabel } from './SectionLabel';
import draftEmblem from '@/assets/draft-emblem.png';
import runedelveEmblem from '@/assets/runedelve-emblem.png';
import nexusEmblem from '@/assets/nexus-emblem.png';
import pickemEmblem from '@/assets/pickem-emblem.png';

interface TileMeta {
  to: string;
  emblem?: string;
  icon?: LucideIcon;
  tint: string;
}

const ASSET_META: Record<string, TileMeta> = {
  'draft-arena':           { to: '/drafts',          emblem: draftEmblem,    tint: '45 95% 55%' },
  'rune-delve':            { to: '/rune-delve',      emblem: runedelveEmblem, tint: '152 70% 55%' },
  'nexus-defense':         { to: '/nexus',           emblem: nexusEmblem,    tint: '195 90% 60%' },
  'nfl-pickem':            { to: '/pickem',          emblem: pickemEmblem,   tint: '0 80% 60%' },
  'portfolio-wars':        { to: '/portfolio-wars',  icon: TrendingUp,       tint: '152 80% 55%' },
  'brackets':              { to: '/brackets',        icon: Trophy,           tint: '210 80% 60%' },
  'lockbox':               { to: '/lockbox',         icon: Lock,             tint: '0 80% 60%' },
  'chat':                  { to: '/chat',            icon: MessageSquareText, tint: '195 80% 65%' },
  'events':                { to: '/events',          icon: CalendarDays,     tint: '38 100% 60%' },
  'lore':                  { to: '/lore',            icon: ScrollText,       tint: '270 70% 65%' },
  'feed':                  { to: '/feed',            icon: Newspaper,        tint: '195 80% 65%' },
  'polls':                 { to: '/polls',           icon: MessageCircle,    tint: '38 95% 60%' },
  'rankings':              { to: '/rankings',        icon: BarChart3,        tint: '195 80% 60%' },
  'posts':                 { to: '/posts',           icon: FileText,         tint: '195 80% 65%' },
  'shared-media':          { to: '/shared',          icon: Link2,            tint: '195 80% 65%' },
  'birthdays-milestones':  { to: '/celebrations',    icon: Cake,             tint: '14 90% 60%' },
  'narrative-rpg':         { to: '/narrative',       icon: Sparkles,         tint: '270 70% 65%' },
  'workout-competition':   { to: '/workouts',        icon: Dumbbell,         tint: '15 90% 58%' },
};

const TONE_DOT: Record<AssetStatusTone, string | null> = {
  urgent: '45 100% 60%',
  live:   '152 70% 50%',
  info:   '210 75% 60%',
  idle:   null,
};

interface Props {
  installedAssets: InstalledAsset[];
  canManage: boolean;
}

export function AppDock({ installedAssets, canManage }: Props) {
  const slugs = installedAssets.map(ia => ia.asset.slug);
  const { statuses } = useAssetStatuses(slugs);

  // Sort: urgent → live → info → idle, then by sort_order.
  const ordered = [...installedAssets].sort((a, b) => {
    const sa = statuses[a.asset.slug];
    const sb = statuses[b.asset.slug];
    const w = (s?: AssetStatus | null) => s?.tone === 'urgent' ? 0 : s?.tone === 'live' ? 1 : s?.tone === 'info' ? 2 : 3;
    const dw = w(sa) - w(sb);
    if (dw !== 0) return dw;
    return a.sort_order - b.sort_order;
  });

  if (ordered.length === 0 && !canManage) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="mb-6"
    >
      <SectionLabel
        label="Your apps"
        to="/club/assets"
        linkLabel="Library"
        count={ordered.length}
      />
      <div
        className="-mx-4 sm:mx-0 flex gap-2.5 overflow-x-auto px-4 sm:px-0 pb-1.5 snap-x snap-mandatory"
        style={{
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch',
          maskImage: 'linear-gradient(to right, transparent 0, #000 16px, #000 calc(100% - 28px), transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to right, transparent 0, #000 16px, #000 calc(100% - 28px), transparent 100%)',
        }}
      >
        {ordered.map((ia, idx) => (
          <motion.div
            key={ia.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: Math.min(idx, 6) * 0.035, ease: [0.22, 1, 0.36, 1] }}
          >
            <AppTile
              slug={ia.asset.slug}
              name={ia.asset.name}
              status={statuses[ia.asset.slug] ?? null}
            />
          </motion.div>
        ))}
        {canManage && <AddTile />}
      </div>
    </motion.section>
  );
}

function AppTile({ slug, name, status }: { slug: string; name: string; status: AssetStatus | null }) {
  const meta = ASSET_META[slug];
  const tint = meta?.tint ?? '195 50% 60%';
  const Icon = meta?.icon;
  const dotTone = status ? TONE_DOT[status.tone] : null;
  const statusText = status?.text;

  return (
    <Link
      to={meta?.to ?? '/'}
      className="snap-start flex-shrink-0 w-[96px] sm:w-[104px] active:scale-95 transition-transform"
    >
      <div
        className="relative h-[112px] sm:h-[120px] rounded-2xl flex flex-col items-center justify-center gap-2 px-2 bg-card border border-border/40 overflow-hidden"
        style={{ boxShadow: 'inset 0 1px 0 hsl(var(--foreground) / 0.04)' }}
      >
        {/* Status dot — small, top right. The only "look at me" affordance. */}
        {dotTone && (
          <span
            aria-hidden
            className="absolute top-2 right-2 w-2 h-2 rounded-full"
            style={{
              background: `hsl(${dotTone})`,
              boxShadow: `0 0 8px hsl(${dotTone} / 0.7)`,
              animation: status?.tone === 'urgent' ? 'tilePulse 1.8s ease-in-out infinite' : undefined,
            }}
          />
        )}
        <style>{`@keyframes tilePulse { 0%,100% { opacity: 0.7; transform: scale(1); } 50% { opacity: 1; transform: scale(1.18); } }`}</style>

        {meta?.emblem ? (
          <img
            src={meta.emblem}
            alt=""
            aria-hidden
            className="w-11 h-11 sm:w-12 sm:h-12 object-contain"
            style={{ filter: `drop-shadow(0 2px 6px hsl(${tint} / 0.45))` }}
            loading="lazy"
            decoding="async"
          />
        ) : Icon ? (
          <div
            className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center"
            style={{
              background: `linear-gradient(135deg, hsl(${tint} / 0.18), hsl(${tint} / 0.04))`,
              color: `hsl(${tint})`,
            }}
          >
            <Icon className="w-5 h-5" />
          </div>
        ) : (
          <div className="w-11 h-11 rounded-xl bg-muted/30 flex items-center justify-center">
            <Bookmark className="w-5 h-5 text-muted-foreground" />
          </div>
        )}

        <div className="w-full px-0.5 text-center">
          <p className="text-[11px] font-bold leading-tight text-foreground/95 line-clamp-2 min-h-[1.8em]">
            {name}
          </p>
          {statusText && (
            <p
              className="text-[9.5px] font-semibold leading-tight mt-0.5 truncate"
              style={{ color: dotTone ? `hsl(${dotTone})` : 'hsl(var(--muted-foreground) / 0.7)' }}
            >
              {statusText}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}

function AddTile() {
  return (
    <Link
      to="/club/assets"
      className="snap-start flex-shrink-0 w-[96px] sm:w-[104px] active:scale-95 transition-transform"
      aria-label="Add an app"
    >
      <div
        className="relative h-[112px] sm:h-[120px] rounded-2xl flex flex-col items-center justify-center gap-2"
        style={{
          background: 'linear-gradient(180deg, hsl(var(--card) / 0.45), hsl(var(--card) / 0.25))',
          border: '1.5px dashed hsl(var(--border) / 0.5)',
        }}
      >
        <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-muted/30 text-muted-foreground/75">
          <Plus className="w-5 h-5" />
        </div>
        <p className="text-[11px] font-bold text-muted-foreground/75">Add app</p>
      </div>
    </Link>
  );
}
