'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import type {
  Booking,
  BookingStatus,
  ConsultationType,
  Tag,
  WebsiteBookingStatus,
  PatientVisitOutcome,
} from '@/types';
import { formatTelUri, formatPhoneDisplay } from '@/lib/whatsapp/phone-utils';
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
  BarChart3,
  CalendarCheck,
  Search,
  Download,
  Phone,
  PhoneCall,
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
  ChevronDown,
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
  Globe,
  AlertTriangle,
  CheckCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { addContactTag, deleteContactTag } from '@/lib/contacts/tag-api';
import { useClinics } from '@/hooks/use-clinics';
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

const CLINIC_OPTIONS = [
  { city: 'Jaipur', label: 'Jaipur (Head Office, Vaishali Nagar)' },
  { city: 'Delhi', label: 'Delhi (Rajouri Garden)' },
  { city: 'Lucknow', label: 'Lucknow (Gomti Nagar)' },
  { city: 'Amritsar', label: 'Amritsar (Ranjit Avenue)' },
  { city: 'Ludhiana', label: 'Ludhiana (Ferozepur Road)' },
  { city: 'Chandigarh', label: 'Chandigarh (Sector 35-C)' },
  { city: 'Indore', label: 'Indore (Vijay Nagar)' },
  { city: 'Patna', label: 'Patna (Kankarbagh)' },
  { city: 'Rewari', label: 'Rewari (Model Town)' },
];

function getQuickDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  const day = d.getDate();
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return `${day} ${monthNames[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Normalizes user-entered date strings into YYYY-MM-DD for accurate comparison and grouping.
 * Handles ISO (2026-11-27), DMY (27/11/2026), and text dates (27 November 2026, 27 Nov 2026).
 */
export function normalizeDateStringToYMD(dateStr?: string | null): string | null {
  if (!dateStr || !dateStr.trim()) return null;
  const s = dateStr.trim();

  // 1. Try ISO YYYY-MM-DD
  const isoMatch = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const y = isoMatch[1];
    const m = isoMatch[2].padStart(2, '0');
    const d = isoMatch[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // 2. Try DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = s.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmyMatch) {
    const d = dmyMatch[1].padStart(2, '0');
    const m = dmyMatch[2].padStart(2, '0');
    const y = dmyMatch[3];
    return `${y}-${m}-${d}`;
  }

  // 3. Try "27 November 2026" or "27 Nov 2026"
  const textMatch = s.match(/(\d{1,2})\s+([a-zA-Z]+)(?:\s+(\d{4}))?/i);
  if (textMatch) {
    const d = textMatch[1].padStart(2, '0');
    const monthStr = textMatch[2].toLowerCase().slice(0, 3);
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const monthIdx = months.indexOf(monthStr);
    if (monthIdx !== -1) {
      const m = String(monthIdx + 1).padStart(2, '0');
      const y = textMatch[3] || String(new Date().getFullYear());
      return `${y}-${m}-${d}`;
    }
  }

  // 4. Try parsing with standard Date
  try {
    const parsed = new Date(s);
    if (!isNaN(parsed.getTime())) {
      const y = parsed.getFullYear();
      const m = String(parsed.getMonth() + 1).padStart(2, '0');
      const d = String(parsed.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  } catch {
    // ignore
  }

  return null;
}

export function getEffectiveWebsiteStatus(b: Booking): 'done' | 'pending' {
  if (b.website_status === 'done' || b.website_status === 'pending') {
    return b.website_status;
  }
  if (b.notes?.includes('[Website: DONE]')) return 'done';
  return 'pending';
}

export function getEffectiveVisitOutcome(b: Booking): PatientVisitOutcome {
  if (
    b.visit_outcome &&
    ['converted', 'non_converted', 'not_visited', 'pending_visit'].includes(b.visit_outcome)
  ) {
    return b.visit_outcome as PatientVisitOutcome;
  }
  if (b.notes?.includes('[Outcome: CONVERTED]')) return 'converted';
  if (b.notes?.includes('[Outcome: NON_CONVERTED]')) return 'non_converted';
  if (b.notes?.includes('[Outcome: NOT_VISITED]')) return 'not_visited';
  return 'pending_visit';
}

export function cleanPatientQueryNotes(notesText: string | null | undefined): string {
  if (!notesText) return '';
  return notesText
    .split('\n')
    .map((l) => l.trim())
    .filter((trimmed) => {
      if (!trimmed) return false;
      // Filter out automated call status logs
      if (
        /^👤\s*.*:\s*(❌|⏳|✅|🚫|📞|📵)?\s*(Not Connected|Call Not Answered|Callback Requested|Booking Confirmed|Patient Not Interested|Dawa Nahi Leni)/i.test(
          trimmed
        )
      ) {
        return false;
      }
      if (/^\[Booking\s+[^\]]+\]\s*👤/i.test(trimmed)) {
        return false;
      }
      if (/^\[Outcome:\s*(CONVERTED|NON_CONVERTED|NOT_VISITED|PENDING_VISIT)\]/i.test(trimmed)) {
        return false;
      }
      if (/^\[Website:\s*(DONE|PENDING)\]/i.test(trimmed)) {
        return false;
      }
      return true;
    })
    .join('\n')
    .trim();
}

export function getCombinedBookingNotesForWebsite(b: Booking): string {
  const rawNotes = (b.notes || '').trim();
  const cleanNotes = cleanPatientQueryNotes(rawNotes);
  const concern = (b.health_concern || '').trim();

  // Strip author stamp if present line-by-line (e.g. "👤 Puneet Choudhary (...): Age: 20...")
  const cleanedLines = cleanNotes
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      const match = trimmed.match(/^👤\s*(?:.*?\)\s*:|[^:]+:)\s*(.*)$/);
      return match ? match[1].trim() : trimmed;
    })
    .filter(Boolean);

  const actualNoteText = cleanedLines.join('\n');

  const parts: string[] = [];
  if (concern) {
    parts.push(concern);
  }
  if (actualNoteText && !parts.some((p) => p.toLowerCase().includes(actualNoteText.toLowerCase()))) {
    parts.push(actualNoteText);
  }

  if (parts.length === 0) {
    return rawNotes || concern || '';
  }

  return parts.join('\n');
}

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
      className="flex flex-wrap items-center gap-1.5 min-w-[240px] max-w-[420px]"
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
            title={tag.name}
            className="text-[11px] font-medium px-2 py-0.5 gap-1.5 border shadow-2xs group/tag transition-all shrink-0 max-w-full"
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
            <span className="font-medium whitespace-nowrap">{tag.name}</span>
            <button
              type="button"
              className="opacity-0 group-hover/tag:opacity-100 hover:bg-black/10 dark:hover:bg-white/10 rounded-full p-0.5 transition-opacity cursor-pointer shrink-0 ml-0.5"
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

const QUICK_MEDICAL_TEMPLATES = [
  '🌸 PCOD / PCOS Problem',
  '🩺 Tubal Blockage Reports Discussion',
  '🩸 Periods Irregular / Heavy Pain',
  '👨‍⚕️ Direct Doctor Consultation Wanted',
  '💳 Consultation Fee & Discount Details Sent',
  '📱 Medical Reports to be Sent on WhatsApp',
  '🏥 Wants Clinic Visit in Jaipur/Delhi',
];

interface FollowUpNoteDialogContentProps {
  booking: Booking;
  initialNote: string;
  saving: boolean;
  onSave: (note: string) => Promise<void>;
  onClose: () => void;
}

function FollowUpNoteDialogContent({
  booking,
  initialNote,
  saving,
  onSave,
  onClose,
}: FollowUpNoteDialogContentProps) {
  const [draft, setDraft] = useState(initialNote);

  return (
    <DialogContent className="sm:max-w-[480px]">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <span>Patient Query & Symptoms (मरीज की समस्या / सवाल)</span>
        </DialogTitle>
        <DialogDescription>
          Patient ne call par jo query ya health issues bataye hain, sirf wahi yaha darj karein:{' '}
          <strong className="text-foreground">{booking.patient_name}</strong>{' '}
          <span className="font-mono text-xs">({booking.booking_query_id})</span>
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-3 py-2">
        {/* Quick Medical Query Templates */}
        <div>
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
            Quick Medical & Query Templates (Click to insert)
          </span>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_MEDICAL_TEMPLATES.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => {
                  setDraft((prev) => {
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
            Patient Query / Discussion Notes (कॉल पर मरीज ने क्या बताया):
          </label>
          <Textarea
            rows={4}
            placeholder="e.g., Patient ne bataya unhe 3 saal se PCOD hai aur conceiving me dikkat aa rahi hai, doctor se direct video call pe baat karna chahte hain..."
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="text-xs"
          />
        </div>
      </div>

      <DialogFooter className="flex sm:justify-between items-center">
        <div className="text-xs text-muted-foreground">
          {booking.phone && (
            <a
              href={formatTelUri(booking.phone)}
              className="text-primary hover:underline flex items-center gap-1"
            >
              <Phone className="h-3 w-3" />
              Call: {formatPhoneDisplay(booking.phone)}
            </a>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => onSave(draft)}
            disabled={saving}
            className="gap-1.5"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            Save Note
          </Button>
        </div>
      </DialogFooter>
    </DialogContent>
  );
}

interface WebsiteReminderDialogContentProps {
  booking: Booking;
  agentName: string;
  initialNotes: string;
  onUpdateStatusDone: (bookingId: string, notes: string) => Promise<void>;
  onClose: (notes: string) => void;
}

function WebsiteReminderDialogContent({
  booking,
  agentName,
  initialNotes,
  onUpdateStatusDone,
  onClose,
}: WebsiteReminderDialogContentProps) {
  const [notes, setNotes] = useState(initialNotes);
  const [copiedAll, setCopiedAll] = useState(false);

  const consultationDisplay =
    booking.consultation_type === 'clinic_visit'
      ? `🏥 Clinic Visit (${booking.clinic_location || booking.city || 'Clinic'})`
      : '📹 Online Video Call (45 Min Session)';

  const consultationCopyText =
    booking.consultation_type === 'clinic_visit'
      ? `Clinic Visit - ${booking.clinic_location || booking.city || 'Clinic'}`
      : 'Online Video Call';

  const scheduleDisplay =
    [booking.preferred_date, booking.preferred_time].filter(Boolean).join(' - ') || 'N/A';

  const handleCopyAll = () => {
    const fullText = `Name: ${booking.patient_name}\nPhone: ${booking.phone}\nCity/Clinic: ${booking.clinic_location || booking.city || 'N/A'}\nMode: ${consultationCopyText}\nSchedule: ${scheduleDisplay}\nHealth Concern / Notes: ${notes || booking.health_concern || 'None'}`;
    navigator.clipboard.writeText(fullText);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
    toast.success('All booking details copied for website punching!');
  };

  return (
    <DialogContent className="sm:max-w-[520px]">
      <DialogHeader>
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mb-1">
          <Globe className="h-5 w-5" />
        </div>
        <DialogTitle className="text-base text-emerald-800 dark:text-emerald-300">
          🎉 Call Booking Confirmed! (By {agentName})
        </DialogTitle>
        <DialogDescription className="text-xs">
          Lead ne call par appointment confirm kiya hai. Website par booking punch karne ke liye ye details copy karein:
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-3 py-1">
        {/* Patient Core Details Summary */}
        <div className="p-3 bg-muted/40 rounded-lg space-y-2 text-xs border border-border">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Patient Name:</span>
            <div className="flex items-center gap-1.5 font-semibold text-foreground">
              <span>{booking.patient_name}</span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(booking.patient_name);
                  toast.success('Patient name copied!');
                }}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
                title="Copy Name"
              >
                <Copy className="h-3 w-3" />
              </button>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Phone Number:</span>
            <div className="flex items-center gap-1.5 font-mono">
              <span>{formatPhoneDisplay(booking.phone)}</span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(booking.phone.replace(/\D/g, ''));
                  toast.success('Phone number copied!');
                }}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
                title="Copy Phone"
              >
                <Copy className="h-3 w-3" />
              </button>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Consultation Type:</span>
            <div className="flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-300">
              <span>{consultationDisplay}</span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(consultationCopyText);
                  toast.success('Consultation type copied!');
                }}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
                title="Copy Mode"
              >
                <Copy className="h-3 w-3" />
              </button>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Preferred Schedule:</span>
            <div className="flex items-center gap-1.5 font-medium text-primary">
              <span>{scheduleDisplay}</span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(scheduleDisplay);
                  toast.success('Schedule copied!');
                }}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
                title="Copy Schedule"
              >
                <Copy className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>

        {/* Health Concern / Notes for Website */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-primary" />
              <span>Health Concern / Notes (Website form me fill karein):</span>
            </label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-xs text-primary hover:text-primary/80 gap-1"
              onClick={() => {
                if (notes) {
                  navigator.clipboard.writeText(notes);
                  toast.success('Health Concern notes copied!');
                }
              }}
            >
              <Copy className="h-3 w-3" />
              Copy Notes
            </Button>
          </div>
          <Textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. 3 saal se PCOD hai, periods irregular, conceiving me issue..."
            className="text-xs font-normal"
          />
        </div>

        {/* 1-Click Copy All Booking Details for Website Punching */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full text-xs gap-1.5 border-dashed border-primary/50 text-primary hover:bg-primary/5 cursor-pointer"
          onClick={handleCopyAll}
        >
          {copiedAll ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
          <span>{copiedAll ? 'All Details Copied!' : 'Copy All Details for Website Punching'}</span>
        </Button>
      </div>

      <DialogFooter className="flex sm:justify-between items-center gap-2 pt-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onClose(notes)}
        >
          Baad Me Karein (Pending)
        </Button>
        <Button
          size="sm"
          className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-xs cursor-pointer"
          onClick={() => onUpdateStatusDone(booking.id, notes)}
        >
          <Check className="h-4 w-4" />
          Website Status: Mark as Done
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

export default function BookingsPage() {
  const router = useRouter();
  const supabase = createClient();
  const { account, accountRole, user, profile } = useAuth();
  const { activeClinics } = useClinics();

  const currentAgentName = useMemo(() => {
    return (
      profile?.full_name?.trim() ||
      user?.user_metadata?.full_name?.trim() ||
      (user?.email ? user.email.split('@')[0] : 'Agent')
    );
  }, [profile?.full_name, user?.user_metadata?.full_name, user?.email]);

  const getRecommendedFollowupTime = useCallback(() => {
    const now = new Date();
    const currentHour = now.getHours();
    if (currentHour < 13) {
      return 'Today 04:00 PM';
    }
    if (currentHour < 17) {
      return 'Today 06:30 PM';
    }
    return 'Tomorrow 11:00 AM';
  }, []);

  // Website Booking Reminder state
  const [websiteReminderOpen, setWebsiteReminderOpen] = useState(false);
  const [reminderBooking, setReminderBooking] = useState<Booking | null>(null);
  const [reminderAgentName, setReminderAgentName] = useState('');
  const [reminderNotes, setReminderNotes] = useState('');
  const [copiedWebsiteDetails, setCopiedWebsiteDetails] = useState(false);

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | BookingStatus>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'clinic_visit' | 'video_consultation'>('all');
  const [websiteFilter, setWebsiteFilter] = useState<'all' | 'done' | 'pending'>('all');
  const [outcomeFilters, setOutcomeFilters] = useState<PatientVisitOutcome[]>([]);

  const toggleOutcomeFilter = useCallback((outcome: PatientVisitOutcome) => {
    setOutcomeFilters((prev) =>
      prev.includes(outcome) ? prev.filter((o) => o !== outcome) : [...prev, outcome]
    );
  }, []);

  const clearOutcomeFilters = useCallback(() => {
    setOutcomeFilters([]);
  }, []);

  const selectAllOutcomeFilters = useCallback(() => {
    setOutcomeFilters(['converted', 'non_converted', 'not_visited', 'pending_visit']);
  }, []);
  const [dateFilter, setDateFilter] = useState<
    'all' | 'today' | 'tomorrow' | 'yesterday' | 'next_7_days' | 'this_week' | 'this_month' | 'no_date' | 'specific'
  >('all');
  const [specificScheduleDate, setSpecificScheduleDate] = useState<string>('');
  const [clinicFilter, setClinicFilter] = useState<string>('all');
  const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null);

  // New Booking Modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newPatientName, setNewPatientName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newConsultationType, setNewConsultationType] = useState<ConsultationType>('clinic_visit');
  const [newClinicLocation, setNewClinicLocation] = useState('Jaipur');
  const [newCity, setNewCity] = useState('Jaipur');
  const [newPreferredDate, setNewPreferredDate] = useState('');
  const [newPreferredTime, setNewPreferredTime] = useState('11:00 AM');
  const [newHealthConcern, setNewHealthConcern] = useState('');
  const [newWebsiteStatus, setNewWebsiteStatus] = useState<WebsiteBookingStatus>('pending');
  const [newVisitOutcome, setNewVisitOutcome] = useState<PatientVisitOutcome>('pending_visit');
  const [newNotes, setNewNotes] = useState('');
  const [creatingBooking, setCreatingBooking] = useState(false);

  // Tags state
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [contactTagsMap, setContactTagsMap] = useState<Record<string, string[]>>({});
  // Contact notes map for syncing notes between contact sidebar/analytics and bookings
  const [contactNotesMap, setContactNotesMap] = useState<
    Record<string, { id: string; note_text: string; created_at: string }[]>
  >({});

  // Notes Modal state
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [editingNoteBooking, setEditingNoteBooking] = useState<Booking | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  // Reschedule Date & Time Modal state
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [editingScheduleBooking, setEditingScheduleBooking] = useState<Booking | null>(null);
  const [scheduleDateDraft, setScheduleDateDraft] = useState('');
  const [scheduleTimeDraft, setScheduleTimeDraft] = useState('');
  const [savingSchedule, setSavingSchedule] = useState(false);

  // Edit Patient Name Modal state
  const [nameModalOpen, setNameModalOpen] = useState(false);
  const [editingNameBooking, setEditingNameBooking] = useState<Booking | null>(null);
  const [patientNameDraft, setPatientNameDraft] = useState('');
  const [savingName, setSavingName] = useState(false);

  // Edit City Modal state
  const [cityModalOpen, setCityModalOpen] = useState(false);
  const [editingCityBooking, setEditingCityBooking] = useState<Booking | null>(null);
  const [cityDraft, setCityDraft] = useState('');
  const [savingCity, setSavingCity] = useState(false);

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

        // Fetch contact tags & contact notes for all contacts associated with these bookings
        const contactIds = Array.from(
          new Set(bookingsList.map((b) => b.contact_id).filter(Boolean))
        ) as string[];

        if (contactIds.length > 0) {
          const [ctRes, cnRes] = await Promise.all([
            supabase
              .from('contact_tags')
              .select('contact_id, tag_id')
              .in('contact_id', contactIds),
            supabase
              .from('contact_notes')
              .select('id, contact_id, note_text, created_at')
              .in('contact_id', contactIds)
              .order('created_at', { ascending: false }),
          ]);

          if (!ctRes.error && ctRes.data) {
            const map: Record<string, string[]> = {};
            ctRes.data.forEach((ct) => {
              if (!map[ct.contact_id]) map[ct.contact_id] = [];
              map[ct.contact_id].push(ct.tag_id);
            });
            setContactTagsMap(map);
          }

          if (!cnRes.error && cnRes.data) {
            const cnMap: Record<string, { id: string; note_text: string; created_at: string }[]> = {};
            cnRes.data.forEach((cn) => {
              if (!cnMap[cn.contact_id]) cnMap[cn.contact_id] = [];
              cnMap[cn.contact_id].push(cn);
            });
            setContactNotesMap(cnMap);
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

  const getEffectiveBookingNotes = useCallback(
    (b: Booking): string => {
      const bNote = cleanPatientQueryNotes(b.notes);
      const cNotes = (b.contact_id ? contactNotesMap[b.contact_id] : []) || [];
      if (cNotes.length === 0) return bNote;

      const missing = cNotes
        .map((cn) => cleanPatientQueryNotes(cn.note_text))
        .filter((text) => text && !bNote.includes(text));

      if (missing.length === 0) return bNote;

      const cNotesFormatted = Array.from(new Set(missing)).join('\n');
      if (!bNote) return cNotesFormatted;
      return `${bNote}\n${cNotesFormatted}`;
    },
    [contactNotesMap]
  );

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

  const handleUpdateConsultationType = async (
    bookingId: string,
    newType: ConsultationType | string,
    newClinicLocation?: string | null
  ) => {
    try {
      const targetBooking = bookings.find((b) => b.id === bookingId);
      const updatePayload: Record<string, any> = {
        consultation_type: newType,
        updated_at: new Date().toISOString(),
      };

      if (newType === 'clinic_visit') {
        updatePayload.clinic_location =
          newClinicLocation || targetBooking?.clinic_location || targetBooking?.city || 'Jaipur';
      } else {
        updatePayload.clinic_location = null;
      }

      const { error } = await supabase
        .from('bookings')
        .update(updatePayload)
        .eq('id', bookingId);

      if (error) {
        toast.error('Failed to update consultation type');
      } else {
        setBookings((prev) =>
          prev.map((b) =>
            b.id === bookingId
              ? {
                  ...b,
                  consultation_type: newType,
                  clinic_location: updatePayload.clinic_location,
                }
              : b
          )
        );
        if (selectedBooking?.id === bookingId) {
          setSelectedBooking((prev) =>
            prev
              ? {
                  ...prev,
                  consultation_type: newType,
                  clinic_location: updatePayload.clinic_location,
                }
              : null
          );
        }
        const label =
          newType === 'clinic_visit'
            ? `Clinic Visit (${updatePayload.clinic_location})`
            : 'Online Video Call';
        toast.success(`Consultation mode updated to ${label}`);
      }
    } catch (err) {
      console.error('[bookings] update consultation type error:', err);
      toast.error('Failed to update consultation type');
    }
  };

  const handleUpdateWebsiteStatus = async (
    bookingId: string,
    newStatus: WebsiteBookingStatus,
    e?: React.MouseEvent
  ) => {
    e?.stopPropagation();
    try {
      const { error } = await supabase
        .from('bookings')
        .update({
          website_status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', bookingId);

      if (error) {
        console.warn('Direct column update failed, checking notes fallback:', error);
        const b = bookings.find((item) => item.id === bookingId);
        const prefix = `[Website: ${newStatus.toUpperCase()}]`;
        const cleanNotes = (b?.notes || '')
          .replace(/\[Website:\s*(DONE|PENDING)\]/gi, '')
          .trim();
        const updatedNotes = `${prefix} ${cleanNotes}`.trim();
        await supabase
          .from('bookings')
          .update({ notes: updatedNotes, updated_at: new Date().toISOString() })
          .eq('id', bookingId);
      }

      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, website_status: newStatus } : b))
      );
      if (selectedBooking?.id === bookingId) {
        setSelectedBooking((prev) => (prev ? { ...prev, website_status: newStatus } : null));
      }
      toast.success(
        `Website Status: ${newStatus === 'done' ? 'Done (Website par live)' : 'Pending (Website par dalna baaki)'}`
      );
    } catch (err: any) {
      toast.error('Website status update karne mein error aayi');
    }
  };

  const handleUpdateVisitOutcome = async (
    bookingId: string,
    newOutcome: PatientVisitOutcome,
    e?: React.MouseEvent
  ) => {
    e?.stopPropagation();
    try {
      const { error } = await supabase
        .from('bookings')
        .update({
          visit_outcome: newOutcome,
          updated_at: new Date().toISOString(),
        })
        .eq('id', bookingId);

      if (error) {
        console.warn('Direct outcome column update failed, checking notes fallback:', error);
        const b = bookings.find((item) => item.id === bookingId);
        const prefix = `[Outcome: ${newOutcome.toUpperCase()}]`;
        const cleanNotes = (b?.notes || '')
          .replace(/\[Outcome:\s*(CONVERTED|NON_CONVERTED|NOT_VISITED|PENDING_VISIT)\]/gi, '')
          .trim();
        const updatedNotes = `${prefix} ${cleanNotes}`.trim();
        await supabase
          .from('bookings')
          .update({ notes: updatedNotes, updated_at: new Date().toISOString() })
          .eq('id', bookingId);
      }

      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, visit_outcome: newOutcome } : b))
      );
      if (selectedBooking?.id === bookingId) {
        setSelectedBooking((prev) => (prev ? { ...prev, visit_outcome: newOutcome } : null));
      }

      const labelMap: Record<string, string> = {
        converted: 'Converted (Treatment Shuru)',
        non_converted: 'Non Converted (Aaye par shuru nahi kiya)',
        not_visited: 'Not Visited (No-Show)',
        pending_visit: 'Awaiting Visit (Visit Baaki Hai)',
      };
      toast.success(`Patient Outcome: ${labelMap[newOutcome] || newOutcome}`);
    } catch (err: any) {
      toast.error('Outcome update karne mein error aayi');
    }
  };

  const handleCreateBooking = async () => {
    if (!account?.id) {
      toast.error('Account reference load nahi ho saka');
      return;
    }
    const cleanName = newPatientName.trim();
    const cleanPhone = newPhone.trim().replace(/\s+/g, '');

    if (!cleanName) {
      toast.error('Please enter patient name');
      return;
    }
    if (!cleanPhone || cleanPhone.length < 10) {
      toast.error('Please enter valid 10-digit mobile number');
      return;
    }

    setCreatingBooking(true);
    try {
      // 1. Find or create contact
      let contactId: string | null = null;
      try {
        const last10 = cleanPhone.replace(/\D/g, '').slice(-10);
        const { data: existingContacts } = await supabase
          .from('contacts')
          .select('id')
          .eq('account_id', account.id)
          .ilike('phone', `%${last10}%`)
          .limit(1);

        if (existingContacts && existingContacts[0]) {
          contactId = existingContacts[0].id;
        } else {
          const { data: newContact } = await supabase
            .from('contacts')
            .insert({
              account_id: account.id,
              name: cleanName,
              phone: cleanPhone,
              company: newConsultationType === 'clinic_visit' ? newClinicLocation : newCity,
            })
            .select('id')
            .single();

          if (newContact) {
            contactId = newContact.id;
          }
        }
      } catch (cErr) {
        console.warn('[bookings] contact find/create notice:', cErr);
      }

      // 2. Generate unique booking_query_id
      const queryId = `GYN-${Math.floor(1000 + Math.random() * 9000)}`;

      // 3. Prepare notes with metadata
      const metaPrefix = `[Website: ${newWebsiteStatus.toUpperCase()}] [Outcome: ${newVisitOutcome.toUpperCase()}]`;
      const combinedNotes = newNotes.trim() ? `${metaPrefix} ${newNotes.trim()}` : metaPrefix;

      const payload: Record<string, any> = {
        account_id: account.id,
        contact_id: contactId,
        booking_query_id: queryId,
        patient_name: cleanName,
        phone: cleanPhone,
        city: newConsultationType === 'clinic_visit' ? newClinicLocation : newCity || 'Online',
        consultation_type: newConsultationType,
        clinic_location: newConsultationType === 'clinic_visit' ? newClinicLocation : null,
        preferred_date: newPreferredDate.trim() || getQuickDate(0),
        preferred_time: newPreferredTime.trim() || '11:00 AM',
        health_concern: newHealthConcern.trim() || null,
        status: 'confirmed',
        website_status: newWebsiteStatus,
        visit_outcome: newVisitOutcome,
        notes: combinedNotes,
      };

      let insertedBooking: Booking | null = null;

      const { data: directInsert, error: directErr } = await supabase
        .from('bookings')
        .insert(payload)
        .select('*')
        .single();

      if (directErr) {
        console.warn('[bookings] direct insert failed, retrying without new columns:', directErr);
        delete payload.website_status;
        delete payload.visit_outcome;
        const { data: fallbackInsert, error: fbErr } = await supabase
          .from('bookings')
          .insert(payload)
          .select('*')
          .single();

        if (fbErr) throw fbErr;
        insertedBooking = {
          ...fallbackInsert,
          website_status: newWebsiteStatus,
          visit_outcome: newVisitOutcome,
        };
      } else {
        insertedBooking = directInsert;
      }

      if (insertedBooking) {
        setBookings((prev) => [insertedBooking!, ...prev]);
      }

      toast.success(`New booking successfully saved! (ID: ${queryId})`);
      setCreateModalOpen(false);

      // Reset form
      setNewPatientName('');
      setNewPhone('');
      setNewHealthConcern('');
      setNewPreferredDate('');
      setNewPreferredTime('11:00 AM');
      setNewNotes('');
      setNewWebsiteStatus('pending');
      setNewVisitOutcome('pending_visit');
    } catch (err: any) {
      console.error('[bookings] create error:', err);
      toast.error(err?.message || 'Booking save karne mein error aayi');
    } finally {
      setCreatingBooking(false);
    }
  };

  const handleOpenScheduleModal = (booking: Booking) => {
    setEditingScheduleBooking(booking);
    setScheduleDateDraft(booking.preferred_date || '');
    setScheduleTimeDraft(booking.preferred_time || '');
    setScheduleModalOpen(true);
  };

  const handleSaveSchedule = async () => {
    if (!editingScheduleBooking) return;
    setSavingSchedule(true);
    try {
      const cleanDate = scheduleDateDraft.trim() || null;
      const cleanTime = scheduleTimeDraft.trim() || null;

      const { error } = await supabase
        .from('bookings')
        .update({
          preferred_date: cleanDate,
          preferred_time: cleanTime,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingScheduleBooking.id);

      if (error) throw error;

      setBookings((prev) =>
        prev.map((b) =>
          b.id === editingScheduleBooking.id
            ? { ...b, preferred_date: cleanDate, preferred_time: cleanTime }
            : b
        )
      );

      if (selectedBooking?.id === editingScheduleBooking.id) {
        setSelectedBooking((prev) =>
          prev ? { ...prev, preferred_date: cleanDate, preferred_time: cleanTime } : null
        );
      }

      toast.success('Appointment schedule updated successfully');
      setScheduleModalOpen(false);
    } catch (err: any) {
      console.error('[bookings] save schedule error:', err);
      toast.error('Failed to save schedule');
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleOpenEditName = (booking: Booking, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingNameBooking(booking);
    setPatientNameDraft(booking.patient_name || '');
    setNameModalOpen(true);
  };

  const handleSavePatientName = async () => {
    if (!editingNameBooking) return;
    const cleanName = patientNameDraft.trim();
    if (!cleanName) {
      toast.error('Patient name empty nahi ho sakta');
      return;
    }

    setSavingName(true);
    try {
      // 1. Update bookings table
      const { error: bookingErr } = await supabase
        .from('bookings')
        .update({
          patient_name: cleanName,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingNameBooking.id);

      if (bookingErr) throw bookingErr;

      // 2. Also update contacts table if contact_id exists
      if (editingNameBooking.contact_id) {
        try {
          await supabase
            .from('contacts')
            .update({
              name: cleanName,
              updated_at: new Date().toISOString(),
            })
            .eq('id', editingNameBooking.contact_id);
        } catch (contactErr) {
          console.warn('[bookings] contact name update fallback notice:', contactErr);
        }
      }

      // 3. Update local state
      setBookings((prev) =>
        prev.map((b) =>
          b.id === editingNameBooking.id ? { ...b, patient_name: cleanName } : b
        )
      );

      if (selectedBooking?.id === editingNameBooking.id) {
        setSelectedBooking((prev) => (prev ? { ...prev, patient_name: cleanName } : null));
      }

      toast.success('Patient name successfully updated!');
      setNameModalOpen(false);
      setEditingNameBooking(null);
    } catch (err: any) {
      toast.error(err?.message || 'Patient name update karne mein error aayi');
    } finally {
      setSavingName(false);
    }
  };

  const handleOpenEditCity = (booking: Booking, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingCityBooking(booking);
    setCityDraft(booking.city || '');
    setCityModalOpen(true);
  };

  const handleSaveCity = async () => {
    if (!editingCityBooking) return;
    const cleanCity = cityDraft.trim();
    if (!cleanCity) {
      toast.error('City empty nahi ho sakti');
      return;
    }
    setSavingCity(true);
    try {
      // 1. Update bookings table
      const { error: bookingErr } = await supabase
        .from('bookings')
        .update({
          city: cleanCity,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingCityBooking.id);

      if (bookingErr) throw bookingErr;

      // 2. Also update contacts company/city field if contact_id exists
      if (editingCityBooking.contact_id) {
        try {
          await supabase
            .from('contacts')
            .update({
              company: cleanCity,
              updated_at: new Date().toISOString(),
            })
            .eq('id', editingCityBooking.contact_id);
        } catch (cErr) {
          console.warn('[bookings] update contact city notice:', cErr);
        }
      }

      // 3. Update local state
      setBookings((prev) =>
        prev.map((b) =>
          b.id === editingCityBooking.id ? { ...b, city: cleanCity } : b
        )
      );

      if (selectedBooking?.id === editingCityBooking.id) {
        setSelectedBooking((prev) => (prev ? { ...prev, city: cleanCity } : null));
      }

      toast.success('City successfully update ho gayi!');
      setCityModalOpen(false);
      setEditingCityBooking(null);
    } catch (err: any) {
      toast.error(err?.message || 'City update karne mein error aayi');
    } finally {
      setSavingCity(false);
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

  const handleSaveNote = async (draftText: string) => {
    if (!editingNoteBooking) return;
    setSavingNote(true);
    let cleanNote = draftText.trim() || null;

    // Automatically stamp author agent name and date/time if not already present
    if (cleanNote && !cleanNote.startsWith('👤')) {
      const now = new Date();
      const dateStr = now.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
      cleanNote = `👤 ${currentAgentName} (${dateStr}, ${timeStr}): ${cleanNote}`;
    }

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

      toast.success(`Follow-up note logged by ${currentAgentName}`);
      setNoteModalOpen(false);
      void fetchBookings();
    } catch (err: any) {
      console.error('Failed to save follow-up note:', err);
      toast.error(err?.message || 'Failed to save note');
    } finally {
      setSavingNote(false);
    }
  };

  const handleLogCallDisposition = async (
    booking: Booking,
    disposition: 'not_connected' | 'callback' | 'confirmed' | 'not_interested',
    e?: React.MouseEvent
  ) => {
    e?.stopPropagation();
    const agent = currentAgentName;
    const followupRec = getRecommendedFollowupTime();
    const contactId = booking.contact_id;

    // Latest booking in case notes or other fields were edited in current session
    const latestBooking = bookings.find((b) => b.id === booking.id) || booking;

    // 1. Instant Optimistic Tag Assignment in UI (0ms delay!)
    const agentTagName = `Call By ${agent}`;
    const dispositionNames: Record<string, { name: string; color: string }> = {
      not_connected: { name: 'Not Connected', color: '#f43f5e' },
      callback: { name: 'Callback Requested', color: '#f59e0b' },
      confirmed: { name: 'Call Confirmed', color: '#10b981' },
      not_interested: { name: 'Not Interested', color: '#64748b' },
    };
    const dispInfo = dispositionNames[disposition];

    if (contactId) {
      setContactTagsMap((prev) => {
        const currentTagIds = prev[contactId] || [];
        // Filter out obsolete agent, status, and followup tags
        const filteredIds = currentTagIds.filter((tid) => {
          const t = tagsMap[tid];
          if (!t) return true;
          const name = t.name.toLowerCase();
          if (name.startsWith('call by ')) return false;
          if (['not connected', 'callback requested', 'call confirmed', 'not interested'].includes(name)) return false;
          if (name.startsWith('follow-up:') || name.startsWith('next call:')) return false;
          return true;
        });

        const newIds = [...filteredIds];
        const existingAgentTag = allTags.find((t) => t.name.toLowerCase() === agentTagName.toLowerCase());
        if (existingAgentTag) newIds.push(existingAgentTag.id);

        const existingDispTag = allTags.find((t) => t.name.toLowerCase() === dispInfo.name.toLowerCase());
        if (existingDispTag) newIds.push(existingDispTag.id);

        return {
          ...prev,
          [contactId]: Array.from(new Set(newIds)),
        };
      });
    }

    // 2. Open confirmation popup immediately or show feedback in 0ms!
    if (disposition === 'confirmed') {
      const combinedNotes = getCombinedBookingNotesForWebsite(latestBooking);
      setReminderBooking(latestBooking);
      setReminderNotes(combinedNotes);
      setReminderAgentName(agent);
      setWebsiteReminderOpen(true);
      toast.success(`Booking Confirmed by ${agent}! Website registration zaroori hai.`);
    } else if (disposition === 'not_connected') {
      toast.info(`Call logged as "Not Connected" by ${agent}. Follow-up tag assigned (${followupRec}).`);
    } else if (disposition === 'callback') {
      toast.success(`Callback requested logged by ${agent}. Follow-up tag assigned (${followupRec}).`);
    } else {
      toast.success(`Call status logged as "Not Interested" by ${agent}`);
    }

    // 3. Background server call to persist call log and sync official tags
    try {
      const res = await fetch('/api/bookings/call-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: booking.id,
          disposition,
          agentName: agent,
          followupRec,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Call status save karne me error aayi');
      }

      // Reconcile tags with authoritative server response
      if (data.allTags && Array.isArray(data.allTags)) {
        setAllTags(data.allTags);
      }
      if (data.contactId && Array.isArray(data.contactTagIds)) {
        setContactTagsMap((prev) => ({
          ...prev,
          [data.contactId]: data.contactTagIds,
        }));
      }
      if (data.officialAgentName && disposition === 'confirmed') {
        setReminderAgentName(data.officialAgentName);
      }
    } catch (err: any) {
      console.error('Call status disposition error:', err);
      toast.error(err?.message || 'Call status save karne me error aayi');
      void fetchBookings();
    }
  };

  const handleUpdateWebsiteStatusDone = async (bookingId: string, currentNotes?: string) => {
    if (currentNotes && reminderBooking && currentNotes !== reminderBooking.notes) {
      try {
        await supabase
          .from('bookings')
          .update({ notes: currentNotes, updated_at: new Date().toISOString() })
          .eq('id', bookingId);
        setBookings((prev) =>
          prev.map((b) => (b.id === bookingId ? { ...b, notes: currentNotes } : b))
        );
      } catch (nErr) {
        console.warn('Note save notice:', nErr);
      }
    }
    await handleUpdateWebsiteStatus(bookingId, 'done');
    setWebsiteReminderOpen(false);
  };

  const handleCloseWebsiteReminder = async (currentNotes?: string) => {
    if (currentNotes && reminderBooking && currentNotes !== reminderBooking.notes) {
      try {
        await supabase
          .from('bookings')
          .update({ notes: currentNotes, updated_at: new Date().toISOString() })
          .eq('id', reminderBooking.id);
        setBookings((prev) =>
          prev.map((b) => (b.id === reminderBooking.id ? { ...b, notes: currentNotes } : b))
        );
      } catch (nErr) {
        console.warn('Note save notice:', nErr);
      }
    }
    setWebsiteReminderOpen(false);
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
    if (filteredBookings.length === 0) {
      toast.error('No bookings found matching selected filters');
      return;
    }

    const headers = [
      'Booking Query ID',
      'Patient Name',
      'Phone Number',
      'Website Booking Status',
      'Patient Visit Outcome',
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
        getEffectiveWebsiteStatus(b) === 'done' ? 'Website Done' : 'Website Pending',
        getEffectiveVisitOutcome(b),
        b.city || '',
        b.consultation_type === 'clinic_visit' ? 'Clinic Visit' : 'Video Consultation',
        b.clinic_location || b.city || '',
        [b.preferred_date, b.preferred_time].filter(Boolean).join(' - ') || 'Not specified',
        b.health_concern || '',
        cTags || '',
        getEffectiveBookingNotes(b),
        b.ad_name || '',
        b.ad_id || '',
        b.status,
        new Date(b.created_at).toLocaleString(),
      ];
    });

    const csvContent = toCsv([headers, ...rows]);
    const filterSuffix = outcomeFilters.length > 0 ? `-${outcomeFilters.join('-')}` : '';
    downloadCsv(`gynocci-bookings${filterSuffix}-${new Date().toISOString().slice(0, 10)}.csv`, csvContent);
    toast.success(`Exported ${filteredBookings.length} bookings to CSV`);
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

  // Available clinics for filtering
  const availableClinics = useMemo(() => {
    const set = new Set<string>();
    activeClinics.forEach((c) => {
      if (c.city) set.add(c.city.trim());
    });
    bookings.forEach((b) => {
      if (b.clinic_location) set.add(b.clinic_location.trim());
      else if (b.city) set.add(b.city.trim());
    });
    ['Jaipur', 'Delhi', 'Lucknow', 'Amritsar', 'Ludhiana', 'Chandigarh', 'Indore', 'Patna', 'Rewari'].forEach(
      (c) => set.add(c)
    );
    return Array.from(set).sort();
  }, [activeClinics, bookings]);

  // Schedule date breakdown stats (distinct scheduled dates and counts)
  const scheduleDateStats = useMemo(() => {
    const map = new Map<string, { ymd: string; display: string; count: number }>();
    let noDateCount = 0;
    let todayCount = 0;
    let tomorrowCount = 0;
    let upcomingCount = 0;
    let pastCount = 0;

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const todayYmd = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const tomorrow = new Date(now.getTime() + 86400000);
    const tomorrowYmd = `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}`;

    bookings.forEach((b) => {
      const ymd = normalizeDateStringToYMD(b.preferred_date);
      if (!ymd) {
        noDateCount++;
        return;
      }

      if (ymd === todayYmd) todayCount++;
      if (ymd === tomorrowYmd) tomorrowCount++;
      if (ymd >= todayYmd) upcomingCount++;
      else pastCount++;

      const existing = map.get(ymd);
      if (existing) {
        existing.count++;
      } else {
        const [year, month, day] = ymd.split('-').map(Number);
        const dObj = new Date(year, month - 1, day);
        const monthShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][month - 1];
        const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dObj.getDay()];
        const isToday = ymd === todayYmd;
        const isTomorrow = ymd === tomorrowYmd;
        const tag = isToday ? ' (Today)' : isTomorrow ? ' (Tomorrow)' : ` (${dayName})`;
        const display = `${day} ${monthShort} ${year}${tag}`;

        map.set(ymd, { ymd, display, count: 1 });
      }
    });

    const sortedDates = Array.from(map.values()).sort((a, b) => a.ymd.localeCompare(b.ymd));

    return {
      sortedDates,
      todayCount,
      tomorrowCount,
      upcomingCount,
      pastCount,
      noDateCount,
      todayYmd,
      tomorrowYmd,
    };
  }, [bookings]);

  // Date filter matcher helper
  const matchesDate = useCallback(
    (b: Booking): boolean => {
      if (dateFilter === 'all' && !specificScheduleDate) return true;

      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const todayYmd = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

      const tomorrow = new Date(now.getTime() + 86400000);
      const tomorrowYmd = `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}`;

      const yesterday = new Date(now.getTime() - 86400000);
      const yesterdayYmd = `${yesterday.getFullYear()}-${pad(yesterday.getMonth() + 1)}-${pad(yesterday.getDate())}`;

      const bYmd = normalizeDateStringToYMD(b.preferred_date);
      const prefDateLower = (b.preferred_date || '').toLowerCase();
      const createdAtYmd = (b.created_at || '').slice(0, 10);

      // 1. If user picked a specific date from calendar picker or distinct dates list
      if (specificScheduleDate) {
        return bYmd === specificScheduleDate || prefDateLower.includes(specificScheduleDate);
      }

      if (dateFilter === 'today') {
        return (
          bYmd === todayYmd ||
          prefDateLower.includes('today') ||
          prefDateLower.includes(todayYmd) ||
          createdAtYmd === todayYmd
        );
      }

      if (dateFilter === 'tomorrow') {
        return (
          bYmd === tomorrowYmd ||
          prefDateLower.includes('tomorrow') ||
          prefDateLower.includes(tomorrowYmd)
        );
      }

      if (dateFilter === 'yesterday') {
        return (
          bYmd === yesterdayYmd ||
          prefDateLower.includes('yesterday') ||
          prefDateLower.includes(yesterdayYmd) ||
          createdAtYmd === yesterdayYmd
        );
      }

      if (dateFilter === 'next_7_days') {
        if (!bYmd) return false;
        const nextWeek = new Date(now.getTime() + 7 * 86400000);
        const nextWeekYmd = `${nextWeek.getFullYear()}-${pad(nextWeek.getMonth() + 1)}-${pad(nextWeek.getDate())}`;
        return bYmd >= todayYmd && bYmd <= nextWeekYmd;
      }

      if (dateFilter === 'this_week') {
        const weekAgo = new Date(now.getTime() - 7 * 86400000);
        const weekAgoYmd = `${weekAgo.getFullYear()}-${pad(weekAgo.getMonth() + 1)}-${pad(weekAgo.getDate())}`;
        return (bYmd && bYmd >= weekAgoYmd && bYmd <= todayYmd) || (createdAtYmd >= weekAgoYmd && createdAtYmd <= todayYmd);
      }

      if (dateFilter === 'this_month') {
        const monthPrefix = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
        return (bYmd && bYmd.startsWith(monthPrefix)) || createdAtYmd.startsWith(monthPrefix);
      }

      if (dateFilter === 'no_date') {
        return !b.preferred_date || b.preferred_date.trim() === '' || prefDateLower.includes('flexible');
      }

      return true;
    },
    [dateFilter, specificScheduleDate]
  );

  // Filtered list
  const filteredBookings = useMemo(() => {
    const q = search.trim().toLowerCase();
    return bookings.filter((b) => {
      if (statusFilter !== 'all' && b.status !== statusFilter) return false;
      if (typeFilter !== 'all' && b.consultation_type !== typeFilter) return false;
      if (websiteFilter !== 'all' && getEffectiveWebsiteStatus(b) !== websiteFilter) return false;
      if (outcomeFilters.length > 0 && !outcomeFilters.includes(getEffectiveVisitOutcome(b))) return false;

      // Clinic Filter
      if (clinicFilter !== 'all') {
        const cLow = clinicFilter.toLowerCase();
        const bClinic = (b.clinic_location || '').toLowerCase();
        const bCity = (b.city || '').toLowerCase();
        if (!bClinic.includes(cLow) && !bCity.includes(cLow)) return false;
      }

      // Date Filter
      if (!matchesDate(b)) return false;

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
        (getEffectiveBookingNotes(b) && getEffectiveBookingNotes(b).toLowerCase().includes(q)) ||
        contactTagNames.includes(q) ||
        (b.ad_name && b.ad_name.toLowerCase().includes(q)) ||
        (b.clinic_location && b.clinic_location.toLowerCase().includes(q))
      );
    });
  }, [
    bookings,
    search,
    statusFilter,
    typeFilter,
    websiteFilter,
    outcomeFilters,
    clinicFilter,
    matchesDate,
    selectedTagFilter,
    contactTagsMap,
    tagsMap,
    getEffectiveBookingNotes,
  ]);

  // Stats
  const stats = useMemo(() => {
    const total = bookings.length;
    const confirmed = bookings.filter((b) => b.status === 'confirmed').length;
    const clinicVisits = bookings.filter((b) => b.consultation_type === 'clinic_visit').length;
    const videoConsultations = bookings.filter((b) => b.consultation_type !== 'clinic_visit').length;

    // Website sync
    const websiteDone = bookings.filter((b) => getEffectiveWebsiteStatus(b) === 'done').length;
    const websitePending = bookings.filter((b) => getEffectiveWebsiteStatus(b) === 'pending').length;

    // Visit / Conversion Outcomes
    const converted = bookings.filter((b) => getEffectiveVisitOutcome(b) === 'converted').length;
    const nonConverted = bookings.filter((b) => getEffectiveVisitOutcome(b) === 'non_converted').length;
    const notVisited = bookings.filter((b) => getEffectiveVisitOutcome(b) === 'not_visited').length;
    const awaitingVisit = bookings.filter((b) => getEffectiveVisitOutcome(b) === 'pending_visit').length;

    return {
      total,
      confirmed,
      clinicVisits,
      videoConsultations,
      websiteDone,
      websitePending,
      converted,
      nonConverted,
      notVisited,
      awaitingVisit,
    };
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
            size="sm"
            onClick={() => setCreateModalOpen(true)}
            className="h-9 gap-1.5 cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-xs"
          >
            <Plus className="h-4 w-4" />
            <span>+ New Booking</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/analytics')}
            className="h-9 gap-1.5"
          >
            <BarChart3 className="h-4 w-4 text-primary" />
            Analytics & Ads
          </Button>

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
            disabled={filteredBookings.length === 0}
            className="h-9 gap-1.5"
            title="Download CSV of current filtered bookings list"
          >
            <Download className="h-4 w-4" />
            Export CSV ({filteredBookings.length})
          </Button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Total Bookings</span>
            <CalendarDays className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">{stats.total}</div>
          <p className="text-xs text-muted-foreground mt-0.5">{stats.confirmed} Confirmed</p>
        </div>

        {/* 🌐 Website Status Sync Card */}
        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Website Booking</span>
            <Globe className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {stats.websiteDone}{' '}
            <span className="text-sm font-normal text-muted-foreground">Done</span>
          </div>
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5 font-medium">
            ⏳ {stats.websitePending} Pending on website
          </p>
        </div>

        {/* 🎯 Patient Conversion Card */}
        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Patient Outcomes</span>
            <CheckCheck className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">
            {stats.converted}{' '}
            <span className="text-xs font-normal text-emerald-600">Converted</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            ⚠️ {stats.nonConverted} Non-Conv • ❌ {stats.notVisited} No-Show
          </p>
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
          {/* Date Filter */}
          <div className="flex items-center gap-1 border rounded-lg p-0.5 bg-muted/30">
            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(
                  'h-7 px-2.5 text-xs font-medium border rounded-md flex items-center gap-1.5 transition-colors cursor-pointer',
                  dateFilter !== 'all' || specificScheduleDate
                    ? 'bg-primary/10 border-primary text-primary font-semibold'
                    : 'bg-muted/30 text-muted-foreground hover:text-foreground'
                )}
              >
                <Calendar className="h-3.5 w-3.5 text-primary" />
                <span className="max-w-[180px] truncate">
                  {specificScheduleDate
                    ? `📅 ${scheduleDateStats.sortedDates.find((d) => d.ymd === specificScheduleDate)?.display || specificScheduleDate}`
                    : dateFilter === 'all'
                    ? 'Schedule: All Dates'
                    : dateFilter === 'today'
                    ? `📅 Today (${scheduleDateStats.todayCount})`
                    : dateFilter === 'tomorrow'
                    ? `📅 Tomorrow (${scheduleDateStats.tomorrowCount})`
                    : dateFilter === 'next_7_days'
                    ? `📅 Next 7 Days (${scheduleDateStats.upcomingCount})`
                    : dateFilter === 'yesterday'
                    ? '📅 Yesterday'
                    : dateFilter === 'this_week'
                    ? '📅 This Week'
                    : dateFilter === 'this_month'
                    ? '📅 This Month'
                    : dateFilter === 'no_date'
                    ? `📅 Flexible (${scheduleDateStats.noDateCount})`
                    : 'Schedule Filter'}
                </span>
                <ChevronDown className="h-3 w-3 opacity-60" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-72 p-1 max-h-96 overflow-y-auto">
                <div className="flex items-center justify-between px-2 py-1.5 border-b">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Preferred Schedule Filter
                  </span>
                  {(dateFilter !== 'all' || specificScheduleDate) && (
                    <button
                      type="button"
                      onClick={() => {
                        setDateFilter('all');
                        setSpecificScheduleDate('');
                      }}
                      className="text-[11px] text-primary hover:underline font-medium cursor-pointer"
                    >
                      Clear Filter
                    </button>
                  )}
                </div>

                {/* Calendar Date Picker */}
                <div className="p-2 border-b bg-muted/20">
                  <div className="text-[11px] font-medium text-muted-foreground mb-1 flex items-center justify-between">
                    <span>Pick Exact Schedule Date:</span>
                    {specificScheduleDate && (
                      <span className="text-[10px] text-primary font-semibold">Active</span>
                    )}
                  </div>
                  <input
                    type="date"
                    value={specificScheduleDate}
                    onChange={(e) => {
                      setSpecificScheduleDate(e.target.value);
                      setDateFilter(e.target.value ? 'specific' : 'all');
                    }}
                    className="w-full h-8 px-2 text-xs border rounded-md bg-background focus:ring-1 focus:ring-primary cursor-pointer"
                  />
                </div>

                {/* Quick Presets with counts */}
                <div className="py-1">
                  <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Quick Options
                  </div>
                  <DropdownMenuItem
                    onClick={() => {
                      setSpecificScheduleDate('');
                      setDateFilter('all');
                    }}
                    className={cn(
                      'text-xs cursor-pointer flex items-center justify-between',
                      dateFilter === 'all' && !specificScheduleDate && 'font-semibold text-primary bg-primary/10'
                    )}
                  >
                    <span>All Bookings</span>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      {bookings.length}
                    </Badge>
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={() => {
                      setSpecificScheduleDate('');
                      setDateFilter('today');
                    }}
                    className={cn(
                      'text-xs cursor-pointer flex items-center justify-between',
                      dateFilter === 'today' && !specificScheduleDate && 'font-semibold text-primary bg-primary/10'
                    )}
                  >
                    <span>📅 Today (Aaj Ke)</span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-emerald-50 text-emerald-700 border-emerald-300">
                      {scheduleDateStats.todayCount}
                    </Badge>
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={() => {
                      setSpecificScheduleDate('');
                      setDateFilter('tomorrow');
                    }}
                    className={cn(
                      'text-xs cursor-pointer flex items-center justify-between',
                      dateFilter === 'tomorrow' && !specificScheduleDate && 'font-semibold text-primary bg-primary/10'
                    )}
                  >
                    <span>📅 Tomorrow (Kal Ke)</span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-blue-50 text-blue-700 border-blue-300">
                      {scheduleDateStats.tomorrowCount}
                    </Badge>
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={() => {
                      setSpecificScheduleDate('');
                      setDateFilter('next_7_days');
                    }}
                    className={cn(
                      'text-xs cursor-pointer flex items-center justify-between',
                      dateFilter === 'next_7_days' && !specificScheduleDate && 'font-semibold text-primary bg-primary/10'
                    )}
                  >
                    <span>📅 Next 7 Days (Upcoming)</span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-violet-50 text-violet-700 border-violet-300">
                      {scheduleDateStats.upcomingCount}
                    </Badge>
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={() => {
                      setSpecificScheduleDate('');
                      setDateFilter('no_date');
                    }}
                    className={cn(
                      'text-xs cursor-pointer flex items-center justify-between',
                      dateFilter === 'no_date' && !specificScheduleDate && 'font-semibold text-primary bg-primary/10'
                    )}
                  >
                    <span>📅 Flexible / No Date</span>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      {scheduleDateStats.noDateCount}
                    </Badge>
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={() => {
                      setSpecificScheduleDate('');
                      setDateFilter('yesterday');
                    }}
                    className={cn(
                      'text-xs cursor-pointer flex items-center justify-between',
                      dateFilter === 'yesterday' && !specificScheduleDate && 'font-semibold text-primary bg-primary/10'
                    )}
                  >
                    <span>📅 Yesterday (Beeta Hua Kal)</span>
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={() => {
                      setSpecificScheduleDate('');
                      setDateFilter('this_week');
                    }}
                    className={cn(
                      'text-xs cursor-pointer flex items-center justify-between',
                      dateFilter === 'this_week' && !specificScheduleDate && 'font-semibold text-primary bg-primary/10'
                    )}
                  >
                    <span>📅 This Week</span>
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={() => {
                      setSpecificScheduleDate('');
                      setDateFilter('this_month');
                    }}
                    className={cn(
                      'text-xs cursor-pointer flex items-center justify-between',
                      dateFilter === 'this_month' && !specificScheduleDate && 'font-semibold text-primary bg-primary/10'
                    )}
                  >
                    <span>📅 This Month</span>
                  </DropdownMenuItem>
                </div>

                {/* Scheduled Dates List Section (Date-wise breakdown with counts) */}
                {scheduleDateStats.sortedDates.length > 0 && (
                  <div className="border-t pt-1 mt-1">
                    <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                      <span>Scheduled Dates ({scheduleDateStats.sortedDates.length})</span>
                      <span className="text-[9px] font-normal text-muted-foreground">lead counts</span>
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-0.5 px-0.5">
                      {scheduleDateStats.sortedDates.map((d) => {
                        const isSelected = specificScheduleDate === d.ymd;
                        return (
                          <DropdownMenuItem
                            key={d.ymd}
                            onClick={() => {
                              setSpecificScheduleDate(d.ymd);
                              setDateFilter('specific');
                            }}
                            className={cn(
                              'text-xs cursor-pointer flex items-center justify-between py-1.5 px-2 rounded',
                              isSelected
                                ? 'bg-primary text-primary-foreground font-semibold'
                                : 'hover:bg-muted'
                            )}
                          >
                            <span className="truncate mr-2">{d.display}</span>
                            <Badge
                              variant={isSelected ? 'default' : 'secondary'}
                              className={cn(
                                'text-[10px] px-1.5 py-0 font-bold shrink-0',
                                isSelected ? 'bg-primary-foreground text-primary' : 'bg-primary/10 text-primary'
                              )}
                            >
                              {d.count} {d.count === 1 ? 'lead' : 'leads'}
                            </Badge>
                          </DropdownMenuItem>
                        );
                      })}
                    </div>
                  </div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Clinic Location Filter */}
          <div className="flex items-center gap-1 border rounded-lg p-0.5 bg-muted/30">
            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(
                  'h-7 px-2.5 text-xs font-medium border rounded-md flex items-center gap-1.5 transition-colors cursor-pointer',
                  clinicFilter !== 'all'
                    ? 'bg-amber-500/10 border-amber-500 text-amber-800 dark:text-amber-200 font-semibold'
                    : 'bg-muted/30 text-muted-foreground hover:text-foreground'
                )}
              >
                <Building2 className="h-3.5 w-3.5 text-amber-600" />
                <span>{clinicFilter === 'all' ? 'Clinic: All' : `🏥 ${clinicFilter}`}</span>
                <ChevronDown className="h-3 w-3 opacity-60" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52 p-1 max-h-64 overflow-y-auto">
                <div className="px-2 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Filter by Clinic / City
                </div>
                <DropdownMenuItem
                  onClick={() => setClinicFilter('all')}
                  className={cn("text-xs cursor-pointer", clinicFilter === 'all' && "font-semibold text-primary")}
                >
                  All Clinics & Cities
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {availableClinics.map((clinicCity) => (
                  <DropdownMenuItem
                    key={clinicCity}
                    onClick={() => setClinicFilter(clinicCity)}
                    className={cn(
                      'text-xs cursor-pointer flex items-center justify-between',
                      clinicFilter.toLowerCase() === clinicCity.toLowerCase() && 'bg-amber-500/10 font-semibold text-amber-800'
                    )}
                  >
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-3 w-3 text-rose-500" />
                      {clinicCity} Clinic
                    </span>
                    {clinicFilter.toLowerCase() === clinicCity.toLowerCase() && (
                      <Check className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

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

          {/* Website Booking Status Filter */}
          <div className="flex items-center gap-1 border rounded-lg p-0.5 bg-muted/30">
            <Button
              variant={websiteFilter === 'all' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setWebsiteFilter('all')}
              className="h-7 text-xs px-2"
              title="All Website Status"
            >
              Web: All
            </Button>
            <Button
              variant={websiteFilter === 'done' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setWebsiteFilter('done')}
              className="h-7 text-xs px-2 gap-1 text-emerald-700 dark:text-emerald-300 font-medium"
              title="Website Status Done"
            >
              <Globe className="h-3 w-3" />
              🌐 Done ({stats.websiteDone})
            </Button>
            <Button
              variant={websiteFilter === 'pending' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setWebsiteFilter('pending')}
              className="h-7 text-xs px-2 gap-1 text-amber-700 dark:text-amber-300 font-medium"
              title="Website Status Pending"
            >
              <Clock className="h-3 w-3" />
              ⏳ Pending ({stats.websitePending})
            </Button>
          </div>

          {/* Patient Outcome Multi-Select Filter */}
          <div className="flex items-center gap-1 border rounded-lg p-0.5 bg-muted/30">
            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(
                  'h-7 px-2.5 text-xs font-medium border rounded-md flex items-center gap-1.5 transition-colors cursor-pointer',
                  outcomeFilters.length > 0
                    ? 'bg-primary/10 border-primary text-primary font-semibold'
                    : 'bg-muted/30 text-muted-foreground hover:text-foreground'
                )}
              >
                <CheckCheck className="h-3.5 w-3.5" />
                <span>
                  {outcomeFilters.length === 0
                    ? 'All Outcomes'
                    : outcomeFilters.length === 1
                    ? outcomeFilters[0] === 'converted'
                      ? '✅ Converted'
                      : outcomeFilters[0] === 'non_converted'
                      ? '⚠️ Non Converted'
                      : outcomeFilters[0] === 'not_visited'
                      ? '❌ Not Visited'
                      : '🕒 Awaiting Visit'
                    : outcomeFilters.length === 4
                    ? 'All Outcomes (4)'
                    : `Outcomes (${outcomeFilters.length})`}
                </span>
                {outcomeFilters.length > 0 && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      clearOutcomeFilters();
                    }}
                    className="ml-0.5 -mr-1 p-0.5 rounded-full hover:bg-primary/20 text-primary cursor-pointer inline-flex items-center"
                    title="Reset to All Outcomes"
                  >
                    <X className="h-3 w-3" />
                  </span>
                )}
                <ChevronDown className="h-3 w-3 opacity-60 ml-0.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 p-1.5 shadow-lg">
                <div className="flex items-center justify-between px-2 py-1.5 text-xs border-b mb-1">
                  <span className="font-semibold text-foreground">
                    Filter by Outcomes {outcomeFilters.length > 0 ? `(${outcomeFilters.length}/4)` : ''}
                  </span>
                  <div className="flex items-center gap-2">
                    {outcomeFilters.length > 0 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          clearOutcomeFilters();
                        }}
                        className="text-[11px] font-medium text-primary hover:underline cursor-pointer"
                      >
                        Reset / Clear
                      </button>
                    )}
                    {outcomeFilters.length < 4 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          selectAllOutcomeFilters();
                        }}
                        className="text-[11px] font-medium text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        Select All
                      </button>
                    )}
                  </div>
                </div>

                {/* Show All Option */}
                <DropdownMenuItem
                  closeOnClick={false}
                  onClick={(e) => {
                    e.preventDefault();
                    clearOutcomeFilters();
                  }}
                  className={cn(
                    'text-xs cursor-pointer py-1.5 px-2 flex items-center justify-between rounded-md transition-colors',
                    outcomeFilters.length === 0 ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted/60'
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className={cn(
                        'w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors',
                        outcomeFilters.length === 0
                          ? 'bg-primary border-primary text-primary-foreground'
                          : 'border-muted-foreground/40 bg-background'
                      )}
                    >
                      {outcomeFilters.length === 0 && <Check className="h-3 w-3 stroke-[3]" />}
                    </div>
                    <span className="truncate">All Outcomes (Show All)</span>
                  </div>
                  <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-medium shrink-0 ml-2">
                    {stats.total}
                  </span>
                </DropdownMenuItem>

                <DropdownMenuSeparator className="my-1" />

                {/* Option 1: Converted */}
                <DropdownMenuItem
                  closeOnClick={false}
                  onClick={(e) => {
                    e.preventDefault();
                    toggleOutcomeFilter('converted');
                  }}
                  className={cn(
                    'text-xs cursor-pointer py-1.5 px-2 flex items-center justify-between rounded-md transition-colors',
                    outcomeFilters.includes('converted')
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-medium'
                      : 'hover:bg-muted/60 text-foreground'
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className={cn(
                        'w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors',
                        outcomeFilters.includes('converted')
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : 'border-muted-foreground/40 bg-background'
                      )}
                    >
                      {outcomeFilters.includes('converted') && <Check className="h-3 w-3 stroke-[3]" />}
                    </div>
                    <span className="truncate">
                      ✅ Converted <span className="text-[11px] text-muted-foreground font-normal">(Treatment Shuru)</span>
                    </span>
                  </div>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-1.5 py-0.5 rounded font-medium shrink-0 ml-2">
                    {stats.converted}
                  </span>
                </DropdownMenuItem>

                {/* Option 2: Non Converted */}
                <DropdownMenuItem
                  closeOnClick={false}
                  onClick={(e) => {
                    e.preventDefault();
                    toggleOutcomeFilter('non_converted');
                  }}
                  className={cn(
                    'text-xs cursor-pointer py-1.5 px-2 flex items-center justify-between rounded-md transition-colors',
                    outcomeFilters.includes('non_converted')
                      ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 font-medium'
                      : 'hover:bg-muted/60 text-foreground'
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className={cn(
                        'w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors',
                        outcomeFilters.includes('non_converted')
                          ? 'bg-amber-600 border-amber-600 text-white'
                          : 'border-muted-foreground/40 bg-background'
                      )}
                    >
                      {outcomeFilters.includes('non_converted') && <Check className="h-3 w-3 stroke-[3]" />}
                    </div>
                    <span className="truncate">
                      ⚠️ Non Converted <span className="text-[11px] text-muted-foreground font-normal">(Dawa Nahi Li)</span>
                    </span>
                  </div>
                  <span className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 px-1.5 py-0.5 rounded font-medium shrink-0 ml-2">
                    {stats.nonConverted}
                  </span>
                </DropdownMenuItem>

                {/* Option 3: Not Visited */}
                <DropdownMenuItem
                  closeOnClick={false}
                  onClick={(e) => {
                    e.preventDefault();
                    toggleOutcomeFilter('not_visited');
                  }}
                  className={cn(
                    'text-xs cursor-pointer py-1.5 px-2 flex items-center justify-between rounded-md transition-colors',
                    outcomeFilters.includes('not_visited')
                      ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 font-medium'
                      : 'hover:bg-muted/60 text-foreground'
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className={cn(
                        'w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors',
                        outcomeFilters.includes('not_visited')
                          ? 'bg-rose-600 border-rose-600 text-white'
                          : 'border-muted-foreground/40 bg-background'
                      )}
                    >
                      {outcomeFilters.includes('not_visited') && <Check className="h-3 w-3 stroke-[3]" />}
                    </div>
                    <span className="truncate">
                      ❌ Not Visited <span className="text-[11px] text-muted-foreground font-normal">(No-Show)</span>
                    </span>
                  </div>
                  <span className="text-[10px] bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 px-1.5 py-0.5 rounded font-medium shrink-0 ml-2">
                    {stats.notVisited}
                  </span>
                </DropdownMenuItem>

                {/* Option 4: Awaiting Visit */}
                <DropdownMenuItem
                  closeOnClick={false}
                  onClick={(e) => {
                    e.preventDefault();
                    toggleOutcomeFilter('pending_visit');
                  }}
                  className={cn(
                    'text-xs cursor-pointer py-1.5 px-2 flex items-center justify-between rounded-md transition-colors',
                    outcomeFilters.includes('pending_visit')
                      ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 font-medium'
                      : 'hover:bg-muted/60 text-foreground'
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className={cn(
                        'w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors',
                        outcomeFilters.includes('pending_visit')
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'border-muted-foreground/40 bg-background'
                      )}
                    >
                      {outcomeFilters.includes('pending_visit') && <Check className="h-3 w-3 stroke-[3]" />}
                    </div>
                    <span className="truncate">
                      🕒 Awaiting Visit <span className="text-[11px] text-muted-foreground font-normal">(Aana Baaki)</span>
                    </span>
                  </div>
                  <span className="text-[10px] bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 px-1.5 py-0.5 rounded font-medium shrink-0 ml-2">
                    {stats.awaitingVisit}
                  </span>
                </DropdownMenuItem>

                <DropdownMenuSeparator className="my-1" />
                <div className="px-2 py-1 flex items-center justify-between text-[11px] text-muted-foreground bg-muted/40 rounded">
                  <span>
                    {outcomeFilters.length === 0
                      ? 'All 4 outcomes showing'
                      : `${outcomeFilters.length} of 4 outcomes selected`}
                  </span>
                  <span className="font-semibold text-foreground">
                    {filteredBookings.length} bookings
                  </span>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
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

      {/* Quick Preferred Schedule Date Pill Bar */}
      <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 rounded-xl bg-card border shadow-2xs">
        <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1 mr-1">
          <Calendar className="h-3.5 w-3.5 text-primary" />
          Preferred Schedule:
        </span>

        <button
          type="button"
          onClick={() => {
            setSpecificScheduleDate('');
            setDateFilter('all');
          }}
          className={cn(
            'px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer border',
            dateFilter === 'all' && !specificScheduleDate
              ? 'bg-primary text-primary-foreground border-primary shadow-xs font-semibold'
              : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground border-transparent'
          )}
        >
          All ({bookings.length})
        </button>

        <button
          type="button"
          onClick={() => {
            setSpecificScheduleDate('');
            setDateFilter('today');
          }}
          className={cn(
            'px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer border flex items-center gap-1.5',
            dateFilter === 'today' && !specificScheduleDate
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs font-semibold'
              : 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100'
          )}
        >
          <span>Today</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-500/20 text-emerald-900 dark:text-emerald-100 font-bold">
            {scheduleDateStats.todayCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setSpecificScheduleDate('');
            setDateFilter('tomorrow');
          }}
          className={cn(
            'px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer border flex items-center gap-1.5',
            dateFilter === 'tomorrow' && !specificScheduleDate
              ? 'bg-blue-600 text-white border-blue-600 shadow-xs font-semibold'
              : 'bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800 hover:bg-blue-100'
          )}
        >
          <span>Tomorrow</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-blue-500/20 text-blue-900 dark:text-blue-100 font-bold">
            {scheduleDateStats.tomorrowCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setSpecificScheduleDate('');
            setDateFilter('next_7_days');
          }}
          className={cn(
            'px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer border flex items-center gap-1.5',
            dateFilter === 'next_7_days' && !specificScheduleDate
              ? 'bg-violet-600 text-white border-violet-600 shadow-xs font-semibold'
              : 'bg-violet-50 text-violet-800 dark:bg-violet-950/40 dark:text-violet-300 border-violet-200 dark:border-violet-800 hover:bg-violet-100'
          )}
        >
          <span>Next 7 Days</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-violet-500/20 text-violet-900 dark:text-violet-100 font-bold">
            {scheduleDateStats.upcomingCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setSpecificScheduleDate('');
            setDateFilter('no_date');
          }}
          className={cn(
            'px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer border flex items-center gap-1.5',
            dateFilter === 'no_date' && !specificScheduleDate
              ? 'bg-slate-700 text-white border-slate-700 shadow-xs font-semibold'
              : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground border-border'
          )}
        >
          <span>Flexible / No Date</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/10 dark:bg-white/10 font-bold">
            {scheduleDateStats.noDateCount}
          </span>
        </button>

        {/* Specific chosen date badge */}
        {specificScheduleDate && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-500 text-white border border-amber-600 shadow-xs">
            <span>
              Date: {scheduleDateStats.sortedDates.find((d) => d.ymd === specificScheduleDate)?.display || specificScheduleDate}
            </span>
            <button
              type="button"
              onClick={() => {
                setSpecificScheduleDate('');
                setDateFilter('all');
              }}
              className="hover:bg-black/20 rounded-full p-0.5 cursor-pointer transition-colors"
              title="Remove specific date filter"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* Inline Exact Date input picker */}
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-[11px] text-muted-foreground hidden md:inline">Calendar Picker:</span>
          <input
            type="date"
            value={specificScheduleDate}
            onChange={(e) => {
              setSpecificScheduleDate(e.target.value);
              setDateFilter(e.target.value ? 'specific' : 'all');
            }}
            className="h-7 px-2 text-xs border rounded-md bg-background focus:ring-1 focus:ring-primary cursor-pointer text-foreground"
            title="Choose specific date to filter Preferred Schedule"
          />
          {specificScheduleDate && (
            <button
              type="button"
              onClick={() => {
                setSpecificScheduleDate('');
                setDateFilter('all');
              }}
              className="text-xs text-muted-foreground hover:text-foreground cursor-pointer px-1 underline"
            >
              Reset
            </button>
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
              {search || statusFilter !== 'all' || typeFilter !== 'all' || selectedTagFilter || dateFilter !== 'all' || specificScheduleDate
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
                  <TableHead className="min-w-[140px]">Website Status</TableHead>
                  <TableHead className="min-w-[155px]">Patient Outcome</TableHead>
                  <TableHead className="min-w-[260px]">Tags</TableHead>
                  <TableHead className="min-w-[180px]">Follow-up Notes</TableHead>
                  <TableHead className="min-w-[165px]">Consultation Mode</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead className="min-w-[170px]">
                    <div className="flex items-center gap-1.5">
                      <span>Preferred Schedule</span>
                      {(dateFilter !== 'all' || specificScheduleDate) && (
                        <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-primary/15 text-primary border border-primary/30">
                          Filtered
                        </span>
                      )}
                    </div>
                  </TableHead>
                  <TableHead>Health Concern / Disease</TableHead>
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
                          <div className="font-medium text-foreground text-sm flex items-center gap-1.5 group/name">
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{b.patient_name}</span>
                            <button
                              type="button"
                              onClick={(e) => handleOpenEditName(b, e)}
                              className="text-muted-foreground hover:text-primary hover:bg-muted p-1 rounded cursor-pointer transition-colors"
                              title="Edit Patient Name"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
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
                              href={formatTelUri(b.phone)}
                              onClick={(e) => e.stopPropagation()}
                              className="text-primary hover:underline inline-flex items-center gap-0.5"
                            >
                              <Phone className="h-3 w-3" />
                              Call
                            </a>

                            {/* 1-Click Quick Call Disposition Action */}
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                className="h-6 px-1.5 text-[11px] font-medium rounded-md border border-border/80 bg-background hover:bg-muted text-foreground flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                                onClick={(e) => e.stopPropagation()}
                                title={`Log Call status for ${b.patient_name}`}
                              >
                                <PhoneCall className="h-3 w-3 text-primary" />
                                <span>Log Call</span>
                                <ChevronDown className="h-2.5 w-2.5 opacity-60" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start" className="w-60 p-1.5 z-50">
                                <div className="px-2 py-1 text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-between border-b pb-1 mb-1">
                                  <span>Agent Call Action</span>
                                  <span className="text-[10px] text-primary font-normal">By {currentAgentName}</span>
                                </div>
                                <DropdownMenuItem
                                  onClick={(e) => handleLogCallDisposition(b, 'not_connected', e)}
                                  className="flex items-center gap-2 text-xs py-1.5 cursor-pointer text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded"
                                >
                                  <XCircle className="h-3.5 w-3.5 text-rose-600 shrink-0" />
                                  <div className="flex flex-col">
                                    <span className="font-semibold">Not Connected (नहीं उठाया)</span>
                                    <span className="text-[10px] text-muted-foreground">Auto-sets followup recommendation</span>
                                  </div>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={(e) => handleLogCallDisposition(b, 'callback', e)}
                                  className="flex items-center gap-2 text-xs py-1.5 cursor-pointer text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded"
                                >
                                  <Clock className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                                  <div className="flex flex-col">
                                    <span className="font-semibold">Callback Requested</span>
                                    <span className="text-[10px] text-muted-foreground">Baad me call karne ko kaha</span>
                                  </div>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={(e) => handleLogCallDisposition(b, 'confirmed', e)}
                                  className="flex items-center gap-2 text-xs py-1.5 cursor-pointer text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded"
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                  <div className="flex flex-col">
                                    <span className="font-semibold">Booking Confirmed on Call</span>
                                    <span className="text-[10px] text-muted-foreground">Prompts to punch on website</span>
                                  </div>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={(e) => handleLogCallDisposition(b, 'not_interested', e)}
                                  className="flex items-center gap-2 text-xs py-1.5 cursor-pointer text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                                >
                                  <AlertTriangle className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                                  <div className="flex flex-col">
                                    <span className="font-semibold">Not Interested / Cancelled</span>
                                    <span className="text-[10px] text-muted-foreground">Dawa ya ilaaj nahi lena</span>
                                  </div>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </TableCell>

                      {/* Website Booking Status */}
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {getEffectiveWebsiteStatus(b) === 'done' ? (
                          <div className="space-y-1">
                            <button
                              type="button"
                              onClick={(e) => handleUpdateWebsiteStatus(b.id, 'pending', e)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 hover:bg-emerald-200 cursor-pointer transition-colors shadow-2xs"
                              title="Website Status: Done. Click to toggle to Pending."
                            >
                              <Globe className="h-3 w-3 text-emerald-600" />
                              <span>Website Done</span>
                            </button>
                            <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium pl-1">
                              ✓ Live on Website
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <button
                              type="button"
                              onClick={(e) => handleUpdateWebsiteStatus(b.id, 'done', e)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200 border border-amber-300 dark:border-amber-800 hover:bg-emerald-100 hover:text-emerald-900 hover:border-emerald-300 cursor-pointer transition-all shadow-2xs group/web"
                              title="Click to mark Done on Website"
                            >
                              <Clock className="h-3 w-3 text-amber-600 group-hover/web:hidden" />
                              <Check className="h-3 w-3 text-emerald-600 hidden group-hover/web:inline" />
                              <span className="group-hover/web:hidden">Website Pending</span>
                              <span className="hidden group-hover/web:inline text-emerald-800">Mark as Done</span>
                            </button>
                            <div className="text-[10px] text-amber-700 dark:text-amber-400 font-medium pl-1">
                              Website par dalna baaki
                            </div>
                          </div>
                        )}
                      </TableCell>

                      {/* Patient Outcome (Converted / Non-Converted / Not Visited / Pending) */}
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <button
                                type="button"
                                className="group/outcome inline-flex items-center gap-1.5 rounded-lg border border-transparent hover:border-border hover:bg-muted/60 p-1 text-left transition-all focus:outline-hidden cursor-pointer"
                                title="Click to update patient visit outcome"
                                onClick={(e) => e.stopPropagation()}
                              />
                            }
                          >
                            {(() => {
                              const outcome = getEffectiveVisitOutcome(b);
                              if (outcome === 'converted') {
                                return (
                                  <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 gap-1 text-xs font-semibold cursor-pointer">
                                    <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                    <span>Converted</span>
                                    <ChevronDown className="h-2.5 w-2.5 opacity-60 ml-0.5" />
                                  </Badge>
                                );
                              }
                              if (outcome === 'non_converted') {
                                return (
                                  <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 gap-1 text-xs font-semibold cursor-pointer">
                                    <AlertTriangle className="h-3 w-3 text-amber-600" />
                                    <span>Non Converted</span>
                                    <ChevronDown className="h-2.5 w-2.5 opacity-60 ml-0.5" />
                                  </Badge>
                                );
                              }
                              if (outcome === 'not_visited') {
                                return (
                                  <Badge className="bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300 gap-1 text-xs font-semibold cursor-pointer">
                                    <XCircle className="h-3 w-3 text-rose-600" />
                                    <span>Not Visited</span>
                                    <ChevronDown className="h-2.5 w-2.5 opacity-60 ml-0.5" />
                                  </Badge>
                                );
                              }
                              return (
                                <Badge variant="secondary" className="gap-1 text-xs font-medium cursor-pointer text-slate-600 dark:text-slate-300">
                                  <Clock className="h-3 w-3 text-slate-500" />
                                  <span>Awaiting Visit</span>
                                  <ChevronDown className="h-2.5 w-2.5 opacity-60 ml-0.5" />
                                </Badge>
                              );
                            })()}
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-56 p-1.5" onClick={(e) => e.stopPropagation()}>
                            <div className="px-2 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                              Update Patient Outcome
                            </div>
                            <DropdownMenuItem
                              onClick={() => handleUpdateVisitOutcome(b.id, 'converted')}
                              className="flex items-center justify-between text-xs cursor-pointer py-1.5 px-2 rounded-md hover:bg-emerald-50 text-emerald-800 font-medium"
                            >
                              <div className="flex items-center gap-2">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                <div>
                                  <div>Converted (Treatment Shuru)</div>
                                  <div className="text-[10px] text-muted-foreground">Patient ne dawa / ilaaj shuru kiya</div>
                                </div>
                              </div>
                              {getEffectiveVisitOutcome(b) === 'converted' && (
                                <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleUpdateVisitOutcome(b.id, 'non_converted')}
                              className="flex items-center justify-between text-xs cursor-pointer py-1.5 px-2 rounded-md hover:bg-amber-50 text-amber-800 font-medium"
                            >
                              <div className="flex items-center gap-2">
                                <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                                <div>
                                  <div>Non Converted</div>
                                  <div className="text-[10px] text-muted-foreground">Aaye par abhi dawa nahi li</div>
                                </div>
                              </div>
                              {getEffectiveVisitOutcome(b) === 'non_converted' && (
                                <Check className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleUpdateVisitOutcome(b.id, 'not_visited')}
                              className="flex items-center justify-between text-xs cursor-pointer py-1.5 px-2 rounded-md hover:bg-rose-50 text-rose-800 font-medium"
                            >
                              <div className="flex items-center gap-2">
                                <XCircle className="h-3.5 w-3.5 text-rose-600" />
                                <div>
                                  <div>Not Visited (No-Show)</div>
                                  <div className="text-[10px] text-muted-foreground">Appointment par nahi aaye</div>
                                </div>
                              </div>
                              {getEffectiveVisitOutcome(b) === 'not_visited' && (
                                <Check className="h-3.5 w-3.5 text-rose-600 shrink-0" />
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleUpdateVisitOutcome(b.id, 'pending_visit')}
                              className="flex items-center justify-between text-xs cursor-pointer py-1.5 px-2 rounded-md hover:bg-slate-100 text-slate-700"
                            >
                              <div className="flex items-center gap-2">
                                <Clock className="h-3.5 w-3.5 text-slate-500" />
                                <div>
                                  <div>Awaiting Visit</div>
                                  <div className="text-[10px] text-muted-foreground">Visit abhi baaki hai</div>
                                </div>
                              </div>
                              {getEffectiveVisitOutcome(b) === 'pending_visit' && (
                                <Check className="h-3.5 w-3.5 text-slate-600 shrink-0" />
                              )}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>

                      {/* Tags Column */}
                      <TableCell className="min-w-[260px]" onClick={(e) => e.stopPropagation()}>
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
                        {(() => {
                          const displayNote = getEffectiveBookingNotes(b);
                          return displayNote ? (
                            <div
                              className="group/note flex items-start justify-between gap-1.5 p-1.5 rounded-md bg-muted/40 hover:bg-muted/70 border border-border/60 text-xs cursor-pointer max-w-[210px] transition-colors"
                              onClick={() => {
                                setEditingNoteBooking(b);
                                setNoteDraft(displayNote);
                                setNoteModalOpen(true);
                              }}
                              title="Click to view or edit follow-up note"
                            >
                              <div className="flex items-start gap-1 min-w-0">
                                <FileText className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                                <span className="line-clamp-2 text-foreground font-normal break-words">
                                  {displayNote}
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
                                setEditingNoteBooking(b);
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

                      {/* Consultation Mode (Editable Dropdown) */}
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <button
                                type="button"
                                className="group/mode inline-flex items-center gap-1.5 rounded-lg border border-transparent hover:border-border hover:bg-muted/60 p-1.5 text-left transition-all focus:outline-hidden cursor-pointer"
                                title="Click to change consultation mode"
                                onClick={(e) => e.stopPropagation()}
                              />
                            }
                          >
                            {isClinic ? (
                              <div className="space-y-0.5">
                                <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 gap-1 text-xs font-semibold cursor-pointer">
                                  <Building2 className="h-3 w-3" />
                                  <span>Clinic Visit</span>
                                  <ChevronDown className="h-3 w-3 opacity-60 group-hover/mode:opacity-100 transition-opacity ml-0.5" />
                                </Badge>
                                <p className="text-[11px] text-muted-foreground font-medium pl-0.5">
                                  {b.clinic_location || b.city || 'Jaipur'} Clinic
                                </p>
                              </div>
                            ) : (
                              <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30 gap-1 text-xs font-semibold cursor-pointer">
                                <Video className="h-3 w-3" />
                                <span>Video Call</span>
                                <ChevronDown className="h-3 w-3 opacity-60 group-hover/mode:opacity-100 transition-opacity ml-0.5" />
                              </Badge>
                            )}
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-64 p-1.5 max-h-80 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                            <div className="px-2 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                              Change Consultation Mode
                            </div>

                            {/* Video Call Option */}
                            <DropdownMenuItem
                              onClick={() => handleUpdateConsultationType(b.id, 'video_consultation')}
                              className={cn(
                                "flex items-center justify-between cursor-pointer py-2 px-2.5 rounded-md",
                                !isClinic && "bg-blue-500/10 text-blue-700 dark:text-blue-300 font-semibold"
                              )}
                            >
                              <div className="flex items-center gap-2">
                                <Video className="h-4 w-4 text-blue-600 shrink-0" />
                                <div>
                                  <div className="text-xs font-medium">Online Video Call</div>
                                  <div className="text-[10px] text-muted-foreground">45 Min Doctor Session</div>
                                </div>
                              </div>
                              {!isClinic && <Check className="h-3.5 w-3.5 text-blue-600 shrink-0" />}
                            </DropdownMenuItem>

                            <DropdownMenuSeparator className="my-1" />

                            <div className="px-2 py-1 text-[11px] font-semibold text-muted-foreground">
                              🏥 In-Person Clinic Visit:
                            </div>

                            {activeClinics.map((c) => {
                              const isCurrentClinic =
                                isClinic &&
                                (b.clinic_location?.toLowerCase() === c.city.toLowerCase() ||
                                  (!b.clinic_location && b.city?.toLowerCase() === c.city.toLowerCase()));
                              return (
                                <DropdownMenuItem
                                  key={c.id || c.city}
                                  onClick={() => handleUpdateConsultationType(b.id, 'clinic_visit', c.city)}
                                  className={cn(
                                    "flex items-center justify-between cursor-pointer py-1.5 px-2.5 rounded-md text-xs",
                                    isCurrentClinic && "bg-amber-500/10 text-amber-700 dark:text-amber-300 font-semibold"
                                  )}
                                >
                                  <div className="flex items-center gap-2 truncate">
                                    <Building2 className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                                    <span className="truncate">{c.name || `${c.city} Clinic`}</span>
                                  </div>
                                  {isCurrentClinic && <Check className="h-3.5 w-3.5 text-amber-600 shrink-0" />}
                                </DropdownMenuItem>
                              );
                            })}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>

                      {/* City (Editable On-Click) */}
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div
                          className="group/city inline-flex items-center gap-1.5 p-1 -m-1 rounded-md hover:bg-muted/70 cursor-pointer transition-colors"
                          onClick={(e) => handleOpenEditCity(b, e)}
                          title="Click to edit patient city / location"
                        >
                          <MapPin className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                          <span className="text-xs text-foreground font-medium">
                            {b.city || <span className="text-muted-foreground italic">Add City</span>}
                          </span>
                          <Pencil className="h-2.5 w-2.5 text-muted-foreground group-hover/city:text-foreground opacity-30 group-hover/city:opacity-100 transition-opacity ml-0.5" />
                        </div>
                      </TableCell>

                      {/* Preferred Schedule (Editable On-Click) */}
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div
                          className="group/schedule flex items-center justify-between gap-1.5 p-1.5 -m-1.5 rounded-lg border border-transparent hover:border-border hover:bg-muted/50 cursor-pointer transition-all"
                          onClick={() => handleOpenScheduleModal(b)}
                          title="Click to edit date and time"
                        >
                          <div className="space-y-0.5 text-xs">
                            {b.preferred_date ? (
                              <div className="flex items-center gap-1 text-foreground font-medium">
                                <Calendar className="h-3 w-3 text-primary shrink-0" />
                                <span>{b.preferred_date}</span>
                              </div>
                            ) : null}
                            {b.preferred_time ? (
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <Clock className="h-3 w-3 shrink-0" />
                                <span>{b.preferred_time}</span>
                              </div>
                            ) : null}
                            {!b.preferred_date && !b.preferred_time && (
                              <span className="text-muted-foreground italic flex items-center gap-1">
                                <CalendarDays className="h-3 w-3 opacity-60" />
                                Flexible
                              </span>
                            )}
                          </div>
                          <div className="opacity-0 group-hover/schedule:opacity-100 transition-opacity p-1 text-muted-foreground hover:text-foreground shrink-0">
                            <Pencil className="h-3 w-3" />
                          </div>
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
                              <DropdownMenuItem onClick={() => handleOpenEditName(b)}>
                                <Pencil className="h-4 w-4 mr-2 text-primary" />
                                Edit Patient Name
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleOpenEditCity(b)}>
                                <MapPin className="h-4 w-4 mr-2 text-rose-500" />
                                Edit City / Location
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleOpenInbox(b)}>
                                <MessageSquare className="h-4 w-4 mr-2 text-primary" />
                                Open Inbox Chat
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleOpenScheduleModal(b)}>
                                <CalendarDays className="h-4 w-4 mr-2 text-primary" />
                                Reschedule (Date & Time)
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setEditingNoteBooking(b);
                                  setNoteDraft(getEffectiveBookingNotes(b));
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
        {editingNoteBooking && (
          <FollowUpNoteDialogContent
            key={editingNoteBooking.id}
            booking={editingNoteBooking}
            initialNote={noteDraft}
            saving={savingNote}
            onSave={handleSaveNote}
            onClose={() => setNoteModalOpen(false)}
          />
        )}
      </Dialog>

      {/* Website Booking Reminder Dialog (Triggered when Agent confirms booking on call) */}
      <Dialog open={websiteReminderOpen} onOpenChange={setWebsiteReminderOpen}>
        {reminderBooking && (
          <WebsiteReminderDialogContent
            key={reminderBooking.id}
            booking={reminderBooking}
            agentName={reminderAgentName}
            initialNotes={reminderNotes}
            onUpdateStatusDone={handleUpdateWebsiteStatusDone}
            onClose={handleCloseWebsiteReminder}
          />
        )}
      </Dialog>

      {/* Reschedule Date & Time Dialog */}
      <Dialog open={scheduleModalOpen} onOpenChange={setScheduleModalOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="text-lg flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              Reschedule Appointment
            </DialogTitle>
            <DialogDescription>
              Update preferred appointment date and consultation time for{' '}
              <strong className="text-foreground">{editingScheduleBooking?.patient_name}</strong>{' '}
              <span className="font-mono text-xs">({editingScheduleBooking?.booking_query_id})</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Date Section */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-primary" />
                <span>Preferred Date</span>
              </label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="e.g. 18 November 2026 or 2026-11-18"
                  value={scheduleDateDraft}
                  onChange={(e) => setScheduleDateDraft(e.target.value)}
                  className="text-xs h-9"
                />
                <Input
                  type="date"
                  className="w-12 px-2 text-xs h-9 cursor-pointer shrink-0"
                  title="Pick from calendar"
                  onChange={(e) => {
                    if (e.target.value) {
                      const parts = e.target.value.split('-');
                      if (parts.length === 3) {
                        const year = parseInt(parts[0], 10);
                        const month = parseInt(parts[1], 10) - 1;
                        const day = parseInt(parts[2], 10);
                        const d = new Date(year, month, day);
                        const monthNames = [
                          'January', 'February', 'March', 'April', 'May', 'June',
                          'July', 'August', 'September', 'October', 'November', 'December'
                        ];
                        setScheduleDateDraft(`${day} ${monthNames[d.getMonth()]} ${year}`);
                      } else {
                        setScheduleDateDraft(e.target.value);
                      }
                    }
                  }}
                />
              </div>

              {/* Quick Date Shortcuts */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[11px] text-muted-foreground mr-1">Quick:</span>
                {[
                  { label: 'Today', days: 0 },
                  { label: 'Tomorrow', days: 1 },
                  { label: '+2 Days', days: 2 },
                  { label: '+3 Days', days: 3 },
                  { label: '+5 Days', days: 5 },
                  { label: '+7 Days', days: 7 },
                ].map((s) => (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => setScheduleDateDraft(getQuickDate(s.days))}
                    className="text-[11px] px-2 py-0.5 rounded-md border border-border bg-muted/60 hover:bg-muted text-foreground transition-colors cursor-pointer"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Time Section */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-primary" />
                <span>Preferred Time</span>
              </label>
              <Input
                type="text"
                placeholder="e.g. 11:00 AM or 04:30 PM"
                value={scheduleTimeDraft}
                onChange={(e) => setScheduleTimeDraft(e.target.value)}
                className="text-xs h-9"
              />

              {/* Quick Time Slot Shortcuts */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[11px] text-muted-foreground mr-1">Slots:</span>
                {[
                  '10:00 AM',
                  '11:00 AM',
                  '12:00 PM',
                  '02:00 PM',
                  '03:30 PM',
                  '04:30 PM',
                  '05:30 PM',
                  '06:30 PM',
                  '07:30 PM',
                ].map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => setScheduleTimeDraft(slot)}
                    className={cn(
                      "text-[11px] px-2 py-0.5 rounded-md border transition-colors cursor-pointer",
                      scheduleTimeDraft === slot
                        ? "bg-primary text-primary-foreground border-primary font-semibold"
                        : "border-border bg-muted/60 hover:bg-muted text-foreground"
                    )}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            </div>

            {/* Flexible Reset button */}
            <div className="pt-2 flex items-center justify-between border-t border-border/60">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground hover:text-foreground h-7 px-2"
                onClick={() => {
                  setScheduleDateDraft('');
                  setScheduleTimeDraft('');
                }}
              >
                Reset to Flexible
              </Button>
            </div>
          </div>

          <DialogFooter className="flex sm:justify-between items-center">
            <div className="text-xs text-muted-foreground">
              {editingScheduleBooking?.phone && (
                <a
                  href={formatTelUri(editingScheduleBooking.phone)}
                  className="text-primary hover:underline flex items-center gap-1"
                >
                  <Phone className="h-3 w-3" />
                  Call: {formatPhoneDisplay(editingScheduleBooking.phone)}
                </a>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setScheduleModalOpen(false)}
                disabled={savingSchedule}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSaveSchedule}
                disabled={savingSchedule}
                className="gap-1.5"
              >
                {savingSchedule ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                Save Schedule
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
                    <span>{selectedBooking.patient_name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenEditName(selectedBooking)}
                      className="h-6 px-1.5 text-xs text-muted-foreground hover:text-primary gap-1 cursor-pointer"
                      title="Edit Patient Name"
                    >
                      <Pencil className="h-3 w-3" />
                      <span>Edit Name</span>
                    </Button>
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
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground block">City / Location</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={(e) => handleOpenEditCity(selectedBooking, e)}
                        className="h-5 px-1.5 text-[11px] text-muted-foreground hover:text-primary gap-1 cursor-pointer"
                        title="Edit City"
                      >
                        <Pencil className="h-2.5 w-2.5" />
                        <span>Edit</span>
                      </Button>
                    </div>
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
                      setNoteDraft(selectedBooking ? getEffectiveBookingNotes(selectedBooking) : '');
                      setNoteModalOpen(true);
                    }}
                  >
                    <Pencil className="h-3 w-3" />
                    Edit Note
                  </Button>
                </div>
                <p className="text-sm text-foreground font-normal bg-background/80 p-2.5 rounded border whitespace-pre-wrap">
                  {(selectedBooking && getEffectiveBookingNotes(selectedBooking)) || (
                    <span className="text-muted-foreground italic">No follow-up notes yet. Click &apos;Edit Note&apos; to add one.</span>
                  )}
                </p>
              </div>

              {/* Consultation Mode Card */}
              <div className="p-3.5 rounded-lg border bg-muted/40 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Consultation Mode
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs text-primary hover:text-primary/80 gap-1 font-normal cursor-pointer"
                        />
                      }
                    >
                      <Pencil className="h-3 w-3" />
                      <span>Change Mode</span>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-64 p-1.5 max-h-80 overflow-y-auto">
                      <div className="px-2 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        Change Consultation Mode
                      </div>
                      <DropdownMenuItem
                        onClick={() => handleUpdateConsultationType(selectedBooking.id, 'video_consultation')}
                        className={cn(
                          "flex items-center justify-between cursor-pointer py-2 px-2.5 rounded-md",
                          selectedBooking.consultation_type !== 'clinic_visit' && "bg-blue-500/10 text-blue-700 dark:text-blue-300 font-semibold"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <Video className="h-4 w-4 text-blue-600 shrink-0" />
                          <div>
                            <div className="text-xs font-medium">Online Video Call</div>
                            <div className="text-[10px] text-muted-foreground">45 Min Doctor Session</div>
                          </div>
                        </div>
                        {selectedBooking.consultation_type !== 'clinic_visit' && <Check className="h-3.5 w-3.5 text-blue-600 shrink-0" />}
                      </DropdownMenuItem>

                      <DropdownMenuSeparator className="my-1" />

                      <div className="px-2 py-1 text-[11px] font-semibold text-muted-foreground">
                        🏥 In-Person Clinic Visit:
                      </div>

                      {activeClinics.map((c) => {
                        const isCurrentClinic =
                          selectedBooking.consultation_type === 'clinic_visit' &&
                          (selectedBooking.clinic_location?.toLowerCase() === c.city.toLowerCase() ||
                            (!selectedBooking.clinic_location && selectedBooking.city?.toLowerCase() === c.city.toLowerCase()));
                        return (
                          <DropdownMenuItem
                            key={c.id || c.city}
                            onClick={() => handleUpdateConsultationType(selectedBooking.id, 'clinic_visit', c.city)}
                            className={cn(
                              "flex items-center justify-between cursor-pointer py-1.5 px-2.5 rounded-md text-xs",
                              isCurrentClinic && "bg-amber-500/10 text-amber-700 dark:text-amber-300 font-semibold"
                            )}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <Building2 className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                              <span className="truncate">{c.name || `${c.city} Clinic`}</span>
                            </div>
                            {isCurrentClinic && <Check className="h-3.5 w-3.5 text-amber-600 shrink-0" />}
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>
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
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Preferred Appointment Schedule
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs text-primary hover:text-primary/80 gap-1 font-normal cursor-pointer"
                    onClick={() => handleOpenScheduleModal(selectedBooking)}
                  >
                    <Pencil className="h-3 w-3" />
                    <span>Reschedule</span>
                  </Button>
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

              {/* Website Booking Sync & Patient Outcome Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Website Booking Status */}
                <div className="p-3.5 rounded-lg border bg-muted/40 space-y-2">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Globe className="h-3.5 w-3.5 text-emerald-600" />
                      Website Booking Status
                    </span>
                    <span className="text-[11px] font-normal text-muted-foreground">
                      {selectedBooking.clinic_location || selectedBooking.city || 'Jaipur'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <div>
                      {getEffectiveWebsiteStatus(selectedBooking) === 'done' ? (
                        <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 font-semibold text-xs">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          <span>Live on Website (Done)</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300 font-semibold text-xs">
                          <Clock className="h-4 w-4 text-amber-600" />
                          <span>Pending on Website</span>
                        </div>
                      )}
                    </div>
                    {getEffectiveWebsiteStatus(selectedBooking) === 'done' ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          handleUpdateWebsiteStatus(selectedBooking.id, 'pending', e);
                          setSelectedBooking((prev) =>
                            prev ? { ...prev, website_status: 'pending' } : null
                          );
                        }}
                        className="h-7 text-xs px-2"
                      >
                        Mark as Pending
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        onClick={(e) => {
                          handleUpdateWebsiteStatus(selectedBooking.id, 'done', e);
                          setSelectedBooking((prev) =>
                            prev ? { ...prev, website_status: 'done' } : null
                          );
                        }}
                        className="h-7 text-xs px-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                      >
                        ✓ Mark Done on Website
                      </Button>
                    )}
                  </div>
                </div>

                {/* Patient Visit & Conversion Outcome */}
                <div className="p-3.5 rounded-lg border bg-muted/40 space-y-2">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <CheckCheck className="h-3.5 w-3.5 text-emerald-500" />
                      Patient Visit Outcome
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1 pt-1">
                    {[
                      { key: 'converted', label: '✅ Converted', color: 'hover:bg-emerald-50 text-emerald-700' },
                      { key: 'non_converted', label: '⚠️ Non Conv', color: 'hover:bg-amber-50 text-amber-700' },
                      { key: 'not_visited', label: '❌ Not Visited', color: 'hover:bg-rose-50 text-rose-700' },
                      { key: 'pending_visit', label: '🕒 Awaiting', color: 'hover:bg-slate-100 text-slate-700' },
                    ].map((item) => {
                      const active = getEffectiveVisitOutcome(selectedBooking) === item.key;
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => {
                            handleUpdateVisitOutcome(selectedBooking.id, item.key as PatientVisitOutcome);
                            setSelectedBooking((prev) =>
                              prev ? { ...prev, visit_outcome: item.key as PatientVisitOutcome } : null
                            );
                          }}
                          className={cn(
                            'px-2 py-1.5 rounded text-xs font-medium border text-center transition-all cursor-pointer',
                            active
                              ? 'bg-primary text-primary-foreground border-primary font-semibold shadow-2xs'
                              : `bg-card border-border ${item.color}`
                          )}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
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
                    window.location.href = formatTelUri(selectedBooking.phone);
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

      {/* Edit Patient Name Modal */}
      <Dialog open={nameModalOpen} onOpenChange={setNameModalOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-4 w-4 text-primary" />
              Edit Patient Name
            </DialogTitle>
            <DialogDescription>
              Update patient name for booking{' '}
              <strong className="font-mono text-foreground">
                {editingNameBooking?.booking_query_id}
              </strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Patient Name:
              </label>
              <Input
                value={patientNameDraft}
                onChange={(e) => setPatientNameDraft(e.target.value)}
                placeholder="Enter patient name..."
                className="text-sm font-medium"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSavePatientName();
                  }
                }}
              />
            </div>
            {editingNameBooking?.phone && (
              <div className="text-xs text-muted-foreground flex items-center gap-1 font-mono">
                <Phone className="h-3 w-3" />
                {formatPhoneDisplay(editingNameBooking.phone)}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setNameModalOpen(false)}
              disabled={savingName}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSavePatientName}
              disabled={savingName || !patientNameDraft.trim()}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
            >
              {savingName ? 'Saving...' : 'Save Name'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit City Modal */}
      <Dialog open={cityModalOpen} onOpenChange={setCityModalOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-lg flex items-center gap-2">
              <MapPin className="h-5 w-5 text-rose-500" />
              Edit Patient City / Location
            </DialogTitle>
            <DialogDescription>
              Patient ki city update karein for booking query{' '}
              <strong className="font-mono text-foreground">
                {editingCityBooking?.booking_query_id}
              </strong>{' '}
              ({editingCityBooking?.patient_name})
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                City / Location
              </label>
              <Input
                value={cityDraft}
                onChange={(e) => setCityDraft(e.target.value)}
                placeholder="e.g. Jaipur, Delhi, Lucknow, Chandigarh..."
                className="text-sm"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSaveCity();
                  }
                }}
              />
            </div>
            {/* Quick city suggestions */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[11px] text-muted-foreground font-medium">Quick suggestions:</span>
              <div className="flex flex-wrap gap-1.5">
                {['Jaipur', 'Delhi', 'Lucknow', 'Amritsar', 'Ludhiana', 'Chandigarh', 'Indore', 'Patna', 'Rewari'].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCityDraft(c)}
                    className="px-2 py-0.5 text-xs rounded-md border border-border bg-muted/60 hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer"
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCityModalOpen(false)}
              disabled={savingCity}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveCity}
              disabled={savingCity || !cityDraft.trim()}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
            >
              {savingCity ? 'Saving...' : 'Save City'}
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

      {/* Create New Booking Modal */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Plus className="h-5 w-5 text-emerald-600" />
              Create New Booking
            </DialogTitle>
            <DialogDescription>
              Patient details, location, consultation mode and website status seedhe CRM mein save karein.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* Patient Name & Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-semibold text-foreground">
                  Patient Name <span className="text-rose-500">*</span>
                </label>
                <Input
                  value={newPatientName}
                  onChange={(e) => setNewPatientName(e.target.value)}
                  placeholder="e.g. Sunita Sharma"
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">
                  Mobile Number <span className="text-rose-500">*</span>
                </label>
                <Input
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="e.g. 9876543210"
                  className="h-9 text-xs font-mono"
                />
              </div>
            </div>

            {/* Consultation Mode */}
            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">
                Consultation Mode
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setNewConsultationType('clinic_visit')}
                  className={cn(
                    'p-2.5 rounded-lg border flex items-center gap-2 text-left transition-all cursor-pointer',
                    newConsultationType === 'clinic_visit'
                      ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 font-semibold ring-1 ring-amber-500'
                      : 'border-border hover:bg-muted/50 text-muted-foreground'
                  )}
                >
                  <Building2 className="h-4 w-4 text-amber-600 shrink-0" />
                  <div>
                    <div className="text-xs font-semibold">🏥 Clinic Visit</div>
                    <div className="text-[10px] text-muted-foreground">In-person Clinic Visit</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setNewConsultationType('video_consultation')}
                  className={cn(
                    'p-2.5 rounded-lg border flex items-center gap-2 text-left transition-all cursor-pointer',
                    newConsultationType === 'video_consultation'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 font-semibold ring-1 ring-blue-500'
                      : 'border-border hover:bg-muted/50 text-muted-foreground'
                  )}
                >
                  <Video className="h-4 w-4 text-blue-600 shrink-0" />
                  <div>
                    <div className="text-xs font-semibold">📹 Video Call</div>
                    <div className="text-[10px] text-muted-foreground">Online Doctor Consult</div>
                  </div>
                </button>
              </div>
            </div>

            {/* City / Clinic Location */}
            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">
                Clinic Location / City
              </label>
              <div className="flex flex-wrap gap-1.5 mb-1.5">
                {['Jaipur', 'Delhi', 'Lucknow', 'Amritsar', 'Ludhiana', 'Chandigarh', 'Indore', 'Patna', 'Rewari'].map(
                  (city) => (
                    <button
                      key={city}
                      type="button"
                      onClick={() => {
                        setNewCity(city);
                        setNewClinicLocation(city);
                      }}
                      className={cn(
                        'px-2 py-1 rounded-md text-[11px] font-medium border transition-colors cursor-pointer',
                        newCity.toLowerCase() === city.toLowerCase()
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-muted/40 hover:bg-muted border-border text-foreground'
                      )}
                    >
                      {city}
                    </button>
                  )
                )}
              </div>
              <Input
                value={newCity}
                onChange={(e) => {
                  setNewCity(e.target.value);
                  setNewClinicLocation(e.target.value);
                }}
                placeholder="Or type custom city..."
                className="h-8 text-xs"
              />
            </div>

            {/* Preferred Schedule (Date & Time) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Preferred Date</label>
                <div className="flex gap-1 mb-1">
                  <button
                    type="button"
                    onClick={() => setNewPreferredDate(getQuickDate(0))}
                    className="px-1.5 py-0.5 text-[10px] rounded bg-muted hover:bg-muted/80 text-foreground border border-border cursor-pointer"
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewPreferredDate(getQuickDate(1))}
                    className="px-1.5 py-0.5 text-[10px] rounded bg-muted hover:bg-muted/80 text-foreground border border-border cursor-pointer"
                  >
                    Tomorrow
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewPreferredDate(getQuickDate(2))}
                    className="px-1.5 py-0.5 text-[10px] rounded bg-muted hover:bg-muted/80 text-foreground border border-border cursor-pointer"
                  >
                    +2 Days
                  </button>
                </div>
                <Input
                  value={newPreferredDate}
                  onChange={(e) => setNewPreferredDate(e.target.value)}
                  placeholder="e.g. 21 Nov 2026"
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">Preferred Time</label>
                <div className="flex gap-1 mb-1">
                  {['11:00 AM', '01:00 PM', '04:00 PM', '06:00 PM'].map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setNewPreferredTime(slot)}
                      className={cn(
                        'px-1.5 py-0.5 text-[10px] rounded border transition-colors cursor-pointer',
                        newPreferredTime === slot
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-muted hover:bg-muted/80 border-border text-foreground'
                      )}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
                <Input
                  value={newPreferredTime}
                  onChange={(e) => setNewPreferredTime(e.target.value)}
                  placeholder="e.g. 11:30 AM"
                  className="h-8 text-xs"
                />
              </div>
            </div>

            {/* Health Concern */}
            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">Health Concern / Disease</label>
              <div className="flex flex-wrap gap-1 mb-1">
                {[
                  'Infertility / Conceiving Issue',
                  'Tubal Blockage',
                  'PCOD / PCOS',
                  'White Discharge',
                  'Irregular Periods',
                  'Low AMH / Egg Quality',
                  'Male Infertility / Nil Sperm',
                ].map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setNewHealthConcern(chip)}
                    className={cn(
                      'px-2 py-0.5 text-[10px] rounded-md border transition-colors cursor-pointer',
                      newHealthConcern === chip
                        ? 'bg-purple-100 text-purple-900 border-purple-300 font-medium'
                        : 'bg-muted/40 hover:bg-muted border-border text-muted-foreground'
                    )}
                  >
                    {chip}
                  </button>
                ))}
              </div>
              <Input
                value={newHealthConcern}
                onChange={(e) => setNewHealthConcern(e.target.value)}
                placeholder="Type patient's condition or disease..."
                className="h-8 text-xs"
              />
            </div>

            {/* Website Status & Patient Visit Outcome */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-lg border bg-muted/20">
              <div className="space-y-1">
                <label className="font-semibold text-foreground flex items-center gap-1">
                  <Globe className="h-3.5 w-3.5 text-emerald-600" />
                  Website Booking Status
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setNewWebsiteStatus('pending')}
                    className={cn(
                      'p-2 rounded border text-center transition-all cursor-pointer text-xs',
                      newWebsiteStatus === 'pending'
                        ? 'border-amber-500 bg-amber-50 text-amber-900 font-semibold'
                        : 'border-border text-muted-foreground hover:bg-muted'
                    )}
                  >
                    ⏳ Pending
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewWebsiteStatus('done')}
                    className={cn(
                      'p-2 rounded border text-center transition-all cursor-pointer text-xs',
                      newWebsiteStatus === 'done'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-900 font-semibold'
                        : 'border-border text-muted-foreground hover:bg-muted'
                    )}
                  >
                    🌐 Done
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground flex items-center gap-1">
                  <CheckCheck className="h-3.5 w-3.5 text-emerald-600" />
                  Patient Outcome
                </label>
                <select
                  value={newVisitOutcome}
                  onChange={(e) => setNewVisitOutcome(e.target.value as PatientVisitOutcome)}
                  className="w-full h-9 rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground focus:outline-hidden"
                >
                  <option value="pending_visit">🕒 Awaiting Visit (Visit Baaki Hai)</option>
                  <option value="converted">✅ Converted (Treatment Shuru)</option>
                  <option value="non_converted">⚠️ Non Converted (Aaye par dawa nahi li)</option>
                  <option value="not_visited">❌ Not Visited (No-Show / Nahi Aaye)</option>
                </select>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <label className="font-semibold text-foreground">Follow-up Notes</label>
              <Textarea
                rows={2}
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="Add any special instructions or doctor preference..."
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateModalOpen(false)}
              disabled={creatingBooking}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateBooking}
              disabled={creatingBooking || !newPatientName.trim() || !newPhone.trim()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5"
            >
              {creatingBooking ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Saving Booking...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Save Booking
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
