import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Channel, Category, ChannelMeta } from '@/components/chat/types';
import type { MentionMember, MessageComposerHandle } from '@/components/chat/MessageComposer';

interface UseChatChannelsOptions {
  userId: string | undefined;
  isClubAdmin: boolean;
  play: (sound: string) => void;
  composerRef: RefObject<MessageComposerHandle | null>;
  /** Latest member list, for resolving author names in the live-preview
   *  realtime handler without re-subscribing. */
  membersRef: RefObject<MentionMember[]>;
  /** Clears every OTHER channel-scoped concern (messages, thread, pinned,
   *  search, edit, draft, last-read) when switching channels. Owned by the
   *  page so this hook stays focused on channel data. */
  onSwitchChannel: () => void;
}

/**
 * Owns channel + category data: the initial fetch, per-channel preview/unread
 * metadata (kept live via a global INSERT subscription), channel selection,
 * and admin CRUD. Everything the channel list needs, in one place.
 */
export function useChatChannels({
  userId, isClubAdmin, play, composerRef, membersRef, onSwitchChannel,
}: UseChatChannelsOptions) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [channelMeta, setChannelMeta] = useState<Map<string, ChannelMeta>>(new Map());
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [showChannelList, setShowChannelList] = useState(true);
  const [loading, setLoading] = useState(true);

  const selectedChannelRef = useRef<Channel | null>(null);
  selectedChannelRef.current = selectedChannel;
  const selectedIdRef = useRef<string | null>(null);
  selectedIdRef.current = selectedChannel?.id || null;
  // Mirror channels so stable callbacks (delete) read the latest list.
  const channelsRef = useRef<Channel[]>([]);
  channelsRef.current = channels;

  const fetchChannels = useCallback(async () => {
    if (!userId) return;
    const [{ data: cats }, { data: chs }] = await Promise.all([
      supabase.from('channel_categories').select('*').order('position'),
      supabase.from('channels').select('*').order('position'),
    ]);
    if (cats) setCategories(cats);
    if (chs) {
      // Hide admin_only channels from non-admins (RLS doesn't gate this — channels are club-scoped only).
      const visibleChs = (chs as Channel[]).filter(c => c.channel_type !== 'admin_only' || isClubAdmin);
      setChannels(visibleChs);
      const chIds = visibleChs.map((c: any) => c.id);
      const { data: lastMsgs } = await supabase
        .from('messages')
        .select('channel_id, content, created_at, user_id, profiles:user_id(display_name)')
        .is('parent_message_id', null)
        .in('channel_id', chIds)
        .order('created_at', { ascending: false })
        .limit(200);

      let readStatesMap = new Map<string, string>();
      try {
        const { data: rsData } = await supabase.from('channel_read_states' as any).select('channel_id, last_read_at').eq('user_id', userId).in('channel_id', chIds);
        if (rsData) (rsData as any[]).forEach((rs: any) => readStatesMap.set(rs.channel_id, rs.last_read_at));
      } catch {}

      const meta = new Map<string, ChannelMeta>();
      const seenChannels = new Set<string>();
      if (lastMsgs) {
        lastMsgs.forEach((m: any) => {
          if (!seenChannels.has(m.channel_id)) {
            seenChannels.add(m.channel_id);
            const lastRead = readStatesMap.get(m.channel_id);
            const fromMe = m.user_id === userId;
            // Unread ONLY when latest message is from someone else AND is newer than last_read_at
            const isUnread = !fromMe && (!lastRead || new Date(m.created_at) > new Date(lastRead));
            meta.set(m.channel_id, {
              lastMessage: m.content,
              lastMessageAt: m.created_at,
              lastAuthor: m.profiles?.display_name || '',
              lastAuthorId: m.user_id,
              unread: isUnread,
            });
          }
        });
      }
      chIds.forEach((id: string) => { if (!meta.has(id)) meta.set(id, { unread: false }); });
      setChannelMeta(meta);

      // Only auto-select on initial load (no channel selected yet).
      // On mobile we keep the user on the channel-list view so nothing feels artificially "active";
      // on desktop we auto-open the saved/default channel because the sidebar always shows the list.
      if (!selectedChannelRef.current) {
        const isDesktop = typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches;
        let target: Channel | undefined;
        try {
          const savedId = localStorage.getItem('last_chat_channel_id');
          if (savedId) target = visibleChs.find(c => c.id === savedId);
        } catch {}
        if (!target) target = visibleChs.find(c => c.is_default) || (chs[0] as Channel);
        if (target) {
          setSelectedChannel(target);
          if (isDesktop) setShowChannelList(false);
        }
      } else {
        // If the currently selected channel still exists, refresh its data from the fetch
        const refreshed = visibleChs.find(c => c.id === selectedChannelRef.current!.id);
        if (refreshed) setSelectedChannel(refreshed);
      }
    }
    setLoading(false);
  }, [userId, isClubAdmin]);

  useEffect(() => { fetchChannels(); }, [fetchChannels]);

  /* ═══ GLOBAL REALTIME — keep channel previews live across ALL channels ═══ */
  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel('chat-channel-previews')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload) => {
        const m = payload.new as any;
        if (m.parent_message_id) return; // threads don't update channel previews
        // Look up author name from cached members ref; only fetch from DB if unknown
        const cachedMember = membersRef.current?.find(mb => mb.id === m.user_id);
        let authorName = cachedMember?.display_name || '';
        if (!cachedMember) {
          const { data: prof } = await supabase.from('profiles').select('display_name').eq('id', m.user_id).maybeSingle();
          authorName = prof?.display_name || '';
        }
        setChannelMeta(prev => {
          const next = new Map(prev);
          const existing = next.get(m.channel_id) || { unread: false };
          const isViewing = selectedIdRef.current === m.channel_id;
          const fromMe = m.user_id === userId;
          next.set(m.channel_id, {
            ...existing,
            lastMessage: m.content,
            lastMessageAt: m.created_at,
            lastAuthor: authorName,
            lastAuthorId: m.user_id,
            // Never unread for self-sent or actively-viewed channels.
            // Self-sent messages also clear any prior unread state for this user.
            unread: fromMe ? false : (isViewing ? false : true),
          });
          return next;
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId, membersRef]);

  const handleCreateChannel = useCallback(async (name: string, categoryId: string) => {
    if (!userId) return;
    play('success');
    await supabase.from('channels').insert({ name, category_id: categoryId || null, created_by: userId, position: channels.length });
    fetchChannels();
  }, [userId, play, channels.length, fetchChannels]);

  const handleEditChannel = useCallback(async (channelId: string, newName: string) => {
    if (!userId) return;
    const { error } = await supabase.from('channels').update({ name: newName }).eq('id', channelId);
    if (error) {
      toast.error('Failed to rename channel');
    } else {
      play('success');
      toast.success('Channel renamed');
      setChannels(prev => prev.map(ch => ch.id === channelId ? { ...ch, name: newName } : ch));
      setSelectedChannel(prev => prev && prev.id === channelId ? { ...prev, name: newName } : prev);
    }
  }, [userId, play]);

  const handleUpdateChannel = useCallback(async (
    channelId: string,
    updates: Partial<Pick<Channel, 'name' | 'description' | 'icon' | 'category_id' | 'is_default' | 'channel_type' | 'post_permission'>>,
  ): Promise<boolean> => {
    if (!userId) return false;
    const { error } = await supabase.from('channels').update(updates as any).eq('id', channelId);
    if (error) {
      toast.error('Failed to update channel');
      return false;
    }
    play('success');
    toast.success('Channel updated');
    setChannels(prev => prev.map(ch => ch.id === channelId ? { ...ch, ...updates } : ch));
    setSelectedChannel(prev => prev && prev.id === channelId ? { ...prev, ...updates } as Channel : prev);
    return true;
  }, [userId, play]);

  const handleDeleteChannel = useCallback(async (channelId: string) => {
    if (!userId) return;
    // messages.channel_id has ON DELETE CASCADE — no need to nuke rows client-side.
    const { error } = await supabase.from('channels').delete().eq('id', channelId);
    if (error) {
      toast.error('Failed to delete channel');
    } else {
      play('success');
      toast.success('Channel deleted');
      const remaining = channelsRef.current.filter(ch => ch.id !== channelId);
      setChannels(remaining);
      if (selectedChannelRef.current?.id === channelId) {
        const def = remaining.find(c => c.is_default) || remaining[0] || null;
        setSelectedChannel(def);
        if (!def) setShowChannelList(true);
      }
    }
  }, [userId, play]);

  const handleCreateCategory = useCallback(async (name: string) => {
    if (!userId) return;
    const { error } = await supabase.from('channel_categories').insert({ name, position: categories.length });
    if (error) {
      toast.error('Failed to create category');
    } else {
      play('success');
      fetchChannels();
    }
  }, [userId, play, categories.length, fetchChannels]);

  const handleReorderChannels = useCallback(async (categoryId: string, reordered: Channel[]) => {
    setChannels(prev => {
      const others = prev.filter(ch => ch.category_id !== categoryId);
      const updated = reordered.map((ch, i) => ({ ...ch, position: i }));
      return [...others, ...updated].sort((a, b) => a.position - b.position);
    });
    await Promise.all(
      reordered.map((ch, i) =>
        supabase.from('channels').update({ position: i }).eq('id', ch.id)
      )
    );
  }, []);

  const selectChannel = useCallback((ch: Channel) => {
    if (ch.id === selectedChannelRef.current?.id) {
      // Already on this channel — just close mobile list
      setShowChannelList(false);
      return;
    }
    setSelectedChannel(ch);
    // Clear every other channel-scoped concern (messages/thread/search/edit/…).
    onSwitchChannel();
    try { localStorage.setItem('last_chat_channel_id', ch.id); } catch {}
    // Optimistically clear unread dot for the channel we're entering
    setChannelMeta(prev => {
      const next = new Map(prev);
      const m = next.get(ch.id);
      if (m?.unread) next.set(ch.id, { ...m, unread: false });
      return next;
    });
    setShowChannelList(false);
    play('tap');
    const isDesktop = window.matchMedia('(min-width: 1024px)').matches;
    if (isDesktop) {
      setTimeout(() => composerRef.current?.focus(), 200);
    }
  }, [onSwitchChannel, play, composerRef]);

  return {
    channels, setChannels,
    categories,
    channelMeta, setChannelMeta,
    selectedChannel, setSelectedChannel,
    showChannelList, setShowChannelList,
    loading,
    fetchChannels,
    selectChannel,
    handleCreateChannel,
    handleEditChannel,
    handleUpdateChannel,
    handleDeleteChannel,
    handleCreateCategory,
    handleReorderChannels,
  };
}
