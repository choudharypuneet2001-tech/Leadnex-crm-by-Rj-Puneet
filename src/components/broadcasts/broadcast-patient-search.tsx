'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Search,
  X,
  Loader2,
  CheckCheck,
  Eye,
  MessageCircle,
  AlertCircle,
  Send,
  Clock,
  ExternalLink,
  MessageSquare,
  User,
  Phone,
  Radio,
  Calendar,
} from 'lucide-react';
import { getRecipientStatus } from '@/lib/broadcast-status';
import type { RecipientStatus } from '@/types';

export interface PatientBroadcastRecord {
  id: string;
  broadcast_id: string;
  contact_id: string;
  status: RecipientStatus;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  replied_at: string | null;
  error_message: string | null;
  created_at: string;
  contact: {
    id: string;
    name: string | null;
    phone: string;
    phone_normalized: string | null;
    conversation_id?: string | null;
  };
  broadcast: {
    id: string;
    name: string;
    template_name: string;
    status: string;
    created_at: string;
  } | null;
}

interface BroadcastPatientSearchProps {
  initialQuery?: string;
  onClear?: () => void;
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return '-';
  }
}

export function BroadcastPatientSearch({
  initialQuery = '',
  onClear,
}: BroadcastPatientSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [results, setResults] = useState<PatientBroadcastRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const performSearch = useCallback(async (searchTerm: string) => {
    const trimmed = searchTerm.trim();
    if (!trimmed) {
      setResults([]);
      setHasSearched(false);
      setErrorMessage(null);
      return;
    }

    setSearching(true);
    setErrorMessage(null);
    setHasSearched(true);

    try {
      const supabase = createClient();
      const cleanDigits = trimmed.replace(/\D/g, '');
      const last10 = cleanDigits.length >= 10 ? cleanDigits.slice(-10) : cleanDigits;

      // Step 1: Find matching contacts
      let contactQuery = supabase
        .from('contacts')
        .select('id, name, phone, phone_normalized');

      if (cleanDigits.length >= 3) {
        // Query both name and variations of the phone number
        contactQuery = contactQuery.or(
          `name.ilike.%${trimmed}%,phone.ilike.%${cleanDigits}%,phone_normalized.ilike.%${cleanDigits}%,phone.ilike.%${last10}%,phone_normalized.ilike.%${last10}%`
        );
      } else {
        contactQuery = contactQuery.ilike('name', `%${trimmed}%`);
      }

      const { data: contacts, error: contactErr } = await contactQuery.limit(50);

      if (contactErr) {
        throw new Error(contactErr.message);
      }

      if (!contacts || contacts.length === 0) {
        setResults([]);
        return;
      }

      const contactIds = contacts.map((c) => c.id);

      // Step 2: Query broadcast_recipients for these contacts
      const { data: recs, error: recErr } = await supabase
        .from('broadcast_recipients')
        .select(`
          id,
          broadcast_id,
          contact_id,
          status,
          sent_at,
          delivered_at,
          read_at,
          replied_at,
          error_message,
          created_at,
          broadcast:broadcasts(id, name, template_name, status, created_at)
        `)
        .in('contact_id', contactIds)
        .order('created_at', { ascending: false });

      if (recErr) {
        throw new Error(recErr.message);
      }

      // Step 3: Fetch active conversations for these contacts to enable one-click chat
      const { data: conversations } = await supabase
        .from('conversations')
        .select('id, contact_id')
        .in('contact_id', contactIds);

      const convMap = new Map<string, string>();
      if (conversations) {
        conversations.forEach((c) => {
          if (c.contact_id && !convMap.has(c.contact_id)) {
            convMap.set(c.contact_id, c.id);
          }
        });
      }

      // Format combined records
      const contactMap = new Map(contacts.map((c) => [c.id, c]));

      const formatted: PatientBroadcastRecord[] = (recs ?? []).map((r) => {
        const contact = contactMap.get(r.contact_id);
        const broadcastData = Array.isArray(r.broadcast)
          ? r.broadcast[0]
          : r.broadcast;

        return {
          id: r.id,
          broadcast_id: r.broadcast_id,
          contact_id: r.contact_id,
          status: r.status as RecipientStatus,
          sent_at: r.sent_at,
          delivered_at: r.delivered_at,
          read_at: r.read_at,
          replied_at: r.replied_at,
          error_message: r.error_message,
          created_at: r.created_at,
          contact: {
            id: r.contact_id,
            name: contact?.name ?? 'Unknown',
            phone: contact?.phone ?? '-',
            phone_normalized: contact?.phone_normalized ?? null,
            conversation_id: convMap.get(r.contact_id) ?? null,
          },
          broadcast: broadcastData
            ? {
                id: broadcastData.id,
                name: broadcastData.name,
                template_name: broadcastData.template_name,
                status: broadcastData.status,
                created_at: broadcastData.created_at,
              }
            : null,
        };
      });

      setResults(formatted);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to search broadcast records'
      );
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  // Handle typing with debounce
  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    if (!query.trim()) {
      setResults([]);
      setHasSearched(false);
      setErrorMessage(null);
      return;
    }

    // Auto-search if at least 2 chars or 3 digits
    debounceTimer.current = setTimeout(() => {
      performSearch(query);
    }, 350);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [query, performSearch]);

  function handleClear() {
    setQuery('');
    setResults([]);
    setHasSearched(false);
    setErrorMessage(null);
    if (onClear) onClear();
  }

  const filteredResults = useMemo(() => {
    if (statusFilter === 'all') return results;
    return results.filter((r) => r.status === statusFilter);
  }, [results, statusFilter]);

  // Unique patient count in results
  const uniquePatients = useMemo(() => {
    const ids = new Set(results.map((r) => r.contact_id));
    return ids.size;
  }, [results]);

  // Status breakdown counts
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: results.length,
      sent: 0,
      delivered: 0,
      read: 0,
      replied: 0,
      failed: 0,
      pending: 0,
    };
    results.forEach((r) => {
      if (counts[r.status] !== undefined) {
        counts[r.status]++;
      }
    });
    return counts;
  }, [results]);

  return (
    <div className="space-y-4">
      {/* Search Input Bar */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search patient by name or 10-digit mobile number (e.g. 9876543210 or Shalu)..."
              className="pl-9 pr-9 h-10 text-sm bg-background border-border"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (debounceTimer.current) clearTimeout(debounceTimer.current);
                  performSearch(query);
                }
              }}
            />
            {query && (
              <button
                type="button"
                onClick={handleClear}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded-full"
                title="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Button
            onClick={() => {
              if (debounceTimer.current) clearTimeout(debounceTimer.current);
              performSearch(query);
            }}
            disabled={searching || !query.trim()}
            className="h-10 px-5 bg-primary text-primary-foreground hover:bg-primary/90 shrink-0"
          >
            {searching ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Search className="h-4 w-4 mr-2" />
            )}
            Search
          </Button>
        </div>

        {/* Quick Help / Hint */}
        <p className="mt-2 text-xs text-muted-foreground flex items-center gap-1.5">
          <span>💡 Tip:</span>
          <span>
            Type patient name or mobile number with or without +91 to check which broadcasts were sent and their delivery status.
          </span>
        </p>
      </div>

      {/* Error state */}
      {errorMessage && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* When Results Are Available */}
      {hasSearched && !searching && results.length > 0 && (
        <div className="space-y-4">
          {/* Header Summary & Filters */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-semibold text-foreground">
                {results.length} Broadcast Record{results.length !== 1 ? 's' : ''}
              </span>
              <span className="text-muted-foreground">
                across {uniquePatients} patient{uniquePatients !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Quick Status Filters */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <button
                onClick={() => setStatusFilter('all')}
                className={`rounded-full px-2.5 py-1 font-medium transition-colors ${
                  statusFilter === 'all'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                All ({statusCounts.all})
              </button>
              {statusCounts.delivered > 0 && (
                <button
                  onClick={() => setStatusFilter('delivered')}
                  className={`rounded-full px-2.5 py-1 font-medium transition-colors ${
                    statusFilter === 'delivered'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  Delivered ({statusCounts.delivered})
                </button>
              )}
              {statusCounts.read > 0 && (
                <button
                  onClick={() => setStatusFilter('read')}
                  className={`rounded-full px-2.5 py-1 font-medium transition-colors ${
                    statusFilter === 'read'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  Read ({statusCounts.read})
                </button>
              )}
              {statusCounts.replied > 0 && (
                <button
                  onClick={() => setStatusFilter('replied')}
                  className={`rounded-full px-2.5 py-1 font-medium transition-colors ${
                    statusFilter === 'replied'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  Replied ({statusCounts.replied})
                </button>
              )}
              {statusCounts.sent > 0 && (
                <button
                  onClick={() => setStatusFilter('sent')}
                  className={`rounded-full px-2.5 py-1 font-medium transition-colors ${
                    statusFilter === 'sent'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  Sent ({statusCounts.sent})
                </button>
              )}
              {statusCounts.failed > 0 && (
                <button
                  onClick={() => setStatusFilter('failed')}
                  className={`rounded-full px-2.5 py-1 font-medium transition-colors ${
                    statusFilter === 'failed'
                      ? 'bg-red-500 text-white'
                      : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                  }`}
                >
                  Failed ({statusCounts.failed})
                </button>
              )}
            </div>
          </div>

          {/* Results Table */}
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground">Patient</TableHead>
                  <TableHead className="text-muted-foreground">Campaign Name</TableHead>
                  <TableHead className="text-muted-foreground">Delivery Status</TableHead>
                  <TableHead className="text-muted-foreground">Sent Time</TableHead>
                  <TableHead className="text-muted-foreground">Delivered / Read</TableHead>
                  <TableHead className="text-muted-foreground">Failure Reason</TableHead>
                  <TableHead className="text-right text-muted-foreground">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredResults.map((record) => {
                  const rStatus = getRecipientStatus(record.status);
                  return (
                    <TableRow key={record.id} className="border-border hover:bg-muted/30">
                      {/* Patient Details */}
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                            {record.contact.name || 'Unknown'}
                          </span>
                          <span className="text-xs text-muted-foreground font-mono flex items-center gap-1 mt-0.5">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            {record.contact.phone}
                          </span>
                        </div>
                      </TableCell>

                      {/* Broadcast Campaign */}
                      <TableCell>
                        <div className="flex flex-col">
                          {record.broadcast ? (
                            <button
                              type="button"
                              onClick={() => router.push(`/broadcasts/${record.broadcast_id}`)}
                              className="text-left font-medium text-primary hover:underline flex items-center gap-1 text-sm"
                            >
                              <span>{record.broadcast.name}</span>
                              <ExternalLink className="h-3 w-3 inline opacity-70" />
                            </button>
                          ) : (
                            <span className="text-muted-foreground text-sm">Campaign #{record.broadcast_id.slice(0, 8)}</span>
                          )}
                          <span className="text-xs text-muted-foreground mt-0.5">
                            {record.broadcast?.template_name || 'Template'}
                          </span>
                        </div>
                      </TableCell>

                      {/* Delivery Status Badge */}
                      <TableCell>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${rStatus.classes}`}
                        >
                          {record.status === 'read' && <Eye className="h-3 w-3 text-primary" />}
                          {record.status === 'delivered' && <CheckCheck className="h-3 w-3 text-primary" />}
                          {record.status === 'replied' && <MessageCircle className="h-3 w-3 text-purple-400" />}
                          {record.status === 'sent' && <Send className="h-3 w-3 text-blue-400" />}
                          {record.status === 'failed' && <AlertCircle className="h-3 w-3 text-red-400" />}
                          {record.status === 'pending' && <Clock className="h-3 w-3 text-muted-foreground" />}
                          {record.status}
                        </span>
                      </TableCell>

                      {/* Sent Time */}
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDateTime(record.sent_at || record.created_at)}
                      </TableCell>

                      {/* Delivered / Read Time */}
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {record.read_at ? (
                          <div className="flex flex-col">
                            <span className="text-primary font-medium flex items-center gap-1">
                              <Eye className="h-3 w-3" /> Seen
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              {formatDateTime(record.read_at)}
                            </span>
                          </div>
                        ) : record.delivered_at ? (
                          <div className="flex flex-col">
                            <span className="text-teal-400 font-medium flex items-center gap-1">
                              <CheckCheck className="h-3 w-3" /> Delivered
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              {formatDateTime(record.delivered_at)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground/60">-</span>
                        )}
                      </TableCell>

                      {/* Failure Reason */}
                      <TableCell className="max-w-xs">
                        {record.error_message ? (
                          <div className="flex items-start gap-1 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-md px-2 py-1">
                            <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                            <span className="truncate" title={record.error_message}>
                              {record.error_message}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground/40 text-xs">-</span>
                        )}
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {record.broadcast && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs border-border hover:bg-muted px-2"
                              onClick={() => router.push(`/broadcasts/${record.broadcast_id}`)}
                              title="View Broadcast Campaign Details"
                            >
                              <Radio className="h-3 w-3 mr-1" />
                              View
                            </Button>
                          )}
                          <Button
                            variant="default"
                            size="sm"
                            className="h-7 text-xs bg-primary text-primary-foreground hover:bg-primary/90 px-2"
                            onClick={() => {
                              if (record.contact.conversation_id) {
                                router.push(`/inbox?c=${record.contact.conversation_id}`);
                              } else {
                                router.push('/inbox');
                              }
                            }}
                            title="Open Chat in Inbox"
                          >
                            <MessageSquare className="h-3 w-3 mr-1" />
                            Chat
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* No Results Found */}
      {hasSearched && !searching && results.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card p-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground mb-3">
            <Search className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">
            No broadcast records found for &ldquo;{query}&rdquo;
          </h3>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            No broadcast campaign messages were found matching this name or mobile number. Please check the spelling or try searching with the 10-digit number directly.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClear}
            className="mt-4 border-border text-xs"
          >
            Clear Search
          </Button>
        </div>
      )}

      {/* Initial Empty State before searching */}
      {!hasSearched && !searching && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 p-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-3">
            <Search className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-medium text-foreground">
            Search Patient Broadcast Delivery Records
          </h3>
          <p className="mt-1 max-w-md text-xs text-muted-foreground">
            Enter a patient&apos;s name (e.g. <span className="text-foreground font-medium">Shalu</span>) or 10-digit mobile number (e.g. <span className="text-foreground font-medium">8595553233</span>) above to see which broadcasts they received, when they were delivered or seen, and any failure reasons.
          </p>
        </div>
      )}
    </div>
  );
}

