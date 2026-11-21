"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { usePresence } from "@/hooks/use-presence";
import { PresenceDot } from "@/components/presence/presence-dot";
import { presenceLabel } from "@/lib/presence";
import { cn } from "@/lib/utils";
import type {
  Conversation,
  Message,
  MessageReaction,
  Contact,
  ConversationStatus,
  MessageTemplate,
  Profile,
  InteractiveMessagePayload,
} from "@/types";
import {
  MessageSquare,
  ChevronDown,
  UserPlus,
  Check,
  Clock,
  ArrowLeft,
  RefreshCw,
  PanelRightOpen,
  PanelRightClose,
  Sparkles,
  Ban,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AiPitchDialog } from "./ai-pitch-dialog";
import { format, isToday, isYesterday, differenceInHours } from "date-fns";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { isContactBlocked } from "@/lib/contacts/block-service";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageBubble } from "./message-bubble";
import { MessageActions } from "./message-actions";
import { MediaLightbox } from "./media-lightbox";
import { collectMediaGallery } from "@/lib/media/gallery";
import {
  MessageComposer,
  CHAT_MEDIA_BUCKET,
  type SendMediaPayload,
} from "./message-composer";
import { deleteAccountMedia } from "@/lib/storage/upload-media";
import { TemplatePicker } from "./template-picker";
import { AiThreadBanner } from "./ai-thread-banner";
import { buildReplyPreview } from "./reply-quote";
import { renderTemplateBody } from "@/lib/whatsapp/template-body";
import { contactHandle } from "@/lib/whatsapp/wa-identity";
import { toast } from "sonner";

interface ReplyDraft {
  id: string;
  authorLabel: string;
  preview: string;
}

interface MessageThreadProps {
  conversation: Conversation | null;
  contact: Contact | null;
  messages: Message[];
  onMessagesLoaded: (messages: Message[]) => void;
  onNewMessage: (message: Message) => void;
  onUpdateMessage: (id: string, updates: Partial<Message>) => void;
  onStatusChange: (conversationId: string, status: ConversationStatus) => void;
  onAssignChange: (
    conversationId: string,
    assignedAgentId: string | null,
  ) => void;
  /**
   * On mobile, the thread is shown full-screen with the conversation list
   * hidden. This callback lets the page deselect the active conversation
   * and reveal the list again. Rendered as a back-arrow in the header on
   * mobile only.
   */
  onBack?: () => void;
  /**
   * Increment to force the messages + reactions fetch effects to refire.
   * Parent bumps this on realtime reconnect / tab visibility → visible
   * so the open thread catches up on any events sent while the WS was
   * disconnected or the tab was throttled. Optional so existing callers
   * keep working.
   */
  resyncToken?: number;
  /**
   * Fired by the manual-refresh button in the thread header. The parent
   * typically bumps the same `resyncToken` it controls — this gives the
   * user a way to force a refetch when they suspect realtime missed an
   * event (or they're impatient). Optional so existing callers keep
   * working; the button is only rendered when this is provided.
   */
  onRefresh?: () => void;
  /**
   * Desktop-only contact-panel toggle. The page owns the open/closed
   * state (it's the one that renders the sidebar), so the thread just
   * reflects it and asks the page to flip it. Both optional so existing
   * callers keep working; the toggle button only renders when
   * `onToggleContactPanel` is wired up.
   */
  contactPanelOpen?: boolean;
  onToggleContactPanel?: () => void;
}

function formatDateSeparator(dateStr: string, t: ReturnType<typeof useTranslations>): string {
  const date = new Date(dateStr);
  if (isToday(date)) return t("today");
  if (isYesterday(date)) return t("yesterday");
  return format(date, "MMMM d, yyyy");
}

function groupMessagesByDate(messages: Message[]) {
  const groups: { date: string; messages: Message[] }[] = [];
  let currentDate = "";

  for (const msg of messages) {
    const day = format(new Date(msg.created_at), "yyyy-MM-dd");
    if (day !== currentDate) {
      currentDate = day;
      groups.push({ date: msg.created_at, messages: [msg] });
    } else {
      groups[groups.length - 1].messages.push(msg);
    }
  }

  return groups;
}

const STATUS_OPTIONS: { label: string; value: ConversationStatus; color: string }[] = [
  { label: "Open", value: "open", color: "text-primary" },
  { label: "Pending", value: "pending", color: "text-amber-400" },
  { label: "Closed", value: "closed", color: "text-muted-foreground" },
];

/**
 * WhatsApp-style doodle background applied to the chat area (both the
 * active thread and the empty state). The SVG tile lives at
 * `/public/inbox-doodle.svg`; the slate-950 colour sits underneath so
 * the doodles read as a subtle pattern rather than a stark grid.
 *
 * Defined once at module scope so the two render paths can't drift —
 * if we ever switch the asset, both spots update together.
 */
const DOODLE_BG_CLASSES =
  "bg-background bg-[url('/inbox-doodle.svg')] bg-repeat";

export function MessageThread({
  conversation,
  contact,
  messages,
  onMessagesLoaded,
  onNewMessage,
  onUpdateMessage,
  onStatusChange,
  onAssignChange,
  onBack,
  resyncToken = 0,
  onRefresh,
  contactPanelOpen,
  onToggleContactPanel,
}: MessageThreadProps) {
  const t = useTranslations("Inbox.messageThread");
  const tTimer = useTranslations("Inbox.sessionTimer");
  const tQuote = useTranslations("Inbox.replyQuote");

  const { user } = useAuth();
  const { getPresence, getRow, now } = usePresence();
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [aiPitchOpen, setAiPitchOpen] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [reactions, setReactions] = useState<MessageReaction[]>([]);
  // Purely visual spin state for the manual-refresh button. The actual
  // refetch is fire-and-forget through `onRefresh` (which bumps the
  // parent's resyncToken); the 700ms spin is just feedback so the click
  // doesn't feel like a no-op. Cleared via the timer ref on unmount.
  const [isRefreshing, setIsRefreshing] = useState(false);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (refreshTimerRef.current !== null) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, []);
  const handleRefreshClick = useCallback(() => {
    if (isRefreshing || !onRefresh) return;
    setIsRefreshing(true);
    onRefresh();
    refreshTimerRef.current = setTimeout(() => {
      setIsRefreshing(false);
      refreshTimerRef.current = null;
    }, 700);
  }, [isRefreshing, onRefresh]);
  const [replyTo, setReplyTo] = useState<ReplyDraft | null>(null);

  // Block contact states
  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [unblockModalOpen, setUnblockModalOpen] = useState(false);
  const [blockReason, setBlockReason] = useState('');
  const [blockingLoading, setBlockingLoading] = useState(false);
  const [contactBlockedLocal, setContactBlockedLocal] = useState<boolean | null>(null);

  useEffect(() => {
    setContactBlockedLocal(null);
  }, [contact?.id]);

  const isBlocked = useMemo(() => {
    if (contactBlockedLocal !== null) return contactBlockedLocal;
    return isContactBlocked(contact);
  }, [contactBlockedLocal, contact]);

  const handleBlockContact = async () => {
    if (!contact?.id) return;
    try {
      setBlockingLoading(true);
      const res = await fetch(`/api/contacts/${contact.id}/block`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'block', reason: blockReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to block contact');

      setContactBlockedLocal(true);
      setBlockModalOpen(false);
      setBlockReason('');
      if (conversation?.id) {
        onStatusChange(conversation.id, 'closed');
      }
      toast.success('Patient ko block list mein add kar diya gaya hai. Inbound messages band ho gaye.');
    } catch (err: any) {
      toast.error(err.message || 'Block karne mein samasya aayi');
    } finally {
      setBlockingLoading(false);
    }
  };

  const handleUnblockContact = async () => {
    if (!contact?.id) return;
    try {
      setBlockingLoading(true);
      const res = await fetch(`/api/contacts/${contact.id}/block`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unblock' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to unblock contact');

      setContactBlockedLocal(false);
      setUnblockModalOpen(false);
      toast.success('Patient ko block list se unblock kar diya gaya hai.');
    } catch (err: any) {
      toast.error(err.message || 'Unblock karne mein samasya aayi');
    } finally {
      setBlockingLoading(false);
    }
  };
  // Which attachment the media viewer is showing. Lives here rather than in
  // the bubble so the viewer can page through every image/video in the
  // thread (issue #373). Paired with the conversation it belongs to and read
  // back through that check below, so switching threads closes the viewer
  // without an effect racing the messages refetch.
  const [openMedia, setOpenMedia] = useState<{
    conversationId: string;
    messageId: string;
  } | null>(null);

  // Profiles are bounded by RLS to rows the current user is allowed to
  // see — today that's just the current user, but the dropdown keeps the
  // shape ready for shared-team workspaces without a refactor.
  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    supabase
      .from("profiles")
      .select("*")
      .order("full_name")
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("Failed to fetch profiles:", error);
          return;
        }
        setProfiles((data as Profile[]) ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 24-hour session timer
  const sessionInfo = useMemo(() => {
    if (!messages.length) return { expired: false, remaining: "" };

    // Find last customer message
    const lastCustomerMsg = [...messages]
      .reverse()
      .find((m) => m.sender_type === "customer");

    if (!lastCustomerMsg) return { expired: true, remaining: tTimer("noCustomerMessages") };

    const hoursSince = differenceInHours(new Date(), new Date(lastCustomerMsg.created_at));
    const expired = hoursSince >= 24;

    if (expired) {
      return { expired: true, remaining: tTimer("expired") };
    }

    const hoursLeft = 24 - hoursSince;
    const remaining =
      hoursLeft >= 1
        ? tTimer("xhRemaining", { hours: Math.floor(hoursLeft) })
        : tTimer("xmRemaining", { minutes: Math.floor(hoursLeft * 60) });

    return { expired, remaining };
  }, [messages, tTimer]);

  // Store latest callback in a ref so fetchMessages doesn't need to
  // depend on `onMessagesLoaded` — otherwise parent re-renders cause
  // fetchMessages to change → useEffect re-fires → refetch → realtime
  // UPDATE on conversations.unread_count → parent re-renders → LOOP.
  // The ref is written inside an effect so the mutation doesn't happen
  // during render (React 19 refs rule); consumers only read `.current`
  // inside the async fetch completion, which runs after the render.
  const onMessagesLoadedRef = useRef(onMessagesLoaded);
  useEffect(() => {
    onMessagesLoadedRef.current = onMessagesLoaded;
  });

  const conversationId = conversation?.id;
  const hasUnread = (conversation?.unread_count ?? 0) > 0;

  const mediaMessageId =
    openMedia && openMedia.conversationId === conversationId
      ? openMedia.messageId
      : null;
  const handleMediaChange = useCallback(
    (messageId: string | null) => {
      setOpenMedia(
        messageId && conversationId ? { conversationId, messageId } : null,
      );
    },
    [conversationId],
  );

  // Fetch messages whenever the selected conversation changes. Kept
  // separate from the unread-reset effect so that incoming messages
  // arriving while the thread is open don't trigger a full refetch —
  // they only flip hasUnread, which only the reset effect listens to.
  useEffect(() => {
    if (!conversationId) return;

    const supabase = createClient();
    let cancelled = false;

    (async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (cancelled) return;

      if (error) {
        console.error("Failed to fetch messages:", error);
      } else {
        onMessagesLoadedRef.current(data ?? []);
      }

      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
    // `resyncToken` is included so the parent can force a refetch when
    // the realtime channel reconnects or the tab regains focus —
    // realtime is best-effort and any message events sent while the WS
    // was disconnected or throttled are otherwise lost.
  }, [conversationId, resyncToken]);

  // Reactions fetch — pulls the current state from the DB. Kept separate
  // from the channel subscription below so a `resyncToken` bump just
  // refetches the rows without also tearing down and rebuilding the
  // realtime channel.
  useEffect(() => {
    if (!conversationId) {
      setReactions([]);
      return;
    }
    const supabase = createClient();
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from("message_reactions")
        .select("*")
        .eq("conversation_id", conversationId);
      if (cancelled) return;
      if (error) {
        console.error("Failed to fetch reactions:", error);
        return;
      }
      setReactions((data as MessageReaction[]) ?? []);
    })();

    return () => {
      cancelled = true;
    };
  }, [conversationId, resyncToken]);

  // Reactions realtime subscription per conversation. Subscribing here
  // (not at the page level) keeps the channel scoped to the visible
  // conversation and avoids cross-conversation chatter on a busy inbox.
  useEffect(() => {
    if (!conversationId) return;
    const supabase = createClient();

    const channel = supabase
      .channel(`reactions:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "message_reactions",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const row = payload.new as MessageReaction;
          setReactions((prev) => {
            if (prev.some((r) => r.id === row.id)) return prev;
            // Swap any matching optimistic temp row for the real one so
            // the pill doesn't double up after a successful POST.
            const tempIdx = prev.findIndex(
              (r) =>
                r.id.startsWith("temp-") &&
                r.message_id === row.message_id &&
                r.actor_type === row.actor_type &&
                r.actor_id === row.actor_id,
            );
            if (tempIdx >= 0) {
              const copy = prev.slice();
              copy[tempIdx] = row;
              return copy;
            }
            return [...prev, row];
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "message_reactions",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const row = payload.new as MessageReaction;
          setReactions((prev) => prev.map((r) => (r.id === row.id ? row : r)));
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "message_reactions",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const old = payload.old as Partial<MessageReaction>;
          if (!old?.id) return;
          setReactions((prev) => prev.filter((r) => r.id !== old.id));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  // Clear any in-progress reply draft when the active conversation changes —
  // a quote pulled from conversation A shouldn't bleed into conversation B.
  useEffect(() => {
    setReplyTo(null);
  }, [conversationId]);

  // Reset the server-side unread_count to 0 whenever an unread count
  // surfaces on the active conversation — covers both (a) opening a
  // conversation that had unread messages and (b) new messages arriving
  // while the user is already viewing the thread (webhook server-bumps
  // unread_count to N+1; the realtime UPDATE propagates it into the
  // client, which re-runs this effect and flips it back to 0).
  //
  // Guarding on hasUnread prevents the eq-update loop: once unread_count
  // is 0 the condition is false, so no further UPDATE is issued.
  useEffect(() => {
    if (!conversationId || !hasUnread) return;
    fetch(`/api/conversations/${conversationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unread_count: 0 }),
    }).catch(() => {
      const supabase = createClient();
      supabase
        .from('conversations')
        .update({ unread_count: 0 })
        .eq('id', conversationId)
        .then(({ error }) => {
          if (error) console.error('Failed to reset unread_count:', error);
        });
    });
  }, [conversationId, hasUnread]);

  // User scroll position tracking: Prevents unwanted snapping to bottom when user is reading past messages
  const isAtBottomRef = useRef(true);
  const prevMessagesLengthRef = useRef(messages.length);
  const prevConversationIdRef = useRef<string | null>(conversation?.id || null);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    const atBottom = distanceFromBottom < 100;
    isAtBottomRef.current = atBottom;
    setShowScrollBottomBtn(!atBottom && scrollHeight > clientHeight + 150);
  }, []);

  const scrollToBottom = useCallback((smooth = false) => {
    if (!scrollRef.current) return;
    const el = scrollRef.current;
    if (smooth) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    } else {
      el.scrollTop = el.scrollHeight;
    }
    isAtBottomRef.current = true;
    setShowScrollBottomBtn(false);
  }, []);

  // Handle conversation change and incoming messages
  useEffect(() => {
    const isNewConversation = conversation?.id !== prevConversationIdRef.current;
    prevConversationIdRef.current = conversation?.id || null;

    if (isNewConversation) {
      // Switched conversation: reset scroll tracking and scroll to bottom
      isAtBottomRef.current = true;
      setShowScrollBottomBtn(false);
      prevMessagesLengthRef.current = messages.length;
      const timer = setTimeout(() => {
        scrollToBottom(false);
      }, 50);
      return () => clearTimeout(timer);
    }

    const prevLength = prevMessagesLengthRef.current;
    const currentLength = messages.length;
    prevMessagesLengthRef.current = currentLength;

    // If message count did NOT increase (e.g. status updates 'sent'->'delivered'->'read', reaction edits):
    // DO NOT change user scroll position!
    if (currentLength <= prevLength) {
      return;
    }

    // A new message arrived or was sent
    const lastMsg = messages[messages.length - 1];
    const isSentByMe = lastMsg?.sender_type === 'agent';

    if (isSentByMe || isAtBottomRef.current) {
      // If agent sent it OR user was already at bottom: scroll down
      scrollToBottom(true);
    } else {
      // User was scrolled up reading past history: DO NOT disrupt them!
      setShowScrollBottomBtn(true);
    }
  }, [messages, conversation?.id, scrollToBottom]);

  const handleSend = useCallback(
    async (text: string, replyToId?: string) => {
      if (!conversation) return;

      const tempId = `temp-${Date.now()}`;

      // Optimistic update — shows the message immediately with "sending" status
      const optimisticMsg: Message = {
        id: tempId,
        conversation_id: conversation.id,
        sender_type: "agent",
        content_type: "text",
        content_text: text,
        status: "sending",
        created_at: new Date().toISOString(),
        reply_to_message_id: replyToId,
      };
      onNewMessage(optimisticMsg);
      setReplyTo(null);

      try {
        const res = await fetch("/api/whatsapp/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversation_id: conversation.id,
            message_type: "text",
            content_text: text,
            reply_to_message_id: replyToId,
          }),
        });

        const payload = await res.json().catch(() => ({}));

        if (!res.ok) {
          const reason = payload?.error || `HTTP ${res.status}`;
          console.error("Failed to send message:", reason);
          toast.error(t("sendFailed", { reason }));
          // Mark the optimistic bubble as failed so the user sees what happened
          onUpdateMessage(tempId, { status: "failed" });
          return;
        }

        // Success — the realtime INSERT event will replace the temp bubble
        // with the real DB row. If realtime hasn't arrived yet, at least
        // flip status to 'sent' so the UI stops showing "sending".
        onUpdateMessage(tempId, { status: "sent" });
      } catch (err) {
        console.error("Failed to send message:", err);
        const reason = err instanceof Error ? err.message : "network error";
        toast.error(t("sendFailed", { reason }));
        onUpdateMessage(tempId, { status: "failed" });
      }
    },
    [conversation, onNewMessage, onUpdateMessage, t]
  );

  const handleSendMedia = useCallback(
    async (payload: SendMediaPayload) => {
      if (!conversation) return;

      // Documents show their filename in our own bubble (and to the
      // recipient as the Meta caption when no caption was typed); other
      // kinds use the caption as-is. Audio carries no caption.
      const contentText =
        payload.kind === "document"
          ? payload.caption || payload.filename || "Document"
          : payload.caption;

      const tempId = `temp-${Date.now()}`;
      const optimisticMsg: Message = {
        id: tempId,
        conversation_id: conversation.id,
        sender_type: "agent",
        content_type: payload.kind,
        content_text: contentText,
        media_url: payload.mediaUrl,
        status: "sending",
        created_at: new Date().toISOString(),
        reply_to_message_id: payload.replyToId,
      };
      onNewMessage(optimisticMsg);
      setReplyTo(null);

      try {
        const res = await fetch("/api/whatsapp/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversation_id: conversation.id,
            message_type: payload.kind,
            media_url: payload.mediaUrl,
            content_text: contentText,
            filename: payload.filename,
            reply_to_message_id: payload.replyToId,
          }),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          const reason = data?.error || `HTTP ${res.status}`;
          console.error("Failed to send media:", reason);
          toast.error(t("sendFailed", { reason }));
          onUpdateMessage(tempId, { status: "failed" });
          // The upload never reached the recipient — GC the orphaned
          // object rather than leaving it in the public bucket forever.
          void deleteAccountMedia(CHAT_MEDIA_BUCKET, payload.path).catch(() => {});
          return;
        }

        onUpdateMessage(tempId, { status: "sent" });
      } catch (err) {
        console.error("Failed to send media:", err);
        const reason = err instanceof Error ? err.message : "network error";
        toast.error(t("sendFailed", { reason }));
        onUpdateMessage(tempId, { status: "failed" });
        void deleteAccountMedia(CHAT_MEDIA_BUCKET, payload.path).catch(() => {});
      }
    },
    [conversation, onNewMessage, onUpdateMessage, t],
  );

  const handleSendInteractive = useCallback(
    async (payload: InteractiveMessagePayload, replyToId?: string) => {
      if (!conversation) return;

      const tempId = `temp-${Date.now()}`;
      // Optimistic bubble — renders the buttons/list immediately via the
      // interactive_payload, same as the persisted row will.
      const optimisticMsg: Message = {
        id: tempId,
        conversation_id: conversation.id,
        sender_type: "agent",
        content_type: "interactive",
        content_text: payload.body,
        interactive_payload: payload,
        status: "sending",
        created_at: new Date().toISOString(),
        reply_to_message_id: replyToId,
      };
      onNewMessage(optimisticMsg);

      try {
        const res = await fetch("/api/whatsapp/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversation_id: conversation.id,
            message_type: "interactive",
            interactive_payload: payload,
            reply_to_message_id: replyToId,
          }),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          const reason = data?.error || `HTTP ${res.status}`;
          console.error("Failed to send interactive message:", reason);
          toast.error(t("sendFailed", { reason }));
          onUpdateMessage(tempId, { status: "failed" });
          return;
        }

        onUpdateMessage(tempId, { status: "sent" });
      } catch (err) {
        console.error("Failed to send interactive message:", err);
        const reason = err instanceof Error ? err.message : "network error";
        toast.error(t("sendFailed", { reason }));
        onUpdateMessage(tempId, { status: "failed" });
      }
    },
    [conversation, onNewMessage, onUpdateMessage, t],
  );

  const handleStatusChange = useCallback(
    async (status: ConversationStatus) => {
      if (!conversation) return;

      try {
        await fetch(`/api/conversations/${conversation.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        });
      } catch {
        const supabase = createClient();
        await supabase
          .from('conversations')
          .update({ status })
          .eq('id', conversation.id);
      }

      onStatusChange(conversation.id, status);
    },
    [conversation, onStatusChange]
  );

  const handleOpenTemplates = useCallback(() => {
    setTemplateModalOpen(true);
  }, []);

  const handleSendTemplate = useCallback(
    async (
      template: MessageTemplate,
      values: {
        body: string[];
        headerText?: string;
        buttonParams?: Record<number, string>;
      },
    ) => {
      if (!conversation) return;

      const renderedBody = renderTemplateBody(template.body_text, values.body);
      const tempId = `temp-${Date.now()}`;

      const optimisticMsg: Message = {
        id: tempId,
        conversation_id: conversation.id,
        sender_type: "agent",
        content_type: "template",
        content_text: renderedBody,
        template_name: template.name,
        status: "sending",
        created_at: new Date().toISOString(),
      };
      onNewMessage(optimisticMsg);

      try {
        const res = await fetch("/api/whatsapp/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversation_id: conversation.id,
            message_type: "template",
            template_name: template.name,
            template_language: template.language,
            // Structured params drive the new send-builder path
            // (header media + URL button substitution). Body values
            // are mirrored under both shapes so the route can fall
            // back if the template row isn't found locally.
            template_message_params: {
              body: values.body,
              headerText: values.headerText,
              buttonParams: values.buttonParams,
            },
            template_params: values.body,
            content_text: renderedBody,
          }),
        });

        const payload = await res.json().catch(() => ({}));

        if (!res.ok) {
          const reason = payload?.error || `HTTP ${res.status}`;
          console.error("Failed to send template:", reason);
          toast.error(t("sendTemplateFailed", { reason }));
          onUpdateMessage(tempId, { status: "failed" });
          return;
        }

        onUpdateMessage(tempId, { status: "sent" });
      } catch (err) {
        console.error("Failed to send template:", err);
        const reason = err instanceof Error ? err.message : "network error";
        toast.error(t("sendTemplateFailed", { reason }));
        onUpdateMessage(tempId, { status: "failed" });
      }
    },
    [conversation, onNewMessage, onUpdateMessage, t],
  );

  // Build a quick id → Message map so reply quotes can be rendered without
  // an extra fetch — the thread already holds the full conversation.
  const messagesById = useMemo(() => {
    const map = new Map<string, Message>();
    for (const m of messages) map.set(m.id, m);
    return map;
  }, [messages]);

  // Images + videos in the thread, in order — the set the media viewer
  // pages through with ← / →.
  const mediaGallery = useMemo(() => collectMediaGallery(messages), [messages]);

  // Bucket reactions by their target message_id for O(1) per-bubble lookup.
  const reactionsByMessageId = useMemo(() => {
    const map = new Map<string, MessageReaction[]>();
    for (const r of reactions) {
      const bucket = map.get(r.message_id);
      if (bucket) bucket.push(r);
      else map.set(r.message_id, [r]);
    }
    return map;
  }, [reactions]);

  const contactDisplayName =
    contact?.name || (contact ? contactHandle(contact) : "") || t("customer");

  // Author label for a quoted message: "You" when we sent the parent,
  // contact name when the customer sent it.
  const authorLabelFor = useCallback(
    (m: Message): string => {
      const isAgentMsg =
        m.sender_type === "agent" || m.sender_type === "bot";
      return isAgentMsg ? "You" : contactDisplayName;
    },
    [contactDisplayName],
  );

  const handleStartReply = useCallback(
    (msg: Message) => {
      setReplyTo({
        id: msg.id,
        authorLabel: authorLabelFor(msg),
        preview: buildReplyPreview(msg, tQuote),
      });
    },
    [authorLabelFor],
  );

  // Single reaction-set primitive. emoji === "" removes; otherwise adds/swaps.
  // The "toggle" semantic (pill click) is computed at the call site where the
  // current reactions for the bubble are already in scope — keeps this
  // function dependency-free w.r.t. the reaction list.
  const postReaction = useCallback(
    async (messageId: string, emoji: string) => {
      if (!user?.id || !conversation) {
        console.warn("[reactions] missing user or conversation");
        return;
      }
      if (messageId.startsWith("temp-")) {
        toast.error(t("waitForSending"));
        return;
      }

      const convId = conversation.id;
      const userId = user.id;
      let snapshot: MessageReaction[] = [];

      // Functional updater — captures the freshest reactions list, never a
      // stale closure. Snapshot stored for rollback on POST failure.
      setReactions((prev) => {
        snapshot = prev;
        const own = prev.find(
          (r) =>
            r.message_id === messageId &&
            r.actor_type === "agent" &&
            r.actor_id === userId,
        );
        if (emoji === "") return own ? prev.filter((r) => r !== own) : prev;
        if (own) return prev.map((r) => (r === own ? { ...own, emoji } : r));
        return [
          ...prev,
          {
            id: `temp-${Date.now()}`,
            message_id: messageId,
            conversation_id: convId,
            actor_type: "agent",
            actor_id: userId,
            emoji,
            created_at: new Date().toISOString(),
          },
        ];
      });

      try {
        const res = await fetch("/api/whatsapp/react", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message_id: messageId, emoji }),
        });
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          throw new Error(payload?.error || `HTTP ${res.status}`);
        }
      } catch (err) {
        const reason = err instanceof Error ? err.message : "network error";
        toast.error(t("reactionFailed", { reason }));
        setReactions(snapshot);
      }
    },
    [conversation, user?.id, t],
  );

  const handleAssignChange = useCallback(
    async (agentId: string | null) => {
      if (!conversation) return;

      try {
        const res = await fetch(`/api/conversations/${conversation.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assigned_agent_id: agentId }),
        });
        if (!res.ok) throw new Error('Failed to update');
      } catch {
        const supabase = createClient();
        const { error } = await supabase
          .from('conversations')
          .update({ assigned_agent_id: agentId })
          .eq('id', conversation.id);

        if (error) {
          console.error('Failed to update assignment:', error);
          toast.error(t('assignmentUpdateFailed'));
          return;
        }
      }

      onAssignChange(conversation.id, agentId);
    },
    [conversation, onAssignChange, t],
  );

  // Empty state — same WhatsApp-style doodle background as the active
  // thread below, so swapping between empty/selected doesn't change the
  // pattern under the user's eye.
  if (!conversation || !contact) {
    return (
      <div className={cn("flex flex-1 flex-col items-center justify-center", DOODLE_BG_CLASSES)}>
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <MessageSquare className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="mt-4 text-sm font-medium text-muted-foreground">
          {t("selectConversation")}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("selectConversationHint")}
        </p>
      </div>
    );
  }

  const displayName = contact.name || contactHandle(contact);
  const messageGroups = groupMessagesByDate(messages);
  const currentStatus = STATUS_OPTIONS.find(
    (s) => s.value === conversation.status
  );
  const assignedAgentId = conversation.assigned_agent_id ?? null;
  const currentAssignee = profiles.find((p) => p.user_id === assignedAgentId);
  const assignLabel = assignedAgentId
    ? (currentAssignee?.full_name ?? t("assigned"))
    : t("assign");

  return (
    // `min-w-0` is load-bearing: the page already puts min-w-0 on the
    // thread's flex *wrapper* (issue #165), but this root keeps the
    // default `min-width: auto`, so a single wide message (long unbroken
    // URL/word) expands the whole thread past its flex share and the chat
    // paints on top of the contact sidebar at lg+ — outgoing bubbles get
    // clipped and the hover toolbar overlaps the Tags panel. Letting the
    // root shrink lets the bubbles' break-words / max-w caps apply.
    // Issue #257.
    <div className={cn("flex min-w-0 flex-1 flex-col", DOODLE_BG_CLASSES)}>
      {/* Header — solid card surface sits on top of the doodle so the
          name/avatar/dropdowns stay legible. */}
      <div className="flex items-center justify-between gap-2 border-b border-border bg-card px-3 py-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          {/* Back-to-list button — mobile only. Hidden on lg+ where the
              conversation list is always visible next to the thread. */}
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label={t("backToConversations")}
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium text-foreground">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-foreground">{displayName}</h2>
            <p className="truncate text-xs text-muted-foreground">
              {contactHandle(contact)}
            </p>
          </div>
          {/* Session timer badge — hidden on the narrowest phones so
              the name + back arrow keep their room. */}
          <Badge
            variant="outline"
            className={cn(
              "ml-1 hidden gap-1 border-border text-[10px] sm:inline-flex sm:ml-2",
              sessionInfo.expired ? "text-red-400" : "text-primary"
            )}
          >
            <Clock className="h-3 w-3" />
            {sessionInfo.remaining}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          {/* Block / Unblock Button */}
          {isBlocked ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setUnblockModalOpen(true)}
              className="h-7 px-2 text-xs gap-1.5 font-medium bg-rose-600 hover:bg-rose-700 text-white shadow-2xs"
              title="Patient is currently blocked. Click to unblock."
            >
              <Ban className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Blocked</span>
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBlockModalOpen(true)}
              className="h-7 px-2 text-xs gap-1.5 font-medium border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-900/60 dark:text-rose-400 dark:hover:bg-rose-950/40 shadow-2xs"
              title="Block this contact from sending future messages"
            >
              <Ban className="h-3.5 w-3.5 text-rose-500" />
              <span className="hidden sm:inline">Block Patient</span>
            </Button>
          )}

          {/* AI Pitch Advisor Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAiPitchOpen(true)}
            className="h-7 px-2 text-xs gap-1.5 font-medium border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300 hover:bg-purple-500/20 shadow-2xs"
            title="Analyze patient chat & generate phone call pitch"
          >
            <Sparkles className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
            <span className="hidden sm:inline">AI Pitch</span>
          </Button>

          {/* Contact-panel toggle — desktop only. Clicking cross in sidebar or toggle here expands/restores full width chat */}
          {onToggleContactPanel && (
            <Button
              type="button"
              variant={contactPanelOpen ? "ghost" : "outline"}
              size="sm"
              onClick={onToggleContactPanel}
              aria-label={
                contactPanelOpen ? "Close patient details" : "Open patient details"
              }
              title={
                contactPanelOpen
                  ? "Close patient details (Full size chat)"
                  : "Open patient details"
              }
              aria-pressed={contactPanelOpen}
              className={cn(
                "hidden h-7 text-xs gap-1.5 font-medium transition-all lg:inline-flex cursor-pointer",
                contactPanelOpen
                  ? "text-muted-foreground hover:text-foreground hover:bg-muted px-2"
                  : "bg-primary/10 border-primary/30 text-primary hover:bg-primary/20 px-2.5 shadow-2xs font-semibold",
              )}
            >
              {contactPanelOpen ? (
                <>
                  <PanelRightClose className="h-3.5 w-3.5" />
                  <span className="hidden xl:inline">Details</span>
                </>
              ) : (
                <>
                  <PanelRightOpen className="h-3.5 w-3.5" />
                  <span>Patient Details</span>
                </>
              )}
            </Button>
          )}

          {/* Manual refresh — forces a refetch of the messages + the
              conversation list (the parent bumps its resyncToken). Useful
              when realtime missed an event or the agent just wants to be
              sure nothing's stale. Only rendered when the parent wires
              up `onRefresh`. */}
          {onRefresh && (
            <button
              type="button"
              onClick={handleRefreshClick}
              disabled={isRefreshing}
              aria-label={t("refreshConversation")}
              title={t("refresh")}
              className={cn(
                "inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-60",
              )}
            >
              <RefreshCw
                className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")}
              />
            </button>
          )}

          {/* Status dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger className={cn(
                  "inline-flex items-center justify-center h-7 gap-1 px-2 text-xs rounded-md hover:bg-muted",
                  currentStatus?.color ?? "text-muted-foreground"
                )}>
                {currentStatus ? t(`status${currentStatus.label}`) : t("status")}
                <ChevronDown className="h-3 w-3" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="border-border bg-popover"
            >
              {STATUS_OPTIONS.map((opt) => (
                <DropdownMenuItem
                  key={opt.value}
                  onClick={() => handleStatusChange(opt.value)}
                  className={cn("text-sm", opt.color)}
                >
                  {t(`status${opt.label}`)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Assign dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                "inline-flex items-center justify-center h-7 gap-1 px-2 text-xs rounded-md hover:bg-muted",
                assignedAgentId ? "text-primary" : "text-muted-foreground"
              )}
            >
              <UserPlus className="h-3 w-3" />
              <span className="hidden sm:inline">{assignLabel}</span>
              <ChevronDown className="h-3 w-3" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="border-border bg-popover"
            >
              {profiles.length === 0 ? (
                <DropdownMenuItem disabled className="text-sm text-muted-foreground">
                  {t("noTeammates")}
                </DropdownMenuItem>
              ) : (
                profiles.map((p) => {
                  const isSelected = p.user_id === assignedAgentId;
                  const presence = getPresence(p.user_id);
                  return (
                    <DropdownMenuItem
                      key={p.id}
                      onClick={() => handleAssignChange(p.user_id)}
                      className={cn(
                        "text-sm",
                        isSelected ? "text-primary" : "text-popover-foreground"
                      )}
                    >
                      <PresenceDot
                        status={presence}
                        label={presenceLabel(
                          presence,
                          getRow(p.user_id)?.last_seen_at ?? null,
                          now
                        )}
                        className="mr-2"
                      />
                      <span className="flex-1">
                        {p.full_name}
                        {p.user_id === user?.id ? t("me") : ""}
                      </span>
                      {isSelected && <Check className="ml-2 h-3 w-3" />}
                    </DropdownMenuItem>
                  );
                })
              )}
              {assignedAgentId && (
                <>
                  <DropdownMenuSeparator className="bg-border" />
                  <DropdownMenuItem
                    onClick={() => handleAssignChange(null)}
                    className="text-sm text-muted-foreground"
                  >
                    {t("unassign")}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Messages Area */}
      <div className="relative flex-1 min-h-0 flex flex-col">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-4 py-4"
        >
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <p className="text-sm text-muted-foreground">{t("noMessagesYet")}</p>
              <p className="text-xs text-muted-foreground">
                {t("sendTemplateHint")}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {messageGroups.map((group) => (
                <div key={group.date}>
                  {/* Date separator */}
                  <div className="mb-4 flex items-center justify-center">
                    <span className="rounded-full bg-muted px-3 py-1 text-[10px] font-medium text-muted-foreground">
                      {formatDateSeparator(group.date, t)}
                    </span>
                  </div>
                  {/* Messages */}
                  <div className="space-y-2">
                    {group.messages.map((msg) => {
                      const parent = msg.reply_to_message_id
                        ? messagesById.get(msg.reply_to_message_id)
                        : null;
                      const reply = parent
                        ? {
                            authorLabel:
                              parent.sender_type === "agent" || parent.sender_type === "bot"
                                ? t("me") 
                                : contact?.name || contact?.phone || t("unknown"),
                            preview: buildReplyPreview(parent, tQuote),
                          }
                        : null;
                      const msgReactions = reactionsByMessageId.get(msg.id);
                      // Toggle is computed at the call site — `msgReactions`
                      // and `user?.id` are already in scope, no extra hook.
                      const handlePillToggle = (emoji: string) => {
                        const own = msgReactions?.find(
                          (r) =>
                            r.actor_type === "agent" &&
                            r.actor_id === user?.id,
                        );
                        const next = own?.emoji === emoji ? "" : emoji;
                        void postReaction(msg.id, next);
                      };
                      return (
                        <MessageActions
                          key={msg.id}
                          message={msg}
                          onReply={() => handleStartReply(msg)}
                          onReact={(emoji) => {
                            if (emoji) void postReaction(msg.id, emoji);
                          }}
                        >
                          <MessageBubble
                            message={msg}
                            reply={reply}
                            reactions={msgReactions}
                            currentUserId={user?.id}
                            onToggleReaction={handlePillToggle}
                            onOpenMedia={handleMediaChange}
                          />
                        </MessageActions>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Floating Jump to Latest Button when user is scrolled up */}
        {showScrollBottomBtn && (
          <div className="absolute bottom-3 right-6 z-20">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => scrollToBottom(true)}
              className="rounded-full shadow-lg h-7 px-3 text-xs gap-1.5 bg-background/95 hover:bg-background border border-border text-foreground cursor-pointer transition-all animate-in fade-in slide-in-from-bottom-2 hover:border-primary/50"
            >
              <ChevronDown className="h-3.5 w-3.5 text-primary" />
              <span>Latest Messages</span>
            </Button>
          </div>
        )}
      </div>

      {/* AI auto-reply banner — take over an active bot, or resume it
          after a handoff. Renders nothing unless the account has
          auto-reply configured. */}
      <AiThreadBanner
        conversationId={conversation.id}
        disabled={conversation.ai_autoreply_disabled ?? false}
        handoffSummary={conversation.ai_handoff_summary}
        assignedAgentId={assignedAgentId}
        currentUserId={user?.id}
        onChange={(patch) => {
          if ("assigned_agent_id" in patch) {
            onAssignChange(conversation.id, patch.assigned_agent_id ?? null);
          }
        }}
      />

      {/* Composer or Blocked Banner */}
      {isBlocked ? (
        <div className="p-4 bg-rose-50/90 dark:bg-rose-950/40 border-t border-rose-200 dark:border-rose-900/60 flex flex-wrap items-center justify-between gap-3 text-xs text-rose-900 dark:text-rose-200">
          <div className="flex items-center gap-2.5">
            <Ban className="h-5 w-5 text-rose-600 shrink-0" />
            <div>
              <div className="font-semibold text-sm">Yeh Patient Block List Mein Hai (Blocked)</div>
              <div className="text-[11px] text-rose-700 dark:text-rose-300">
                Inka koi bhi naya WhatsApp message yahan receive nahi hoga aur AI auto-replies band hain. Message bhejne ke liye pehle unblock karein.
              </div>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setUnblockModalOpen(true)}
            className="h-8 px-3 text-xs border-rose-300 bg-white dark:bg-rose-900 text-rose-700 dark:text-rose-200 hover:bg-rose-100 font-semibold"
          >
            Unblock Patient
          </Button>
        </div>
      ) : (
        <MessageComposer
          conversationId={conversation.id}
          sessionExpired={sessionInfo.expired}
          onSend={handleSend}
          onSendMedia={handleSendMedia}
          onSendInteractive={handleSendInteractive}
          onOpenTemplates={handleOpenTemplates}
          replyTo={replyTo}
          onClearReply={() => setReplyTo(null)}
        />
      )}

      <TemplatePicker
        open={templateModalOpen}
        onOpenChange={setTemplateModalOpen}
        onSelect={handleSendTemplate}
        contactName={contact?.name}
      />

      {/* Full-size viewer for the thread's images/videos. Renders nothing
          until a bubble opens it. */}
      <MediaLightbox
        items={mediaGallery}
        activeId={mediaMessageId}
        onActiveIdChange={handleMediaChange}
        contactLabel={contactDisplayName}
      />

      {/* AI Pitch Advisor Dialog */}
      <AiPitchDialog
        open={aiPitchOpen}
        onOpenChange={setAiPitchOpen}
        conversationId={conversation?.id}
        contactId={contact?.id}
        patientName={displayName}
      />

      {/* Block Confirmation Dialog */}
      <Dialog open={blockModalOpen} onOpenChange={setBlockModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <Ban className="h-5 w-5" />
              Patient ko Block karein? (Block Contact)
            </DialogTitle>
            <DialogDescription>
              Kya aap sach mein <strong>{displayName}</strong> ko block list mein daalna chahte hain?
              <br />
              Block hone ke baad <strong>inka koi bhi naya WhatsApp message aapke CRM mein nahi aayega</strong> aur AI bot ka response bhi turant band ho jayega.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Block karne ki wajah (Optional):
            </label>
            <Textarea
              rows={2}
              placeholder="e.g. Faltu messages bhej rahe hain, abusive, ya spam..."
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
              className="text-xs"
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBlockModalOpen(false)}
              disabled={blockingLoading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBlockContact}
              disabled={blockingLoading}
              className="bg-rose-600 hover:bg-rose-700 text-white font-semibold gap-1.5"
            >
              <Ban className="h-4 w-4" />
              {blockingLoading ? 'Blocking...' : 'Confirm Block (ब्लॉक करें)'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unblock Confirmation Dialog */}
      <Dialog open={unblockModalOpen} onOpenChange={setUnblockModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
              <Check className="h-5 w-5 text-emerald-600" />
              Patient ko Unblock karein?
            </DialogTitle>
            <DialogDescription>
              Kya aap <strong>{displayName}</strong> ko block list se hatana chahte hain? Unblock karne ke baad inke aage aane wale WhatsApp messages normal tareeqe se inbox mein receive hone shuru ho jayenge.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setUnblockModalOpen(false)}
              disabled={blockingLoading}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleUnblockContact}
              disabled={blockingLoading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5"
            >
              <Check className="h-4 w-4" />
              {blockingLoading ? 'Unblocking...' : 'Confirm Unblock (अनब्लॉक करें)'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
