import { useState, useRef, useCallback, useEffect, useLayoutEffect, Fragment, memo, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useMotionValue, useTransform, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import {
  Pin, Reply, Trash2, Pencil, Check, X, MessageSquare, Loader2, Flag,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { UserAvatar, getUserColor } from './UserAvatar';
import type { Message } from './types';
import { QUICK_EMOJIS } from './types';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { parseMessageLinks } from '@/lib/linkParser';
import { LinkPreviewCard } from './LinkPreviewCard';
import { ChatAttachmentImage } from './ChatAttachmentImage';
import { isPrivateAttachmentUrl } from '@/lib/chatAttachments';

/* ═══ URL auto-linking + inline image preview ═══ */
const URL_RE = /((?:https?|lovable-private):\/\/[^\s<]+)/g;
const IMAGE_EXT_RE = /\.(jpg|jpeg|png|gif|webp|avif|svg)(\?.*)?$/i;
const STORAGE_IMAGE_RE = /\/storage\/v1\/object\/public\/chat-attachments\//i;

function isImageUrl(url: string): boolean {
  return IMAGE_EXT_RE.test(url) || STORAGE_IMAGE_RE.test(url) || isPrivateAttachmentUrl(url);
}

function stripImageUrls(text: string): string {
  return text.replace(URL_RE, match => isImageUrl(match) ? '' : match).replace(/\n{2,}/g, '\n').trim();
}

const MENTION_RE = /@([\w\s]+?)(?=\s@|\s|$)/g;

/* ═══ Markdown layer ═══
 *
 * Layered on TOP of the existing URL + mention pipeline so the
 * established behaviour stays exactly the same — markdown just
 * pre-wraps plain-text segments with styling spans before they're
 * passed to the URL/mention renderer.
 *
 * Order of operations (Discord-style):
 *   1. Extract triple-backtick code blocks (block-level, opaque)
 *   2. On the remaining text:
 *      a. Inline tokens — `code`, **bold**, *italic*, ~~strike~~
 *      b. URLs (existing)
 *      c. @mentions (existing)
 *
 * Code blocks are completely opaque to URL/mention parsing — content
 * inside triple-backticks renders verbatim, which matches Discord.
 */

const CODE_BLOCK_RE = /```([a-zA-Z0-9_-]*)\r?\n?([\s\S]*?)```/g;
const INLINE_TOKEN_PATTERNS: Array<{ type: 'code' | 'bold' | 'strike' | 'italic'; re: RegExp }> = [
  // Order matters: `code` first so backtick-wrapped content is opaque,
  // **bold** before *italic* so ** isn't confused with two italic *s,
  // ~~strike~~ standalone.
  { type: 'code',   re: /`([^`\n]+?)`/ },
  { type: 'bold',   re: /\*\*([^*\n]+?)\*\*/ },
  { type: 'strike', re: /~~([^~\n]+?)~~/ },
  { type: 'italic', re: /(?<!\*)\*([^*\n]+?)\*(?!\*)/ },
];

interface InlineToken { type: 'text' | 'code' | 'bold' | 'strike' | 'italic'; value: string }

function tokenizeInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    let earliest: { idx: number; type: InlineToken['type']; raw: string; inner: string } | null = null;
    for (const p of INLINE_TOKEN_PATTERNS) {
      const re = new RegExp(p.re.source, 'g');
      re.lastIndex = cursor;
      const m = re.exec(text);
      if (m && (!earliest || m.index < earliest.idx)) {
        earliest = { idx: m.index, type: p.type, raw: m[0], inner: m[1] };
      }
    }
    if (!earliest) {
      tokens.push({ type: 'text', value: text.slice(cursor) });
      break;
    }
    if (earliest.idx > cursor) tokens.push({ type: 'text', value: text.slice(cursor, earliest.idx) });
    tokens.push({ type: earliest.type, value: earliest.inner });
    cursor = earliest.idx + earliest.raw.length;
  }
  return tokens;
}

function renderInlineTokens(text: string, currentDisplayName?: string, keyPrefix = ''): React.ReactNode[] {
  const tokens = tokenizeInline(text);
  return tokens.map((t, i) => {
    const k = `${keyPrefix}-tok-${i}`;
    switch (t.type) {
      case 'code':
        return (
          <code key={k} className="px-1 py-0.5 rounded text-[12.5px] font-mono bg-black/[0.08] dark:bg-black/40 text-foreground/95">
            {t.value}
          </code>
        );
      case 'bold':
        return <strong key={k} className="font-extrabold">{renderUrlsAndMentions(t.value, currentDisplayName, k)}</strong>;
      case 'italic':
        return <em key={k} className="italic">{renderUrlsAndMentions(t.value, currentDisplayName, k)}</em>;
      case 'strike':
        return <span key={k} className="line-through opacity-75">{renderUrlsAndMentions(t.value, currentDisplayName, k)}</span>;
      case 'text':
      default:
        return <Fragment key={k}>{renderUrlsAndMentions(t.value, currentDisplayName, k)}</Fragment>;
    }
  });
}

// Renders URLs + mentions on a plain-text leaf — exactly what the
// previous `renderContent` did, just extracted so the markdown layer
// can call it for each text token.
function renderUrlsAndMentions(text: string, currentDisplayName?: string, keyPrefix = ''): React.ReactNode {
  const urlParts = text.split(URL_RE);
  if (urlParts.length === 1) return renderMentions(text, currentDisplayName);
  return urlParts.map((part, i) =>
    URL_RE.test(part) ? (
      <a key={`${keyPrefix}-url-${i}`} href={part} target="_blank" rel="noopener noreferrer"
        className="text-primary underline underline-offset-2 hover:text-primary/80 break-all"
        onClick={e => e.stopPropagation()}>{part}</a>
    ) : (
      <Fragment key={`${keyPrefix}-txt-${i}`}>{renderMentions(part, currentDisplayName, i)}</Fragment>
    )
  );
}

function renderContent(text: string, currentUserId?: string, currentDisplayName?: string) {
  // Step 1: split out triple-backtick code blocks (block-level,
  // opaque). Everything inside ``` is rendered verbatim — no URL,
  // mention, or inline-mark parsing happens inside a code block.
  const segments: Array<{ kind: 'code' | 'text'; content: string; lang?: string }> = [];
  let cursor = 0;
  const re = new RegExp(CODE_BLOCK_RE.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > cursor) segments.push({ kind: 'text', content: text.slice(cursor, m.index) });
    segments.push({ kind: 'code', content: m[2] ?? '', lang: m[1] || undefined });
    cursor = re.lastIndex;
  }
  if (cursor < text.length) segments.push({ kind: 'text', content: text.slice(cursor) });

  // No code blocks AND no inline-mark candidates → take the original
  // fast path so we don't change behaviour for the most common case
  // (plain text + maybe a URL + maybe a mention).
  if (segments.length === 1 && segments[0].kind === 'text' && !/[*~`]/.test(text)) {
    return renderUrlsAndMentions(text, currentDisplayName, 'root');
  }

  return segments.map((seg, i) => {
    if (seg.kind === 'code') {
      return (
        <pre
          key={`cb-${i}`}
          className="my-1.5 rounded-md bg-black/[0.06] dark:bg-black/55 border border-border/20 px-3 py-2 overflow-x-auto"
        >
          {seg.lang && (
            <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground/65 mb-1">{seg.lang}</div>
          )}
          <code className="text-[12.5px] font-mono leading-snug whitespace-pre-wrap break-words text-foreground/95">
            {seg.content.replace(/\n$/, '')}
          </code>
        </pre>
      );
    }
    return <Fragment key={`txt-${i}`}>{renderInlineTokens(seg.content, currentDisplayName, `s${i}`)}</Fragment>;
  });
}

function renderMentions(text: string, currentDisplayName?: string, keyPrefix: number = 0): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const re = new RegExp(MENTION_RE.source, 'g');

  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const mentionName = match[1].trim();
    const isCurrentUser = currentDisplayName && mentionName.toLowerCase() === currentDisplayName.toLowerCase();
    parts.push(
      <span
        key={`${keyPrefix}-mention-${match.index}`}
        className={cn(
          "inline-block rounded px-1 py-0.5 font-semibold text-[12px]",
          isCurrentUser
            ? "bg-primary/20 text-primary"
            : "bg-primary/10 text-primary/80"
        )}
      >
        @{mentionName}
      </span>
    );
    lastIndex = re.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}

function extractImageUrls(text: string): string[] {
  const matches = text.match(URL_RE);
  if (!matches) return [];
  return matches.filter(isImageUrl);
}

/* ═══ Bubble corner rounding logic ═══ */
function getBubbleCorners(isOwn: boolean, isFirst: boolean, isLast: boolean, isSingle: boolean): string {
  if (isSingle) return 'rounded-2xl';
  const base = 'rounded-2xl';
  if (isOwn) {
    if (isFirst) return `${base} rounded-br-md`;
    if (isLast) return `${base} rounded-tr-md`;
    return `${base} rounded-tr-md rounded-br-md`;
  } else {
    if (isFirst) return `${base} rounded-bl-md`;
    if (isLast) return `${base} rounded-tl-md`;
    return `${base} rounded-tl-md rounded-bl-md`;
  }
}

interface MessageBubbleProps {
  msg: Message;
  isOwn: boolean;
  sameAuthor: boolean;
  nextSameAuthor?: boolean;
  currentUserId?: string;
  currentDisplayName?: string;
  onToggleReaction: (messageId: string, emoji: string) => void;
  onOpenThread: (msg: Message) => void;
  onTogglePin: (msg: Message) => void;
  onStartEditing: (msg: Message) => void;
  onDeleteMessage: (msgId: string) => void;
  onSaveEdit: (msgId: string, content: string) => void;
  editingMessageId: string | null;
  editContent: string;
  onEditContentChange: (content: string) => void;
  onCancelEdit: () => void;
  isOverlayOpen?: boolean;
  onToggleOverlay?: (msgId: string | null) => void;
  /** Optional — set true to render a green presence dot on this
   *  message's avatar. The parent passes this from a shared
   *  useClubPresence subscription so all bubbles agree. */
  isAuthorOnline?: boolean;
}

const SWIPE_THRESHOLD = 60;
const HEADER_OFFSET = 80;

function MessageBubbleInner({
  msg, isOwn, sameAuthor, nextSameAuthor,
  currentUserId, currentDisplayName,
  onToggleReaction, onOpenThread, onTogglePin,
  onStartEditing, onDeleteMessage, onSaveEdit,
  editingMessageId, editContent, onEditContentChange, onCancelEdit,
  isOverlayOpen, onToggleOverlay,
  isAuthorOnline,
}: MessageBubbleProps) {
  const showOverlay = !!isOverlayOpen;
  const setShowOverlay = useCallback((open: boolean) => {
    onToggleOverlay?.(open ? msg.id : null);
  }, [msg.id, onToggleOverlay]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showReportConfirm, setShowReportConfirm] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [overlayPos, setOverlayPos] = useState<{ left: number; top: number } | null>(null);
  const bubbleWrapperRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const editRef = useRef<HTMLTextAreaElement>(null);

  const dragX = useMotionValue(0);
  const replyIconOpacity = useTransform(dragX, [0, SWIPE_THRESHOLD], [0, 1]);
  const replyIconScale = useTransform(dragX, [0, SWIPE_THRESHOLD], [0.5, 1]);
  const [swiped, setSwiped] = useState(false);
  const reduceMotion = useReducedMotion();

  // Subtle entrance: own messages rise a touch more (they came from the
  // composer below); received slide in from the same direction but
  // gentler. Both use a snappy spring so it never feels delayed.
  const enterInitial = reduceMotion
    ? { opacity: 1 }
    : { opacity: 0, y: isOwn ? 8 : 6, scale: 0.97 };
  const enterAnimate = { opacity: 1, y: 0, scale: 1 };
  const enterTransition = reduceMotion
    ? { duration: 0 }
    : { type: 'spring' as const, damping: 28, stiffness: 420, mass: 0.6 };

  const tinyHaptic = useCallback(() => {
    if (!reduceMotion) navigator.vibrate?.(4);
  }, [reduceMotion]);

  useEffect(() => {
    const el = editRef.current;
    if (!el || editingMessageId !== msg.id) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [editContent, editingMessageId, msg.id]);

  useEffect(() => {
    if (!showOverlay) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowOverlay(false);
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [showOverlay, setShowOverlay]);

  // Close overlay on any scroll within the chat — matches messaging-app
  // muscle memory ("scroll dismisses").
  useEffect(() => {
    if (!showOverlay) return;
    const onScroll = () => setShowOverlay(false);
    window.addEventListener('scroll', onScroll, true); // capture so descendant scroll containers trigger it too
    return () => window.removeEventListener('scroll', onScroll, true);
  }, [showOverlay, setShowOverlay]);

  // Reset measured position whenever the overlay closes so the next open
  // computes fresh coords (bubble may have moved due to new messages).
  useEffect(() => {
    if (!showOverlay) setOverlayPos(null);
  }, [showOverlay]);

  // Measure and clamp overlay position. Runs after the portaled overlay
  // mounts so we can read its real width/height — then we anchor it to
  // the bubble and clamp to the viewport with an 8px safe margin.
  useLayoutEffect(() => {
    if (!showOverlay) return;
    const overlay = overlayRef.current;
    const bubble = bubbleWrapperRef.current;
    if (!overlay || !bubble) return;
    const ov = overlay.getBoundingClientRect();
    const bb = bubble.getBoundingClientRect();
    const margin = 8;
    const placeBelow = bb.top < HEADER_OFFSET + ov.height + margin;
    // Anchor on the user's side (own → right edge, others → left edge)
    let left = isOwn ? bb.right - ov.width : bb.left;
    // Clamp horizontally to viewport
    const maxLeft = window.innerWidth - ov.width - margin;
    left = Math.max(margin, Math.min(left, maxLeft));
    const top = placeBelow
      ? Math.min(bb.bottom + margin, window.innerHeight - ov.height - margin)
      : Math.max(margin, bb.top - ov.height - margin);
    setOverlayPos({ left, top });
  }, [showOverlay, isOwn]);

  const isBeingEdited = editingMessageId === msg.id;
  const isFirstInBlock = !sameAuthor;
  const isLastInBlock = !nextSameAuthor;
  const isSingle = isFirstInBlock && isLastInBlock;

  const openOverlay = useCallback(() => {
    if (isBeingEdited) return;
    // Position is computed in useLayoutEffect once the overlay is mounted;
    // we just request it to open here.
    setShowOverlay(true);
    tinyHaptic();
  }, [isBeingEdited, setShowOverlay, tinyHaptic]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    if (isBeingEdited) return;
    e.preventDefault();
    openOverlay();
  }, [isBeingEdited, openOverlay]);

  const handleTap = useCallback(() => {
    if (isBeingEdited) return;
    if (showOverlay) setShowOverlay(false);
    else openOverlay();
  }, [isBeingEdited, showOverlay, openOverlay, setShowOverlay]);

  const handleReaction = useCallback((emoji: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    onToggleReaction(msg.id, emoji);
    setShowOverlay(false);
    tinyHaptic();
  }, [msg.id, onToggleReaction, setShowOverlay, tinyHaptic]);

  const confirmDelete = () => {
    onDeleteMessage(msg.id);
    setShowDeleteConfirm(false);
    setShowOverlay(false);
  };

  const confirmReport = async () => {
    if (reporting) return;
    setReporting(true);
    const { error } = await (supabase as any)
      .from('message_reports')
      .insert({ message_id: msg.id, reporter_id: currentUserId, reason: 'flagged_by_member' });
    setReporting(false);
    setShowReportConfirm(false);
    setShowOverlay(false);
    if (error) {
      const dup = (error.code === '23505') || /duplicate/i.test(error.message || '');
      if (dup) toast.success('You\'ve already reported this message.');
      else toast.error('Couldn\'t submit report.');
    } else {
      toast.success('Report sent to admins.');
    }
  };

  const imageUrls = extractImageUrls(msg.content);
  const parsedLinks = useMemo(() => parseMessageLinks(msg.content), [msg.content]);
  const previewLinks = parsedLinks.filter(l => l.contentType !== 'image');
  const senderColor = getUserColor(msg.user_id);
  const bubbleCorners = getBubbleCorners(isOwn, isFirstInBlock, isLastInBlock, isSingle);

  return (
    <>
      <motion.div
        className={cn(
          "group relative",
          sameAuthor ? "py-[1px]" : "pt-1",
          msg._optimistic && "opacity-70"
        )}
        style={{ x: dragX }}
        initial={enterInitial}
        animate={enterAnimate}
        transition={enterTransition}
        drag={isBeingEdited ? false : "x"}
        dragDirectionLock
        dragConstraints={{ left: 0, right: SWIPE_THRESHOLD + 10 }}
        dragElastic={0.15}
        dragSnapToOrigin
        dragMomentum={false}
        onDrag={(_, info) => {
          if (info.offset.x > SWIPE_THRESHOLD && !swiped) {
            setSwiped(true);
            navigator.vibrate?.(10);
          }
        }}
        onDragEnd={(_, info) => {
          if (info.offset.x > SWIPE_THRESHOLD) onOpenThread(msg);
          setSwiped(false);
        }}
        onContextMenu={handleContextMenu}
        onTap={(e) => {
          // Ignore taps that originated on interactive children (links, buttons, images)
          const target = e.target as HTMLElement;
          if (target.closest('a, button, textarea, input')) return;
          handleTap();
        }}
      >
        {/* Swipe reply icon */}
        <motion.div
          className="absolute left-0 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center pointer-events-none"
          style={{ opacity: replyIconOpacity, scale: replyIconScale }}
        >
          <Reply className="w-3 h-3 text-primary" />
        </motion.div>

        {/* Row container: flex left or right */}
        <div className={cn("flex items-end gap-2", isOwn ? "justify-end" : "justify-start")}>
          {/* Avatar for other users — only on last message of block */}
          {!isOwn && (
            <div className="w-7 flex-shrink-0">
              {isLastInBlock ? (
                <UserAvatar userId={msg.user_id} name={msg.profiles?.display_name || '?'} avatarUrl={msg.profiles?.avatar_url} size={28} isOnline={isAuthorOnline} />
              ) : (
                <div className="w-7" />
              )}
            </div>
          )}

          {/* Bubble column */}
          <div ref={bubbleWrapperRef} className="relative max-w-[80%] min-w-[60px]">
            {/* Sender name — first message of other user's block */}
            {!isOwn && isFirstInBlock && (
              <div className="flex items-baseline gap-2 mb-0.5 pl-1">
                <span className="text-[12px] font-semibold truncate" style={{ color: senderColor }}>
                  {msg.profiles?.display_name || 'Unknown'}
                </span>
                <span className="text-[10px] text-muted-foreground/45 font-medium flex-shrink-0">
                  {format(new Date(msg.created_at), 'h:mm a')}
                </span>
              </div>
            )}

            {/* Bubble + reactions wrapper */}
            <div className="relative">
              {/* The bubble */}
              <div
                className={cn(
                  bubbleCorners,
                  "px-3 py-2 relative",
                  isOwn
                    ? "text-foreground/95"
                    : "border border-border/10 text-foreground/90"
                )}
                style={{
                  backgroundColor: isOwn
                    ? 'hsl(var(--chat-own-bg))'
                    : 'hsl(var(--chat-incoming))'
                }}
              >
                {isBeingEdited ? (
                  <div className="flex items-start gap-2">
                    <textarea
                      ref={editRef}
                      value={editContent}
                      onChange={e => onEditContentChange(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSaveEdit(msg.id, editContent); }
                        if (e.key === 'Escape') onCancelEdit();
                      }}
                      className="flex-1 resize-none text-[13px] bg-background/30 border border-border/25 rounded-lg px-2 py-1.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20"
                      rows={1}
                      autoFocus
                      style={{ minHeight: 28, maxHeight: 120 }}
                    />
                    <button onClick={() => onSaveEdit(msg.id, editContent)} className="p-1 rounded-lg bg-primary/15 text-primary hover:bg-primary/25 transition-colors">
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={onCancelEdit} className="p-1 rounded-lg hover:bg-muted/50 transition-colors">
                      <X className="w-3.5 h-3.5 text-muted-foreground/70" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <p className={cn(
                      "text-[13px] leading-[1.55] break-words whitespace-pre-wrap",
                      imageUrls.length > 0 && !stripImageUrls(msg.content) && "hidden"
                    )}>
                      {renderContent(stripImageUrls(msg.content), currentUserId, currentDisplayName)}
                      {msg.is_pinned && <Pin className="w-2 h-2 inline-block ml-1 -mt-0.5" style={{ color: 'hsl(var(--premium-warm) / 0.5)' }} />}
                      {msg.edited_at && <span className="text-[9px] text-muted-foreground/50 ml-1.5">(edited)</span>}
                    </p>
                    {previewLinks.length > 0 && !msg._optimistic && (
                      <div className="space-y-1.5 mt-1.5">
                        {previewLinks.map((link, i) => (
                          <LinkPreviewCard key={`${link.url}-${i}`} link={link} messageId={msg.id} />
                        ))}
                      </div>
                    )}
                    {imageUrls.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {imageUrls.map((url, i) => (
                          <ChatAttachmentImage key={i} url={url} />
                        ))}
                      </div>
                    )}
                    {msg._optimistic && (
                      <span className="inline-flex items-center gap-1 mt-0.5 text-[9px] text-muted-foreground/50 font-medium">
                        <Loader2 className="w-2.5 h-2.5 animate-spin" /> Sending…
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Reactions — in-flow below bubble with slight overlap, never overflows into next message */}
              {msg.reactions && msg.reactions.length > 0 && (
                <div className={cn(
                  "-mt-1 relative z-10 flex flex-wrap gap-1",
                  isOwn ? "justify-end pr-1" : "justify-start pl-1"
                )}>
                  <AnimatePresence initial={false}>
                    {msg.reactions.map(r => (
                      <motion.button
                        key={r.emoji}
                        layout
                        initial={reduceMotion ? false : { opacity: 0, scale: 0.6, y: -2 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.6, y: -2 }}
                        transition={reduceMotion ? { duration: 0 } : { type: 'spring', damping: 22, stiffness: 480 }}
                        onClick={(e) => { e.stopPropagation(); handleReaction(r.emoji); }}
                        className={cn(
                          // Mobile: h-7 (28px) for reliable tap target.
                          // Desktop keeps the original h-6 (24px) so
                          // reaction rows stay dense alongside text.
                          "inline-flex items-center gap-1 h-7 lg:h-6 px-2 lg:px-1.5 rounded-full text-[11px] border shadow-sm backdrop-blur-sm transition-colors duration-150 active:scale-90",
                          r.user_reacted
                            ? "border-primary/30 bg-primary/15 text-primary"
                            : "border-border/30 bg-background/95 text-foreground/80 hover:bg-background"
                        )}
                      >
                        {r.emoji} <span className="font-bold text-[10px]">{r.count}</span>
                      </motion.button>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>

            {/* Timestamp for own messages — last in block */}
            {isOwn && isLastInBlock && !isBeingEdited && (
              <div className="flex justify-end mt-1 pr-1">
                <span className="text-[10px] text-muted-foreground/40 font-medium">
                  {format(new Date(msg.created_at), 'h:mm a')}
                </span>
              </div>
            )}

            {/* Thread indicator — Discord-style "thread chip" with
                visible surface, accent stripe, hover-to-deepen state,
                and an explicit "View thread →" affordance so users
                know it's clickable on first encounter. */}
            {(msg.reply_count || 0) > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); onOpenThread(msg); }}
                className={cn(
                  // Mobile: py-2 + min-h-[36px] for HIG-acceptable tap
                  // target. Desktop keeps the denser py-1.5 since chips
                  // hover-target reliably with a mouse.
                  "group/thread relative inline-flex items-center gap-2 mt-2 pl-2.5 pr-3 py-2 lg:py-1.5 min-h-[36px] lg:min-h-0 rounded-lg text-[11.5px] font-bold transition-colors",
                  "bg-primary/8 hover:bg-primary/14 text-primary border border-primary/20 hover:border-primary/35",
                  isOwn ? "ml-auto" : ""
                )}
                style={{ touchAction: 'manipulation' }}
                aria-label={`View thread — ${msg.reply_count} ${msg.reply_count === 1 ? 'reply' : 'replies'}`}
              >
                <MessageSquare className="w-3.5 h-3.5 flex-shrink-0" />
                <span>
                  <span className="tabular-nums">{msg.reply_count}</span>{' '}
                  {msg.reply_count === 1 ? 'reply' : 'replies'}
                </span>
                <span className="text-primary/60 group-hover/thread:text-primary group-hover/thread:translate-x-0.5 transition-all font-extrabold">→</span>
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {/* Action overlay — portaled to body so it escapes the message list's
          overflow-x-hidden clip. Position is measured + clamped to the
          viewport so the bar always appears in full. A transparent
          backdrop catches outside taps to dismiss. */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {showOverlay && (
            <Fragment key="overlay-wrapper">
              <motion.div
                key="overlay-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
                onClick={() => setShowOverlay(false)}
                onTap={() => setShowOverlay(false)}
                aria-hidden="true"
                className="fixed inset-0 z-[55]"
                style={{ background: 'transparent' }}
              />
              <motion.div
                key="overlay-bar"
                ref={overlayRef}
                initial={{ opacity: 0, scale: 0.9, y: 6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 6 }}
                transition={{ type: 'spring', damping: 26, stiffness: 380 }}
                onClick={(e) => e.stopPropagation()}
                onTap={(e) => e.stopPropagation?.()}
                role="menu"
                className="fixed z-[60] flex items-center gap-0.5 px-1.5 py-1 bg-background/95 backdrop-blur-lg border border-border/20 shadow-lg rounded-xl overflow-x-auto"
                style={{
                  left: overlayPos?.left ?? 0,
                  top: overlayPos?.top ?? 0,
                  visibility: overlayPos ? 'visible' : 'hidden',
                  maxWidth: 'calc(100vw - 16px)',
                  scrollbarWidth: 'none',
                }}
              >
                {QUICK_EMOJIS.map(emoji => (
                  <button
                    key={emoji}
                    onClick={(e) => handleReaction(emoji, e)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted/50 text-base transition-colors active:scale-90 flex-shrink-0"
                  >
                    {emoji}
                  </button>
                ))}
                <div className="w-px h-5 bg-border/20 mx-0.5 flex-shrink-0" />
                <button
                  onClick={(e) => { e.stopPropagation(); onOpenThread(msg); setShowOverlay(false); }}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted/50 transition-colors active:scale-90 flex-shrink-0"
                  title="Reply"
                  aria-label="Reply"
                >
                  <Reply className="w-3.5 h-3.5 text-muted-foreground/70" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onTogglePin(msg); setShowOverlay(false); }}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted/50 transition-colors active:scale-90 flex-shrink-0"
                  title={msg.is_pinned ? 'Unpin' : 'Pin'}
                  aria-label={msg.is_pinned ? 'Unpin' : 'Pin'}
                >
                  <Pin className="w-3.5 h-3.5 text-muted-foreground/70" />
                </button>
                {isOwn ? (
                  <>
                    <button
                      onClick={(e) => { e.stopPropagation(); onStartEditing(msg); setShowOverlay(false); }}
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted/50 transition-colors active:scale-90 flex-shrink-0"
                      title="Edit"
                      aria-label="Edit message"
                    >
                      <Pencil className="w-3.5 h-3.5 text-muted-foreground/70" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(true); setShowOverlay(false); }}
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-destructive/10 transition-colors active:scale-90 flex-shrink-0"
                      title="Delete"
                      aria-label="Delete message"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowReportConfirm(true); setShowOverlay(false); }}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-destructive/10 transition-colors active:scale-90 flex-shrink-0"
                    title="Report"
                    aria-label="Report message"
                  >
                    <Flag className="w-3.5 h-3.5 text-muted-foreground/70" />
                  </button>
                )}
              </motion.div>
            </Fragment>
          )}
        </AnimatePresence>,
        document.body,
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete message?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. The message and its replies will be permanently removed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Report confirmation dialog */}
      <AlertDialog open={showReportConfirm} onOpenChange={setShowReportConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Report this message?</AlertDialogTitle>
            <AlertDialogDescription>An admin will be notified to review it. You can only report each message once.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={reporting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmReport}
              disabled={reporting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {reporting ? 'Sending…' : 'Report'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export const MessageBubble = memo(MessageBubbleInner, (prev, next) => {
  // Edit state is global, but only the message actually being edited cares
  // about it. Scoping the comparison here means typing in one message's edit
  // box re-renders just that bubble — not all 50 in the list.
  const wasEditingThis = prev.editingMessageId === prev.msg.id;
  const isEditingThis = next.editingMessageId === next.msg.id;
  if (wasEditingThis !== isEditingThis) return false;
  if (isEditingThis && prev.editContent !== next.editContent) return false;

  return (
    prev.msg.id === next.msg.id &&
    prev.msg.content === next.msg.content &&
    prev.msg.edited_at === next.msg.edited_at &&
    prev.msg.is_pinned === next.msg.is_pinned &&
    prev.msg.reactions === next.msg.reactions &&
    prev.msg.reply_count === next.msg.reply_count &&
    prev.msg._optimistic === next.msg._optimistic &&
    prev.isOwn === next.isOwn &&
    prev.sameAuthor === next.sameAuthor &&
    prev.nextSameAuthor === next.nextSameAuthor &&
    prev.isOverlayOpen === next.isOverlayOpen
  );
});
