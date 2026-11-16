'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import type { Booking, BookingStatus, ConsultationType, Tag } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
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
  CalendarCheck,
  Search,
  Download,
  Phone,
  MapPin,
  Calendar,
  Clock,
  Activity,
  MessageSquare,
  CheckCircle2,
  XCircle,
  Megaphone,
  MoreHorizontal,
  RefreshCw,
  Copy,
  Check,
  Sparkles,
  CalendarDays,
  User,
  Trash2,
  Building2,
  Video,
  Tag as TagIcon,
  Plus,
  Pencil,
  FileText,
  X,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { addContactTag, deleteContactTag } from '@/lib/contacts/tag-api';
import { cn } from '@/lib/utils';

const TAG_PRESET_COLORS = [
  '#10b981', // emerald
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#f59e0b', // amber
  '#f97316', // orange
  '#ef4444', // red
];

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

function formatPhoneDisplay(rawPhone?: string | null): string {
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

interface BookingTagsCellProps {
  contactId?: string | null;
  patientName: string;
  contactTagIds: string[];
  allTags: Tag[];
  tagsMap: Record<string, Tag>;
  onToggleTag: (contactId: string, tagId: string) => Promise<void>;
  onCreateTag: (contactId: string, name: string, color: string) => Promise<void>;
}

function BookingTagsCell({
  contactId,
  patientName,
  contactTagIds,
  allTags,
  tagsMap,
  onToggleTag,
  onCreateTag,
}: BookingTagsCellProps) {
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
      {/* Display Assigned Tags */}
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
            <span className="truncate max-w-[110px]">{tag.name}</span>
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

      {/* Popover to assign or create tags */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          className="h-6 px-1.5 text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer rounded border border-dashed border-border/80 hover:border-solid hover:bg-muted/60 transition-colors"
          title="Assign or create tags for this patient"
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
          {/* Header */}
          <div className="flex items-center justify-between pb-1.5 border-b border-border">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <TagIcon className="h-3.5 w-3.5 text-primary" />
              Patient Tags ({patientName})
            </span>
          </div>

          {/* Search input */}
          <Input
            placeholder="Filter tags..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-7 text-xs"
          />

          {/* Tags List */}
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

          {/* Add New Tag Section */}
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
            {/* Preset Color Swatches */}
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

export default function BookingsPage() {
  const router = useRouter();
  const supabase = createClient();
  const { account, accountRole, user } = useAuth();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | BookingStatus>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'clinic_visit' | 'video_consultation'>('all');
  const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null);

  // Tags state
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [contactTagsMap, setContactTagsMap] = useState<Record<string, string[]>>({});

  // Notes Modal state
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [editingNoteBooking, setEditingNoteBooking] = useState<Booking | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  // Selected booking modal
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState<Booking | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Tags lookup dictionary
  const tagsMap = useMemo(() => {
    const map: Record<string, Tag> = {};
    allTags.forEach((t) => {
      map[t.id] = t;
    });
    return map;
  }, [allTags]);

  const fetchTags = useCallback(async () => {
    if (!account?.id) return;
    try {
      const { data, error } = await supabase
        .from('tags')
        .select('*')
        .eq('account_id', account.id)
        .order('name');
      if (!error && data) {
        setAllTags(data);
      }
    } catch (err) {
      console.warn('[bookings] fetchTags error:', err);
    }
  }, [account?.id, supabase]);

  const fetchBookings = useCallback(async () => {
    if (!account?.id) return;
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('account_id', account.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[bookings] fetch error:', error);
        toast.error('Failed to load appointments');
      } else {
        const bookingsList = data || [];
        setBookings(bookingsList);

        // Fetch contact tags for all contacts associated with these bookings
        const contactIds = Array.from(
          new Set(bookingsList.map((b) => b.contact_id).filter(Boolean))
        ) as string[];

        if (contactIds.length > 0) {
          const { data: ctData, error: ctErr } = await supabase
            .from('contact_tags')
            .select('contact_id, tag_id')
            .in('contact_id', contactIds);

          if (!ctErr && ctData) {
            const map: Record<string, string[]> = {};
            ctData.forEach((ct) => {
              if (!map[ct.contact_id]) map[ct.contact_id] = [];
              map[ct.contact_id].push(ct.tag_id);
            });
            setContactTagsMap(map);
          }
        }
      }
    } catch (err) {
      console.error('[bookings] unexpected fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [account?.id, supabase]);

  useEffect(() => {
    fetchBookings();
    fetchTags();
  }, [fetchBookings, fetchTags]);

  // Realtime subscription for instant updates when AI books an appointment
  useEffect(() => {
    if (!account?.id) return;

    const channel = supabase
      .channel('bookings-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
          filter: `account_id=eq.${account.id}`,
        },
        () => {
          fetchBookings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [account?.id, supabase, fetchBookings]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchBookings(), fetchTags()]);
    toast.success('Bookings and tags refreshed');
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Booking ID copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleUpdateStatus = async (bookingId: string, newStatus: BookingStatus) => {
    try {
      const { error } = await supabase
        .from('bookings')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', bookingId);

      if (error) {
        toast.error('Failed to update status');
      } else {
        setBookings((prev) =>
          prev.map((b) => (b.id === bookingId ? { ...b, status: newStatus } : b))
        );
        if (selectedBooking?.id === bookingId) {
          setSelectedBooking((prev) => (prev ? { ...prev, status: newStatus } : null));
        }
        toast.success(`Booking status changed to ${newStatus}`);
      }
    } catch (err) {
      console.error('[bookings] update status error:', err);
      toast.error('Failed to update status');
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
      console.warn('API tag toggle error, attempting direct DB fallback:', err);
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
    if (!name.trim() || !account?.id) return;
    try {
      const { data: newTag, error } = await supabase
        .from('tags')
        .insert({
          account_id: account.id,
          user_id: user?.id,
          name: name.trim(),
          color: color || TAG_PRESET_COLORS[0],
        })
        .select()
        .single();

      if (error) throw error;
      if (newTag) {
        setAllTags((prev) => [...prev, newTag]);
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

  const handleSaveNote = async () => {
    if (!editingNoteBooking) return;
    setSavingNote(true);
    const cleanNote = noteDraft.trim() || null;
    try {
      const { error } = await supabase
        .from('bookings')
        .update({
          notes: cleanNote,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingNoteBooking.id);

      if (error) throw error;

      // Optional mirror to contact_notes
      if (editingNoteBooking.contact_id && cleanNote) {
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          await supabase.from('contact_notes').insert({
            contact_id: editingNoteBooking.contact_id,
            account_id: account?.id,
            user_id: sessionData?.session?.user?.id || user?.id,
            note_text: `[Booking ${editingNoteBooking.booking_query_id}] ${cleanNote}`,
          });
        } catch (cnErr) {
          console.warn('contact_notes mirror notice:', cnErr);
        }
      }

      setBookings((prev) =>
        prev.map((b) =>
          b.id === editingNoteBooking.id ? { ...b, notes: cleanNote } : b
        )
      );

      if (selectedBooking?.id === editingNoteBooking.id) {
        setSelectedBooking((prev) => (prev ? { ...prev, notes: cleanNote } : null));
      }

      toast.success('Follow-up note saved successfully');
      setNoteModalOpen(false);
    } catch (err: any) {
      console.error('Failed to save follow-up note:', err);
      toast.error(err?.message || 'Failed to save note');
    } finally {
      setSavingNote(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('bookings').delete().eq('id', deleteTarget.id);
      if (error) {
        toast.error('Failed to delete booking');
      } else {
        setBookings((prev) => prev.filter((b) => b.id !== deleteTarget.id));
        setDeleteOpen(false);
        setDetailOpen(false);
        toast.success('Booking removed successfully');
      }
    } catch (err) {
      console.error('[bookings] delete error:', err);
      toast.error('Failed to delete booking');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleExportCsv = () => {
    if (bookings.length === 0) {
      toast.error('No bookings to export');
      return;
    }

    const headers = [
      'Booking Query ID',
      'Patient Name',
      'Phone Number',
      'City',
      'Consultation Mode',
      'Clinic Location',
      'Preferred Date & Time',
      'Health Concern',
      'Tags',
      'Follow-up Notes',
      'Meta Ad Campaign',
      'Meta Ad ID',
      'Status',
      'Booked At',
    ];

    const rows = filteredBookings.map((b) => {
      const cTags = (contactTagsMap[b.contact_id || ''] || [])
        .map((tid) => tagsMap[tid]?.name)
        .filter(Boolean)
        .join(', ');

      return [
        b.booking_query_id,
        b.patient_name,
        b.phone,
        b.city || '',
        b.consultation_type === 'clinic_visit' ? 'Clinic Visit' : 'Video Consultation',
        b.clinic_location || b.city || '',
        [b.preferred_date, b.preferred_time].filter(Boolean).join(' - ') || 'Not specified',
        b.health_concern || '',
        cTags || '',
        b.notes || '',
        b.ad_name || '',
        b.ad_id || '',
        b.status,
        new Date(b.created_at).toLocaleString(),
      ];
    });

    const csvContent = toCsv([headers, ...rows]);
    downloadCsv(`gynocci-bookings-${new Date().toISOString().slice(0, 10)}.csv`, csvContent);
    toast.success('Bookings exported to CSV');
  };

  const handleOpenInbox = async (b: Booking) => {
    // 1. Direct conversation_id from booking record
    if (b.conversation_id) {
      router.push(`/inbox?c=${b.conversation_id}`);
      return;
    }

    // 2. Lookup by contact_id if conversation_id was not populated
    if (b.contact_id) {
      try {
        const { data: conv } = await supabase
          .from('conversations')
          .select('id')
          .eq('contact_id', b.contact_id)
          .order('last_message_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (conv?.id) {
          router.push(`/inbox?c=${conv.id}`);
          return;
        }
      } catch (err) {
        console.warn('[bookings] conversation lookup by contact_id failed:', err);
      }
    }

    // 3. Fallback: Lookup by phone number
    if (b.phone) {
      try {
        const digits = b.phone.replace(/\D/g, '');
        const last10 = digits.slice(-10);
        const { data: contacts } = await supabase
          .from('contacts')
          .select('id')
          .ilike('phone', `%${last10}%`)
          .limit(1);

        if (contacts && contacts[0]) {
          const { data: conv } = await supabase
            .from('conversations')
            .select('id')
            .eq('contact_id', contacts[0].id)
            .order('last_message_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (conv?.id) {
            router.push(`/inbox?c=${conv.id}`);
            return;
          }
        }
      } catch (err) {
        console.warn('[bookings] conversation lookup by phone failed:', err);
      }
    }

    // 4. Default fallback to general inbox
    router.push('/inbox');
  };

  // Filtered list
  const filteredBookings = useMemo(() => {
    const q = search.trim().toLowerCase();
    return bookings.filter((b) => {
      if (statusFilter !== 'all' && b.status !== statusFilter) return false;
      if (typeFilter !== 'all' && b.consultation_type !== typeFilter) return false;

      // Tag filter
      if (selectedTagFilter) {
        const cTags = contactTagsMap[b.contact_id || ''] || [];
        if (!cTags.includes(selectedTagFilter)) return false;
      }

      if (!q) return true;

      const contactTagNames = (contactTagsMap[b.contact_id || ''] || [])
        .map((tid) => tagsMap[tid]?.name?.toLowerCase() || '')
        .join(' ');

      return (
        b.booking_query_id.toLowerCase().includes(q) ||
        b.patient_name.toLowerCase().includes(q) ||
        b.phone.includes(q) ||
        (b.city && b.city.toLowerCase().includes(q)) ||
        (b.health_concern && b.health_concern.toLowerCase().includes(q)) ||
        (b.notes && b.notes.toLowerCase().includes(q)) ||
        contactTagNames.includes(q) ||
        (b.ad_name && b.ad_name.toLowerCase().includes(q)) ||
        (b.clinic_location && b.clinic_location.toLowerCase().includes(q))
      );
    });
  }, [bookings, search, statusFilter, typeFilter, selectedTagFilter, contactTagsMap, tagsMap]);

  // Stats
  const stats = useMemo(() => {
    const total = bookings.length;
    const confirmed = bookings.filter((b) => b.status === 'confirmed').length;
    const clinicVisits = bookings.filter((b) => b.consultation_type === 'clinic_visit').length;
    const videoConsultations = bookings.filter((b) => b.consultation_type !== 'clinic_visit').length;
    return { total, confirmed, clinicVisits, videoConsultations };
  }, [bookings]);

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <CalendarCheck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Appointments & Bookings
              </h1>
              <p className="text-sm text-muted-foreground">
                Live patient consultations scheduled via AI care assistant and marketing campaigns.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="h-9 gap-1.5"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            disabled={bookings.length === 0}
            className="h-9 gap-1.5"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Total Bookings</span>
            <CalendarDays className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">{stats.total}</div>
          <p className="text-xs text-muted-foreground mt-0.5">All appointments received</p>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Confirmed</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {stats.confirmed}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">Ready for Gynocci team</p>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Clinic Visits</span>
            <Building2 className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-600 dark:text-amber-400">
            {stats.clinicVisits}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">Jaipur & clinic appointments</p>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Video Calls</span>
            <Video className="h-4 w-4 text-blue-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-blue-600 dark:text-blue-400">
            {stats.videoConsultations}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">Online consultations</p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search patient, phone, query ID, notes, tags..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {/* Mode Filter */}
          <div className="flex items-center gap-1 border rounded-lg p-0.5 bg-muted/30">
            <Button
              variant={typeFilter === 'all' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setTypeFilter('all')}
              className="h-7 text-xs px-2"
            >
              All Modes
            </Button>
            <Button
              variant={typeFilter === 'clinic_visit' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setTypeFilter('clinic_visit')}
              className="h-7 text-xs px-2 gap-1 text-amber-700 dark:text-amber-300"
            >
              <Building2 className="h-3 w-3" />
              Clinic Visit
            </Button>
            <Button
              variant={typeFilter === 'video_consultation' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setTypeFilter('video_consultation')}
              className="h-7 text-xs px-2 gap-1 text-blue-700 dark:text-blue-300"
            >
              <Video className="h-3 w-3" />
              Video Call
            </Button>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1 border rounded-lg p-0.5 bg-muted/30">
            {(['all', 'confirmed', 'completed', 'cancelled'] as const).map((st) => (
              <Button
                key={st}
                variant={statusFilter === st ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setStatusFilter(st)}
                className="h-7 capitalize text-xs px-2"
              >
                {st}
              </Button>
            ))}
          </div>

          {/* Tag Filter */}
          {allTags.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(
                  'h-8 px-2.5 text-xs font-medium border rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer',
                  selectedTagFilter
                    ? 'bg-primary/10 border-primary text-primary'
                    : 'bg-muted/30 text-muted-foreground hover:text-foreground'
                )}
              >
                <TagIcon className="h-3.5 w-3.5" />
                <span>
                  {selectedTagFilter ? tagsMap[selectedTagFilter]?.name || 'Tag Filter' : 'All Tags'}
                </span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 p-1">
                <DropdownMenuItem
                  onClick={() => setSelectedTagFilter(null)}
                  className="text-xs"
                >
                  All Tags
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <div className="max-h-48 overflow-y-auto space-y-0.5">
                  {allTags.map((tag) => (
                    <DropdownMenuItem
                      key={tag.id}
                      onClick={() => setSelectedTagFilter(tag.id)}
                      className="flex items-center justify-between text-xs cursor-pointer"
                    >
                      <span className="flex items-center gap-2 truncate">
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: tag.color }}
                        />
                        <span className="truncate">{tag.name}</span>
                      </span>
                      {selectedTagFilter === tag.id && (
                        <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                      )}
                    </DropdownMenuItem>
                  ))}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Bookings Table */}
      <div className="rounded-xl border bg-card shadow-xs overflow-hidden">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <RefreshCw className="h-6 w-6 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading appointments...</p>
            </div>
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-4">
              <CalendarCheck className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">No appointments found</h3>
            <p className="text-sm text-muted-foreground max-w-sm mt-1">
              {search || statusFilter !== 'all' || typeFilter !== 'all' || selectedTagFilter
                ? 'No bookings match your current filter criteria. Try clearing filters.'
                : 'When patients confirm their appointment via WhatsApp or Ads, their booking details and query ID will automatically appear here.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[125px]">Query ID</TableHead>
                  <TableHead className="min-w-[190px]">Patient Details</TableHead>
                  <TableHead className="min-w-[150px]">Tags</TableHead>
                  <TableHead className="min-w-[180px]">Follow-up Notes</TableHead>
                  <TableHead>Consultation Mode</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>Preferred Schedule</TableHead>
                  <TableHead>Health Concern (तकलीफ)</TableHead>
                  <TableHead>Meta Ad Referral</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Booked On</TableHead>
                  <TableHead className="w-[60px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBookings.map((b) => {
                  const phoneDigits = b.phone.replace(/\D/g, '');
                  const waUrl = `https://wa.me/${phoneDigits}`;
                  const isClinic = b.consultation_type === 'clinic_visit';
                  const contactTagIds = contactTagsMap[b.contact_id || ''] || [];

                  return (
                    <TableRow
                      key={b.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => {
                        setSelectedBooking(b);
                        setDetailOpen(true);
                      }}
                    >
                      {/* Query ID */}
                      <TableCell className="font-mono text-xs font-semibold">
                        <div
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted text-foreground hover:bg-muted/80 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopy(b.booking_query_id, b.id);
                          }}
                          title="Click to copy ID"
                        >
                          <span>{b.booking_query_id}</span>
                          {copiedId === b.id ? (
                            <Check className="h-3 w-3 text-emerald-500" />
                          ) : (
                            <Copy className="h-3 w-3 text-muted-foreground" />
                          )}
                        </div>
                      </TableCell>

                      {/* Patient Details */}
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium text-foreground text-sm flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                            {b.patient_name}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span>{formatPhoneDisplay(b.phone)}</span>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-6 px-2 text-[11px] gap-1 font-semibold text-primary border-primary/30 bg-primary/5 hover:bg-primary/15 transition-all shadow-2xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenInbox(b);
                              }}
                              title="Open chat in CRM Inbox"
                            >
                              <MessageSquare className="h-3 w-3 text-primary" />
                              Inbox
                            </Button>
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-emerald-600 hover:text-emerald-700 font-medium inline-flex items-center gap-0.5"
                            >
                              WhatsApp
                            </a>
                            <a
                              href={`tel:${b.phone}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-primary hover:underline inline-flex items-center gap-0.5"
                            >
                              <Phone className="h-3 w-3" />
                              Call
                            </a>
                          </div>
                        </div>
                      </TableCell>

                      {/* Tags Column */}
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <BookingTagsCell
                          contactId={b.contact_id}
                          patientName={b.patient_name}
                          contactTagIds={contactTagIds}
                          allTags={allTags}
                          tagsMap={tagsMap}
                          onToggleTag={toggleContactTag}
                          onCreateTag={handleCreateAndAssignTag}
                        />
                      </TableCell>

                      {/* Follow-up Notes Column */}
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {b.notes ? (
                          <div
                            className="group/note flex items-start justify-between gap-1.5 p-1.5 rounded-md bg-muted/40 hover:bg-muted/70 border border-border/60 text-xs cursor-pointer max-w-[210px] transition-colors"
                            onClick={() => {
                              setEditingNoteBooking(b);
                              setNoteDraft(b.notes || '');
                              setNoteModalOpen(true);
                            }}
                            title="Click to view or edit follow-up note"
                          >
                            <div className="flex items-start gap-1 min-w-0">
                              <FileText className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                              <span className="line-clamp-2 text-foreground font-normal break-words">
                                {b.notes}
                              </span>
                            </div>
                            <Pencil className="h-3 w-3 text-muted-foreground group-hover/note:text-foreground shrink-0 mt-0.5 opacity-50 group-hover/note:opacity-100 transition-opacity" />
                          </div>
                        ) : (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground gap-1 border border-dashed border-border/80 hover:border-solid hover:bg-muted/50 font-normal"
                            onClick={() => {
                              setEditingNoteBooking(b);
                              setNoteDraft('');
                              setNoteModalOpen(true);
                            }}
                            title="Add follow-up note"
                          >
                            <Pencil className="h-3 w-3" />
                            <span>+ Add Note</span>
                          </Button>
                        )}
                      </TableCell>

                      {/* Consultation Mode */}
                      <TableCell>
                        {isClinic ? (
                          <div className="space-y-0.5">
                            <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 gap-1 text-xs">
                              <Building2 className="h-3 w-3" />
                              Clinic Visit
                            </Badge>
                            {b.clinic_location && (
                              <p className="text-[11px] text-muted-foreground font-medium">
                                {b.clinic_location} Clinic
                              </p>
                            )}
                          </div>
                        ) : (
                          <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30 gap-1 text-xs">
                            <Video className="h-3 w-3" />
                            Video Call
                          </Badge>
                        )}
                      </TableCell>

                      {/* City */}
                      <TableCell>
                        {b.city ? (
                          <div className="inline-flex items-center gap-1 text-xs text-foreground font-medium">
                            <MapPin className="h-3 w-3 text-rose-500" />
                            <span>{b.city}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Not specified</span>
                        )}
                      </TableCell>

                      {/* Preferred Schedule */}
                      <TableCell>
                        <div className="space-y-0.5 text-xs">
                          {b.preferred_date ? (
                            <div className="flex items-center gap-1 text-foreground font-medium">
                              <Calendar className="h-3 w-3 text-primary" />
                              <span>{b.preferred_date}</span>
                            </div>
                          ) : null}
                          {b.preferred_time ? (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              <span>{b.preferred_time}</span>
                            </div>
                          ) : null}
                          {!b.preferred_date && !b.preferred_time && (
                            <span className="text-muted-foreground italic">Flexible</span>
                          )}
                        </div>
                      </TableCell>

                      {/* Health Concern */}
                      <TableCell className="max-w-[180px]">
                        {b.health_concern ? (
                          <div className="flex items-start gap-1 text-xs text-foreground">
                            <Activity className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                            <span className="line-clamp-2">{b.health_concern}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Ayurvedic consultation</span>
                        )}
                      </TableCell>

                      {/* Meta Ad Referral */}
                      <TableCell className="max-w-[160px]">
                        {b.ad_name ? (
                          <div className="space-y-0.5">
                            <Badge
                              variant="outline"
                              className="bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200 dark:border-purple-800 text-[10px] gap-1 px-1.5 py-0"
                            >
                              <Megaphone className="h-2.5 w-2.5" />
                              Meta Ad
                            </Badge>
                            <p className="text-xs text-muted-foreground line-clamp-1 truncate" title={b.ad_name}>
                              {b.ad_name}
                            </p>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Direct / Organic</span>
                        )}
                      </TableCell>

                      {/* Status */}
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <button
                                className="focus:outline-hidden"
                                onClick={(e) => e.stopPropagation()}
                              />
                            }
                          >
                            {b.status === 'confirmed' ? (
                              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/25 border-emerald-500/30 gap-1 text-xs cursor-pointer">
                                <CheckCircle2 className="h-3 w-3" />
                                Confirmed
                              </Badge>
                            ) : b.status === 'completed' ? (
                              <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-300 hover:bg-blue-500/25 border-blue-500/30 gap-1 text-xs cursor-pointer">
                                <Sparkles className="h-3 w-3" />
                                Completed
                              </Badge>
                            ) : (
                              <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-300 hover:bg-rose-500/25 border-rose-500/30 gap-1 text-xs cursor-pointer">
                                <XCircle className="h-3 w-3" />
                                Cancelled
                              </Badge>
                            )}
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenuItem onClick={() => handleUpdateStatus(b.id, 'confirmed')}>
                              <CheckCircle2 className="h-4 w-4 text-emerald-600 mr-2" />
                              Mark Confirmed
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleUpdateStatus(b.id, 'completed')}>
                              <Sparkles className="h-4 w-4 text-blue-600 mr-2" />
                              Mark Completed
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleUpdateStatus(b.id, 'cancelled')}>
                              <XCircle className="h-4 w-4 text-rose-600 mr-2" />
                              Mark Cancelled
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>

                      {/* Booked On */}
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(b.created_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </TableCell>

                      {/* Actions: ONLY dropdown menu, marked redundant Inbox button removed! */}
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end">
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              }
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedBooking(b);
                                  setDetailOpen(true);
                                }}
                              >
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleOpenInbox(b)}>
                                <MessageSquare className="h-4 w-4 mr-2 text-primary" />
                                Open Inbox Chat
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setEditingNoteBooking(b);
                                  setNoteDraft(b.notes || '');
                                  setNoteModalOpen(true);
                                }}
                              >
                                <FileText className="h-4 w-4 mr-2 text-primary" />
                                Add / Edit Note
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleCopy(b.booking_query_id, b.id)}
                              >
                                <Copy className="h-4 w-4 mr-2" />
                                Copy Query ID
                              </DropdownMenuItem>
                              {(accountRole === 'owner' || accountRole === 'admin') && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-rose-600 dark:text-rose-400"
                                    onClick={() => {
                                      setDeleteTarget(b);
                                      setDeleteOpen(true);
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Follow-up Note Dialog */}
      <Dialog open={noteModalOpen} onOpenChange={setNoteModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Follow-up Note
            </DialogTitle>
            <DialogDescription>
              Record call outcome, patient responses, and decide next follow-up action for{' '}
              <strong className="text-foreground">{editingNoteBooking?.patient_name}</strong>{' '}
              <span className="font-mono text-xs">({editingNoteBooking?.booking_query_id})</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {/* Quick Status / Outcome Templates */}
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                Quick Templates (Click to insert)
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  '📞 Call Connected - Interested',
                  '📵 Call Not Answered / Busy',
                  '⏳ Follow-up Tomorrow',
                  '🏥 Agreed for Clinic Visit',
                  '📹 Video Consultation Confirmed',
                  '💳 50% Offer / Fee Details Sent',
                  '❌ Not Interested / Cancelled',
                ].map((chip) => (
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
                Patient Notes & Follow-up Details:
              </label>
              <Textarea
                rows={4}
                placeholder="e.g., Call kiya tha, patient ne bola kal 11 baje video consultation karenge, fees ke baare me confirm kiya..."
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter className="flex sm:justify-between items-center">
            <div className="text-xs text-muted-foreground">
              {editingNoteBooking?.phone && (
                <a
                  href={`tel:${editingNoteBooking.phone}`}
                  className="text-primary hover:underline flex items-center gap-1"
                >
                  <Phone className="h-3 w-3" />
                  Call: {formatPhoneDisplay(editingNoteBooking.phone)}
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
                onClick={handleSaveNote}
                disabled={savingNote}
                className="gap-1.5"
              >
                {savingNote ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                Save Note
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Booking Details Modal */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <div className="flex items-center justify-between pr-4">
              <Badge variant="outline" className="font-mono text-xs gap-1">
                <span>{selectedBooking?.booking_query_id}</span>
              </Badge>
              {selectedBooking?.status === 'confirmed' ? (
                <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">
                  Confirmed
                </Badge>
              ) : selectedBooking?.status === 'completed' ? (
                <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30">
                  Completed
                </Badge>
              ) : (
                <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30">
                  Cancelled
                </Badge>
              )}
            </div>
            <DialogTitle className="text-xl mt-2">
              Appointment Details
            </DialogTitle>
            <DialogDescription>
              Consultation query recorded for Gynocci team.
            </DialogDescription>
          </DialogHeader>

          {selectedBooking && (
            <div className="space-y-4 py-2">
              {/* Patient Card */}
              <div className="p-3.5 rounded-lg border bg-muted/40 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-base text-foreground flex items-center gap-2">
                    <User className="h-4 w-4 text-primary" />
                    {selectedBooking.patient_name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Booked {new Date(selectedBooking.created_at).toLocaleString()}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 text-sm">
                  <div>
                    <span className="text-xs text-muted-foreground block">Phone</span>
                    <span className="font-medium text-foreground">
                      {formatPhoneDisplay(selectedBooking.phone)}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block">City / Location</span>
                    <span className="font-medium text-foreground">
                      {selectedBooking.city || 'Not provided'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Tags Section */}
              <div className="p-3.5 rounded-lg border bg-muted/40 space-y-2">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <TagIcon className="h-3.5 w-3.5 text-primary" />
                  Patient Tags
                </div>
                <BookingTagsCell
                  contactId={selectedBooking.contact_id}
                  patientName={selectedBooking.patient_name}
                  contactTagIds={contactTagsMap[selectedBooking.contact_id || ''] || []}
                  allTags={allTags}
                  tagsMap={tagsMap}
                  onToggleTag={toggleContactTag}
                  onCreateTag={handleCreateAndAssignTag}
                />
              </div>

              {/* Follow-up Notes Section */}
              <div className="p-3.5 rounded-lg border bg-muted/40 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-primary" />
                    Follow-up Notes
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs gap-1"
                    onClick={() => {
                      setEditingNoteBooking(selectedBooking);
                      setNoteDraft(selectedBooking.notes || '');
                      setNoteModalOpen(true);
                    }}
                  >
                    <Pencil className="h-3 w-3" />
                    Edit Note
                  </Button>
                </div>
                <p className="text-sm text-foreground font-normal bg-background/80 p-2.5 rounded border">
                  {selectedBooking.notes || (
                    <span className="text-muted-foreground italic">No follow-up notes yet. Click &apos;Edit Note&apos; to add one.</span>
                  )}
                </p>
              </div>

              {/* Consultation Mode Card */}
              <div className="p-3.5 rounded-lg border bg-muted/40 space-y-2">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Consultation Mode
                </div>
                <div className="flex items-center gap-2">
                  {selectedBooking.consultation_type === 'clinic_visit' ? (
                    <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 font-semibold text-sm">
                      <Building2 className="h-5 w-5" />
                      <span>Clinic Visit ({selectedBooking.clinic_location || selectedBooking.city || 'Jaipur'} Clinic)</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 font-semibold text-sm">
                      <Video className="h-5 w-5" />
                      <span>Online Video Consultation (Video Call)</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Schedule Card */}
              <div className="p-3.5 rounded-lg border bg-muted/40 space-y-2">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Preferred Appointment Schedule
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4 text-primary" />
                    <span className="font-medium">
                      {selectedBooking.preferred_date || 'Flexible Date'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-primary" />
                    <span className="font-medium">
                      {selectedBooking.preferred_time || '10:00 AM - 8:00 PM'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Health Concern */}
              <div className="p-3.5 rounded-lg border bg-muted/40 space-y-1">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Activity className="h-3.5 w-3.5 text-amber-500" />
                  Health Concern / Takleef
                </div>
                <p className="text-sm text-foreground pt-1 font-medium">
                  {selectedBooking.health_concern || 'Ayurvedic doctor consultation required'}
                </p>
              </div>

              {/* Meta Ad Referral if any */}
              {selectedBooking.ad_name && (
                <div className="p-3 rounded-lg border bg-purple-50/50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-900 space-y-1">
                  <div className="text-xs font-semibold text-purple-700 dark:text-purple-300 flex items-center gap-1">
                    <Megaphone className="h-3.5 w-3.5" />
                    Acquired via Meta Ad Campaign
                  </div>
                  <p className="text-xs text-foreground font-medium">
                    {selectedBooking.ad_name}
                  </p>
                  {selectedBooking.ad_id && (
                    <p className="text-[11px] font-mono text-muted-foreground">
                      Ad ID: {selectedBooking.ad_id}
                    </p>
                  )}
                </div>
              )}

              {/* Quick Actions */}
              <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
                <Button
                  className="w-full sm:flex-1 gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                  onClick={() => {
                    handleOpenInbox(selectedBooking);
                  }}
                >
                  <MessageSquare className="h-4 w-4" />
                  Open in CRM Inbox
                </Button>
                <Button
                  variant="outline"
                  className="w-full sm:flex-1 gap-1.5 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10"
                  onClick={() => {
                    const digits = selectedBooking.phone.replace(/\D/g, '');
                    window.open(`https://wa.me/${digits}`, '_blank');
                  }}
                >
                  <MessageSquare className="h-4 w-4 text-emerald-600" />
                  WhatsApp
                </Button>
                <Button
                  variant="outline"
                  className="w-full sm:flex-1 gap-1.5"
                  onClick={() => {
                    window.location.href = `tel:${selectedBooking.phone}`;
                  }}
                >
                  <Phone className="h-4 w-4" />
                  Call Patient
                </Button>
              </div>
            </div>
          )}

          <DialogFooter className="flex sm:justify-between items-center">
            {selectedBooking && (
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleUpdateStatus(selectedBooking.id, 'confirmed')}
                  disabled={selectedBooking.status === 'confirmed'}
                  className="text-xs"
                >
                  Confirm
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleUpdateStatus(selectedBooking.id, 'completed')}
                  disabled={selectedBooking.status === 'completed'}
                  className="text-xs"
                >
                  Complete
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleUpdateStatus(selectedBooking.id, 'cancelled')}
                  disabled={selectedBooking.status === 'cancelled'}
                  className="text-xs"
                >
                  Cancel
                </Button>
              </div>
            )}
            <Button variant="secondary" onClick={() => setDetailOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Delete Booking</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove booking query{' '}
              <strong className="font-mono text-foreground">
                {deleteTarget?.booking_query_id}
              </strong>{' '}
              for {deleteTarget?.patient_name}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : 'Delete Booking'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
