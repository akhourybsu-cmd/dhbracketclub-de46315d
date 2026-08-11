import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSoundEffect } from '@/hooks/useSoundEffect';
import { toast } from 'sonner';
import type { Message } from '@/components/chat/types';
import { notifyReaction } from '@/lib/chatNotifications';

interface UseChatActionsOptions {
  /** Setter for the main messages array — used by optimistic
   *  reaction toggling so the UI updates in the same frame as the
   *  tap. Required: reactions are always optimistic. */
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  /** Shared echo set keyed by `${messageId}:${emoji}:${action}`.
   *  Whenever we optimistically toggle a reaction here, we record an
   *  entry; useChatRealtime checks the set and skips its own apply
   *  when an INSERT/DELETE comes back as the echo of our optimistic
   *  action. Prevents double-counting. */
  reactionEchoRef: React.RefObject<Set<string>>;
}

export function useChatActions(userId: string | undefined, opts: UseChatActionsOptions) {
  const { play } = useSoundEffect();
  const { setMessages, reactionEchoRef } = opts;

  // Edit state
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  // Helper — applies the local optimistic toggle and returns whether
  // the user was already reacted (so the caller knows which DB op to
  // run). Read-modify-write happens inside the setMessages updater
  // closure so we always see fresh state even if the user mashes the
  // button.
  const applyOptimisticToggle = useCallback((messageId: string, emoji: string): 'added' | 'removed' | null => {
    let action: 'added' | 'removed' | null = null;
    setMessages(prev => prev.map(m => {
      if (m.id !== messageId) return m;
      const reactions = [...(m.reactions || [])];
      const existing = reactions.find(rx => rx.emoji === emoji);
      if (existing?.user_reacted) {
        action = 'removed';
        existing.count--;
        existing.user_reacted = false;
        return {
          ...m,
          reactions: existing.count <= 0 ? reactions.filter(rx => rx.emoji !== emoji) : reactions,
        };
      } else if (existing) {
        action = 'added';
        existing.count++;
        existing.user_reacted = true;
        return { ...m, reactions };
      } else {
        action = 'added';
        return { ...m, reactions: [...reactions, { emoji, count: 1, user_reacted: true }] };
      }
    }));
    return action;
  }, [setMessages]);

  const toggleReaction = useCallback(async (messageId: string, emoji: string) => {
    if (!userId) return;
    play('tap');

    // 1. Optimistic local toggle — visible in the same frame as the
    //    tap. If setMessages wasn't wired (legacy callsites), we fall
    //    through to the slower request-first path below.
    const action = applyOptimisticToggle(messageId, emoji);

    // 2. Record the echo so the realtime listener can dedup the
    //    INSERT/DELETE event that's about to come back for OUR own
    //    user_id + emoji + message.
    if (action && reactionEchoRef?.current) {
      reactionEchoRef.current.add(`${messageId}:${emoji}:${action === 'added' ? 'add' : 'remove'}`);
    }

    // 3. Run the DB call. If anything fails, roll the optimistic
    //    state back AND clear the echo (so a later genuine state
    //    update doesn't get swallowed).
    try {
      if (action === 'removed') {
        const { data: existing } = await supabase
          .from('message_reactions').select('id')
          .eq('message_id', messageId).eq('user_id', userId).eq('emoji', emoji)
          .maybeSingle();
        if (existing) await supabase.from('message_reactions').delete().eq('id', existing.id);
        return; // un-reacting never sends a notification
      }
      await supabase.from('message_reactions').insert({ message_id: messageId, user_id: userId, emoji });
    } catch (err) {
      // Rollback: re-apply the inverse toggle locally and clear the
      // echo entry so the system snaps back to truth.
      if (action) {
        reactionEchoRef?.current?.delete(`${messageId}:${emoji}:${action === 'added' ? 'add' : 'remove'}`);
        applyOptimisticToggle(messageId, emoji);
      }
      toast.error('Reaction failed');
      return;
    }

    // 4. Personal push to the message author only (skips self-reactions).
    // Tag-grouped per-message so emoji-spam coalesces into one notification.
    if (action === 'added') {
      try {
        const [{ data: msg }, { data: reactor }] = await Promise.all([
          supabase.from('messages').select('user_id, channel_id').eq('id', messageId).maybeSingle(),
          supabase.from('profiles').select('display_name').eq('id', userId).maybeSingle(),
        ]);
        if (msg && msg.user_id && msg.user_id !== userId) {
          await notifyReaction({
            messageId,
            channelId: msg.channel_id,
            authorId: msg.user_id,
            reactorId: userId,
            reactorDisplayName: reactor?.display_name || 'Someone',
            emoji,
          });
        }
      } catch { /* fire-and-forget */ }
    }
  }, [userId, play, applyOptimisticToggle, reactionEchoRef]);

  const togglePin = useCallback(async (msg: Message) => {
    if (!userId) return;
    play('tap');
    const wasPinned = msg.is_pinned;
    const { error } = await supabase.rpc('toggle_message_pin', { p_message_id: msg.id });
    if (error) {
      toast.error('Failed to pin message');
    } else {
      toast.success(wasPinned ? 'Unpinned' : 'Pinned');
    }
  }, [userId, play]);

  const deleteMessage = useCallback(async (msgId: string) => {
    // DB cascades handle replies and reactions automatically
    await supabase.from('messages').delete().eq('id', msgId);
  }, []);

  const startEditing = useCallback((msg: Message) => {
    setEditingMessageId(msg.id);
    setEditContent(msg.content);
  }, []);

  const handleSaveEdit = useCallback(async (msgId: string, content: string) => {
    if (!content.trim()) return;
    play('tap');
    await supabase.from('messages').update({ content: content.trim(), edited_at: new Date().toISOString() }).eq('id', msgId);
    setEditingMessageId(null);
    setEditContent('');
    toast.success('Message edited');
  }, [play]);

  const cancelEdit = useCallback(() => {
    setEditingMessageId(null);
    setEditContent('');
  }, []);

  return {
    play,
    toggleReaction,
    togglePin,
    deleteMessage,
    startEditing,
    handleSaveEdit,
    editingMessageId,
    editContent,
    setEditContent,
    cancelEdit,
  };
}
