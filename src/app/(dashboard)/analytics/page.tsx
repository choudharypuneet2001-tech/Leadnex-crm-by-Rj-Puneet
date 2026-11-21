'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  TrendingUp,
  Users,
  CalendarCheck,
  Building2,
  Megaphone,
  ArrowUpRight,
  Filter,
  Download,
  RefreshCw,
  Search,
  MessageSquare,
  Sparkles,
  PhoneCall,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  MapPin,
  Stethoscope,
  Copy,
  Check,
  ChevronRight,
  ShieldAlert,
  StickyNote,
  Tag as TagIcon,
  Plus,
  X,
  ExternalLink,
  Share2,
  PlayCircle,
  Phone,
  Video,
  Clock,
  Calendar,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { useAuth } from '@/hooks/use-auth';
import { createClient } from '@/lib/supabase/client';
import { computeAnalytics } from '@/lib/analytics/analytics-service';
import { formatTelUri, formatPhoneDisplay } from '@/lib/whatsapp/phone-utils';
import { addContactTag, deleteContactTag } from '@/lib/contacts/tag-api';
import { findDiseaseVideo, formatDiseaseVideoMessage } from '@/lib/ai/disease-video-links';
import { SendDiseaseVideoModal } from '@/components/shared/send-disease-video-modal';
import { LiveVoiceCallDialog } from '@/components/voice/live-voice-call-dialog';
import type {
  AnalyticsSummary,
  AnalyticsDateRangePreset,
  DateRangeFilter,
  AnalyticsLeadItem,
  LeadIntentStage,
} from '@/lib/analytics/types';
import type { Booking, Contact, Tag } from '@/types';
import { toast } from 'sonner';

const TAG_PRESET_COLORS = [
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#06b6d4', // cyan
  '#64748b', // slate
];

const QUICK_CALL_TAGS = [
  { name: '🔥 Interested', color: '#10b981' },
  { name: '📞 Callback', color: '#3b82f6' },
  { name: '⚠️ Fees Hesitation', color: '#f59e0b' },
  { name: '🏥 Clinic Visit', color: '#8b5cf6' },
  { name: '🚫 Not Reachable', color: '#64748b' },
  { name: '❌ Not Interested', color: '#ef4444' },
];

function formatLeadDateTime(dateStr?: string | null): string {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return 'N/A';

  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  const isYesterday =
    date.getDate() === y.getDate() &&
    date.getMonth() === y.getMonth() &&
    date.getFullYear() === y.getFullYear();

  const timeStr = date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  if (isToday) return `Today, ${timeStr}`;
  if (isYesterday) return `Yesterday, ${timeStr}`;

  const dateStrFormatted = date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  return `${dateStrFormatted}, ${timeStr}`;
}

export default function AnalyticsPage() {
  const router = useRouter();
  const { account, user } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  // State - default to "all" (All Time) so user immediately sees all past data
  const [rangePreset, setRangePreset] = useState<AnalyticsDateRangePreset>('all');
  const [customFrom, setCustomFrom] = useState<string>('');
  const [customTo, setCustomTo] = useState<string>('');
  const [selectedAdFilter, setSelectedAdFilter] = useState<string>('all');
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Leads table local search & filters
  const [leadsSearch, setLeadsSearch] = useState<string>('');
  const [intentFilter, setIntentFilter] = useState<string>('all');

  // Tags & Notes state
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [contactTagsMap, setContactTagsMap] = useState<Record<string, string[]>>({});
  const [contactNotesMap, setContactNotesMap] = useState<
    Record<string, { id: string; note_text: string; created_at: string }[]>
  >({});

  // Script Modal state
  const [scriptModalLead, setScriptModalLead] = useState<AnalyticsLeadItem | null>(null);
  const [copiedScript, setCopiedScript] = useState<boolean>(false);
  const [copiedVideoMsg, setCopiedVideoMsg] = useState<boolean>(false);
  const [modalNoteDraft, setModalNoteDraft] = useState<string>('');
  const [modalSavingNote, setModalSavingNote] = useState<boolean>(false);

  // Note Modal state (for clicking notes on table)
  const [noteModalLead, setNoteModalLead] = useState<AnalyticsLeadItem | null>(null);
  const [tableNoteDraft, setTableNoteDraft] = useState<string>('');
  const [tableSavingNote, setTableSavingNote] = useState<boolean>(false);

  // Send Educational Video modal
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [selectedVideoLead, setSelectedVideoLead] = useState<AnalyticsLeadItem | null>(null);

  // Live AI Voice Call dialog
  const [voiceCallOpen, setVoiceCallOpen] = useState(false);
  const [selectedVoiceLead, setSelectedVoiceLead] = useState<AnalyticsLeadItem | null>(null);

  // Tags Map for fast lookup
  const tagsMap = useMemo(() => {
    const map: Record<string, Tag> = {};
    allTags.forEach((t) => {
      map[t.id] = t;
    });
    return map;
  }, [allTags]);

  // Load all available tags from DB
  const fetchTagsAndNotes = useCallback(async () => {
    try {
      // 1. Fetch tags
      let tagsQuery = supabase.from('tags').select('*').order('name');
      if (account?.id) {
        tagsQuery = tagsQuery.eq('account_id', account.id);
      }
      const { data: tData } = await tagsQuery;
      if (tData) setAllTags(tData);

      // 2. Fetch contact_tags
      const { data: ctData } = await supabase.from('contact_tags').select('contact_id, tag_id');
      if (ctData) {
        const ctMap: Record<string, string[]> = {};
        ctData.forEach((row) => {
          if (!ctMap[row.contact_id]) ctMap[row.contact_id] = [];
          ctMap[row.contact_id].push(row.tag_id);
        });
        setContactTagsMap(ctMap);
      }

      // 3. Fetch contact_notes
      let notesQuery = supabase
        .from('contact_notes')
        .select('id, contact_id, note_text, created_at')
        .order('created_at', { ascending: false });
      if (account?.id) {
        notesQuery = notesQuery.eq('account_id', account.id);
      }
      const { data: cnData } = await notesQuery;
      if (cnData) {
        const cnMap: Record<string, { id: string; note_text: string; created_at: string }[]> = {};
        cnData.forEach((row) => {
          if (!cnMap[row.contact_id]) cnMap[row.contact_id] = [];
          cnMap[row.contact_id].push(row);
        });
        setContactNotesMap(cnMap);
      }
    } catch (err) {
      console.warn('[analytics] error fetching tags/notes:', err);
    }
  }, [supabase, account?.id]);

  useEffect(() => {
    fetchTagsAndNotes();
  }, [fetchTagsAndNotes]);

  // Tag Toggle Handler
  const handleToggleTag = async (contactId: string, tagId: string) => {
    if (!contactId) return;
    const current = contactTagsMap[contactId] || [];
    const isAssigned = current.includes(tagId);

    // Optimistic UI update
    setContactTagsMap((prev) => ({
      ...prev,
      [contactId]: isAssigned ? current.filter((id) => id !== tagId) : [...current, tagId],
    }));

    try {
      if (isAssigned) {
        await deleteContactTag(contactId, tagId);
      } else {
        await addContactTag(contactId, tagId);
      }
      toast.success(isAssigned ? 'Tag removed' : 'Tag added');
    } catch (err) {
      console.warn('[analytics] tag toggle API fallback to DB:', err);
      try {
        if (isAssigned) {
          await supabase.from('contact_tags').delete().eq('contact_id', contactId).eq('tag_id', tagId);
        } else {
          await supabase.from('contact_tags').insert({ contact_id: contactId, tag_id: tagId });
        }
        toast.success(isAssigned ? 'Tag removed' : 'Tag added');
      } catch (dbErr) {
        // Revert
        setContactTagsMap((prev) => ({
          ...prev,
          [contactId]: isAssigned ? [...current, tagId] : current.filter((id) => id !== tagId),
        }));
        toast.error('Tag update nahi ho saka');
      }
    }
  };

  // Create Tag & Assign
  const handleCreateAndAssignTag = async (contactId: string, name: string, color: string) => {
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
        await handleToggleTag(contactId, newTag.id);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Tag create nahi ho saka');
    }
  };

  // Save Note Handler
  const handleSaveContactNote = async (contactId: string, text: string) => {
    if (!contactId || !text.trim() || !account?.id) return;
    try {
      const { data: newNote, error } = await supabase
        .from('contact_notes')
        .insert({
          contact_id: contactId,
          account_id: account.id,
          user_id: user?.id,
          note_text: text.trim(),
        })
        .select('id, contact_id, note_text, created_at')
        .single();

      if (error) throw error;
      if (newNote) {
        setContactNotesMap((prev) => ({
          ...prev,
          [contactId]: [newNote, ...(prev[contactId] || [])],
        }));

        // Also sync to matching booking if exists
        try {
          const { data: matchedBookings } = await supabase
            .from('bookings')
            .select('id, notes')
            .eq('account_id', account.id)
            .eq('contact_id', contactId)
            .order('created_at', { ascending: false })
            .limit(1);

          if (matchedBookings && matchedBookings[0]) {
            const target = matchedBookings[0];
            const existing = target.notes ? target.notes.trim() : '';
            const timestamp = new Date().toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            });
            const updated = existing ? `${existing}\n[${timestamp}]: ${text.trim()}` : `[${timestamp}]: ${text.trim()}`;
            await supabase
              .from('bookings')
              .update({ notes: updated, updated_at: new Date().toISOString() })
              .eq('id', target.id);
          }
        } catch (syncErr) {
          console.warn('[analytics] sync note to booking error:', syncErr);
        }

        toast.success('Call note successfully save ho gaya!');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Note save karne mein error aayi');
    }
  };

  // Fetch analytics summary from API with resilient client-side fallback
  const fetchAnalytics = useCallback(async () => {
    try {
      setRefreshing(true);

      // Calculate exact local / IST date bounds in browser
      let calculatedFrom: string | undefined = undefined;
      let calculatedTo: string | undefined = undefined;

      const now = new Date();
      if (rangePreset === 'today') {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        calculatedFrom = start.toISOString();
        calculatedTo = end.toISOString();
      } else if (rangePreset === 'yesterday') {
        const y = new Date(now);
        y.setDate(y.getDate() - 1);
        const start = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 0, 0, 0, 0);
        const end = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 23, 59, 59, 999);
        calculatedFrom = start.toISOString();
        calculatedTo = end.toISOString();
      } else if (rangePreset === '7d') {
        const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        calculatedFrom = start.toISOString();
        calculatedTo = now.toISOString();
      } else if (rangePreset === '30d') {
        const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        calculatedFrom = start.toISOString();
        calculatedTo = now.toISOString();
      } else if (rangePreset === 'this_month') {
        const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        calculatedFrom = start.toISOString();
        calculatedTo = now.toISOString();
      } else if (rangePreset === 'custom') {
        if (customFrom) calculatedFrom = new Date(customFrom).toISOString();
        if (customTo) {
          const toDate = new Date(customTo);
          toDate.setHours(23, 59, 59, 999);
          calculatedTo = toDate.toISOString();
        }
      }

      const params = new URLSearchParams();
      params.set('range', rangePreset);
      if (calculatedFrom) params.set('from', calculatedFrom);
      if (calculatedTo) params.set('to', calculatedTo);
      if (selectedAdFilter && selectedAdFilter !== 'all') {
        params.set('ad_name', selectedAdFilter);
      }

      let summaryData: AnalyticsSummary | null = null;

      // 1. Try server API route first
      try {
        const res = await fetch(`/api/analytics?${params.toString()}`);
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            summaryData = json.data;
          }
        }
      } catch (apiErr) {
        console.warn('[analytics] API fetch failed, falling back to direct client query:', apiErr);
      }

      // 2. Client-side fallback if API route returned error, 401, or failed
      if (!summaryData) {
        let contactsData: any[] = [];
        let bookingsData: any[] = [];
        let convData: any[] = [];

        try {
          let contactsQuery = supabase.from('contacts').select('*').order('created_at', { ascending: false });
          if (account?.id) contactsQuery = contactsQuery.eq('account_id', account.id);
          const cRes = await contactsQuery;
          if (!cRes.error && cRes.data) contactsData = cRes.data;
        } catch (e) {
          console.warn('[analytics] client contacts fallback err:', e);
        }

        try {
          let bookingsQuery = supabase.from('bookings').select('*').order('created_at', { ascending: false });
          if (account?.id) bookingsQuery = bookingsQuery.eq('account_id', account.id);
          const bRes = await bookingsQuery;
          if (!bRes.error && bRes.data) bookingsData = bRes.data;
        } catch (e) {
          console.warn('[analytics] client bookings fallback err:', e);
        }

        try {
          let convQuery = supabase
            .from('conversations')
            .select('id, contact_id, created_at, last_message_text, last_message_at')
            .order('last_message_at', { ascending: false });
          if (account?.id) convQuery = convQuery.eq('account_id', account.id);
          const convRes = await convQuery;
          if (!convRes.error && convRes.data) convData = convRes.data;
        } catch (e) {
          console.warn('[analytics] client conversations fallback err:', e);
        }

        const filter: DateRangeFilter = {
          preset: rangePreset,
          from: calculatedFrom,
          to: calculatedTo,
        };

        summaryData = computeAnalytics(
          (contactsData || []) as Contact[],
          (bookingsData || []) as Booking[],
          filter,
          selectedAdFilter !== 'all' ? selectedAdFilter : undefined,
          convData
        );
      }

      setSummary(summaryData);
      void fetchTagsAndNotes();
    } catch (err) {
      console.error('[analytics page] fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [rangePreset, customFrom, customTo, selectedAdFilter, supabase, account?.id, fetchTagsAndNotes]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Copy script handler
  const handleCopyScript = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedScript(true);
    toast.success('Calling script copied!');
    setTimeout(() => setCopiedScript(false), 2000);
  };

  // Copy video recommendation message handler
  const handleCopyVideoMessage = (lead: AnalyticsLeadItem) => {
    const matched = findDiseaseVideo(
      `${lead.health_concern || ''} ${lead.ad_name || ''} ${lead.ai_analysis?.disease_cause || ''}`
    );
    if (!matched) {
      toast.info('Is bimari ke liye koi specific video link nahi mila');
      return;
    }
    const msg = formatDiseaseVideoMessage(matched);
    navigator.clipboard.writeText(msg);
    setCopiedVideoMsg(true);
    toast.success('Patient WhatsApp video message copied!');
    setTimeout(() => setCopiedVideoMsg(false), 2000);
  };

  // Export filtered leads to CSV
  const handleExportCsv = () => {
    if (!summary || summary.leads.length === 0) {
      toast.error('Export ke liye koi data nahi hai');
      return;
    }

    const headers = [
      'Name',
      'Phone',
      'City',
      'Meta Ad Campaign',
      'Meta Ad ID',
      'Health Concern',
      'AI Calling Priority',
      'Tags',
      'Latest Note',
      'Drop-off Reason',
      'Calling Pitch Script',
      'Booking Status',
      'Consultation Type',
      'Clinic Branch',
      'First Message Date & Time',
      'Created At ISO',
    ];

    const rows = summary.leads.map((l: AnalyticsLeadItem) => {
      const assignedTags = (contactTagsMap[l.id] || [])
        .map((tid) => tagsMap[tid]?.name)
        .filter(Boolean)
        .join(', ');
      const latestNote = contactNotesMap[l.id]?.[0]?.note_text || '';

      return [
        `"${(l.name || '').replace(/"/g, '""')}"`,
        `"${(l.phone || '').replace(/"/g, '""')}"`,
        `"${(l.city || '').replace(/"/g, '""')}"`,
        `"${(l.ad_name || 'Direct / Organic').replace(/"/g, '""')}"`,
        `"${(l.ad_id || '').replace(/"/g, '""')}"`,
        `"${(l.health_concern || 'General').replace(/"/g, '""')}"`,
        `"${(l.ai_analysis?.intent_label || 'Normal').replace(/"/g, '""')}"`,
        `"${assignedTags.replace(/"/g, '""')}"`,
        `"${latestNote.replace(/"/g, '""')}"`,
        `"${(l.ai_analysis?.dropout_reason || '').replace(/"/g, '""')}"`,
        `"${(l.ai_analysis?.calling_pitch || '').replace(/"/g, '""')}"`,
        `"${l.has_booking ? 'Booked' : 'Pending'}"`,
        `"${(l.consultation_type || '').replace(/"/g, '""')}"`,
        `"${(l.clinic_location || '').replace(/"/g, '""')}"`,
        `"${formatLeadDateTime(l.first_message_at || l.created_at)}"`,
        `"${l.first_message_at || l.created_at || ''}"`,
      ];
    });

    const csvContent =
      'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `gynocci_analytics_leads_${rangePreset}_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('CSV successfully export ho gayi!');
  };

  // Filtered leads list for UI table
  const displayedLeads = useMemo(() => {
    if (!summary?.leads) return [];
    return summary.leads.filter((lead: AnalyticsLeadItem) => {
      // 1. Search term
      if (leadsSearch.trim()) {
        const q = leadsSearch.toLowerCase().trim();
        const matchesName = (lead.name || '').toLowerCase().includes(q);
        const matchesPhone = (lead.phone || '').includes(q);
        const matchesCity = (lead.city || '').toLowerCase().includes(q);
        const matchesAd = (lead.ad_name || '').toLowerCase().includes(q);
        const matchesConcern = (lead.health_concern || '').toLowerCase().includes(q);
        if (!matchesName && !matchesPhone && !matchesCity && !matchesAd && !matchesConcern) {
          return false;
        }
      }

      // 2. Intent filter
      if (intentFilter !== 'all') {
        if (intentFilter === 'booked') {
          return lead.has_booking;
        }
        return lead.ai_analysis?.intent_stage === intentFilter;
      }

      return true;
    });
  }, [summary?.leads, leadsSearch, intentFilter]);

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 max-w-7xl mx-auto pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-purple-100 text-purple-700 rounded-lg">
              <Megaphone className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                Analytics & Ad Performance
                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-xs">
                  Gynocci Intelligence
                </Badge>
              </h1>
              <p className="text-sm text-slate-500">
                Meta Ads, drop-off calling leads, bimariyan (Health Concerns) aur AI pitch suggestions ka complete analysis
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAnalytics}
            disabled={refreshing}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={handleExportCsv}
            disabled={!summary || summary.leads.length === 0}
            className="gap-2 bg-purple-600 hover:bg-purple-700"
          >
            <Download className="h-4 w-4" />
            Export CSV ({summary?.leads.length || 0})
          </Button>
        </div>
      </div>

      {/* Date Filters & Ad Campaign Filter */}
      <Card className="border-slate-200 shadow-xs">
        <CardContent className="p-4 flex flex-wrap items-center justify-between gap-4">
          {/* Preset Buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mr-1 flex items-center gap-1">
              <Filter className="h-3.5 w-3.5" /> Date:
            </span>
            {(
              [
                { key: 'all' as const, label: 'All Time' },
                { key: 'today' as const, label: 'Today' },
                { key: 'yesterday' as const, label: 'Yesterday' },
                { key: '7d' as const, label: 'Last 7 Days' },
                { key: '30d' as const, label: 'Last 30 Days' },
                { key: 'this_month' as const, label: 'This Month' },
                { key: 'custom' as const, label: 'Custom' },
              ]
            ).map((preset) => (
              <Button
                key={preset.key}
                variant={rangePreset === preset.key ? 'default' : 'outline'}
                size="sm"
                onClick={() => setRangePreset(preset.key)}
                className={`text-xs h-8 ${
                  rangePreset === preset.key
                    ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-xs'
                    : 'text-slate-700'
                }`}
              >
                {preset.label}
              </Button>
            ))}
          </div>

          {/* Ad Campaign Dropdown */}
          <div className="flex items-center gap-2 min-w-[240px]">
            <Megaphone className="h-4 w-4 text-slate-400" />
            <Select
              value={selectedAdFilter}
              onValueChange={(val) => setSelectedAdFilter(val || 'all')}
            >
              <SelectTrigger className="h-8 text-xs w-[260px]">
                <SelectValue placeholder="All Ad Campaigns" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Ad Campaigns</SelectItem>
                {summary?.ad_performance?.map((ad) => (
                  <SelectItem key={ad.ad_name} value={ad.ad_name}>
                    {ad.ad_name} ({ad.leads_count} Leads)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>

        {/* Custom Date Inputs */}
        {rangePreset === 'custom' && (
          <div className="border-t border-slate-100 p-4 bg-slate-50 flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-600">From:</span>
              <Input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="h-8 text-xs w-40 bg-white"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-600">To:</span>
              <Input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="h-8 text-xs w-40 bg-white"
              />
            </div>
            <Button
              size="sm"
              variant="default"
              onClick={fetchAnalytics}
              className="h-8 text-xs bg-purple-600 hover:bg-purple-700"
            >
              Apply Filter
            </Button>
          </div>
        )}
      </Card>

      {/* Top Level Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="border-slate-200">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase">
              Total Leads
            </CardTitle>
            <Users className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-slate-900">{summary?.total_leads || 0}</div>
            <p className="text-xs text-slate-500 mt-1">All Leads received</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase">
              Total Bookings
            </CardTitle>
            <CalendarCheck className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-emerald-600">
              {summary?.total_bookings || 0}
            </div>
            <p className="text-xs text-slate-500 mt-1">Confirmed consultations</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase">
              Conversion Rate
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-blue-600">
              {summary?.conversion_rate || 0}%
            </div>
            <p className="text-xs text-slate-500 mt-1">Leads to booked ratio</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase">
              Clinic Visits
            </CardTitle>
            <Building2 className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-amber-600">
              {summary?.clinic_visits || 0}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              vs {summary?.video_consultations || 0} Video Calls
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase">
              Meta Ad Leads
            </CardTitle>
            <Megaphone className="h-4 w-4 text-pink-600" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-pink-600">
              {summary?.meta_ad_leads || 0}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {summary?.organic_leads || 0} Direct / Organic
            </p>
          </CardContent>
        </Card>
      </div>

      {/* AI Lead Qualification & Drop-Off Action Pipeline */}
      <Card className="border-purple-200 bg-gradient-to-r from-purple-50/50 via-white to-pink-50/30">
        <CardHeader className="p-5 pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-600" />
                AI Lead Qualification & Drop-Off Calling Pipeline
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                AI ne chat analyze karke bataya ki kin leads ko call karne par booking confirm ho sakti hai
              </CardDescription>
            </div>
            <Badge className="bg-purple-100 text-purple-800 border-purple-200 self-start sm:self-auto">
              Auto-Analyzed by AI
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-5 pt-1">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* 1. Ready to Convert */}
            <div
              onClick={() =>
                setIntentFilter(intentFilter === 'ready_to_convert' ? 'all' : 'ready_to_convert')
              }
              className={`cursor-pointer rounded-xl p-4 border transition-all ${
                intentFilter === 'ready_to_convert'
                  ? 'border-purple-600 bg-purple-100/80 shadow-md ring-2 ring-purple-400'
                  : 'border-purple-200 bg-white hover:border-purple-300 hover:shadow-xs'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-purple-800 uppercase flex items-center gap-1.5">
                  <PhoneCall className="h-3.5 w-3.5 text-purple-600" />
                  Ready to Convert
                </span>
                <Badge className="bg-purple-600 text-white font-bold text-xs px-2">
                  {summary?.ready_to_convert_count || 0}
                </Badge>
              </div>
              <p className="text-xs text-slate-600 mt-2 font-medium">
                High Intent — Serious health issue bataya, bus friendly call aur 5-doctor panel consultation pitch karein.
              </p>
              <div className="mt-2 text-[11px] text-purple-700 font-semibold flex items-center gap-1">
                Click to view leads <ChevronRight className="h-3 w-3" />
              </div>
            </div>

            {/* 2. Fees Hesitation */}
            <div
              onClick={() =>
                setIntentFilter(intentFilter === 'fees_hesitation' ? 'all' : 'fees_hesitation')
              }
              className={`cursor-pointer rounded-xl p-4 border transition-all ${
                intentFilter === 'fees_hesitation'
                  ? 'border-amber-600 bg-amber-100/80 shadow-md ring-2 ring-amber-400'
                  : 'border-amber-200 bg-white hover:border-amber-300 hover:shadow-xs'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-800 uppercase flex items-center gap-1.5">
                  <ShieldAlert className="h-3.5 w-3.5 text-amber-600" />
                  Fees Hesitation
                </span>
                <Badge className="bg-amber-600 text-white font-bold text-xs px-2">
                  {summary?.fees_hesitation_count || 0}
                </Badge>
              </div>
              <p className="text-xs text-slate-600 mt-2 font-medium">
                Rs. 499 fees sunkar ruke — Diet plan se relief aur clinic par Rs. 0 advance fees pitch karein.
              </p>
              <div className="mt-2 text-[11px] text-amber-700 font-semibold flex items-center gap-1">
                Click to view leads <ChevronRight className="h-3 w-3" />
              </div>
            </div>

            {/* 3. Clinic Opportunity */}
            <div
              onClick={() =>
                setIntentFilter(intentFilter === 'clinic_opportunity' ? 'all' : 'clinic_opportunity')
              }
              className={`cursor-pointer rounded-xl p-4 border transition-all ${
                intentFilter === 'clinic_opportunity'
                  ? 'border-emerald-600 bg-emerald-100/80 shadow-md ring-2 ring-emerald-400'
                  : 'border-emerald-200 bg-white hover:border-emerald-300 hover:shadow-xs'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-800 uppercase flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-emerald-600" />
                  Clinic Pitch
                </span>
                <Badge className="bg-emerald-600 text-white font-bold text-xs px-2">
                  {summary?.clinic_opportunity_count || 0}
                </Badge>
              </div>
              <p className="text-xs text-slate-600 mt-2 font-medium">
                Clinic branch ke paas hain — Nadi parikshan aur clinic par direct milne ki suvidha pitch karein.
              </p>
              <div className="mt-2 text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                Click to view leads <ChevronRight className="h-3 w-3" />
              </div>
            </div>

            {/* 4. Awareness Only */}
            <div
              onClick={() =>
                setIntentFilter(intentFilter === 'awareness_only' ? 'all' : 'awareness_only')
              }
              className={`cursor-pointer rounded-xl p-4 border transition-all ${
                intentFilter === 'awareness_only'
                  ? 'border-slate-500 bg-slate-100 shadow-md ring-2 ring-slate-400'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5">
                  <HelpCircle className="h-3.5 w-3.5 text-slate-500" />
                  Awareness Only
                </span>
                <Badge variant="secondary" className="font-bold text-xs px-2">
                  {summary?.awareness_only_count || 0}
                </Badge>
              </div>
              <p className="text-xs text-slate-600 mt-2 font-medium">
                Sirf general information ya hi-hello kiya, abhi tak symptoms share nahi kiye.
              </p>
              <div className="mt-2 text-[11px] text-slate-600 font-semibold flex items-center gap-1">
                Click to view leads <ChevronRight className="h-3 w-3" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Meta Ads Attribution Leaderboard */}
      <Card className="border-slate-200">
        <CardHeader className="p-5 pb-3">
          <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-purple-600" />
            Meta Ads Performance & Attribution Leaderboard
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            Ad Campaign ranking — kis ad campaign se sabse zyada leads aur appointments book hui hain
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Ad Campaign Name</th>
                  <th className="py-3 px-4">Ad ID</th>
                  <th className="py-3 px-4 text-center">Total Leads</th>
                  <th className="py-3 px-4 text-center">Bookings Confirmed</th>
                  <th className="py-3 px-4 text-center">Conversion Rate</th>
                  <th className="py-3 px-4">Top Disease / Concern</th>
                  <th className="py-3 px-4">Clinic Visits</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(!summary?.ad_performance || summary.ad_performance.length === 0) && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      No Meta Ad attribution found for this date range.
                    </td>
                  </tr>
                )}
                {summary?.ad_performance?.map((ad, idx) => (
                  <tr key={ad.ad_name + idx} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-medium text-slate-900 flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-[11px]">
                        {idx + 1}
                      </span>
                      {ad.ad_name}
                    </td>
                    <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                      {ad.ad_id || 'N/A'}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-slate-800">
                      {ad.leads_count}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-emerald-600">
                      {ad.bookings_count}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Badge
                        variant="outline"
                        className={`${
                          ad.conversion_rate >= 15
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-50 text-slate-700 border-slate-200'
                        }`}
                      >
                        {ad.conversion_rate}%
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {ad.top_concern ? (
                        <Badge variant="secondary" className="text-[11px]">
                          {ad.top_concern}
                        </Badge>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {ad.clinic_visits} visits ({ad.video_consultations} video)
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Complete Leads & Drop-off Telecaller Calling Table */}
      <Card className="border-slate-200">
        <CardHeader className="p-5 pb-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Users className="h-5 w-5 text-purple-600" />
                All Leads & Telecalling Action Center ({displayedLeads.length})
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Lead AI Calling Status, Drop-off Reason, Tags, Call Notes aur AI Pitch
              </CardDescription>
            </div>

            {/* Search and Video Links Action */}
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative w-full md:w-64">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <Input
                  placeholder="Search name, phone, city, ad..."
                  value={leadsSearch}
                  onChange={(e) => setLeadsSearch(e.target.value)}
                  className="h-8 pl-8 text-xs bg-white"
                />
              </div>

              <Link href="/settings?tab=videos">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200 shrink-0 cursor-pointer"
                  title="YouTube video links aur emotional message manage karein"
                >
                  <Video className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Video Links (YouTube)</span>
                </Button>
              </Link>

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedVoiceLead(null);
                  setVoiceCallOpen(true);
                }}
                className="h-8 gap-1.5 text-xs text-purple-700 hover:text-purple-800 hover:bg-purple-50 border-purple-200 shrink-0 cursor-pointer"
                title="AI Voice Calling Agent live demo chalayein"
              >
                <Phone className="h-3.5 w-3.5 text-purple-600 fill-current" />
                <span className="hidden sm:inline">🎙️ AI Call Demo</span>
              </Button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 pt-3 border-t border-slate-100">
            <span className="text-xs font-medium text-slate-500 mr-1">Filter by AI Stage:</span>
            {[
              { key: 'all', label: 'All Leads' },
              { key: 'ready_to_convert', label: '🔥 Ready to Convert' },
              { key: 'fees_hesitation', label: '⚠️ Fees Hesitation' },
              { key: 'clinic_opportunity', label: '🏥 Clinic Pitch' },
              { key: 'awareness_only', label: '💡 Awareness Only' },
              { key: 'booked', label: '✅ Booked Only' },
            ].map((tab) => (
              <Button
                key={tab.key}
                variant={intentFilter === tab.key ? 'default' : 'outline'}
                size="sm"
                onClick={() => setIntentFilter(tab.key)}
                className={`text-xs h-7 px-2.5 ${
                  intentFilter === tab.key
                    ? 'bg-purple-600 hover:bg-purple-700 text-white font-medium'
                    : 'text-slate-600'
                }`}
              >
                {tab.label}
              </Button>
            ))}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 min-w-[150px]">Contact / Patient</th>
                  <th className="py-3 px-4 min-w-[180px]">Meta Ad Campaign</th>
                  <th className="py-3 px-4 min-w-[150px]">Tags</th>
                  <th className="py-3 px-4 min-w-[140px]">Calling Priority</th>
                  <th className="py-3 px-4 min-w-[220px]">AI Dropout Reason & Pitch</th>
                  <th className="py-3 px-4 min-w-[150px]">Call Notes</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedLeads.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      No leads match the selected date, ad, or filter criteria.
                    </td>
                  </tr>
                )}
                {displayedLeads.map((lead: AnalyticsLeadItem) => {
                  const stage = lead.ai_analysis?.intent_stage || 'awareness_only';
                  const isReady = stage === 'ready_to_convert';
                  const isFees = stage === 'fees_hesitation';
                  const isClinic = stage === 'clinic_opportunity';
                  const isBooked = lead.has_booking;

                  const assignedTagIds = contactTagsMap[lead.id] || [];
                  const notesList = contactNotesMap[lead.id] || [];
                  const latestNote = notesList[0];

                  return (
                    <tr key={lead.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* 1. Contact / Patient */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{lead.name || 'Unknown'}</div>
                        <div className="text-slate-500 font-mono text-[11px] flex items-center gap-1">
                          <a
                            href={formatTelUri(lead.phone)}
                            className="hover:text-purple-700 hover:underline flex items-center gap-0.5"
                            title="Call this patient"
                          >
                            <Phone className="h-2.5 w-2.5 text-emerald-600 fill-current" />
                            {formatPhoneDisplay(lead.phone)}
                          </a>
                        </div>
                        {lead.city && (
                          <div className="text-[11px] text-purple-700 flex items-center gap-1 mt-0.5">
                            <MapPin className="h-3 w-3" /> {lead.city}
                          </div>
                        )}
                        <div
                          className="text-[11px] text-slate-500 flex items-center gap-1 mt-1 font-sans"
                          title="First message date & time"
                        >
                          <Clock className="h-3 w-3 text-slate-400 shrink-0" />
                          <span>{formatLeadDateTime(lead.first_message_at || lead.created_at)}</span>
                        </div>
                        {lead.health_concern && (
                          <Badge variant="outline" className="text-[10px] mt-1 bg-purple-50 text-purple-700">
                            {lead.health_concern}
                          </Badge>
                        )}
                      </td>

                      {/* 2. Meta Ad Campaign */}
                      <td className="py-3 px-4 min-w-[180px] max-w-[240px]">
                        {lead.ad_name ? (
                          <div className="space-y-0.5">
                            <div className="font-medium text-slate-800 line-clamp-2 leading-snug">
                              {lead.ad_name}
                            </div>
                            {lead.ad_id && (
                              <div className="text-[10px] text-slate-400 font-mono">
                                ID: {lead.ad_id}
                              </div>
                            )}
                            {lead.concern_category && (
                              <Badge
                                variant="outline"
                                className="text-[9px] px-1 py-0 bg-purple-50 text-purple-700 border-purple-200 mt-0.5"
                              >
                                {lead.concern_category}
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Direct / Organic</span>
                        )}
                      </td>

                      {/* 3. Tags Column */}
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap items-center gap-1 max-w-[200px]">
                          {assignedTagIds.map((tid) => {
                            const tag = tagsMap[tid];
                            if (!tag) return null;
                            return (
                              <Badge
                                key={tag.id}
                                variant="outline"
                                className="text-[10px] font-medium px-1.5 py-0.5 gap-1 border shadow-2xs group/tag transition-all"
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
                                <span className="truncate max-w-[90px]">{tag.name}</span>
                                <button
                                  type="button"
                                  className="opacity-0 group-hover/tag:opacity-100 hover:bg-black/10 rounded-full p-0.5 cursor-pointer"
                                  onClick={() => handleToggleTag(lead.id, tag.id)}
                                >
                                  <X className="h-2 w-2" />
                                </button>
                              </Badge>
                            );
                          })}

                          {/* + Tag Popover */}
                          <Popover>
                            <PopoverTrigger
                              className="inline-flex items-center justify-center rounded-md border border-dashed border-input bg-background hover:bg-accent hover:text-accent-foreground h-5 px-1.5 text-[10px] gap-0.5 text-slate-500 hover:text-slate-900 cursor-pointer transition-colors"
                            >
                              <Plus className="h-2.5 w-2.5" /> Tag
                            </PopoverTrigger>
                            <PopoverContent className="w-56 p-2 text-xs" align="start">
                              <div className="font-semibold text-slate-700 mb-2 flex items-center gap-1">
                                <TagIcon className="h-3.5 w-3.5 text-purple-600" />
                                Select or Add Tag
                              </div>
                              <div className="max-h-40 overflow-y-auto space-y-1 mb-2">
                                {allTags.map((tag) => {
                                  const active = assignedTagIds.includes(tag.id);
                                  return (
                                    <div
                                      key={tag.id}
                                      onClick={() => handleToggleTag(lead.id, tag.id)}
                                      className={`p-1.5 rounded-md cursor-pointer flex items-center justify-between text-xs transition-colors ${
                                        active ? 'bg-purple-50 text-purple-900 font-medium' : 'hover:bg-slate-50'
                                      }`}
                                    >
                                      <div className="flex items-center gap-1.5 truncate">
                                        <span
                                          className="w-2 h-2 rounded-full shrink-0"
                                          style={{ backgroundColor: tag.color }}
                                        />
                                        <span className="truncate">{tag.name}</span>
                                      </div>
                                      {active && <Check className="h-3 w-3 text-purple-600" />}
                                    </div>
                                  );
                                })}
                              </div>
                              <div className="pt-2 border-t border-slate-100">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="w-full text-xs h-7 text-purple-600 justify-start"
                                  onClick={() => {
                                    const name = prompt('New Tag Name:');
                                    if (name) handleCreateAndAssignTag(lead.id, name, '#8b5cf6');
                                  }}
                                >
                                  <Plus className="h-3 w-3 mr-1" /> New Tag (Create Tag)
                                </Button>
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                      </td>

                      {/* 3. Calling Priority */}
                      <td className="py-3 px-4">
                        {isBooked ? (
                          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
                            ✅ Booked
                          </Badge>
                        ) : isReady ? (
                          <Badge className="bg-purple-100 text-purple-800 border-purple-300 font-semibold">
                            🔥 High Intent (Call)
                          </Badge>
                        ) : isFees ? (
                          <Badge className="bg-amber-100 text-amber-800 border-amber-300 font-semibold">
                            ⚠️ Fees Hesitation
                          </Badge>
                        ) : isClinic ? (
                          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-semibold">
                            🏥 Clinic Near Branch
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-slate-600">
                            💡 Awareness Only
                          </Badge>
                        )}
                      </td>

                      {/* 4. AI Dropout Reason & Pitch */}
                      <td className="py-3 px-4 max-w-sm">
                        <div className="text-slate-700 font-medium line-clamp-1">
                          {lead.ai_analysis?.dropout_reason || 'No drop-off noted'}
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setScriptModalLead(lead);
                              setModalNoteDraft('');
                            }}
                            className="h-6 px-2 text-[11px] gap-1 text-purple-700 border-purple-200 hover:bg-purple-50 cursor-pointer"
                          >
                            <PhoneCall className="h-3 w-3" />
                            📞 View AI Script
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedVideoLead(lead);
                              setVideoModalOpen(true);
                            }}
                            className="h-6 px-2 text-[11px] gap-1 text-rose-700 border-rose-300 bg-rose-50/70 hover:bg-rose-100 cursor-pointer font-medium"
                            title="Patient ko 1-click mein YouTube video aur emotional message bhejein"
                          >
                            <Video className="h-3 w-3 text-rose-600" />
                            🌸 Send Video
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedVoiceLead(lead);
                              setVoiceCallOpen(true);
                            }}
                            className="h-6 px-2 text-[11px] gap-1 text-purple-700 border-purple-300 bg-purple-50/70 hover:bg-purple-100 cursor-pointer font-medium"
                            title="Is patient ko AI agent se live voice call demo chalayein"
                          >
                            <Phone className="h-3 w-3 text-purple-600 fill-current" />
                            🎙️ AI Call Demo
                          </Button>
                        </div>
                      </td>

                      {/* 5. Notes Column */}
                      <td className="py-3 px-4 max-w-[200px]">
                        {latestNote ? (
                          <div
                            onClick={() => {
                              setNoteModalLead(lead);
                              setTableNoteDraft(latestNote.note_text);
                            }}
                            className="cursor-pointer group/note"
                            title="Click to view all notes or add new"
                          >
                            <div className="text-slate-800 font-medium line-clamp-2 text-[11px] group-hover/note:text-purple-700">
                              📝 {latestNote.note_text}
                            </div>
                            <span className="text-[10px] text-slate-400">
                              {new Date(latestNote.created_at).toLocaleDateString('hi-IN', {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </span>
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setNoteModalLead(lead);
                              setTableNoteDraft('');
                            }}
                            className="h-6 px-2 text-[11px] text-slate-400 hover:text-slate-700 gap-1 border border-dashed border-slate-200"
                          >
                            <StickyNote className="h-3 w-3" />
                            + Add Note
                          </Button>
                        )}
                      </td>

                      {/* 6. Status */}
                      <td className="py-3 px-4 text-center">
                        {isBooked ? (
                          <Badge className="bg-emerald-600 text-white text-[11px]">Confirmed</Badge>
                        ) : (
                          <Badge variant="outline" className="text-amber-700 bg-amber-50 text-[11px]">
                            Pending
                          </Badge>
                        )}
                      </td>

                      {/* 7. Action */}
                      <td className="py-3 px-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(`/inbox?contactId=${lead.id}`)}
                          className="h-7 px-2 text-xs text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                        >
                          <MessageSquare className="h-3.5 w-3.5 mr-1" />
                          Chat
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Calling Script & Action Popup Dialog */}
      <Dialog open={!!scriptModalLead} onOpenChange={(open) => !open && setScriptModalLead(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {scriptModalLead && (
            <div className="space-y-4">
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-purple-100 text-purple-700 rounded-lg">
                    <PhoneCall className="h-5 w-5" />
                  </div>
                  <div>
                    <DialogTitle className="text-lg font-bold text-slate-900">
                      Telecalling Script & Lead Action Center
                    </DialogTitle>
                    <DialogDescription className="text-xs text-slate-500">
                      Patient chat analysis, bimari ki samajh, telecalling script aur response tracking
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              {/* Patient Info Card */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-500">Patient Name:</span>
                  <div className="font-bold text-slate-900">{scriptModalLead.name || 'Unknown'}</div>
                </div>
                <div>
                  <span className="text-slate-500">Phone Number (Click to call):</span>
                  <div className="font-bold text-purple-700 flex items-center gap-1">
                    <a
                      href={formatTelUri(scriptModalLead.phone)}
                      className="hover:underline flex items-center gap-1"
                    >
                      <Phone className="h-3 w-3 fill-current text-emerald-600" />
                      {formatPhoneDisplay(scriptModalLead.phone)}
                    </a>
                  </div>
                </div>
                <div>
                  <span className="text-slate-500">City / Location:</span>
                  <div className="font-semibold text-slate-800">{scriptModalLead.city || 'Not specified'}</div>
                </div>
                <div>
                  <span className="text-slate-500">Health Concern / Disease:</span>
                  <div className="font-semibold text-pink-700">{scriptModalLead.health_concern || 'General'}</div>
                </div>
              </div>

              {/* Dropout Reason Analysis */}
              <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 text-xs space-y-1">
                <div className="font-bold text-amber-900 flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  Why Did Lead Drop Off? (Drop-off Reason):
                </div>
                <p className="text-amber-800 leading-relaxed font-medium">
                  {scriptModalLead.ai_analysis?.dropout_reason || 'Koi specific drop-off signal nahi mila.'}
                </p>
              </div>

              {/* Clinical Root-Cause & Treatment Insight */}
              {(scriptModalLead.ai_analysis?.disease_cause || scriptModalLead.ai_analysis?.disease_treatment) && (
                <div className="p-3.5 bg-blue-50/70 rounded-xl border border-blue-200 text-xs space-y-2">
                  <div className="font-bold text-blue-950 flex items-center gap-1.5">
                    <Stethoscope className="h-4 w-4 text-blue-600" />
                    Doctor Insight (Karan aur Ayurvedic Solution):
                  </div>
                  {scriptModalLead.ai_analysis?.disease_cause && (
                    <div>
                      <strong className="text-blue-900">Problem kyun hoti hai: </strong>
                      <span className="text-slate-700">{scriptModalLead.ai_analysis.disease_cause}</span>
                    </div>
                  )}
                  {scriptModalLead.ai_analysis?.disease_treatment && (
                    <div>
                      <strong className="text-blue-900">Ayurvedic ilaaj ka tareeka: </strong>
                      <span className="text-slate-700">{scriptModalLead.ai_analysis.disease_treatment}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Telecaller Script */}
              <div className="p-4 bg-purple-50/70 rounded-xl border border-purple-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-xs text-purple-950 flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-purple-600" />
                    Telecalling Script (Call par bolne wali pitch):
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopyScript(scriptModalLead.ai_analysis?.calling_pitch || '')}
                    className="h-7 text-xs gap-1 border-purple-300 text-purple-700 hover:bg-purple-100"
                  >
                    {copiedScript ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {copiedScript ? 'Copied!' : 'Copy Script'}
                  </Button>
                </div>

                <div className="p-3 bg-white rounded-lg border border-purple-100 text-xs text-slate-800 leading-relaxed whitespace-pre-line font-normal">
                  {scriptModalLead.ai_analysis?.calling_pitch}
                </div>
              </div>

              {/* Disease YouTube Video Recommendation */}
              <div className="p-3.5 bg-red-50/50 rounded-xl border border-red-200 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-red-950 flex items-center gap-1.5">
                    <PlayCircle className="h-4 w-4 text-red-600" />
                    YouTube Video Link & Emotional Message (Patient Reassurance):
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopyVideoMessage(scriptModalLead)}
                    className="h-7 text-xs gap-1 border-red-300 text-red-700 hover:bg-red-100"
                  >
                    {copiedVideoMsg ? <Check className="h-3 w-3" /> : <Share2 className="h-3 w-3" />}
                    {copiedVideoMsg ? 'Message Copied!' : 'Copy Video Message'}
                  </Button>
                </div>
                <p className="text-slate-600">
                  Patient ko call ke dauran ya baad mein WhatsApp par ye video link aur emotional message bhejein jisse patient ka trust build ho.
                </p>
                {scriptModalLead.ai_analysis?.video_recommendation && (
                  <div className="text-[11px] text-red-700 font-mono break-all">
                    Link: {scriptModalLead.ai_analysis.video_recommendation}
                  </div>
                )}
              </div>

              {/* Post-Call Tagging & Notes Tracking */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-3">
                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                  <TagIcon className="h-4 w-4 text-purple-600" />
                  Call Result & Tags Update:
                </div>

                {/* Quick Call Result Tags */}
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_CALL_TAGS.map((qt) => {
                    const matchedTag = allTags.find((t) => t.name.toLowerCase().includes(qt.name.toLowerCase()));
                    const isAssigned = matchedTag ? (contactTagsMap[scriptModalLead.id] || []).includes(matchedTag.id) : false;

                    return (
                      <Button
                        key={qt.name}
                        type="button"
                        variant={isAssigned ? 'default' : 'outline'}
                        size="sm"
                        onClick={async () => {
                          if (matchedTag) {
                            await handleToggleTag(scriptModalLead.id, matchedTag.id);
                          } else {
                            await handleCreateAndAssignTag(scriptModalLead.id, qt.name, qt.color);
                          }
                        }}
                        className={`text-xs h-7 px-2.5 ${
                          isAssigned ? 'bg-purple-600 text-white' : 'text-slate-700'
                        }`}
                      >
                        {qt.name} {isAssigned && <Check className="h-3 w-3 ml-1" />}
                      </Button>
                    );
                  })}
                </div>

                {/* Call Notes input */}
                <div className="space-y-1.5 pt-2 border-t border-slate-200">
                  <label className="font-semibold text-slate-700 flex items-center gap-1">
                    <StickyNote className="h-3.5 w-3.5 text-slate-500" />
                    Call Note (Kya baat hui):
                  </label>
                  <Textarea
                    placeholder="e.g. Patient se baat hui, unhone kaha shaam 5 baje call karein..."
                    value={modalNoteDraft}
                    onChange={(e) => setModalNoteDraft(e.target.value)}
                    rows={2}
                    className="text-xs bg-white"
                  />
                  <div className="flex justify-end pt-1">
                    <Button
                      size="sm"
                      onClick={async () => {
                        if (!modalNoteDraft.trim()) return;
                        setModalSavingNote(true);
                        await handleSaveContactNote(scriptModalLead.id, modalNoteDraft);
                        setModalNoteDraft('');
                        setModalSavingNote(false);
                      }}
                      disabled={modalSavingNote || !modalNoteDraft.trim()}
                      className="h-7 text-xs bg-purple-600 hover:bg-purple-700"
                    >
                      Save Note
                    </Button>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <Button variant="outline" size="sm" onClick={() => setScriptModalLead(null)}>
                  Close
                </Button>
                <Button
                  size="sm"
                  onClick={() => router.push(`/inbox?contactId=${scriptModalLead.id}`)}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  <MessageSquare className="h-4 w-4 mr-1.5" />
                  Open Inbox Chat
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Standalone Note Modal (from clicking table note) */}
      <Dialog open={!!noteModalLead} onOpenChange={(open) => !open && setNoteModalLead(null)}>
        <DialogContent className="max-w-md">
          {noteModalLead && (
            <div className="space-y-4">
              <DialogHeader>
                <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                  <StickyNote className="h-4 w-4 text-purple-600" />
                  Call Notes: {noteModalLead.name || noteModalLead.phone}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Is patient ke liye calling notes aur response history
                </DialogDescription>
              </DialogHeader>

              {/* Existing Notes History */}
              <div className="max-h-40 overflow-y-auto space-y-2">
                {(contactNotesMap[noteModalLead.id] || []).length === 0 && (
                  <p className="text-xs text-slate-400">Abhi tak koi note save nahi hai.</p>
                )}
                {(contactNotesMap[noteModalLead.id] || []).map((cn) => (
                  <div key={cn.id} className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 text-xs">
                    <p className="text-slate-800 whitespace-pre-wrap">{cn.note_text}</p>
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      {new Date(cn.created_at).toLocaleString('hi-IN')}
                    </span>
                  </div>
                ))}
              </div>

              {/* Add New Note */}
              <div className="space-y-1.5 pt-2 border-t border-slate-100">
                <label className="text-xs font-semibold text-slate-700">Add New Note:</label>
                <Textarea
                  placeholder="Call details yahan likhein..."
                  value={tableNoteDraft}
                  onChange={(e) => setTableNoteDraft(e.target.value)}
                  rows={3}
                  className="text-xs bg-white"
                />
              </div>

              <DialogFooter>
                <Button variant="outline" size="sm" onClick={() => setNoteModalLead(null)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={async () => {
                    if (!tableNoteDraft.trim()) return;
                    setTableSavingNote(true);
                    await handleSaveContactNote(noteModalLead.id, tableNoteDraft);
                    setTableNoteDraft('');
                    setTableSavingNote(false);
                    setNoteModalLead(null);
                  }}
                  disabled={tableSavingNote || !tableNoteDraft.trim()}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  Save Note
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 1-Click Send Disease Video Modal */}
      <SendDiseaseVideoModal
        open={videoModalOpen}
        onOpenChange={setVideoModalOpen}
        patientName={selectedVideoLead?.name}
        phone={selectedVideoLead?.phone}
        initialConcernOrAd={selectedVideoLead?.health_concern || selectedVideoLead?.ad_name}
      />

      {/* Live AI Voice Call Dialog */}
      <LiveVoiceCallDialog
        open={voiceCallOpen}
        onOpenChange={setVoiceCallOpen}
        patientName={selectedVoiceLead?.name || 'Patient'}
        phone={selectedVoiceLead?.phone || null}
        concern={selectedVoiceLead?.health_concern || selectedVoiceLead?.ad_name || 'Ayurvedic Consultation'}
        city={selectedVoiceLead?.city || null}
        adName={selectedVoiceLead?.ad_name || null}
        contactId={selectedVoiceLead?.id || null}
      />
    </div>
  );
}
