import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { MentionMember } from '@/components/chat/MessageComposer';

/**
 * Club members for @mention autocomplete + the current user's display name.
 * `membersRef` mirrors `members` so long-lived callbacks (realtime handlers)
 * can read the latest list without re-subscribing.
 */
export function useChatMembers(userId: string | undefined, clubId: string | undefined) {
  const [members, setMembers] = useState<MentionMember[]>([]);
  const membersRef = useRef<MentionMember[]>([]);
  const [currentDisplayName, setCurrentDisplayName] = useState<string>('');

  useEffect(() => { membersRef.current = members; }, [members]);

  useEffect(() => {
    if (!userId || !clubId) return;
    (async () => {
      const { data: memberRows } = await supabase
        .from('club_members')
        .select('user_id, profiles:user_id(id, display_name, avatar_url)')
        .eq('club_id', clubId);
      if (memberRows) {
        const list = memberRows
          .map((r: any) => r.profiles)
          .filter((p: any) => p && p.id && p.display_name);
        setMembers(list.map((p: any) => ({ id: p.id, display_name: p.display_name, avatar_url: p.avatar_url })));
        const me = list.find((p: any) => p.id === userId);
        if (me) setCurrentDisplayName(me.display_name);
      }
    })();
  }, [userId, clubId]);

  return { members, membersRef, currentDisplayName };
}
