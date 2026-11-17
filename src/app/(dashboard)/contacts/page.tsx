'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import type { Contact, Tag, ContactTag } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Search,
  Plus,
  Upload,
  Download,
  BarChart3,
  MoreHorizontal,
  Pencil,
  Trash2,
  Loader2,
  Users,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  Filter,
  X,
  Phone,
  MapPin,
  Megaphone,
  Sparkles,
  MessageSquare,
  FileText,
  Check,
  CheckCircle2,
  Tag as TagIcon,
  Clock,
} from 'lucide-react';
import { ContactForm } from '@/components/contacts/contact-form';
import { ContactDetailView } from '@/components/contacts/contact-detail-view';
import { ImportModal } from '@/components/contacts/import-modal';
import { CustomFieldsManager } from '@/components/contacts/custom-fields-manager';
import { useCan } from '@/hooks/use-can';
import { GatedButton } from '@/components/ui/gated-button';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { addContactTag, deleteContactTag } from '@/lib/contacts/tag-api';
import { AiPitchDialog } from '@/components/inbox/ai-pitch-dialog';

const PAGE_SIZE = 25;

const TAG_PRESET_COLORS = [
  '#6366f1', // indigo
  '#06b6d4', // cyan
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#ec4899', // pink
  '#8b5cf6', // purple
];

const QUICK_NOTE_TEMPLATES = [
  '📞 Call Connected - Interested, ready to consult',
  '📵 Switched off / Not reachable',
  '⏳ Requested callback tomorrow',
  '🏥 Interested in Ayurvedic consultation',
  '🗓️ Booked appointment',
  '💳 ₹499 Offer & fees details explained',
  '❌ Not interested at this time',
];

interface ContactWithTags extends Contact {
  tags?: Tag[];
}

interface ContactTagsCellProps {
  contactId: string;
  contactName: string;
  contactTagIds: string[];
  allTags: Tag[];
  tagsMap: Record<string, Tag>;
  onToggleTag: (contactId: string, tagId: string) => Promise<void>;
  onCreateTag: (contactId: string, name: string, color: string) => Promise<void>;
}

function ContactTagsCell({
  contactId,
  contactName,
  contactTagIds,
  allTags,
  tagsMap,
  onToggleTag,
  onCreateTag,
}: ContactTagsCellProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_PRESET_COLORS[0]);
  const [creating, setCreating] = useState(false);

  const filteredTags = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allTags;
    return allTags.filter((t) => t.name.toLowerCase().includes(q));
  }, [allTags, search]);

  const handleCreate = async () => {
    if (!newTagName.trim() || !contactId) return;
    setCreating(true);
    try {
      await onCreateTag(contactId, newTagName.trim(), newTagColor);
      setNewTagName('');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div
      className="flex flex-wrap items-center gap-1 max-w-[220px]"
      onClick={(e) => e.stopPropagation()}
    >
      {contactTagIds.map((tid) => {
        const tag = tagsMap[tid];
        if (!tag) return null;
        return (
          <Badge
            key={tag.id}
            variant="outline"
            className="text-[11px] font-medium px-1.5 py-0.5 gap-1 border shadow-2xs group/tag transition-all"
            style={{
              backgroundColor: `${tag.color}15`,
              color: tag.color,
              borderColor: `${tag.color}40`,
            }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full shrink-0"
              style={{ backgroundColor: tag.color }}
            />
            <span className="truncate max-w-[100px]">{tag.name}</span>
            <button
              type="button"
              className="opacity-0 group-hover/tag:opacity-100 hover:bg-black/10 dark:hover:bg-white/10 rounded-full p-0.5 transition-opacity cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                if (contactId) onToggleTag(contactId, tag.id);
              }}
              title={`Remove ${tag.name}`}
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </Badge>
        );
      })}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          className="h-6 px-1.5 text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer rounded border border-dashed border-border/80 hover:border-solid hover:bg-muted/60 transition-colors"
          title="Assign or create tags for this contact"
          onClick={(e) => e.stopPropagation()}
        >
          <Plus className="h-3 w-3" />
          <span>{contactTagIds.length === 0 ? 'Tag' : ''}</span>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-72 p-2.5 shadow-xl bg-popover z-50 space-y-2 border"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between pb-1.5 border-b border-border">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <TagIcon className="h-3.5 w-3.5 text-primary" />
              Contact Tags ({contactName || 'Contact'})
            </span>
          </div>

          <Input
            placeholder="Filter tags..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-7 text-xs"
          />

          <div className="max-h-44 overflow-y-auto space-y-0.5 pr-0.5">
            {filteredTags.length === 0 ? (
              <p className="py-3 text-center text-xs text-muted-foreground">
                No matching tags found.
              </p>
            ) : (
              filteredTags.map((t) => {
                const isSelected = contactTagIds.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      if (contactId) onToggleTag(contactId, t.id);
                    }}
                    className={cn(
                      'flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs transition-colors text-left cursor-pointer',
                      isSelected
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <span className="flex items-center gap-2 truncate">
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: t.color }}
                      />
                      <span className="truncate">{t.name}</span>
                    </span>
                    {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0 ml-1" />}
                  </button>
                );
              })
            )}
          </div>

          <div className="border-t border-border pt-2 space-y-1.5">
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Create New Tag
            </div>
            <div className="flex items-center gap-1.5">
              <Input
                placeholder="New tag name..."
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleCreate();
                  }
                }}
                className="h-7 text-xs flex-1"
              />
              <Button
                size="sm"
                type="button"
                disabled={!newTagName.trim() || creating || !contactId}
                onClick={handleCreate}
                className="h-7 px-2 text-xs gap-1"
              >
                {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                Add
              </Button>
            </div>
            <div className="flex items-center gap-1.5 pt-0.5">
              {TAG_PRESET_COLORS.map((col) => (
                <button
                  key={col}
                  type="button"
                  onClick={() => setNewTagColor(col)}
                  className={cn(
                    'h-4 w-4 rounded-full transition-transform cursor-pointer',
                    newTagColor === col ? 'ring-2 ring-offset-1 ring-primary scale-110' : 'hover:scale-105'
                  )}
                  style={{ backgroundColor: col }}
                  title={col}
                />
              ))}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

/**
 * CSV export helper - RFC 4180 quoting with UTF-8 BOM so Excel opens
 * international / Hindi text and commas seamlessly.
 */
function toCsv(rows: string[][]): string {
  const escape = (v: string) => `"${(v ?? '').replace(/"/g, '""')}"`;
  return rows.map((r) => r.map(escape).join(',')).join('\n');
}

function downloadCsv(filename: string, content: string) {
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function formatCsvDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toISOString().replace('T', ' ').substring(0, 19);
  } catch {
    return dateStr;
  }
}

function get10DigitPhone(rawPhone?: string | null): string {
  if (!rawPhone) return '';
  const digits = rawPhone.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return digits.slice(1);
  }
  return digits;
}

function getFormattedPhone(rawPhone?: string | null): string {
  if (!rawPhone) return '';
  const digits = rawPhone.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    const main = digits.slice(2);
    return `+91 ${main.slice(0, 5)} ${main.slice(5)}`;
  }
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  return rawPhone.startsWith('+') ? rawPhone : `+${rawPhone}`;
}

export default function ContactsPage() {
  const router = useRouter();
  const t = useTranslations('Contacts.page');
  const supabase = createClient();
  const { account, profile, user } = useAuth();
  const accountId = account?.id || profile?.account_id;
  const canEdit = useCan('send-messages');
  const canEditSettings = useCan('edit-settings');

  const [contacts, setContacts] = useState<ContactWithTags[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  // Tag filter — contacts shown must have ANY of these tags (OR).
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  // Contact tags map: contactId -> tagId[]
  const [contactTagsMap, setContactTagsMap] = useState<Record<string, string[]>>({});

  // Contact notes map: contactId -> notes list
  const [contactNotesMap, setContactNotesMap] = useState<
    Record<string, { id: string; note_text: string; created_at: string }[]>
  >({});

  // Contact bookings map: contactId -> booking info
  const [contactBookingsMap, setContactBookingsMap] = useState<
    Record<
      string,
      {
        id: string;
        contact_id?: string | null;
        phone: string;
        booking_query_id: string;
        status: string;
        preferred_date?: string | null;
        preferred_time?: string | null;
        consultation_type?: string | null;
        clinic_location?: string | null;
      }
    >
  >({});

  // Booking status filter: 'all' | 'pending' | 'done'
  const [bookingStatusFilter, setBookingStatusFilter] = useState<'all' | 'pending' | 'done'>('all');

  // Follow-up Notes Modal state
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [editingNoteContact, setEditingNoteContact] = useState<Contact | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  // AI Patient Pitch Advisor state
  const [aiPitchOpen, setAiPitchOpen] = useState(false);
  const [selectedContactForPitch, setSelectedContactForPitch] = useState<Contact | null>(null);

  // Modals
  const [formOpen, setFormOpen] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [editContactTags, setEditContactTags] = useState<ContactTag[]>([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailContactId, setDetailContactId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [customFieldsOpen, setCustomFieldsOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Bulk selection (page-scoped — only the loaded rows are selectable)
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  // All tags for display
  const [tagsMap, setTagsMap] = useState<Record<string, Tag>>({});

  // Guards against out-of-order fetch responses: each fetchContacts run
  // claims a sequence number and only the latest is allowed to commit its
  // results. Without this, rapidly toggling tag filters could let a slower
  // earlier request resolve last and render stale rows.
  const fetchSeq = useRef(0);

  const fetchTags = useCallback(async () => {
    const { data } = await supabase.from('tags').select('*');
    if (data) {
      const map: Record<string, Tag> = {};
      data.forEach((t) => (map[t.id] = t));
      setTagsMap(map);
      // Drop any filter selections whose tag no longer exists (e.g. a tag
      // deleted elsewhere) so it can't linger invisibly in the query.
      setSelectedTagIds((prev) => {
        const pruned = prev.filter((id) => map[id]);
        return pruned.length === prev.length ? prev : pruned;
      });
    }
  }, [supabase]);

  const fetchContacts = useCallback(async () => {
    const seq = ++fetchSeq.current;
    setLoading(true);
    // The visible rows are about to change — drop any selection that
    // referred to the old page/search results so the bulk bar can't
    // act on rows the user can no longer see.
    setSelected(new Set());

    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const term = search.trim();

    let contactRows: Contact[];
    let count: number;

    if (selectedTagIds.length > 0) {
      // Tag filter active — resolve it server-side (join + distinct +
      // windowed total count + pagination) so a tag covering many
      // contacts can't silently truncate the result or overflow an IN
      // clause. See migration 025_filter_contacts_by_tags.
      const { data, error } = await supabase.rpc('filter_contacts_by_tags', {
        p_tag_ids: selectedTagIds,
        p_search: term || null,
        p_limit: PAGE_SIZE,
        p_offset: from,
      });
      if (seq !== fetchSeq.current) return; // superseded by a newer fetch
      if (error) {
        toast.error(t('toastFailedLoad'));
        setLoading(false);
        return;
      }
      const rows = (data ?? []) as { contact: Contact; total_count: number }[];
      contactRows = rows.map((r) => r.contact);
      count = rows.length > 0 ? Number(rows[0].total_count) : 0;
    } else {
      let query = supabase
        .from('contacts')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (term) {
        const like = `%${term}%`;
        query = query.or(`name.ilike.${like},phone.ilike.${like},email.ilike.${like},ad_name.ilike.${like},ad_id.ilike.${like}`);
      }

      const { data, count: exactCount, error } = await query;
      if (seq !== fetchSeq.current) return; // superseded by a newer fetch
      if (error) {
        toast.error(t('toastFailedLoad'));
        setLoading(false);
        return;
      }
      contactRows = data ?? [];
      count = exactCount ?? 0;
    }

    setTotalCount(count);

    if (contactRows.length === 0) {
      setContacts([]);
      setContactTagsMap({});
      setContactNotesMap({});
      setContactBookingsMap({});
      setLoading(false);
      return;
    }

    // Fetch tags, notes & bookings for these contacts in parallel
    const contactIds = contactRows.map((c) => c.id);
    const contactPhones = contactRows.map((c) => c.phone).filter(Boolean) as string[];

    const [
      { data: contactTags },
      { data: contactNotes },
      { data: bookingsByContactId },
      { data: bookingsByPhone },
    ] = await Promise.all([
      supabase
        .from('contact_tags')
        .select('contact_id, tag_id')
        .in('contact_id', contactIds),
      supabase
        .from('contact_notes')
        .select('id, contact_id, note_text, created_at')
        .in('contact_id', contactIds)
        .order('created_at', { ascending: false }),
      supabase
        .from('bookings')
        .select('id, contact_id, phone, booking_query_id, status, preferred_date, preferred_time, consultation_type, clinic_location')
        .in('contact_id', contactIds)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false }),
      contactPhones.length > 0
        ? supabase
            .from('bookings')
            .select('id, contact_id, phone, booking_query_id, status, preferred_date, preferred_time, consultation_type, clinic_location')
            .in('phone', contactPhones)
            .neq('status', 'cancelled')
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [] }),
    ]);

    if (seq !== fetchSeq.current) return; // superseded by a newer fetch

    const tagsByContact: Record<string, string[]> = {};
    contactTags?.forEach((ct) => {
      if (!tagsByContact[ct.contact_id]) tagsByContact[ct.contact_id] = [];
      tagsByContact[ct.contact_id].push(ct.tag_id);
    });
    setContactTagsMap(tagsByContact);

    const notesByContact: Record<string, { id: string; note_text: string; created_at: string }[]> = {};
    contactNotes?.forEach((cn) => {
      if (!notesByContact[cn.contact_id]) notesByContact[cn.contact_id] = [];
      notesByContact[cn.contact_id].push(cn);
    });
    setContactNotesMap(notesByContact);

    // Map bookings: phone fallback first, then direct contact_id priority
    const bMap: Record<
      string,
      {
        id: string;
        contact_id?: string | null;
        phone: string;
        booking_query_id: string;
        status: string;
        preferred_date?: string | null;
        preferred_time?: string | null;
        consultation_type?: string | null;
        clinic_location?: string | null;
      }
    > = {};

    bookingsByPhone?.forEach((b) => {
      if (b.phone) {
        const digits = b.phone.replace(/\D/g, '').slice(-10);
        const match = contactRows.find(
          (c) => c.phone && c.phone.replace(/\D/g, '').slice(-10) === digits
        );
        if (match) bMap[match.id] = b;
      }
    });

    bookingsByContactId?.forEach((b) => {
      if (b.contact_id) bMap[b.contact_id] = b;
    });

    setContactBookingsMap(bMap);

    const enriched: ContactWithTags[] = contactRows.map((c) => ({
      ...c,
      tags: (tagsByContact[c.id] ?? [])
        .map((tid) => tagsMap[tid])
        .filter(Boolean),
    }));

    setContacts(enriched);
    setLoading(false);
  }, [supabase, page, search, selectedTagIds, tagsMap, t]);

  // Load-once-on-mount-ish data fetches. Each setter inside runs
  // inside an async promise completion (Supabase await), not
  // synchronously in the effect body, so the cascade the lint rule
  // warns about doesn't apply here.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchTags();
  }, [fetchTags]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchContacts();
  }, [fetchContacts]);

  const bookingCounts = useMemo(() => {
    let done = 0;
    let pending = 0;
    contacts.forEach((c) => {
      if (contactBookingsMap[c.id]) done++;
      else pending++;
    });
    return { done, pending, total: contacts.length };
  }, [contacts, contactBookingsMap]);

  const displayedContacts = useMemo(() => {
    if (bookingStatusFilter === 'all') return contacts;
    if (bookingStatusFilter === 'done') {
      return contacts.filter((c) => Boolean(contactBookingsMap[c.id]));
    }
    if (bookingStatusFilter === 'pending') {
      return contacts.filter((c) => !contactBookingsMap[c.id]);
    }
    return contacts;
  }, [contacts, bookingStatusFilter, contactBookingsMap]);

  const handleOpenInbox = async (contact: Contact) => {
    try {
      // 1. Direct lookup in conversations table by contact_id
      const { data: conv } = await supabase
        .from('conversations')
        .select('id')
        .eq('contact_id', contact.id)
        .order('last_message_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (conv?.id) {
        router.push(`/inbox?c=${conv.id}`);
        return;
      }

      // 2. Fallback lookup by phone digits (last 10 digits)
      if (contact.phone) {
        const digits = contact.phone.replace(/\D/g, '');
        const last10 = digits.slice(-10);
        const { data: convByPhone } = await supabase
          .from('conversations')
          .select('id, contact_id, contacts!inner(phone)')
          .ilike('contacts.phone', `%${last10}%`)
          .order('last_message_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (convByPhone?.id) {
          router.push(`/inbox?c=${convByPhone.id}`);
          return;
        }
      }

      toast.info('No active conversation found yet, opening CRM Inbox');
      router.push('/inbox');
    } catch (err) {
      console.warn('Inbox lookup error:', err);
      router.push('/inbox');
    }
  };

  const toggleContactTag = async (contactId: string, tagId: string) => {
    if (!contactId) return;
    const currentTags = contactTagsMap[contactId] || [];
    const isSelected = currentTags.includes(tagId);

    // Optimistic UI update
    setContactTagsMap((prev) => {
      const list = prev[contactId] || [];
      return {
        ...prev,
        [contactId]: isSelected ? list.filter((id) => id !== tagId) : [...list, tagId],
      };
    });

    try {
      if (isSelected) {
        await deleteContactTag(contactId, tagId);
      } else {
        await addContactTag(contactId, tagId);
      }
      toast.success(isSelected ? 'Tag removed' : 'Tag assigned');
    } catch (err: any) {
      console.warn('API tag toggle error, attempting DB fallback:', err);
      try {
        if (isSelected) {
          await supabase
            .from('contact_tags')
            .delete()
            .eq('contact_id', contactId)
            .eq('tag_id', tagId);
        } else {
          await supabase
            .from('contact_tags')
            .insert({ contact_id: contactId, tag_id: tagId });
        }
        toast.success(isSelected ? 'Tag removed' : 'Tag assigned');
      } catch (fallbackErr) {
        // Revert on failure
        setContactTagsMap((prev) => {
          const list = prev[contactId] || [];
          return {
            ...prev,
            [contactId]: isSelected ? [...list, tagId] : list.filter((id) => id !== tagId),
          };
        });
        toast.error('Failed to update tag');
      }
    }
  };

  const handleCreateAndAssignTag = async (
    contactId: string,
    name: string,
    color: string
  ) => {
    if (!name.trim() || !accountId) {
      toast.error('Unable to create tag: Account ID missing');
      return;
    }
    try {
      const { data: newTag, error } = await supabase
        .from('tags')
        .insert({
          account_id: accountId,
          name: name.trim(),
          color: color || TAG_PRESET_COLORS[0],
        })
        .select()
        .single();

      if (error) throw error;
      if (newTag) {
        setTagsMap((prev) => ({ ...prev, [newTag.id]: newTag }));
        if (contactId) {
          await toggleContactTag(contactId, newTag.id);
        }
        toast.success(`Tag "${newTag.name}" created & assigned`);
      }
    } catch (err: any) {
      console.error('Failed to create tag:', err);
      toast.error(err?.message || 'Failed to create tag');
    }
  };

  const handleSaveContactNote = async () => {
    if (!editingNoteContact || !noteDraft.trim()) return;
    if (!accountId) {
      toast.error('Account ID not available');
      return;
    }
    setSavingNote(true);
    const cleanNote = noteDraft.trim();
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const currentUserId = session?.user?.id || user?.id;

      const { data: inserted, error } = await supabase
        .from('contact_notes')
        .insert({
          contact_id: editingNoteContact.id,
          account_id: accountId,
          user_id: currentUserId,
          note_text: cleanNote,
        })
        .select()
        .single();

      if (error) throw error;

      // Update state
      setContactNotesMap((prev) => {
        const list = prev[editingNoteContact.id] || [];
        return {
          ...prev,
          [editingNoteContact.id]: [inserted, ...list],
        };
      });

      toast.success('Follow-up note added successfully');
      setNoteDraft('');
      setNoteModalOpen(false);
    } catch (err: any) {
      console.error('Failed to save contact note:', err);
      toast.error(err?.message || 'Failed to save note');
    } finally {
      setSavingNote(false);
    }
  };

  function openAddForm() {
    setEditContact(null);
    setEditContactTags([]);
    setFormOpen(true);
  }

  async function openEditForm(contact: Contact) {
    const { data } = await supabase
      .from('contact_tags')
      .select('*')
      .eq('contact_id', contact.id);
    setEditContact(contact);
    setEditContactTags(data ?? []);
    setFormOpen(true);
  }

  function openDetail(contactId: string) {
    setDetailContactId(contactId);
    setDetailOpen(true);
  }

  function confirmDelete(contact: Contact) {
    setDeleteTarget(contact);
    setDeleteConfirmOpen(true);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);

    const { error } = await supabase
      .from('contacts')
      .delete()
      .eq('id', deleteTarget.id);

    if (error) {
      toast.error(t('toastFailedDelete'));
    } else {
      toast.success(t('toastDeleted'));
      fetchContacts();
    }

    setDeleting(false);
    setDeleteConfirmOpen(false);
    setDeleteTarget(null);
  }

  const allOnPageSelected =
    displayedContacts.length > 0 && displayedContacts.every((c) => selected.has(c.id));
  const someOnPageSelected = displayedContacts.some((c) => selected.has(c.id));

  function toggleSelectAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) {
        displayedContacts.forEach((c) => next.delete(c.id));
      } else {
        displayedContacts.forEach((c) => next.add(c.id));
      }
      return next;
    });
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleBulkDelete() {
    const ids = [...selected];
    if (ids.length === 0) return;
    setDeleting(true);

    const { error } = await supabase.from('contacts').delete().in('id', ids);

    if (error) {
      toast.error(t('toastBulkFailedDelete'));
    } else {
      toast.success(t('toastBulkDeleted', { count: ids.length }));
      setSelected(new Set());
      fetchContacts();
    }

    setDeleting(false);
    setBulkDeleteOpen(false);
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const hasNext = page < totalPages - 1;
  const hasPrev = page > 0;

  // Tag filter helpers. Every change resets to page 0 — the result set
  // shrinks/grows so page N may no longer be valid (mirrors the search box).
  const allTags = Object.values(tagsMap).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
  const hasActiveFilters = search.trim().length > 0 || selectedTagIds.length > 0;

  function toggleTagFilter(tagId: string) {
    setSelectedTagIds((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId]
    );
    setPage(0);
  }

  function clearTagFilters() {
    setSelectedTagIds([]);
    setPage(0);
  }

  const handleExportCsv = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      toast.info('Preparing contacts export...');
      const term = search.trim();
      let exportContactRows: Contact[] = [];

      if (selectedTagIds.length > 0) {
        // Tag filter active - fetch all contacts matching active tags
        const { data, error } = await supabase.rpc('filter_contacts_by_tags', {
          p_tag_ids: selectedTagIds,
          p_search: term || null,
          p_limit: 10000,
          p_offset: 0,
        });
        if (error) throw error;
        const rows = (data ?? []) as { contact: Contact; total_count: number }[];
        exportContactRows = rows.map((r) => r.contact);
      } else {
        // Fetch all contacts matching search query
        let query = supabase
          .from('contacts')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(10000);

        if (term) {
          const like = `%${term}%`;
          query = query.or(`name.ilike.${like},phone.ilike.${like},email.ilike.${like},ad_name.ilike.${like},ad_id.ilike.${like}`);
        }

        const { data, error } = await query;
        if (error) throw error;
        exportContactRows = data ?? [];
      }

      if (exportContactRows.length === 0) {
        toast.error('No contacts found to export');
        return;
      }

      // Fetch tags and bookings for exported contacts in safe chunks
      const contactIds = exportContactRows.map((c) => c.id);
      const chunkSize = 500;
      const allContactTags: { contact_id: string; tag_id: string }[] = [];
      const allBookings: { contact_id?: string | null; phone: string; booking_query_id: string }[] = [];

      for (let i = 0; i < contactIds.length; i += chunkSize) {
        const chunk = contactIds.slice(i, i + chunkSize);
        const [{ data: ctData }, { data: bkData }] = await Promise.all([
          supabase
            .from('contact_tags')
            .select('contact_id, tag_id')
            .in('contact_id', chunk),
          supabase
            .from('bookings')
            .select('contact_id, phone, booking_query_id')
            .in('contact_id', chunk)
            .neq('status', 'cancelled'),
        ]);

        if (ctData) allContactTags.push(...ctData);
        if (bkData) allBookings.push(...bkData);
      }

      const tagsByContact: Record<string, string[]> = {};
      allContactTags.forEach((ct) => {
        if (!tagsByContact[ct.contact_id]) tagsByContact[ct.contact_id] = [];
        tagsByContact[ct.contact_id].push(ct.tag_id);
      });

      const bookingsByContact: Record<string, string> = {};
      allBookings.forEach((b) => {
        if (b.contact_id) bookingsByContact[b.contact_id] = b.booking_query_id;
      });

      // Fetch custom fields
      const { data: customFieldsData } = await supabase
        .from('custom_fields')
        .select('id, field_name')
        .order('field_name');
      const customFields = customFieldsData ?? [];

      const customValuesByContact: Record<string, Record<string, string>> = {};
      if (customFields.length > 0) {
        for (let i = 0; i < contactIds.length; i += chunkSize) {
          const chunk = contactIds.slice(i, i + chunkSize);
          const { data: cvData } = await supabase
            .from('contact_custom_values')
            .select('contact_id, custom_field_id, value')
            .in('contact_id', chunk);
          if (cvData) {
            cvData.forEach((cv) => {
              if (!customValuesByContact[cv.contact_id]) {
                customValuesByContact[cv.contact_id] = {};
              }
              if (cv.value) {
                customValuesByContact[cv.contact_id][cv.custom_field_id] = cv.value;
              }
            });
          }
        }
      }

      // Build CSV headers and rows
      const headers = [
        'Name',
        'Mobile (10 Digits)',
        'WhatsApp Phone (+91)',
        'Booking Status',
        'Booking Query ID',
        'Email',
        'City / Location',
        'Meta Ad Name',
        'Meta Ad ID',
        'Tags',
        ...customFields.map((f) => f.field_name),
        'Created At',
      ];

      const rows = exportContactRows.map((c) => {
        const contactTagNames = (tagsByContact[c.id] ?? [])
          .map((tid) => tagsMap[tid]?.name)
          .filter(Boolean)
          .join(', ');

        const bQueryId = bookingsByContact[c.id] || '';
        const bStatus = bQueryId ? 'Booking Done' : 'Booking Pending';

        const customCells = customFields.map(
          (f) => customValuesByContact[c.id]?.[f.id] ?? ''
        );

        return [
          c.name ?? '',
          get10DigitPhone(c.phone),
          getFormattedPhone(c.phone),
          bStatus,
          bQueryId,
          c.email ?? '',
          c.city ?? '',
          c.ad_name ?? '',
          c.ad_id ?? '',
          contactTagNames,
          ...customCells,
          formatCsvDate(c.created_at),
        ];
      });

      const csvContent = toCsv([headers, ...rows]);
      const dateStr = new Date().toISOString().split('T')[0];
      let filename = `contacts-${dateStr}.csv`;
      if (selectedTagIds.length > 0) {
        const tagNames = selectedTagIds
          .map((id) => tagsMap[id]?.name)
          .filter(Boolean)
          .join('-')
          .replace(/[^a-zA-Z0-9_\u0900-\u097F-]/g, '_');
        filename = `contacts-${tagNames}-${dateStr}.csv`;
      } else if (term) {
        filename = `contacts-search_${term.replace(/[^a-zA-Z0-9_\u0900-\u097F-]/g, '_')}-${dateStr}.csv`;
      }

      downloadCsv(filename, csvContent);
      toast.success(`Exported ${exportContactRows.length} contacts successfully!`);
    } catch (err) {
      console.error('[Contacts] export error:', err);
      toast.error('Failed to export contacts');
    } finally {
      setExporting(false);
    }
  };

  const handleExportSelected = () => {
    if (selected.size === 0) return;
    try {
      const selectedContacts = contacts.filter((c) => selected.has(c.id));
      if (selectedContacts.length === 0) return;

      const headers = [
        'Name',
        'Mobile (10 Digits)',
        'WhatsApp Phone (+91)',
        'Booking Status',
        'Booking Query ID',
        'Email',
        'City / Location',
        'Tags',
        'Created At',
      ];
      const rows = selectedContacts.map((c) => {
        const bk = contactBookingsMap[c.id];
        return [
          c.name ?? '',
          get10DigitPhone(c.phone),
          getFormattedPhone(c.phone),
          bk ? 'Booking Done' : 'Booking Pending',
          bk?.booking_query_id || '',
          c.email ?? '',
          c.city ?? '',
          (c.tags ?? []).map((t) => t.name).join(', '),
          formatCsvDate(c.created_at),
        ];
      });

      const csvContent = toCsv([headers, ...rows]);
      const dateStr = new Date().toISOString().split('T')[0];
      downloadCsv(`contacts-selected-${selected.size}-${dateStr}.csv`, csvContent);
      toast.success(`Exported ${selectedContacts.length} selected contacts!`);
    } catch (err) {
      console.error('[Contacts] export selected error:', err);
      toast.error('Failed to export selected contacts');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {totalCount > 0 ? t('subtitle', { count: totalCount }) : t('subtitleZero')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canEditSettings && (
            <Button
              variant="outline"
              onClick={() => setCustomFieldsOpen(true)}
              className="border-border text-muted-foreground hover:bg-muted"
            >
              <SlidersHorizontal className="size-4" />
              {t('customFieldsBtn')}
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => router.push('/analytics')}
            className="border-border text-primary hover:bg-primary/5 gap-1.5"
          >
            <BarChart3 className="size-4" />
            Analytics & Ads
          </Button>
          <Button
            variant="outline"
            onClick={handleExportCsv}
            disabled={exporting || totalCount === 0}
            className="border-border text-muted-foreground hover:bg-muted"
          >
            {exporting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            Export CSV {selectedTagIds.length > 0 && totalCount > 0 ? `(${totalCount})` : ''}
          </Button>
          <GatedButton
            variant="outline"
            canAct={canEdit}
            gateReason="add or import contacts"
            onClick={() => setImportOpen(true)}
            className="border-border text-muted-foreground hover:bg-muted"
          >
            <Upload className="size-4" />
            {t('importBtn')}
          </GatedButton>
          <GatedButton
            canAct={canEdit}
            gateReason="add or import contacts"
            onClick={openAddForm}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Plus className="size-4" />
            {t('addContactBtn')}
          </GatedButton>
        </div>
      </div>

      {/* Search + booking filter + tag filter */}
      <div className="space-y-2">
        <div className="flex flex-col lg:flex-row gap-2 items-stretch lg:items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center flex-1">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  // Reset pagination when the query changes — the result
                  // set shrinks/grows, page N may no longer be valid.
                  setPage(0);
                }}
                placeholder={t('searchPlaceholder')}
                className="pl-8 bg-card border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>

            {/* Booking Status Filter: All | Booking Pending | Booking Done */}
            <div className="flex items-center gap-1 border border-border rounded-lg p-0.5 bg-muted/30 shrink-0">
              <Button
                type="button"
                variant={bookingStatusFilter === 'all' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setBookingStatusFilter('all')}
                className="h-8 text-xs px-2.5 font-medium cursor-pointer"
              >
                All Contacts ({bookingCounts.total})
              </Button>
              <Button
                type="button"
                variant={bookingStatusFilter === 'pending' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setBookingStatusFilter('pending')}
                className={cn(
                  "h-8 text-xs px-2.5 gap-1.5 font-semibold transition-all cursor-pointer",
                  bookingStatusFilter === 'pending'
                    ? "bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                    : "text-amber-600 dark:text-amber-400 hover:text-amber-700 hover:bg-amber-500/10"
                )}
                title="Show only leads who have not booked yet so you can call them"
              >
                <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                Booking Pending ({bookingCounts.pending})
              </Button>
              <Button
                type="button"
                variant={bookingStatusFilter === 'done' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setBookingStatusFilter('done')}
                className={cn(
                  "h-8 text-xs px-2.5 gap-1.5 font-semibold transition-all cursor-pointer",
                  bookingStatusFilter === 'done'
                    ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                    : "text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 hover:bg-emerald-500/10"
                )}
                title="Show contacts who have confirmed appointment bookings"
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                Booking Done ({bookingCounts.done})
              </Button>
            </div>

            <Popover>
              <PopoverTrigger
                render={
                  <Button
                    variant="outline"
                    className="border-border text-muted-foreground hover:bg-muted shrink-0"
                  />
                }
              >
                <Filter className="size-4" />
                {t('filterByTags')}
                {selectedTagIds.length > 0 && (
                  <span className="ml-1 inline-flex items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                    {selectedTagIds.length}
                  </span>
                )}
              </PopoverTrigger>
              <PopoverContent align="start" className="w-64 p-0">
                <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                  <span className="text-sm font-medium text-popover-foreground">
                    {t('filterByTags')}
                  </span>
                  {selectedTagIds.length > 0 && (
                    <button
                      onClick={clearTagFilters}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      {t('clearAll')}
                    </button>
                  )}
                </div>
                {allTags.length === 0 ? (
                  <p className="px-3 py-4 text-sm text-muted-foreground text-center">
                    {t('noTagsYet')}
                  </p>
                ) : (
                  <div className="max-h-64 overflow-y-auto py-1">
                    {allTags.map((tag) => (
                      <label
                        key={tag.id}
                        className="flex items-center gap-2.5 px-3 py-1.5 cursor-pointer hover:bg-muted/50"
                      >
                        <Checkbox
                          checked={selectedTagIds.includes(tag.id)}
                          onCheckedChange={() => toggleTagFilter(tag.id)}
                          aria-label={`Filter by ${tag.name}`}
                        />
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: tag.color }}
                        />
                        <span className="text-sm text-popover-foreground truncate">
                          {tag.name}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Active tag-filter chips */}
        {selectedTagIds.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {selectedTagIds.map((id) => {
              const tag = tagsMap[id];
              if (!tag) return null;
              return (
                <span
                  key={id}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                  style={{
                    backgroundColor: tag.color + '20',
                    color: tag.color,
                  }}
                >
                  {tag.name}
                  <button
                    onClick={() => toggleTagFilter(id)}
                    aria-label={`Remove ${tag.name} filter`}
                    className="hover:opacity-70"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              );
            })}
            <button
              onClick={clearTagFilters}
              className="text-xs text-muted-foreground hover:text-foreground px-1"
            >
              {t('clearAll')}
            </button>
          </div>
        )}
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/40 px-4 py-2">
          <p className="text-sm text-foreground">
            {t('selectedCount', { count: selected.size })}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportSelected}
              disabled={exporting}
              className="border-border text-muted-foreground hover:text-foreground"
            >
              <Download className="size-3.5" />
              Export selected ({selected.size})
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelected(new Set())}
              className="text-muted-foreground hover:text-foreground"
            >
              {t('clearSelection')}
            </Button>
            <GatedButton
              variant="destructive"
              size="sm"
              canAct={canEdit}
              gateReason="delete contacts"
              onClick={() => setBulkDeleteOpen(true)}
            >
              <Trash2 className="size-4" />
              {t('deleteSelected')}
            </GatedButton>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="w-10">
                <Checkbox
                  checked={allOnPageSelected}
                  indeterminate={!allOnPageSelected && someOnPageSelected}
                  onCheckedChange={toggleSelectAll}
                  disabled={displayedContacts.length === 0}
                  aria-label={t('selectAllOnPage')}
                />
              </TableHead>
              <TableHead className="text-muted-foreground">{t('tableColumns.name')}</TableHead>
              <TableHead className="text-muted-foreground min-w-[210px]">{t('tableColumns.phone')}</TableHead>
              <TableHead className="text-muted-foreground min-w-[155px]">Booking Status</TableHead>
              <TableHead className="text-muted-foreground min-w-[130px]">AI Pitch</TableHead>
              <TableHead className="text-muted-foreground min-w-[160px]">{t('tableColumns.tags')}</TableHead>
              <TableHead className="text-muted-foreground min-w-[190px]">Follow-up Notes</TableHead>
              <TableHead className="text-muted-foreground hidden sm:table-cell">City / Location</TableHead>
              <TableHead className="text-muted-foreground hidden lg:table-cell">Meta Ad Source</TableHead>
              <TableHead className="text-muted-foreground hidden xl:table-cell">{t('tableColumns.email')}</TableHead>
              <TableHead className="text-muted-foreground hidden 2xl:table-cell">{t('tableColumns.createdAt')}</TableHead>
              <TableHead className="text-muted-foreground w-12 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow className="border-border">
                <TableCell colSpan={12} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="size-6 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">{t('loading')}</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : displayedContacts.length === 0 ? (
              <TableRow className="border-border">
                <TableCell colSpan={12} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2">
                    <Users className="size-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      {bookingStatusFilter !== 'all'
                        ? `No contacts found with booking status: ${bookingStatusFilter === 'pending' ? 'Pending' : 'Done'}`
                        : hasActiveFilters
                        ? t('noContactsMatch')
                        : t('noContactsYet')}
                    </p>
                    {!hasActiveFilters && bookingStatusFilter === 'all' && (
                      <GatedButton
                        canAct={canEdit}
                        gateReason="add or import contacts"
                        variant="outline"
                        size="sm"
                        onClick={openAddForm}
                        className="mt-2 border-border text-muted-foreground hover:bg-muted"
                      >
                        <Plus className="size-3.5" />
                        {t('addFirstContact')}
                      </GatedButton>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              displayedContacts.map((contact) => (
                <TableRow
                  key={contact.id}
                  className="border-border hover:bg-muted/50 cursor-pointer"
                  onClick={() => openDetail(contact.id)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selected.has(contact.id)}
                      onCheckedChange={() => toggleSelect(contact.id)}
                      aria-label={`Select ${contact.name || contact.phone}`}
                    />
                  </TableCell>
                  <TableCell className="text-foreground font-medium">
                    <div>
                      <div>{contact.name || <span className="text-muted-foreground italic">{t('unnamed')}</span>}</div>
                      <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs text-muted-foreground font-normal">
                        {(contact.city || contact.company) && (
                          <div className="flex items-center gap-1">
                            <MapPin className="size-3 text-emerald-500 shrink-0" />
                            <span>{contact.city || contact.company}</span>
                          </div>
                        )}
                        {(contact.ad_name || contact.ad_id) && (
                          <div className="lg:hidden inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-medium border border-blue-500/20 truncate max-w-[150px]">
                            <Megaphone className="size-2.5 shrink-0" />
                            <span className="truncate">{contact.ad_name || `Ad ${contact.ad_id}`}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground font-mono text-xs">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span>{getFormattedPhone(contact.phone) || contact.phone || '-'}</span>
                      {contact.phone && (
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-6 px-2 text-[11px] gap-1 font-semibold text-primary border-primary/30 bg-primary/5 hover:bg-primary/15 transition-all shadow-2xs cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenInbox(contact);
                            }}
                            title="Open chat in CRM Inbox"
                          >
                            <MessageSquare className="h-3 w-3 text-primary" />
                            Inbox
                          </Button>
                          <a
                            href={`tel:${contact.phone}`}
                            onClick={(e) => e.stopPropagation()}
                            title={`Call ${contact.name || contact.phone}`}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-600 hover:text-white transition-all font-sans font-semibold text-[11px] shadow-xs cursor-pointer border border-emerald-500/20"
                            aria-label={`Call ${contact.name || contact.phone}`}
                          >
                            <Phone className="size-2.5 fill-current" />
                            <span>Call</span>
                          </a>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  {/* Booking Status Column */}
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {(() => {
                      const booking = contactBookingsMap[contact.id];
                      if (booking) {
                        return (
                          <div className="space-y-1">
                            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 gap-1 text-xs font-semibold py-0.5">
                              <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                              Booking Done
                            </Badge>
                            <div className="text-[11px] text-muted-foreground flex items-center gap-1 font-mono">
                              <span className="font-semibold text-foreground">{booking.booking_query_id}</span>
                              {booking.preferred_date && (
                                <span className="text-[10px] text-muted-foreground font-sans">
                                  • {booking.preferred_date}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      }
                      return (
                        <div className="space-y-0.5">
                          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 gap-1 text-xs font-semibold py-0.5">
                            <Clock className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                            Booking Pending
                          </Badge>
                          <p className="text-[10px] text-muted-foreground font-medium">Needs follow-up call</p>
                        </div>
                      );
                    })()}
                  </TableCell>
                  {/* AI Pitch Advisor */}
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2.5 text-xs gap-1.5 font-semibold text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800 bg-purple-50/60 dark:bg-purple-950/30 hover:bg-purple-100 hover:border-purple-300 dark:hover:bg-purple-900/40 shadow-2xs transition-all cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedContactForPitch(contact);
                        setAiPitchOpen(true);
                      }}
                      title="Analyze chat history and get telecalling pitch & script"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                      Analyze Pitch
                    </Button>
                  </TableCell>
                  {/* Interactive Tags Cell */}
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <ContactTagsCell
                      contactId={contact.id}
                      contactName={contact.name || contact.phone || ''}
                      contactTagIds={contactTagsMap[contact.id] || []}
                      allTags={allTags}
                      tagsMap={tagsMap}
                      onToggleTag={toggleContactTag}
                      onCreateTag={handleCreateAndAssignTag}
                    />
                  </TableCell>
                  {/* Follow-up Notes Cell */}
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {(() => {
                      const notesList = contactNotesMap[contact.id] || [];
                      const latestNote = notesList[0];
                      return latestNote ? (
                        <div
                          className="group/note flex items-start justify-between gap-1.5 p-1.5 rounded-md bg-muted/40 hover:bg-muted/70 border border-border/60 text-xs cursor-pointer max-w-[210px] transition-colors"
                          onClick={() => {
                            setEditingNoteContact(contact);
                            setNoteDraft('');
                            setNoteModalOpen(true);
                          }}
                          title="Click to view notes history or add follow-up note"
                        >
                          <div className="flex items-start gap-1 min-w-0">
                            <FileText className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                            <span className="line-clamp-2 text-foreground font-normal break-words">
                              {latestNote.note_text}
                            </span>
                          </div>
                          <Pencil className="h-3 w-3 text-muted-foreground group-hover/note:text-foreground shrink-0 mt-0.5 opacity-50 group-hover/note:opacity-100 transition-opacity" />
                        </div>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground gap-1 border border-dashed border-border/80 hover:border-solid hover:bg-muted/50 font-normal cursor-pointer"
                          onClick={() => {
                            setEditingNoteContact(contact);
                            setNoteDraft('');
                            setNoteModalOpen(true);
                          }}
                          title="Add follow-up note"
                        >
                          <Pencil className="h-3 w-3" />
                          <span>+ Add Note</span>
                        </Button>
                      );
                    })()}
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden sm:table-cell text-sm">
                    {contact.city || contact.company || <span className="text-muted-foreground">-</span>}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {contact.ad_name || contact.ad_id ? (
                      <div className="flex flex-col gap-0.5 max-w-[190px]">
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-medium truncate border border-blue-500/20"
                          title={contact.ad_name || `Meta Ad ID: ${contact.ad_id}`}
                        >
                          <Megaphone className="size-3 shrink-0" />
                          <span className="truncate">{contact.ad_name || 'Meta Ad'}</span>
                        </span>
                        {contact.ad_id && (
                          <span className="text-[10px] text-muted-foreground font-mono truncate pl-1">
                            ID: {contact.ad_id}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground/60 text-xs italic">Direct</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden xl:table-cell text-sm">
                    {contact.email || <span className="text-muted-foreground">-</span>}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs hidden 2xl:table-cell">
                    {new Date(contact.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-muted-foreground hover:text-foreground"
                            onClick={(e) => e.stopPropagation()}
                          />
                        }
                      >
                        <MoreHorizontal className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="bg-popover border-border"
                      >
                        {contact.phone && (
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              window.location.href = `tel:${contact.phone}`;
                            }}
                            className="text-popover-foreground focus:bg-muted focus:text-foreground flex items-center gap-2 cursor-pointer"
                          >
                            <Phone className="size-4 text-emerald-500" />
                            Call ({contact.phone})
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenInbox(contact);
                          }}
                          className="text-popover-foreground focus:bg-muted focus:text-foreground flex items-center gap-2 cursor-pointer"
                        >
                          <MessageSquare className="size-4 text-primary" />
                          Open Inbox Chat
                        </DropdownMenuItem>
                        {contactBookingsMap[contact.id] && (
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/bookings?search=${contactBookingsMap[contact.id].booking_query_id}`);
                            }}
                            className="text-popover-foreground focus:bg-muted focus:text-foreground flex items-center gap-2 cursor-pointer font-medium"
                          >
                            <CheckCircle2 className="size-4 text-emerald-500" />
                            View Booking ({contactBookingsMap[contact.id].booking_query_id})
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedContactForPitch(contact);
                            setAiPitchOpen(true);
                          }}
                          className="text-popover-foreground focus:bg-muted focus:text-foreground flex items-center gap-2 cursor-pointer"
                        >
                          <Sparkles className="size-4 text-purple-500" />
                          AI Calling Pitch
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingNoteContact(contact);
                            setNoteDraft('');
                            setNoteModalOpen(true);
                          }}
                          className="text-popover-foreground focus:bg-muted focus:text-foreground flex items-center gap-2 cursor-pointer"
                        >
                          <FileText className="size-4 text-primary" />
                          Add Follow-up Note
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditForm(contact);
                          }}
                          className="text-popover-foreground focus:bg-muted focus:text-foreground flex items-center gap-2 cursor-pointer"
                        >
                          <Pencil className="size-4" />
                          {t('editAction')}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-border" />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            confirmDelete(contact);
                          }}
                        >
                          <Trash2 className="size-4" />
                          {t('deleteAction')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {t('showingPagination', {
              start: page * PAGE_SIZE + 1,
              end: Math.min((page + 1) * PAGE_SIZE, totalCount),
              total: totalCount
            })}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              disabled={!hasPrev}
              onClick={() => setPage((p) => p - 1)}
              className="border-border text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="text-xs text-muted-foreground px-2">
              {t('pageCount', { page: page + 1, total: totalPages })}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              disabled={!hasNext}
              onClick={() => setPage((p) => p + 1)}
              className="border-border text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Contact Form Dialog */}
      <ContactForm
        open={formOpen}
        onOpenChange={setFormOpen}
        contact={editContact}
        contactTags={editContactTags}
        onSaved={() => {
          fetchContacts();
          fetchTags();
        }}
        onViewExisting={(id) => {
          setFormOpen(false);
          openDetail(id);
        }}
      />

      {/* Contact Detail Sheet */}
      <ContactDetailView
        open={detailOpen}
        onOpenChange={setDetailOpen}
        contactId={detailContactId}
        onUpdated={fetchContacts}
      />

      {/* Import Modal */}
      <ImportModal
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={fetchContacts}
      />

      {/* Custom Fields Manager (admin+) */}
      {canEditSettings && (
        <CustomFieldsManager
          open={customFieldsOpen}
          onOpenChange={setCustomFieldsOpen}
        />
      )}

      {/* Delete Confirmation */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="bg-popover border-border text-popover-foreground sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-popover-foreground">{t('deleteContactTitle')}</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {t('deleteContactDesc', { name: deleteTarget?.name || deleteTarget?.phone || '' })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="bg-popover border-border">
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmOpen(false)}
              className="border-border text-muted-foreground hover:bg-muted"
            >
              {t('cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting && <Loader2 className="size-4 animate-spin" />}
              {t('deleteBtn')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirmation */}
      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent className="bg-popover border-border text-popover-foreground sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-popover-foreground">
              {t('deleteBulkTitle')}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {t('deleteBulkDesc', { count: selected.size })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="bg-popover border-border">
            <Button
              variant="outline"
              onClick={() => setBulkDeleteOpen(false)}
              className="border-border text-muted-foreground hover:bg-muted"
            >
              {t('cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={deleting}
            >
              {deleting && <Loader2 className="size-4 animate-spin" />}
              {t('deleteBtn')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Follow-up Note Dialog */}
      <Dialog open={noteModalOpen} onOpenChange={setNoteModalOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Follow-up Notes
            </DialogTitle>
            <DialogDescription>
              Record call outcome, patient response, and next steps for{' '}
              <strong className="text-foreground">
                {editingNoteContact?.name || editingNoteContact?.phone || 'Contact'}
              </strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 max-h-[60vh] overflow-y-auto pr-1">
            {/* Previous Notes History */}
            {editingNoteContact && (contactNotesMap[editingNoteContact.id]?.length || 0) > 0 && (
              <div className="space-y-1.5 pb-2 border-b border-border">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                  Previous Notes History ({contactNotesMap[editingNoteContact.id]?.length})
                </span>
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {contactNotesMap[editingNoteContact.id]?.map((note) => (
                    <div
                      key={note.id}
                      className="p-2 rounded bg-muted/40 border border-border/60 text-xs text-foreground space-y-0.5"
                    >
                      <p className="whitespace-pre-wrap">{note.note_text}</p>
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" />
                        {new Date(note.created_at).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Status / Outcome Templates */}
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                Quick Templates (Click to insert)
              </span>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_NOTE_TEMPLATES.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => {
                      setNoteDraft((prev) => {
                        const trimmed = prev.trim();
                        return trimmed ? `${trimmed}\n${chip}` : chip;
                      });
                    }}
                    className="px-2 py-1 text-xs rounded-md bg-muted hover:bg-muted/80 text-foreground border border-border/60 transition-colors cursor-pointer"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>

            {/* Note Textarea */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">
                Add New Note / Follow-up Details:
              </label>
              <Textarea
                rows={3}
                placeholder="e.g., Patient se baat hui, unhone kal subah video consultation ke liye bola, fees detail bhej di hai..."
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter className="flex sm:justify-between items-center">
            <div className="text-xs text-muted-foreground">
              {editingNoteContact?.phone && (
                <a
                  href={`tel:${editingNoteContact.phone}`}
                  className="text-primary hover:underline flex items-center gap-1"
                >
                  <Phone className="h-3 w-3" />
                  Call: {getFormattedPhone(editingNoteContact.phone)}
                </a>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setNoteModalOpen(false)}
                disabled={savingNote}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSaveContactNote}
                disabled={savingNote || !noteDraft.trim()}
                className="gap-1.5"
              >
                {savingNote ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <FileText className="h-3.5 w-3.5" />
                )}
                Save Note
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Patient Pitch Advisor Modal */}
      <AiPitchDialog
        open={aiPitchOpen}
        onOpenChange={setAiPitchOpen}
        contactId={selectedContactForPitch?.id}
        patientName={selectedContactForPitch?.name}
      />
    </div>
  );
}
