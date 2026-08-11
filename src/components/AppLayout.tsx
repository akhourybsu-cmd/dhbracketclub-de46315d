import { ReactNode, useEffect, useState, useCallback, useRef } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { LayoutDashboard, MessageSquareText, CalendarDays, Swords, Newspaper, User, Trophy, BarChart3, MessageCircle, Bookmark, Link2, ScrollText, Lock, FileText, Sparkles, Shield, Menu, Brackets as BracketsIcon, TrendingUp, Settings, Cake, BookOpen, Dumbbell } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/ThemeToggle';
import dhMonogram from '@/assets/dh-monogram.png';
import { useSoundEffect } from '@/hooks/useSoundEffect';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useClub } from '@/contexts/ClubContext';
import { AppDrawer } from '@/components/AppDrawer';
import { BottomTabBar } from '@/components/BottomTabBar';
import { NavDrawerProvider, useNavDrawer } from '@/contexts/NavDrawerContext';
import { useClubAssets } from '@/hooks/useClubAssets';

type SidebarItem = { path: string; label: string; icon: React.ComponentType<{ className?: string }> };
type SidebarSection = { label: string; items: SidebarItem[] };

const STATIC_SECTIONS: SidebarSection[] = [
  {
    label: 'Main',
    items: [
      { path: '/dashboard', label: 'Home', icon: LayoutDashboard },
      { path: '/chat', label: 'Chat', icon: MessageSquareText },
      { path: '/compete', label: 'Compete', icon: Swords },
      { path: '/feed', label: 'Feed', icon: Newspaper },
      { path: '/events', label: 'Events', icon: CalendarDays },
      { path: '/lore', label: 'Lore', icon: ScrollText },
      { path: '/celebrations', label: 'Celebrations', icon: Cake },
    ],
  },
  {
    label: 'Games',
    items: [
      { path: '/drafts', label: 'Draft Arena', icon: Bookmark },
      { path: '/rune-delve', label: 'Rune Delve', icon: Sparkles },
      { path: '/nexus', label: 'Nexus Defense', icon: Shield },
      { path: '/pickem', label: "NFL Pick'em", icon: Trophy },
      { path: '/brackets', label: 'Brackets', icon: BracketsIcon },
      { path: '/portfolio-wars', label: 'Portfolio Wars', icon: TrendingUp },
      { path: '/lockbox', label: 'Lockbox', icon: Lock },
      { path: '/workouts', label: 'Workout Arena', icon: Dumbbell },
    ],
  },
  {
    label: 'Community',
    items: [
      { path: '/narrative', label: 'Narrative RPG', icon: BookOpen },
      { path: '/polls', label: 'Polls', icon: MessageCircle },
      { path: '/rankings', label: 'Rankings', icon: BarChart3 },
      { path: '/posts', label: 'Posts', icon: FileText },
      { path: '/shared', label: 'Shared Media', icon: Link2 },
    ],
  },
];

// Map of routes -> friendly title shown in mobile header
const routeTitles: Array<[RegExp, string]> = [
  [/^\/dashboard/, 'Home'],
  [/^\/chat/, 'Chat'],
  [/^\/compete/, 'Compete'],
  [/^\/events/, 'Events'],
  [/^\/lore/, 'Lore'],
  [/^\/feed/, 'Feed'],
  [/^\/profile/, 'Profile'],
  [/^\/posts/, 'Posts'],
  [/^\/polls/, 'Polls'],
  [/^\/rankings/, 'Rankings'],
  [/^\/shared/, 'Shared Media'],
  [/^\/lockbox/, 'Lockbox'],
  [/^\/brackets/, 'Brackets'],
  [/^\/pools/, 'Pools'],
  [/^\/admin\/clubs/, 'Manage Clubs'],
  [/^\/club\/settings/, 'Club Settings'],
  [/^\/club\/request/, 'Club Access'],
];
function getRouteTitle(pathname: string): string {
  for (const [re, title] of routeTitles) if (re.test(pathname)) return title;
  return 'DH Club';
}

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <NavDrawerProvider>
      <AppLayoutInner>{children}</AppLayoutInner>
    </NavDrawerProvider>
  );
}

function AppLayoutInner({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { play } = useSoundEffect();
  const { user } = useAuth();
  const { club, isClubAdmin, isPlatformOwner, isAppAdmin } = useClub();
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const { open: drawerOpen, setOpen: setDrawerOpen } = useNavDrawer();
  const { filterNavPaths } = useClubAssets();
  const lastFetchAtRef = useRef<number>(0);

  // Fetch unread chat count (throttled)
  const fetchUnreadCount = useCallback(async (force = false) => {
    if (!user) return;
    const now = Date.now();
    if (!force && now - lastFetchAtRef.current < 10_000) return;
    lastFetchAtRef.current = now;
    try {
      const [{ data: channels }, { data: readStates }] = await Promise.all([
        supabase.from('channels').select('id'),
        (supabase as any).from('channel_read_states').select('channel_id, last_read_at').eq('user_id', user.id),
      ]);
      if (!channels) return;
      const readMap = new Map<string, string>();
      if (readStates) (readStates as any[]).forEach((rs: any) => readMap.set(rs.channel_id, rs.last_read_at));

      const chIds = channels.map((c: any) => c.id);
      const { data: lastMsgs } = await supabase
        .from('messages')
        .select('channel_id, created_at')
        .is('parent_message_id', null)
        .in('channel_id', chIds)
        .order('created_at', { ascending: false })
        .limit(200);

      if (!lastMsgs) return;
      const latestPerChannel = new Map<string, string>();
      lastMsgs.forEach((m: any) => {
        if (!latestPerChannel.has(m.channel_id)) latestPerChannel.set(m.channel_id, m.created_at);
      });

      let count = 0;
      latestPerChannel.forEach((latestAt, chId) => {
        const lastRead = readMap.get(chId);
        if (!lastRead || new Date(latestAt) > new Date(lastRead)) count++;
      });
      setUnreadChatCount(count);
    } catch {}
  }, [user]);

  useEffect(() => { fetchUnreadCount(true); }, [fetchUnreadCount]);
  useEffect(() => {
    const interval = setInterval(() => fetchUnreadCount(true), 30000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);
  useEffect(() => { fetchUnreadCount(); }, [location.pathname, fetchUnreadCount]);

  const isChatRoute = location.pathname.startsWith('/chat');
  const isRuneDelve = location.pathname.startsWith('/rune-delve');
  const isNexus = location.pathname.startsWith('/nexus');
  const isPickem = location.pathname.startsWith('/pickem');
  const isDrafts = location.pathname.startsWith('/drafts');
  const isPortfolioWars = location.pathname.startsWith('/portfolio-wars');
  const isGameShell = isRuneDelve || isNexus || isPickem || isDrafts || isPortfolioWars;

  const isNavActive = (path: string) => {
    if (path === '/brackets') return location.pathname.startsWith('/brackets') || location.pathname.startsWith('/pools');
    if (path === '/compete') return location.pathname === '/compete';
    if (path === '/feed') return location.pathname === '/feed';
    if (path === '/posts') return location.pathname.startsWith('/posts');
    if (path === '/lore') return location.pathname.startsWith('/lore');
    if (path === '/dashboard') return location.pathname === '/dashboard';
    return location.pathname.startsWith(path);
  };

  // Mobile header is hidden inside game shells (they own the viewport) and in chat
  // (chat owns its own compact header, including a hamburger button).
  const showMobileHeader = !isGameShell && !isChatRoute;
  const isDashboard = location.pathname === '/dashboard';
  const mobileTitle = getRouteTitle(location.pathname);

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      {/* Mobile top header with hamburger.
          Calm shell rules:
          - Hamburger and profile tap targets are both 44×44 (Apple HIG min).
          - Backdrop blur softened from 20px/180% to 16px/160% so the header
            feels premium without dominating.
          - Border opacity reduced to /25 to match the surrounding shell.
          - Symmetric left/right padding keeps the right-side avatar from
            feeling cramped against the screen edge or notch safe area. */}
      {showMobileHeader && (
        <header
          className="lg:hidden sticky top-0 z-40 flex items-center gap-2 h-12 border-b border-border/25 bg-background/80"
          style={{
            backdropFilter: 'blur(16px) saturate(160%)',
            WebkitBackdropFilter: 'blur(16px) saturate(160%)',
            paddingLeft: 'max(0.5rem, env(safe-area-inset-left, 0px))',
            paddingRight: 'max(0.75rem, env(safe-area-inset-right, 0px))',
          }}
        >
          <button
            type="button"
            aria-label="Open navigation menu"
            onClick={() => { play('tap'); setDrawerOpen(true); }}
            className="p-2 -ml-1 rounded-lg hover:bg-muted/40 active:bg-muted/60 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <Menu className="w-5 h-5 text-foreground/85" />
          </button>
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {!isDashboard && (
              <h1 className="text-[15px] font-bold tracking-tight truncate">{mobileTitle}</h1>
            )}
          </div>
          <Link
            to="/profile"
            aria-label="Profile"
            className="rounded-full active:opacity-80 min-w-[44px] min-h-[44px] flex items-center justify-center -mr-1"
          >
            {club?.logo_url ? (
              <img src={club.logo_url} alt="" className="w-8 h-8 rounded-full object-cover border border-border/40" />
            ) : (
              <img src={dhMonogram} alt="" className="w-8 h-8 rounded-full object-contain" />
            )}
          </Link>
        </header>
      )}

      {/* Drawer */}
      <AppDrawer open={drawerOpen} onOpenChange={setDrawerOpen} unreadChatCount={unreadChatCount} />

      {/* Mobile bottom tab bar — portaled to <body>, so it stays pinned to the
          viewport bottom on every route (never trapped inside PageTransition's
          transform). Hidden inside game shells and chat, which own the viewport. */}
      {showMobileHeader && <BottomTabBar unreadChatCount={unreadChatCount} />}

      {/* Main Content */}
      <main className={cn(
        "flex-1 overflow-x-hidden min-w-0",
        isGameShell ? "pb-0" : "lg:pl-64",
        isChatRoute && "overflow-hidden"
      )}>
        {location.pathname === '/chat' || isGameShell ? (
          children
        ) : (
          // Content area sizing:
          //   • Mobile / tablet (<lg): keep the 640px phone-column cap.
          //     Everything below the lg breakpoint stays byte-identical
          //     to the prior mobile-first design.
          //   • Desktop (lg+): widen to 1280px. This single change is
          //     the foundation of the desktop overhaul — most non-game
          //     pages were getting capped at 640px on a 1920px display,
          //     which is what makes the app feel like an emulated phone.
          //
          // Long-form reading pages (Lore article detail, etc.) re-apply
          // a narrower cap at the page root via `lg:max-w-[760px]
          // lg:mx-auto` so prose stays readable.
          <div className={cn(
            "max-w-[640px] lg:max-w-[1280px] mx-auto px-4 sm:px-5 pt-5 sm:pt-6 lg:pt-8 min-w-0",
            // Clearance for the mobile bottom tab bar (~56px + safe area) so the
            // last items aren't hidden behind it. Desktop has no bar → normal pad.
            showMobileHeader ? "pb-24 lg:pb-8" : "pb-5 sm:pb-6 lg:pb-8",
          )}>
            {children}
          </div>
        )}
      </main>

      {/* Desktop Sidebar — hidden inside game shells (Rune Delve, Nexus, etc.) */}
      {!isGameShell && (() => {
        // Build sections including conditional admin section, filtered by installed assets
        const sections: SidebarSection[] = STATIC_SECTIONS.map(sec => ({
          ...sec,
          items: sec.items.filter(item => filterNavPaths([item.path]).length > 0),
        })).filter(sec => sec.items.length > 0);
        const accountItems: SidebarItem[] = [{ path: '/profile', label: 'Profile', icon: User }];
        sections.push({ label: 'Account', items: accountItems });
        if (isClubAdmin || isPlatformOwner || isAppAdmin) {
          const adminItems: SidebarItem[] = [
            ...(isClubAdmin ? [{ path: '/club/settings', label: 'Club Settings', icon: Settings }] : []),
            ...((isAppAdmin || isPlatformOwner) ? [{ path: '/admin', label: 'Admin Portal', icon: Shield }] : []),
          ];
          sections.push({ label: 'Admin', items: adminItems });
        }

        return (
          <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-64 flex-col z-40 bg-sidebar-background border-r border-border/50" style={{
            backdropFilter: 'blur(24px) saturate(180%)',
            boxShadow: 'inset -1px 0 0 hsl(var(--foreground) / 0.02)',
          }}>
            {/* Identity header — fixed, never scrolls */}
            <div className="flex-shrink-0 px-6 pt-6 pb-5 border-b border-border/30">
              <div className="flex items-center gap-3">
                {club?.logo_url ? (
                  <img src={club.logo_url} alt={club.name} className="w-10 h-10 object-cover rounded-xl drop-shadow-lg flex-shrink-0" style={{ filter: 'drop-shadow(0 0 10px hsl(var(--club-accent) / 0.3))' }} />
                ) : (
                  <img src={dhMonogram} alt="DH" className="w-10 h-10 object-contain drop-shadow-lg flex-shrink-0" style={{ filter: 'drop-shadow(0 0 10px hsl(var(--club-accent) / 0.25))' }} />
                )}
                <div className="min-w-0">
                  <h1 className="text-[15px] font-extrabold tracking-tight leading-none truncate">
                    <span className="gradient-text">{club?.name ?? 'DH'}</span>
                  </h1>
                  <p className="text-[8px] text-muted-foreground/70 font-bold uppercase tracking-[0.2em] mt-0.5">Compete With Your Crew</p>
                </div>
              </div>
            </div>

            {/* Scrollable nav — fills remaining height */}
            <nav className="flex-1 overflow-y-auto px-3 py-3 min-h-0">
              {sections.map((sec) => (
                <div key={sec.label} className="mb-4">
                  <p className="px-3 mb-1.5 text-[8px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">
                    {sec.label}
                  </p>
                  <div className="flex flex-col gap-0.5">
                    {sec.items.map((item) => {
                      const Icon = item.icon;
                      const active = isNavActive(item.path);
                      const showBadge = item.path === '/chat' && unreadChatCount > 0;
                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          onClick={() => play('tap')}
                          className={cn('nav-item relative', active ? 'nav-item-active' : 'nav-item-inactive')}
                        >
                          <div className="relative flex-shrink-0">
                            <Icon className="w-[18px] h-[18px]" />
                            {showBadge && (
                              <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] rounded-full bg-primary text-[8px] font-bold text-primary-foreground flex items-center justify-center px-0.5">
                                {unreadChatCount > 9 ? '9+' : unreadChatCount}
                              </span>
                            )}
                          </div>
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>

            {/* Footer — fixed, never scrolls */}
            <div className="flex-shrink-0 border-t border-border/30">
              <div className="px-4 py-3 flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/60">Theme</span>
                <ThemeToggle />
              </div>
              <div className="px-6 pb-4">
                <p className="text-[9px] text-muted-foreground/50 font-semibold tracking-wide">DH — For fun, not funds.</p>
              </div>
            </div>
          </aside>
        );
      })()}
    </div>
  );
}
