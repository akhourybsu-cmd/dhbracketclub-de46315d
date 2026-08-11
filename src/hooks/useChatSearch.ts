import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Message } from '@/components/chat/types';

/**
 * Debounced, DB-side message search scoped to the active channel.
 * `searchResults` is null when search is inactive (so callers can render the
 * live message list) and an array (possibly empty) when a query is running.
 */
export function useChatSearch(selectedChannelId: string | undefined) {
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Message[] | null>(null);

  // Switching channels closes and clears search — before paint, so the old
  // channel's results never flash under the new channel's header.
  useLayoutEffect(() => {
    setShowSearch(false);
    setSearchQuery('');
    setSearchResults(null);
  }, [selectedChannelId]);

  useEffect(() => {
    if (!showSearch || !searchQuery.trim() || !selectedChannelId) {
      setSearchResults(null);
      return;
    }
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('messages')
        .select('*, profiles:user_id(display_name, avatar_url)')
        .eq('channel_id', selectedChannelId)
        .is('parent_message_id', null)
        .ilike('content', `%${searchQuery}%`)
        .order('created_at', { ascending: true })
        .limit(50);
      if (data) {
        setSearchResults(data.map(m => ({ ...m, reply_count: 0, reactions: [] })));
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, showSearch, selectedChannelId]);

  const resetSearch = useCallback(() => {
    setShowSearch(false);
    setSearchQuery('');
    setSearchResults(null);
  }, []);

  return {
    showSearch, setShowSearch,
    searchQuery, setSearchQuery,
    searchResults, setSearchResults,
    resetSearch,
  };
}
