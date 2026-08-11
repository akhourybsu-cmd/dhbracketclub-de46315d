import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import {
  Trophy, BarChart3, MessageCircle, Bookmark, CalendarDays, FileText, Newspaper,
  Zap, Users, Pin, ChevronRight, Plus, Lock, Unlock
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { useActivityFeedUpdates } from '@/hooks/useRealtimeSubscription';
import { Stagger, StaggerItem } from '@/components/motion/Stagger';

const FEED_ICONS: Record<string, { icon: any; color: string }> = {
  ranking_created: { icon: BarChart3, color: 'accent' },
  ranking_submitted: { icon: BarChart3, color: 'accent' },
  poll_created: { icon: MessageCircle, color: 'warning' },
  poll_voted: { icon: MessageCircle, color: 'warning' },
  draft_created: { icon: Bookmark, color: 'gold' },
  draft_completed: { icon: Bookmark, color: 'gold' },
  bracket_submitted: { icon: Trophy, color: 'primary' },
  event_created: { icon: CalendarDays, color: 'success' },
  post_created: { icon: FileText, color: 'primary' },
  event_rsvp: { icon: Users, color: 'success' },
  lockbox_created: { icon: Lock, color: 'destructive' },
  lockbox_cracked: { icon: Unlock, color: 'destructive' },
};

const FEED_LABELS: Record<string, string> = {
  ranking_created: 'created a ranking',
  ranking_submitted: 'submitted a ranking',
  poll_created: 'created a poll',
  poll_voted: 'voted on a poll',
  draft_created: 'created a draft',
  draft_completed: 'completed a draft',
  bracket_submitted: 'submitted a bracket',
  event_created: 'created an event',
  post_created: 'started a discussion',
  event_rsvp: 'RSVPed to an event',
  lockbox_created: 'set their daily lock 🔒',
  lockbox_cracked: 'cracked a lock 🔓',
};

type Post = {
  id: string;
  title: string;
  content: string;
  is_pinned: boolean;
  comments_count: number;
  created_at: string;
  profiles?: { display_name: string };
};

export default function FeedPage() {
  const { user } = useAuth();
  const [activity, setActivity] = useState<any[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    const [{ data: actData }, { data: postData }] = await Promise.all([
      supabase.from('activity_feed').select('*, profiles:actor_user_id(display_name)').order('created_at', { ascending: false }).limit(30),
      supabase.from('posts').select('*, profiles:user_id(display_name)').order('is_pinned', { ascending: false }).order('created_at', { ascending: false }).limit(20),
    ]);

    if (actData) setActivity(actData);
    if (postData) {
      const postIds = postData.map(p => p.id);
      let countMap = new Map<string, number>();
      if (postIds.length > 0) {
        const { data: comments } = await supabase.from('post_comments').select('post_id').in('post_id', postIds);
        if (comments) comments.forEach(c => countMap.set(c.post_id, (countMap.get(c.post_id) || 0) + 1));
      }
      setPosts(postData.map(p => ({ ...p, comments_count: countMap.get(p.id) || 0 })));
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  useActivityFeedUpdates(() => { fetchData(); });

  const getLink = (item: any) => {
    if (!item.target_id) return null;
    const type = item.target_type;
    if (type === 'ranking') return `/rankings/${item.target_id}`;
    if (type === 'poll') return `/polls/${item.target_id}`;
    if (type === 'draft') return `/drafts/${item.target_id}`;
    if (type === 'bracket') return `/brackets`;
    if (type === 'event') return `/events/${item.target_id}`;
    if (type === 'post') return `/posts/${item.target_id}`;
    return null;
  };

  // Pinned posts
  const pinnedPosts = posts.filter(p => p.is_pinned);

  return (
    <div className="pb-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-6">
          <div className="page-header mb-0">
            <div className="page-header-icon"><Newspaper /></div>
            <div>
              <h1 className="page-header-title">Feed</h1>
              <p className="page-header-subtitle">Activity & discussions</p>
            </div>
          </div>
          <Link to="/posts/create">
            <Button size="sm" className="h-8 gap-1.5 text-xs font-bold rounded-xl">
              <Plus className="w-3.5 h-3.5" /> Post
            </Button>
          </Link>
        </div>

        {/* Skeleton loading */}
        {loading && (
          <div className="space-y-6">
            {/* Discussion skeletons */}
            <div>
              <div className="h-3 w-24 rounded skeleton-shimmer mb-3" />
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="glass-card p-3.5">
                    <div className="h-3.5 rounded-md w-3/4 skeleton-shimmer mb-2" />
                    <div className="h-2.5 rounded-md w-full skeleton-shimmer mb-2.5" />
                    <div className="flex justify-between">
                      <div className="h-2 rounded w-28 skeleton-shimmer" />
                      <div className="h-2 rounded w-8 skeleton-shimmer" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* Activity skeletons */}
            <div>
              <div className="h-3 w-16 rounded skeleton-shimmer mb-3" />
              <div className="space-y-1">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="flex items-center gap-2.5 px-2 py-2.5">
                    <div className="w-7 h-7 rounded-lg skeleton-shimmer flex-shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-2.5 rounded-md w-3/4 skeleton-shimmer" />
                      <div className="h-2 rounded-md w-16 skeleton-shimmer" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Desktop 2-column split (mobile/tablet keeps the original
            vertical stack — no `lg:` prefix means no change <lg):
              LEFT  (1fr)            — Pinned posts + Discussions
              RIGHT (360px, sticky)  — Activity stream

            The Activity stream is high-volume realtime micro-events;
            it naturally belongs in a sidebar. Discussions are the
            bigger content cards and stay in the primary column. */}
        <div className="flex flex-col gap-0 lg:grid lg:grid-cols-[1fr_360px] lg:gap-6 lg:items-start">
          <div className="min-w-0">

        {/* Pinned posts */}
        {!loading && pinnedPosts.length > 0 && (
          <div className="mb-6">
            {pinnedPosts.map(post => (
              <Link key={post.id} to={`/posts/${post.id}`} className="block mb-2">
                <div className="glass-card p-3.5 border-premium-warm/10 transition-all hover:border-premium-warm/20">
                  <div className="relative z-10">
                    <div className="flex items-center gap-1 text-[9px] font-bold mb-1" style={{ color: 'hsl(var(--premium-warm))' }}>
                      <Pin className="w-2.5 h-2.5" /> Pinned
                    </div>
                    <h3 className="font-bold text-[13px] tracking-tight">{post.title}</h3>
                    <p className="text-[11px] text-muted-foreground/60 mt-0.5 line-clamp-1">{post.content}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Recent discussions */}
        {!loading && posts.filter(p => !p.is_pinned).length > 0 && (
          <div className="mb-6">
            <h2 className="section-header mb-3">
              <FileText className="w-3.5 h-3.5 inline-block mr-1.5 text-primary/80" />
              Discussions
            </h2>
            <Stagger className="space-y-2">
              {posts.filter(p => !p.is_pinned).slice(0, 5).map((post) => (
                <StaggerItem key={post.id}>
                  <Link to={`/posts/${post.id}`} className="block group">
                    <div className="glass-card p-3.5 transition-all duration-200 group-hover:border-primary/15">
                      <div className="relative z-10">
                        <h3 className="font-bold text-[13px] tracking-tight mb-0.5">{post.title}</h3>
                        <p className="text-[11px] text-foreground/60 line-clamp-1 mb-1.5">{post.content}</p>
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground/70">
                          <span>{post.profiles?.display_name} · {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</span>
                          <span className="flex items-center gap-1"><MessageCircle className="w-2.5 h-2.5" /> {post.comments_count}</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        )}

          </div>{/* /lg left column — Pinned posts + Discussions */}

          {/* RIGHT column — Activity sidebar (sticky on lg) */}
          <div className="min-w-0 lg:sticky lg:top-3">
        {/* Activity stream */}
        {!loading && (
        <div>
          <h2 className="section-header mb-3">
            <Zap className="w-3.5 h-3.5 inline-block mr-1.5 text-primary/80" />
            Activity
          </h2>
          <Stagger className="space-y-1">
            {activity.map((item) => {
              const iconConfig = FEED_ICONS[item.event_type] || { icon: Zap, color: 'primary' };
              const Icon = iconConfig.icon;
              const label = FEED_LABELS[item.event_type] || item.event_type;
              const link = getLink(item);
              const meta = typeof item.metadata === 'object' ? item.metadata : {};
              const title = meta?.title || meta?.topic || meta?.question || '';

              const content = (
                <div className="flex items-center gap-2.5 px-2 py-2.5 -mx-2 rounded-lg hover:bg-muted/25 transition-colors group">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{
                    background: `linear-gradient(135deg, hsl(var(--${iconConfig.color}) / 0.15), hsl(var(--${iconConfig.color}) / 0.04))`,
                  }}>
                    <Icon className="w-3.5 h-3.5" style={{ color: `hsl(var(--${iconConfig.color}))` }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] leading-tight">
                      <span className="font-bold text-foreground/80">{item.profiles?.display_name}</span>{' '}
                      <span className="text-foreground/65">{label}</span>
                      {title && <span className="text-foreground/80 font-semibold"> — {title}</span>}
                    </p>
                    <p className="text-[9px] text-muted-foreground/70 mt-0.5">{formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}</p>
                  </div>
                  {link && <ChevronRight className="w-3 h-3 text-muted-foreground/30 group-hover:text-muted-foreground/70 transition-colors flex-shrink-0" />}
                </div>
              );

              return (
                <StaggerItem key={item.id}>
                  {link ? <Link to={link} className="block">{content}</Link> : content}
                </StaggerItem>
              );
            })}
          </Stagger>

          {activity.length === 0 && posts.length === 0 && !loading && (
            <div className="text-center py-16">
              <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, hsl(var(--primary) / 0.12), hsl(var(--primary) / 0.04))' }}>
                <Newspaper className="w-7 h-7 text-primary/60" />
              </div>
              <p className="text-sm font-semibold text-foreground/70 mb-1">No activity yet</p>
              <p className="text-xs text-muted-foreground/60 mb-4">Start a discussion or create something to get the feed going</p>
              <Link to="/posts/create">
                <Button size="sm" variant="outline" className="gap-1.5 text-xs rounded-xl">
                  <Plus className="w-3.5 h-3.5" /> Start a Discussion
                </Button>
              </Link>
            </div>
          )}
        </div>
        )}
          </div>{/* /lg right column — Activity */}
        </div>{/* /lg 2-col grid */}
      </motion.div>
    </div>
  );
}
