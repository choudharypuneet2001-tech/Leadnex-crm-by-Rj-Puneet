'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import type { Booking, BookingStatus } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
  ExternalLink,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Megaphone,
  MoreHorizontal,
  RefreshCw,
  Copy,
  Check,
  Sparkles,
  CalendarDays,
  User,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

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

export default function BookingsPage() {
  const router = useRouter();
  const supabase = createClient();
  const { account, accountRole } = useAuth();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | BookingStatus>('all');

  // Selected booking modal
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState<Booking | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
        setBookings(data || []);
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
  }, [fetchBookings]);

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
    await fetchBookings();
    toast.success('Bookings refreshed');
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
      'Preferred Date & Time',
      'Health Concern',
      'Meta Ad Campaign',
      'Meta Ad ID',
      'Status',
      'Booked At',
    ];

    const rows = filteredBookings.map((b) => [
      b.booking_query_id,
      b.patient_name,
      b.phone,
      b.city || '',
      [b.preferred_date, b.preferred_time].filter(Boolean).join(' - ') || 'Not specified',
      b.health_concern || '',
      b.ad_name || '',
      b.ad_id || '',
      b.status,
      new Date(b.created_at).toLocaleString(),
    ]);

    const csvContent = toCsv([headers, ...rows]);
    downloadCsv(`gynocci-bookings-${new Date().toISOString().slice(0, 10)}.csv`, csvContent);
    toast.success('Bookings exported to CSV');
  };

  // Filtered list
  const filteredBookings = useMemo(() => {
    const q = search.trim().toLowerCase();
    return bookings.filter((b) => {
      if (statusFilter !== 'all' && b.status !== statusFilter) return false;
      if (!q) return true;
      return (
        b.booking_query_id.toLowerCase().includes(q) ||
        b.patient_name.toLowerCase().includes(q) ||
        b.phone.includes(q) ||
        (b.city && b.city.toLowerCase().includes(q)) ||
        (b.health_concern && b.health_concern.toLowerCase().includes(q)) ||
        (b.ad_name && b.ad_name.toLowerCase().includes(q))
      );
    });
  }, [bookings, search, statusFilter]);

  // Stats
  const stats = useMemo(() => {
    const total = bookings.length;
    const confirmed = bookings.filter((b) => b.status === 'confirmed').length;
    const completed = bookings.filter((b) => b.status === 'completed').length;
    const cancelled = bookings.filter((b) => b.status === 'cancelled').length;
    return { total, confirmed, completed, cancelled };
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
          <p className="text-xs text-muted-foreground mt-0.5">Ready for doctor team</p>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Completed</span>
            <Sparkles className="h-4 w-4 text-blue-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-blue-600 dark:text-blue-400">
            {stats.completed}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">Consultations done</p>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Cancelled</span>
            <XCircle className="h-4 w-4 text-rose-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-rose-600 dark:text-rose-400">
            {stats.cancelled}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">Rescheduled / cancelled</p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search patient, phone, query ID, city, takleef..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {(['all', 'confirmed', 'completed', 'cancelled'] as const).map((st) => (
            <Button
              key={st}
              variant={statusFilter === st ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter(st)}
              className="h-8 capitalize text-xs"
            >
              {st}
            </Button>
          ))}
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
              {search || statusFilter !== 'all'
                ? 'No bookings match your current filter criteria. Try clearing filters.'
                : 'When patients confirm their appointment via WhatsApp or Ads, their booking details and query ID will automatically appear here.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[140px]">Query ID</TableHead>
                  <TableHead>Patient Details</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>Preferred Schedule</TableHead>
                  <TableHead>Health Concern (तकलीफ)</TableHead>
                  <TableHead>Meta Ad Referral</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Booked On</TableHead>
                  <TableHead className="w-[80px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBookings.map((b) => {
                  const phoneDigits = b.phone.replace(/\D/g, '');
                  const waUrl = `https://wa.me/${phoneDigits}`;

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
                        <div className="space-y-0.5">
                          <div className="font-medium text-foreground text-sm flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                            {b.patient_name}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{formatPhoneDisplay(b.phone)}</span>
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-emerald-600 hover:text-emerald-700 font-medium inline-flex items-center gap-0.5"
                            >
                              <MessageSquare className="h-3 w-3" />
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
                      <TableCell className="max-w-[220px]">
                        {b.health_concern ? (
                          <div className="flex items-start gap-1 text-xs text-foreground">
                            <Activity className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                            <span className="line-clamp-2">{b.health_concern}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Consultation request</span>
                        )}
                      </TableCell>

                      {/* Meta Ad Referral */}
                      <TableCell className="max-w-[180px]">
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

                      {/* Actions */}
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
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
                            <DropdownMenuItem
                              onClick={() => {
                                if (b.conversation_id) {
                                  router.push(`/inbox?conversationId=${b.conversation_id}`);
                                } else {
                                  router.push('/inbox');
                                }
                              }}
                            >
                              <MessageSquare className="h-4 w-4 mr-2 text-primary" />
                              Open Inbox Chat
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
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

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
              Consultation query recorded for Gynocci doctor team.
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
                <p className="text-sm text-foreground pt-1">
                  {selectedBooking.health_concern || 'Doctor consultation required'}
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
              <div className="flex items-center gap-2 pt-2">
                <Button
                  className="flex-1 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => {
                    const digits = selectedBooking.phone.replace(/\D/g, '');
                    window.open(`https://wa.me/${digits}`, '_blank');
                  }}
                >
                  <MessageSquare className="h-4 w-4" />
                  Chat on WhatsApp
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 gap-1.5"
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
