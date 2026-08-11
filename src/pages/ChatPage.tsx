import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useClub } from '@/contexts/ClubContext';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

import { AnimatePresence, motion } from 'framer-motion';
import { Hash, ChevronLeft, Pin, Search, X, Link2, Settings, Menu, Lock, MoreVertical, Bell } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { getChannelTypeMeta } from '@/components/chat/channelTypeMeta';
import { StatusPill } from '@/components/ui/status-pill';
import { useNavigate } from 'react-router-dom';
import { useNavDrawer } from '@/contexts/NavDrawerContext';
import { format } from 'date-fns';
import { toast } from 'sonner';

import { ChannelList } from '@/components/chat/ChannelList';
import { MessageList } from '@/components/chat/MessageList';
import { MessageComposer, type MessageComposerHandle, type MentionMember } from '@/components/chat/MessageComposer';
import { ThreadPanel } from '@/components/chat/ThreadPanel';
import { UserAvatar } from '@/components/chat/UserAvatar';
import { ChannelSettingsDialog } from '@/components/chat/ChannelSettingsDialog';
import { CHANNEL_EMOJI } from '@/components/chat/types';
import type { Channel, Category, ChannelMeta, Message } from '@/components/chat/types';

import { useChatMessages } from '@/hooks/useChatMessages';
import { useChatRealtime, useChatTyping } from '@/hooks/useChatRealtime';
import { useChatActions } from '@/hooks/useChatActions';
import { notifyThreadReply } from '@/lib/chatNotifications';
import { applySlashCommand } from '@/lib/chatSlashCommands';
import { useClubPresence } from '@/hooks/useClubPresence';

export default function ChatPage() {
  const { user } = useAuth();
  const { isClubAdmin, club } = useClub();
  const navigate = useNavigate();
  const { setOpen: setNavDrawerOpen } = useNavDrawer();
  const composerRef = useRef<MessageComposerHandle>(null);

  // Dynamic viewport height to handle mobile keyboard
  const [chatHeight, setChatHeight] = useState<string>('calc(100dvh - env(safe-area-inset-top, 0px))');
  const [scrollToBottomTrigger, setScrollToBottomTrigger] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const isDesktop = () => window.matchMedia('(min-width: 1024px)').matches;

    const update = () => {
      requestAnimationFrame(() => {
        const viewportHeight = vv.height + vv.offsetTop;
        const keyboardInset = Math.max(0, window.innerHeight - viewportHeight);
        // Bottom nav is gone; only reserve space for safe-area when keyboard closed.
        const mobileBottomOffset = 0;
        const nextHeight = isDesktop()
          ? viewportHeight
          : Math.max(220, viewportHeight - mobileBottomOffset);

        setChatHeight(`${nextHeight}px`);
        setScrollToBottomTrigger(c => c + 1);
      });
    };

    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    window.addEventListener('resize', update);

    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  const [channels, setChannels] = useState<Channel[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [channelMeta, setChannelMeta] = useState<Map<string, ChannelMeta>>(new Map());
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [showChannelList, setShowChannelList] = useState(true);
  const [loading, setLoading] = useState(true);

  const [newMessage, setNewMessage] = useState('');

  // Thread
  const [threadParent, setThreadParent] = useState<Message | null>(null);
  const [threadMessages, setThreadMessages] = useState<Message[]>([]);
  const [threadReply, setThreadReply] = useState('');
  const threadParentRef = useRef<Message | null>(null);
  threadParentRef.current = threadParent;

  // Pinned
  const [showPinned, setShowPinned] = useState(false);
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [searchResults, setSearchResults] = useState<Message[] | null>(null);

  // Members for @mention autocomplete
  const [members, setMembers] = useState<MentionMember[]>([]);
  const membersRef = useRef<MentionMember[]>([]);
  useEffect(() => { membersRef.current = members; }, [members]);
  const [currentDisplayName, setCurrentDisplayName] = useState<string>('');

  // Last read timestamp for unread divider
  const [lastReadAt, setLastReadAt] = useState<string | null>(null);

  // Channel settings dialog
  const [settingsChannel, setSettingsChannel] = useState<Channel | null>(null);

  // ═══ HOOKS ═══
  const {
    messages, setMessages, hasMore, loadingMore, fetchMessages, loadOlderMessages,
  } = useChatMessages(user?.id);

  // Shared echo set so optimistic reaction toggles (useChatActions)
  // and realtime listeners (useChatRealtime) cooperate. When we
  // optimistically apply a reaction, we record the action here; the
  // realtime listener checks the set and skips applying its own
  // echo, preventing double-counting.
  const reactionEchoRef = useRef<Set<string>>(new Set());

  const {
    play, toggleReaction, togglePin, deleteMessage,
    startEditing, handleSaveEdit,
    editingMessageId, editContent, setEditContent, cancelEdit,
  } = useChatActions(user?.id, { setMessages, reactionEchoRef });

  useChatRealtime({
    channelId: selectedChannel?.id,
    userId: user?.id,
    members,
    play,
    setMessages,
    threadParentRef,
    setThreadMessages,
    reactionEchoRef,
  });

  const { typingUsers, broadcastTyping } = useChatTyping(
    selectedChannel?.id,
    user?.id,
    currentDisplayName || user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'Someone',
  );

  // Club-wide presence — drives the green online dot on message
  // avatars (Discord-style). Reuses the same presence channel that
  // the Home page's MembersOnline strip uses, so opening Chat
  // doesn't fire a second WebSocket.
  const { onlineIds } = useClubPresence({
    displayName: currentDisplayName || user?.user_metadata?.display_name || undefined,
    avatarUrl: user?.user_metadata?.avatar_url || null,
  });

  /* ═══ FETCH CHANNELS ═══ */
  const selectedChannelRef = useRef<Channel | null>(null);
  selectedChannelRef.current = selectedChannel;

  const fetchChannels = useCallback(async () => {
    if (!user) return;
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
        const { data: rsData } = await supabase.from('channel_read_states' as any).select('channel_id, last_read_at').eq('user_id', user.id).in('channel_id', chIds);
        if (rsData) (rsData as any[]).forEach((rs: any) => readStatesMap.set(rs.channel_id, rs.last_read_at));
      } catch {}

      const meta = new Map<string, ChannelMeta>();
      const seenChannels = new Set<string>();
      if (lastMsgs) {
        lastMsgs.forEach((m: any) => {
          if (!seenChannels.has(m.channel_id)) {
            seenChannels.add(m.channel_id);
            const lastRead = readStatesMap.get(m.channel_id);
            const fromMe = m.user_id === user.id;
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
  }, [user, isClubAdmin]);

  useEffect(() => { fetchChannels(); }, [fetchChannels]);

  /* ═══ GLOBAL REALTIME — keep channel previews live across ALL channels ═══ */
  const selectedIdRef = useRef<string | null>(null);
  selectedIdRef.current = selectedChannel?.id || null;
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel('chat-channel-previews')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload) => {
        const m = payload.new as any;
        if (m.parent_message_id) return; // threads don't update channel previews
        // Look up author name from cached members ref; only fetch from DB if unknown
        const cachedMember = membersRef.current.find(mb => mb.id === m.user_id);
        let authorName = cachedMember?.display_name || '';
        if (!cachedMember) {
          const { data: prof } = await supabase.from('profiles').select('display_name').eq('id', m.user_id).maybeSingle();
          authorName = prof?.display_name || '';
        }
        setChannelMeta(prev => {
          const next = new Map(prev);
          const existing = next.get(m.channel_id) || { unread: false };
          const isViewing = selectedIdRef.current === m.channel_id;
          const fromMe = m.user_id === user.id;
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
  }, [user]);
  useEffect(() => {
    if (!user || !club?.id) return;
    (async () => {
      const { data: memberRows } = await supabase
        .from('club_members')
        .select('user_id, profiles:user_id(id, display_name, avatar_url)')
        .eq('club_id', club.id);
      if (memberRows) {
        const list = memberRows
          .map((r: any) => r.profiles)
          .filter((p: any) => p && p.id && p.display_name);
        setMembers(list.map((p: any) => ({ id: p.id, display_name: p.display_name, avatar_url: p.avatar_url })));
        const me = list.find((p: any) => p.id === user.id);
        if (me) setCurrentDisplayName(me.display_name);
      }
    })();
  }, [user, club?.id]);

  /* ═══ FETCH MESSAGES ═══ */
  useEffect(() => {
    if (!selectedChannel || !user) return;

    fetchMessages(selectedChannel.id).then(async () => {
      // Capture lastReadAt BEFORE updating read state
      try {
        const sb = supabase as any;
        const { data: existing } = await sb.from('channel_read_states').select('id, last_read_at').eq('channel_id', selectedChannel.id).eq('user_id', user.id).maybeSingle();
        if (existing) {
          setLastReadAt(existing.last_read_at);
          await sb.from('channel_read_states').update({ last_read_at: new Date().toISOString() }).eq('id', existing.id);
        } else {
          setLastReadAt(null);
          await sb.from('channel_read_states').insert({ channel_id: selectedChannel.id, user_id: user.id });
        }
      } catch {}

      setChannelMeta(prev => {
        const next = new Map(prev);
        const m = next.get(selectedChannel.id);
        if (m) next.set(selectedChannel.id, { ...m, unread: false });
        return next;
      });
    });
  }, [selectedChannel?.id, user?.id]);

  const handleLoadMore = useCallback(() => {
    if (selectedChannel) loadOlderMessages(selectedChannel.id);
  }, [selectedChannel, loadOlderMessages]);

  /* ═══ ACTIONS ═══ */
  const handleSend = async (imageUrls?: string[]) => {
    const hasText = newMessage.trim().length > 0;
    const hasImages = imageUrls && imageUrls.length > 0;
    // No `sending` gate: sends are optimistic and each carries its own id,
    // so messages can be fired back-to-back like a real texting app. The
    // text is cleared synchronously below, which prevents a duplicate send
    // from a second Enter on the same content.
    if ((!hasText && !hasImages) || !selectedChannel || !user) return;
    play('tap');

    // Apply Discord-style slash command transformations (e.g.
    // "/shrug hi" → "hi ¯\_(ツ)_/¯", "/me dances" → "*dances*").
    // Non-command text is returned unchanged.
    // Build content: text + image URLs on separate lines
    let content = applySlashCommand(newMessage.trim());
    // If the slash command emitted nothing (e.g. "/me" with no text)
    // and there are no images, bail out — there's nothing to send.
    if (!content && !hasImages) {
      setNewMessage('');
      return;
    }
    if (hasImages) {
      const imgLines = imageUrls.map(url => url).join('\n');
      content = content ? `${content}\n${imgLines}` : imgLines;
    }
    setNewMessage('');

    const optimisticId = `opt-${Date.now()}`;
    const optimisticMsg: Message = {
      id: optimisticId,
      channel_id: selectedChannel.id,
      user_id: user.id,
      content,
      parent_message_id: null,
      is_pinned: false,
      created_at: new Date().toISOString(),
      edited_at: null,
      profiles: { display_name: user.user_metadata?.display_name || user.email?.split('@')[0] || 'You', avatar_url: null },
      reply_count: 0,
      reactions: [],
      _optimistic: true,
    };
    setMessages(prev => [...prev, optimisticMsg]);
    // Sending your own message always snaps you to the bottom — even if you'd
    // scrolled up to read history. Matches how every texting app behaves.
    setScrollToBottomTrigger(t => t + 1);

    const { data: inserted, error } = await supabase
      .from('messages')
      .insert({ channel_id: selectedChannel.id, user_id: user.id, content })
      .select('*, profiles:user_id(display_name, avatar_url)')
      .single();

    if (error || !inserted) {
      setMessages(prev => prev.filter(m => m.id !== optimisticId));
      toast.error('Failed to send message');
    } else {
      setMessages(prev => prev.map(m => m.id === optimisticId
        ? { ...inserted, reply_count: 0, reactions: [] }
        : m
      ));
      // Fire-and-forget: push notification + link preview generation
      supabase.functions.invoke('send-push-notification', {
        body: { record: { id: inserted.id, channel_id: inserted.channel_id, user_id: inserted.user_id, content: inserted.content } },
      }).catch(() => {});

      // Link previews are generated by LinkPreviewCard on render — no duplicate insert here
    }
  };

  const openThread = useCallback(async (msg: Message) => {
    setThreadParent(msg);
    setShowPinned(false);
    const { data } = await supabase
      .from('messages')
      .select('*, profiles:user_id(display_name, avatar_url)')
      .eq('parent_message_id', msg.id)
      .order('created_at', { ascending: true });
    setThreadMessages(data || []);
  }, []);

  const handleThreadReply = async () => {
    if (!threadReply.trim() || !threadParent || !user || !selectedChannel) return;
    play('tap');
    const content = threadReply.trim();
    setThreadReply('');

    const optimisticId = `opt-thread-${Date.now()}`;
    const optimisticReply: Message = {
      id: optimisticId,
      channel_id: selectedChannel.id,
      user_id: user.id,
      content,
      parent_message_id: threadParent.id,
      is_pinned: false,
      created_at: new Date().toISOString(),
      edited_at: null,
      profiles: { display_name: user.user_metadata?.display_name || user.email?.split('@')[0] || 'You', avatar_url: null },
      reply_count: 0,
      reactions: [],
      _optimistic: true,
    };
    setThreadMessages(prev => [...prev, optimisticReply]);

    const { data: inserted, error } = await supabase.from('messages').insert({
      channel_id: selectedChannel.id, user_id: user.id, content,
      parent_message_id: threadParent.id,
    }).select('*, profiles:user_id(display_name, avatar_url)').single();

    if (error || !inserted) {
      setThreadMessages(prev => prev.filter(m => m.id !== optimisticId));
      toast.error('Failed to send reply');
    } else {
      setThreadMessages(prev => prev.map(m => m.id === optimisticId ? { ...inserted } : m));
      // Personal-only push: parent author + prior thread participants + @mentions.
      // Does NOT broadcast to the whole channel (P0 fix preserved).
      const senderDisplayName =
        user.user_metadata?.display_name || user.email?.split('@')[0] || 'Someone';
      notifyThreadReply({
        parentMessageId: threadParent.id,
        parentAuthorId: threadParent.user_id,
        channelId: selectedChannel.id,
        senderUserId: user.id,
        senderDisplayName,
        content,
        members,
      });
    }
  };

  const handleTogglePin = useCallback(async (msg: Message) => {
    await togglePin(msg);
    if (showPinned) {
      if (msg.is_pinned) {
        setPinnedMessages(prev => prev.filter(m => m.id !== msg.id));
      } else {
        setPinnedMessages(prev => [msg, ...prev]);
      }
    }
  }, [togglePin, showPinned]);

  const loadPinnedMessages = async () => {
    if (!selectedChannel) return;
    setShowPinned(true);
    setThreadParent(null);
    const { data } = await supabase
      .from('messages')
      .select('*, profiles:user_id(display_name, avatar_url)')
      .eq('channel_id', selectedChannel.id)
      .eq('is_pinned', true)
      .order('created_at', { ascending: false });
    setPinnedMessages(data || []);
  };

  const handleCreateChannel = async (name: string, categoryId: string) => {
    if (!user) return;
    play('success');
    await supabase.from('channels').insert({ name, category_id: categoryId || null, created_by: user.id, position: channels.length });
    fetchChannels();
  };

  const handleEditChannel = async (channelId: string, newName: string) => {
    if (!user) return;
    const { error } = await supabase.from('channels').update({ name: newName }).eq('id', channelId);
    if (error) {
      toast.error('Failed to rename channel');
    } else {
      play('success');
      toast.success('Channel renamed');
      setChannels(prev => prev.map(ch => ch.id === channelId ? { ...ch, name: newName } : ch));
      if (selectedChannel?.id === channelId) {
        setSelectedChannel(prev => prev ? { ...prev, name: newName } : prev);
      }
    }
  };

  const handleUpdateChannel = async (channelId: string, updates: Partial<Pick<Channel, 'name' | 'description' | 'icon' | 'category_id' | 'is_default' | 'channel_type' | 'post_permission'>>): Promise<boolean> => {
    if (!user) return false;
    const { error } = await supabase.from('channels').update(updates as any).eq('id', channelId);
    if (error) {
      toast.error('Failed to update channel');
      return false;
    }
    play('success');
    toast.success('Channel updated');
    setChannels(prev => prev.map(ch => ch.id === channelId ? { ...ch, ...updates } : ch));
    if (selectedChannel?.id === channelId) {
      setSelectedChannel(prev => prev ? { ...prev, ...updates } as Channel : prev);
    }
    return true;
  };

  const handleDeleteChannel = async (channelId: string) => {
    if (!user) return;
    // messages.channel_id has ON DELETE CASCADE — no need to nuke rows client-side.
    const { error } = await supabase.from('channels').delete().eq('id', channelId);
    if (error) {
      toast.error('Failed to delete channel');
    } else {
      play('success');
      toast.success('Channel deleted');
      setChannels(prev => prev.filter(ch => ch.id !== channelId));
      if (selectedChannel?.id === channelId) {
        const remaining = channels.filter(ch => ch.id !== channelId);
        const def = remaining.find(c => c.is_default) || remaining[0] || null;
        setSelectedChannel(def);
        if (!def) setShowChannelList(true);
      }
    }
  };

  const handleCreateCategory = async (name: string) => {
    if (!user) return;
    const { error } = await supabase.from('channel_categories').insert({ name, position: categories.length });
    if (error) {
      toast.error('Failed to create category');
    } else {
      play('success');
      fetchChannels();
    }
  };

  const handleReorderChannels = async (categoryId: string, reordered: Channel[]) => {
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
  };

  const selectChannel = (ch: Channel) => {
    if (ch.id === selectedChannel?.id) {
      // Already on this channel — just close mobile list
      setShowChannelList(false);
      return;
    }
    // Immediately update selected channel & header
    setSelectedChannel(ch);
    // Clear all channel-specific state atomically
    setMessages([]);
    setThreadParent(null);
    setThreadMessages([]);
    setThreadReply('');
    setShowPinned(false);
    setPinnedMessages([]);
    setLastReadAt(null);
    setShowSearch(false);
    setSearchQuery('');
    setSearchResults(null);
    cancelEdit();
    setNewMessage('');
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
  };

  /* ═══ DB-SIDE SEARCH ═══ */
  useEffect(() => {
    if (!showSearch || !searchQuery.trim() || !selectedChannel) {
      setSearchResults(null);
      return;
    }
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('messages')
        .select('*, profiles:user_id(display_name, avatar_url)')
        .eq('channel_id', selectedChannel.id)
        .is('parent_message_id', null)
        .ilike('content', `%${searchQuery}%`)
        .order('created_at', { ascending: true })
        .limit(50);
      if (data) {
        setSearchResults(data.map(m => ({ ...m, reply_count: 0, reactions: [] })));
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, showSearch, selectedChannel]);

  const pinnedCount = useMemo(() => messages.filter(m => m.is_pinned).length, [messages]);
  const showSidePanel = !!threadParent || showPinned;

  const channelType = selectedChannel?.channel_type || 'general';
  const postPermission = selectedChannel?.post_permission || 'all';
  const isAnnouncement = channelType === 'announcements';
  const isAdminOnly = channelType === 'admin_only';
  const isElevated = isAnnouncement || isAdminOnly;
  const typeMeta = getChannelTypeMeta(channelType);
  const TypeIcon = typeMeta.icon;
  const canPost = postPermission === 'all' || isClubAdmin;
  const lockedReason = isAdminOnly
    ? 'Admin-only channel'
    : isAnnouncement
      ? 'Only admins can post announcements'
      : 'Only admins can post here';

  /* ═══ CHANNEL LIST VIEW (mobile only — desktop uses sidebar) ═══ */
  if (showChannelList) {
    return (
      <div className="flex overflow-hidden" style={{ height: chatHeight }}>
        <div className="w-full lg:w-[260px] lg:border-r lg:border-border/25 flex-shrink-0 overflow-y-auto">
          <ChannelList
            channels={channels}
            categories={categories}
            channelMeta={channelMeta}
            selectedChannel={selectedChannel}
            currentUserId={user?.id}
            isAdmin={isClubAdmin}
            loading={loading}
            onSelectChannel={selectChannel}
            onCreateChannel={handleCreateChannel}
            onEditChannel={handleEditChannel}
            onReorderChannels={handleReorderChannels}
            onOpenSettings={setSettingsChannel}
            onCreateCategory={handleCreateCategory}
          />
        </div>
        <div className="hidden lg:flex flex-1 items-center justify-center text-muted-foreground/50 text-sm">
          Select a channel to start chatting
        </div>
      </div>
    );
  }

  /* ═══ MESSAGE VIEW ═══ */
  return (
    <div className="flex overflow-hidden" style={{ height: chatHeight }}>
      {/* Desktop sidebar */}
      <div className="hidden lg:block w-[260px] border-r border-border/25 flex-shrink-0 overflow-y-auto">
        <ChannelList
          channels={channels}
          categories={categories}
          channelMeta={channelMeta}
          selectedChannel={selectedChannel}
          currentUserId={user?.id}
          loading={loading}
          onSelectChannel={selectChannel}
          onCreateChannel={handleCreateChannel}
          onEditChannel={handleEditChannel}
          onReorderChannels={handleReorderChannels}
          onOpenSettings={setSettingsChannel}
          onCreateCategory={handleCreateCategory}
        />
      </div>

      {/* Main content area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <div
          className="flex items-center gap-2 py-2 border-b flex-shrink-0 sticky top-0 z-10"
          style={{
            background: isElevated
              ? `linear-gradient(180deg, hsl(${typeMeta.accent} / 0.12), hsl(var(--background) / 0.9))`
              : 'hsl(var(--background) / 0.85)',
            borderColor: isElevated ? `hsl(${typeMeta.accent} / 0.35)` : 'hsl(var(--border) / 0.2)',
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            paddingTop: 'max(0.5rem, env(safe-area-inset-top, 0px))',
            paddingLeft: 'max(0.625rem, env(safe-area-inset-left, 0px))',
            paddingRight: 'max(0.625rem, env(safe-area-inset-right, 0px))',
          }}
        >
          <button onClick={() => { setShowChannelList(true); setThreadParent(null); setThreadMessages([]); setShowPinned(false); }} className="p-1.5 -ml-0.5 rounded-lg hover:bg-muted/50 active:bg-muted/70 transition-colors lg:hidden">
            <ChevronLeft className="w-5 h-5 text-foreground/70" />
          </button>
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0"
            style={{ background: `hsl(${typeMeta.accent} / ${isElevated ? 0.18 : 0.12})` }}
          >
            {isElevated
              ? <TypeIcon className="w-3.5 h-3.5" style={{ color: `hsl(${typeMeta.accent})` }} />
              : (selectedChannel?.icon && selectedChannel.icon !== 'hash')
                ? selectedChannel.icon
                : (CHANNEL_EMOJI[selectedChannel?.name || ''] || <Hash className="w-3.5 h-3.5 text-primary/80" />)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              {/* Discord-style "#" prefix on the channel name. Hidden
                  for elevated channels (announcements/admin-only) since
                  they already have a typed pill that makes their nature
                  obvious. */}
              {!isElevated && selectedChannel && (
                <span className="font-bold text-[15px] text-muted-foreground/45 leading-tight flex-shrink-0" aria-hidden>#</span>
              )}
              <h2 className="font-bold text-[15px] tracking-tight leading-tight truncate">{selectedChannel?.name}</h2>
              {isElevated && (
                <StatusPill accent={typeMeta.accent} size="xs" className="flex-shrink-0">
                  {isAnnouncement ? 'Announcements' : 'Admins'}
                </StatusPill>
              )}
            </div>
            {selectedChannel?.description && <p className="text-[10px] text-muted-foreground/70 truncate leading-tight">{selectedChannel.description}</p>}
          </div>
          {/* Desktop: individual buttons */}
          <button onClick={() => { setShowSearch(!showSearch); setSearchQuery(''); setSearchResults(null); }} className={cn("hidden sm:inline-flex p-2 rounded-full transition-colors", showSearch ? "bg-primary/15 text-primary" : "hover:bg-muted/50 text-muted-foreground/70")} title="Search messages">
            <Search className="w-[18px] h-[18px]" />
          </button>
          <button onClick={() => navigate('/shared')} className="hidden sm:inline-flex p-2 rounded-full hover:bg-muted/50 text-muted-foreground/70 transition-colors" title="Shared Media">
            <Link2 className="w-[18px] h-[18px]" />
          </button>
          {pinnedCount > 0 && (
            <button onClick={loadPinnedMessages} className={cn("hidden sm:inline-flex p-2 rounded-full transition-colors", showPinned ? "bg-premium-warm/15 text-premium-warm" : "hover:bg-muted/50 text-muted-foreground/70")} title="Pinned messages">
              <Pin className="w-[18px] h-[18px]" />
            </button>
          )}
          {selectedChannel && (
            <button onClick={() => setSettingsChannel(selectedChannel)} className="hidden sm:inline-flex p-2 rounded-full hover:bg-muted/50 text-muted-foreground/70 transition-colors" title="Channel Settings" aria-label="Channel settings">
              <Settings className="w-[18px] h-[18px]" />
            </button>
          )}

          {/* Mobile: overflow menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="sm:hidden p-2 rounded-full hover:bg-muted/50 text-muted-foreground/70 transition-colors" aria-label="Channel actions">
                <MoreVertical className="w-[18px] h-[18px]" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={() => { setShowSearch(true); setSearchQuery(''); setSearchResults(null); }}>
                <Search className="w-4 h-4 mr-2" /> Search messages
              </DropdownMenuItem>
              {pinnedCount > 0 && (
                <DropdownMenuItem onClick={loadPinnedMessages}>
                  <Pin className="w-4 h-4 mr-2" /> Pinned ({pinnedCount})
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => navigate('/shared')}>
                <Link2 className="w-4 h-4 mr-2" /> Shared media
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {selectedChannel && (
                <DropdownMenuItem onClick={() => setSettingsChannel(selectedChannel)}>
                  <Bell className="w-4 h-4 mr-2" /> Notifications & settings
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Search bar */}
        {showSearch && (
          <div className="border-b border-border/5 flex-shrink-0 px-4 sm:px-5 py-2 space-y-1">
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search messages..."
              // Mobile: h-9 (36px) so it's comfortable to focus with a
              // thumb without misfiring on the surrounding border.
              // Desktop: original h-8 keeps the header compact.
              className="h-9 lg:h-8 text-xs bg-muted/20 border-border/25 rounded-lg"
              autoFocus
            />
            {searchResults && searchResults.length > 0 && (
              <p className="text-[10px] text-muted-foreground/60 font-medium px-1">{searchResults.length} result{searchResults.length !== 1 ? 's' : ''}</p>
            )}
          </div>
        )}

        <div className="flex flex-1 min-h-0">
          {/* Message area — hide on mobile when thread/pinned is open */}
          <div className={cn("flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden", showSidePanel && "hidden lg:flex")}>
            {showPinned && !threadParent ? (
              <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold flex items-center gap-1.5">
                    <Pin className="w-3.5 h-3.5" style={{ color: 'hsl(var(--premium-warm))' }} /> Pinned Messages
                  </h3>
                  <button onClick={() => setShowPinned(false)} className="p-1 rounded-lg hover:bg-muted/50">
                    <X className="w-4 h-4 text-muted-foreground/70" />
                  </button>
                </div>
                <div className="space-y-2">
                  {pinnedMessages.map(msg => (
                    <div key={msg.id} className="glass-card p-3.5">
                      <div className="flex items-center gap-2 mb-1.5 relative z-10">
                        <UserAvatar userId={msg.user_id} name={msg.profiles?.display_name || '?'} avatarUrl={msg.profiles?.avatar_url} size={24} />
                        <span className="text-[11px] font-bold text-foreground/80">{msg.profiles?.display_name}</span>
                        <span className="text-[9px] text-muted-foreground/70">{format(new Date(msg.created_at), 'MMM d, h:mm a')}</span>
                        <button
                          onClick={() => handleTogglePin(msg)}
                          className="ml-auto p-1 rounded-md hover:bg-muted/50 transition-colors"
                          title="Unpin"
                        >
                          <Pin className="w-3 h-3 text-premium-warm" />
                        </button>
                      </div>
                      <p className="text-[13px] text-foreground/80 leading-relaxed pl-8 relative z-10">{msg.content}</p>
                    </div>
                  ))}
                  {pinnedMessages.length === 0 && <p className="text-xs text-muted-foreground/70 text-center py-8">No pinned messages</p>}
                </div>
              </div>
            ) : (
              <>
                <MessageList
                  key={selectedChannel?.id || 'none'}
                  messages={searchResults || messages}
                  selectedChannel={selectedChannel}
                  userId={user?.id}
                  currentDisplayName={currentDisplayName}
                  onlineUserIds={onlineIds}
                  onToggleReaction={toggleReaction}
                  onOpenThread={openThread}
                  onTogglePin={handleTogglePin}
                  onStartEditing={startEditing}
                  onDeleteMessage={deleteMessage}
                  onSaveEdit={handleSaveEdit}
                  editingMessageId={editingMessageId}
                  editContent={editContent}
                  onEditContentChange={setEditContent}
                  onCancelEdit={cancelEdit}
                  onLoadMore={searchResults ? undefined : handleLoadMore}
                  hasMore={searchResults ? false : hasMore}
                  loadingMore={loadingMore}
                  isSearchActive={!!searchResults}
                  lastReadAt={lastReadAt}
                  scrollToBottomTrigger={scrollToBottomTrigger}
                />
                {!searchResults && (
                  <div className="flex-shrink-0 border-t border-border/15 z-10">
                    <AnimatePresence>
                      {typingUsers.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 4 }}
                          transition={{ duration: 0.15 }}
                          className="px-4 sm:px-5 pt-1.5 pb-0 flex items-center gap-1.5"
                        >
                          <div className="flex gap-[3px] items-center">
                            {[0, 1, 2].map(i => (
                              <motion.span
                                key={i}
                                className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 block"
                                animate={{ y: [0, -4, 0] }}
                                transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
                              />
                            ))}
                          </div>
                          {/* Discord-style typing line: bold the names,
                              italicise the verb, end with an ellipsis so the
                              animation reads as in-progress speech. */}
                          <span className="text-[10px] text-muted-foreground/65 font-medium italic">
                            {typingUsers.length === 1 ? (
                              <><span className="font-bold not-italic text-foreground/80">{typingUsers[0]}</span> is typing…</>
                            ) : (
                              <><span className="font-bold not-italic text-foreground/80">{typingUsers.join(', ')}</span> are typing…</>
                            )}
                          </span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <AnimatePresence initial={false} mode="wait">
                      {canPost ? (
                        <motion.div
                          key="composer"
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 6 }}
                          transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                        >
                          <MessageComposer
                            ref={composerRef}
                            value={newMessage}
                            onChange={setNewMessage}
                            onSend={handleSend}
                            onTyping={broadcastTyping}
                            placeholder={isAnnouncement ? `Post an announcement to #${selectedChannel?.name || ''}` : `Message #${selectedChannel?.name || ''}`}
                            members={members}
                            userId={user?.id}
                          />
                        </motion.div>
                      ) : (
                        <motion.div
                          key="locked"
                          role="status"
                          aria-live="polite"
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 6 }}
                          transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                          className="flex items-center gap-2 px-4 py-3 text-[12px] font-semibold text-muted-foreground/80"
                          style={{
                            background: 'hsl(var(--muted) / 0.3)',
                            borderTop: '1px solid hsl(var(--border) / 0.2)',
                            paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))',
                          }}
                        >
                          <Lock className="w-3.5 h-3.5 text-muted-foreground/60 flex-shrink-0" aria-hidden="true" />
                          <span>{lockedReason}</span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Thread side panel — show full-screen on mobile */}
          <AnimatePresence>
            {threadParent && (
              <div className={cn("flex flex-col min-h-0", "w-full lg:w-auto")}>
                <ThreadPanel
                  parent={threadParent}
                  replies={threadMessages}
                  replyValue={threadReply}
                  onReplyChange={setThreadReply}
                  onSendReply={handleThreadReply}
                  onClose={() => { setThreadParent(null); const isDesktop = window.matchMedia('(min-width: 1024px)').matches; if (isDesktop) setTimeout(() => composerRef.current?.focus(), 100); }}
                />
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
      {settingsChannel && (
        <ChannelSettingsDialog
          channel={settingsChannel}
          categories={categories}
          open={!!settingsChannel}
          isAdmin={isClubAdmin}
          onOpenChange={(open) => { if (!open) setSettingsChannel(null); }}
          onUpdate={handleUpdateChannel}
          onDelete={handleDeleteChannel}
        />
      )}
    </div>
  );
}
