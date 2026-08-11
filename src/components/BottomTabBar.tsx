import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { LayoutDashboard, MessageSquareText, Swords, Newspaper, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSoundEffect } from '@/hooks/useSoundEffect';

type Tab = {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Route-active predicate. */
  match: (pathname: string) => boolean;
};

const TABS: Tab[] = [
  { path: '/dashboard', label: 'Home', icon: LayoutDashboard, match: (p) => p === '/dashboard' },
  { path: '/chat', label: 'Chat', icon: MessageSquareText, match: (p) => p.startsWith('/chat') },
  { path: '/compete', label: 'Compete', icon: Swords, match: (p) => p === '/compete' },
  { path: '/feed', label: 'Feed', icon: Newspaper, match: (p) => p === '/feed' },
  { path: '/profile', label: 'You', icon: User, match: (p) => p.startsWith('/profile') },
];

/**
 * Mobile bottom tab bar (lg:hidden). Portaled to document.body so its
 * `position: fixed` always anchors to the viewport — never to a transformed
 * ancestor like PageTransition's motion wrapper (see CLAUDE.md transform-context
 * gotcha). That is what keeps it pinned to the bottom on every route it links to.
 */
export function BottomTabBar({ unreadChatCount = 0 }: { unreadChatCount?: number }) {
  const location = useLocation();
  const { play } = useSoundEffect();
  const reduce = useReducedMotion();

  const bar = (
    <nav
      aria-label="Primary"
      className="lg:hidden fixed inset-x-0 bottom-0 z-40 border-t border-border/25 bg-background/80"
      style={{
        backdropFilter: 'blur(16px) saturate(160%)',
        WebkitBackdropFilter: 'blur(16px) saturate(160%)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)',
      }}
    >
      <div className="flex items-stretch h-14 max-w-[640px] mx-auto px-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = tab.match(location.pathname);
          const showBadge = tab.path === '/chat' && unreadChatCount > 0;
          return (
            <Link
              key={tab.path}
              to={tab.path}
              onClick={() => { play('tap'); navigator.vibrate?.(8); }}
              aria-label={tab.label}
              aria-current={active ? 'page' : undefined}
              className="relative flex-1 flex flex-col items-center justify-center gap-0.5 min-w-0 select-none"
            >
              {active && (
                <motion.span
                  layoutId={reduce ? undefined : 'bottomTabGlow'}
                  aria-hidden
                  className="absolute top-1 h-9 w-[64px] rounded-2xl"
                  style={{ background: 'hsl(var(--primary) / 0.12)' }}
                  transition={{ type: 'spring', stiffness: 520, damping: 38, mass: 0.7 }}
                />
              )}
              <div className="relative flex-shrink-0">
                <Icon
                  className={cn(
                    'w-[22px] h-[22px] transition-colors',
                    active ? 'text-primary' : 'text-muted-foreground/65',
                  )}
                />
                {showBadge && (
                  <span className="absolute -top-1.5 -right-2 min-w-[15px] h-[15px] rounded-full bg-primary text-[8px] font-bold text-primary-foreground flex items-center justify-center px-0.5">
                    {unreadChatCount > 9 ? '9+' : unreadChatCount}
                  </span>
                )}
              </div>
              <span
                className={cn(
                  'text-[9.5px] font-bold tracking-tight leading-none transition-colors',
                  active ? 'text-primary' : 'text-muted-foreground/60',
                )}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(bar, document.body);
}
