'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
} from '@/components/ui/dialog';
import { useAuth } from '@/hooks/use-auth';
import { createClient } from '@/lib/supabase/client';
import { computeAnalytics } from '@/lib/analytics/analytics-service';
import type {
  AnalyticsSummary,
  AnalyticsDateRangePreset,
  DateRangeFilter,
  AnalyticsLeadItem,
  LeadIntentStage,
} from '@/lib/analytics/types';
import type { Booking, Contact } from '@/types';
import { toast } from 'sonner';

export default function AnalyticsPage() {
  const router = useRouter();
  const { account } = useAuth();
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

  // Script Modal state
  const [scriptModalLead, setScriptModalLead] = useState<AnalyticsLeadItem | null>(null);
  const [copiedScript, setCopiedScript] = useState<boolean>(false);

  // Fetch analytics summary from API with resilient client-side fallback
  const fetchAnalytics = useCallback(async () => {
    try {
      setRefreshing(true);
      const params = new URLSearchParams();
      params.set('range', rangePreset);
      if (rangePreset === 'custom') {
        if (customFrom) params.set('from', new Date(customFrom).toISOString());
        if (customTo) {
          const toDate = new Date(customTo);
          toDate.setHours(23, 59, 59, 999);
          params.set('to', toDate.toISOString());
        }
      }
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

      // 2. Client-side fallback if API route returned error or failed
      if (!summaryData) {
        let contactsData: any[] = [];
        let bookingsData: any[] = [];
        let convData: any[] = [];

        // Contacts query
        try {
          let contactsQuery = supabase
            .from('contacts')
            .select('*')
            .order('created_at', { ascending: false });

          if (account?.id) {
            contactsQuery = contactsQuery.eq('account_id', account.id);
          }

          const cRes = await contactsQuery;
          if (!cRes.error && cRes.data) {
            contactsData = cRes.data;
          } else {
            const retryRes = await supabase
              .from('contacts')
              .select('*')
              .order('created_at', { ascending: false });
            if (retryRes.data) contactsData = retryRes.data;
          }
        } catch (e) {
          console.warn('[analytics] client contacts fallback err:', e);
        }

        // Bookings query
        try {
          let bookingsQuery = supabase
            .from('bookings')
            .select('*')
            .order('created_at', { ascending: false });

          if (account?.id) {
            bookingsQuery = bookingsQuery.eq('account_id', account.id);
          }

          const bRes = await bookingsQuery;
          if (!bRes.error && bRes.data) {
            bookingsData = bRes.data;
          } else {
            const retryRes = await supabase
              .from('bookings')
              .select('*')
              .order('created_at', { ascending: false });
            if (retryRes.data) bookingsData = retryRes.data;
          }
        } catch (e) {
          console.warn('[analytics] client bookings fallback err:', e);
        }

        // Conversations query
        try {
          let convQuery = supabase
            .from('conversations')
            .select('id, contact_id, last_message_text, last_message_at')
            .order('last_message_at', { ascending: false });

          if (account?.id) {
            convQuery = convQuery.eq('account_id', account.id);
          }

          const convRes = await convQuery;
          if (!convRes.error && convRes.data) {
            convData = convRes.data;
          }
        } catch (e) {
          console.warn('[analytics] client conversations fallback err:', e);
        }

        const filter: DateRangeFilter = {
          preset: rangePreset,
          from: customFrom ? new Date(customFrom).toISOString() : undefined,
          to: customTo ? new Date(customTo).toISOString() : undefined,
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
    } catch (err) {
      console.error('[analytics page] fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [rangePreset, customFrom, customTo, selectedAdFilter, supabase, account?.id]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Copy script handler
  const handleCopyScript = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedScript(true);
    toast.success('कॉलिंग स्क्रिप्ट कॉपी हो गई!');
    setTimeout(() => setCopiedScript(false), 2000);
  };

  // Export filtered leads to CSV
  const handleExportCsv = () => {
    if (!summary || summary.leads.length === 0) {
      toast.error('एक्सपोर्ट के लिए कोई डेटा नहीं है');
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
      'Drop-off Reason (क्या कमी रही)',
      'Calling Pitch Script (कैसे पिच करें)',
      'Booking Status',
      'Consultation Type',
      'Clinic Branch',
      'Date & Time',
      'Created At',
    ];

    const rows = summary.leads.map((l: AnalyticsLeadItem) => [
      `"${(l.name || '').replace(/"/g, '""')}"`,
      `"${(l.phone || '').replace(/"/g, '""')}"`,
      `"${(l.city || '').replace(/"/g, '""')}"`,
      `"${(l.ad_name || 'Direct / Organic').replace(/"/g, '""')}"`,
      `"${(l.ad_id || '').replace(/"/g, '""')}"`,
      `"${(l.health_concern || 'General').replace(/"/g, '""')}"`,
      `"${(l.ai_analysis?.intent_label || 'Normal').replace(/"/g, '""')}"`,
      `"${(l.ai_analysis?.dropout_reason || '').replace(/"/g, '""')}"`,
      `"${(l.ai_analysis?.calling_pitch || '').replace(/"/g, '""')}"`,
      `"${l.has_booking ? 'Booked' : 'Pending'}"`,
      `"${(l.consultation_type || '').replace(/"/g, '""')}"`,
      `"${(l.clinic_location || '').replace(/"/g, '""')}"`,
      `"${l.created_at || ''}"`,
    ]);

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
    toast.success('CSV सफलतापूर्वक एक्सपोर्ट हो गई!');
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
                मेटा विज्ञापनों (Meta Ads), ड्रॉप-ऑफ कॉलिंग लीड्स, बीमारियों (Health Concerns) एवं AI पिच सुझावों का संपूर्ण विश्लेषण
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
                { key: 'all' as const, label: 'सब (All Time)' },
                { key: 'today' as const, label: 'आज (Today)' },
                { key: 'yesterday' as const, label: 'कल (Yesterday)' },
                { key: '7d' as const, label: 'पिछले 7 दिन (7 Days)' },
                { key: '30d' as const, label: 'पिछले 30 दिन (30 Days)' },
                { key: 'this_month' as const, label: 'इस महीने (This Month)' },
                { key: 'custom' as const, label: 'कस्टम (Custom)' },
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
                <SelectValue placeholder="All Ad Campaigns (सभी विज्ञापन)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Ad Campaigns (सभी विज्ञापन)</SelectItem>
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
                AI ने चैट विश्लेषण करके बताया कि किन लीड्स को तुरंत कॉल करने पर बुकिंग कंफर्म हो सकती है
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
                High Intent — गंभीर समस्या बताई, बस एक दोस्ताना फोन कॉल और 5-डॉक्टर पैनल की जरूरत है।
              </p>
              <div className="mt-2 text-[11px] text-purple-700 font-semibold flex items-center gap-1">
                क्लिक करके लीड्स देखें <ChevronRight className="h-3 w-3" />
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
                ₹499 फीस सुनकर रुक गए — इनको लाइफटाइम फ्री कंसल्टेशन या क्लिनिक पर ₹0 एडवांस पिच करें।
              </p>
              <div className="mt-2 text-[11px] text-amber-700 font-semibold flex items-center gap-1">
                क्लिक करके लीड्स देखें <ChevronRight className="h-3 w-3" />
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
                क्लिनिक ब्रांच के पास हैं — नाड़ी परीक्षण और क्लिनिक पर ही फीस देने की सुविधा पिच करें।
              </p>
              <div className="mt-2 text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                क्लिक करके लीड्स देखें <ChevronRight className="h-3 w-3" />
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
                सिर्फ सामान्य जानकारी या जिज्ञासा के लिए आए थे, अभी कोई गंभीर लक्षण साझा नहीं किए।
              </p>
              <div className="mt-2 text-[11px] text-slate-600 font-semibold flex items-center gap-1">
                क्लिक करके लीड्स देखें <ChevronRight className="h-3 w-3" />
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
            विज्ञापनों की रैंकिंग — किस Ad Campaign से सबसे ज्यादा Leads और Appointments Book हुईं
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

      {/* Middle Row: Disease Breakdown & Demographics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Health Concern / Disease Breakdown */}
        <Card className="border-slate-200 md:col-span-2">
          <CardHeader className="p-5 pb-3">
            <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Stethoscope className="h-5 w-5 text-pink-600" />
              AI Health Concern & Disease Breakdown
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              AI विश्लेषण: किस बीमारी (PCOD, ट्यूब ब्लॉकेज, इनफर्टिलिटी, स्पर्म काउंट, लो AMH) से जुड़े सबसे ज्यादा मरीज आ रहे हैं
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            {(!summary?.health_concerns || summary.health_concerns.length === 0) && (
              <div className="py-8 text-center text-slate-400 text-xs">
                No health concern data available for this range.
              </div>
            )}
            <div className="space-y-3 mt-2">
              {summary?.health_concerns?.map((item) => (
                <div key={item.category} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-800">{item.label_hi}</span>
                    <span className="text-slate-500">
                      <strong className="text-slate-900">{item.count} leads</strong> (
                      {item.percentage}%) •{' '}
                      <span className="text-emerald-600 font-semibold">
                        {item.bookings_count} Booked ({item.conversion_rate}%)
                      </span>
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden flex">
                    <div
                      className="bg-purple-600 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, item.percentage)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Demographics: Gender Ratio & Top Cities */}
        <div className="space-y-6">
          {/* Gender Ratio */}
          <Card className="border-slate-200">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1.5">
                <Users className="h-4 w-4 text-purple-600" /> Gender Ratio (महिला vs पुरुष)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-1">
              <div className="grid grid-cols-3 gap-2 text-center mt-2">
                <div className="p-2 bg-pink-50 rounded-lg border border-pink-100">
                  <span className="text-[11px] text-pink-700 font-medium">महिला (Female)</span>
                  <div className="text-lg font-bold text-pink-700">
                    {summary?.gender_stats?.female_count || 0}
                  </div>
                  <span className="text-[10px] text-slate-500">
                    {summary?.gender_stats?.female_percentage || 0}%
                  </span>
                </div>

                <div className="p-2 bg-blue-50 rounded-lg border border-blue-100">
                  <span className="text-[11px] text-blue-700 font-medium">पुरुष (Male)</span>
                  <div className="text-lg font-bold text-blue-700">
                    {summary?.gender_stats?.male_count || 0}
                  </div>
                  <span className="text-[10px] text-slate-500">
                    {summary?.gender_stats?.male_percentage || 0}%
                  </span>
                </div>

                <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-[11px] text-slate-600 font-medium">Unknown</span>
                  <div className="text-lg font-bold text-slate-700">
                    {summary?.gender_stats?.unknown_count || 0}
                  </div>
                  <span className="text-[10px] text-slate-500">
                    {summary?.gender_stats?.total
                      ? Math.round(
                          ((summary.gender_stats.unknown_count || 0) / summary.gender_stats.total) *
                            100
                        )
                      : 0}
                    %
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Top Cities */}
          <Card className="border-slate-200">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-emerald-600" /> Top Patient Cities (शीर्ष शहर)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-1">
              <div className="space-y-2 mt-1">
                {(!summary?.top_cities || summary.top_cities.length === 0) && (
                  <p className="text-xs text-slate-400">No city data available</p>
                )}
                {summary?.top_cities?.slice(0, 5).map((city, idx) => (
                  <div key={city.city} className="flex items-center justify-between text-xs">
                    <span className="text-slate-700 flex items-center gap-1.5">
                      <span className="text-[11px] font-mono text-slate-400">#{idx + 1}</span>
                      {city.city}
                      {city.has_clinic && (
                        <Badge variant="outline" className="text-[9px] bg-emerald-50 text-emerald-700 border-emerald-200">
                          Branch
                        </Badge>
                      )}
                    </span>
                    <span className="font-semibold text-slate-900">
                      {city.leads_count} leads ({city.bookings_count} booked)
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* AI Ad Strategy & Recommendations */}
      <Card className="border-purple-200 bg-purple-50/40">
        <CardHeader className="p-5 pb-2">
          <CardTitle className="text-base font-bold text-purple-900 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            AI Ad Strategy & Optimization Recommendations
          </CardTitle>
          <CardDescription className="text-xs text-purple-700">
            मरीजों के प्रश्नों व डाटा विश्लेषण के आधार पर भविष्य में कैसे और किस विषय पर विज्ञापन चलाने चाहिए:
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5 pt-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {summary?.ai_recommendations?.creative_hooks?.map((hook, i) => (
              <div
                key={hook.title + i}
                className="p-4 bg-white rounded-xl border border-purple-100 shadow-2xs space-y-2"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-purple-950 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-[11px] font-bold">
                      {i + 1}
                    </span>
                    {hook.title}
                  </h4>
                  <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700">
                    {hook.target_audience}
                  </Badge>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">{hook.angle}</p>
                <div className="p-2.5 bg-slate-50 rounded-md border border-slate-100 text-[11px] text-slate-700">
                  <strong className="text-purple-700">Hook:</strong> &ldquo;
                  {hook.hook_hindi}&rdquo;
                </div>
              </div>
            ))}
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
                हर लीड का AI कॉलिंग स्टेटस, क्या कमी रही (ड्रॉप-ऑफ कारण), एवं कॉल पर क्या बोलना है (AI Script)
              </CardDescription>
            </div>

            {/* Local Search */}
            <div className="relative w-full md:w-64">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder="Search name, phone, city, ad..."
                value={leadsSearch}
                onChange={(e) => setLeadsSearch(e.target.value)}
                className="h-8 pl-8 text-xs bg-white"
              />
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 pt-3 border-t border-slate-100">
            <span className="text-xs font-medium text-slate-500 mr-1">Filter by AI Stage:</span>
            {[
              { key: 'all', label: 'All Leads (सब)' },
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
                  <th className="py-3 px-4">Contact / Patient</th>
                  <th className="py-3 px-4">Meta Ad Campaign</th>
                  <th className="py-3 px-4">Calling Priority</th>
                  <th className="py-3 px-4">AI Dropout Reason & Pitch</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedLeads.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
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

                  return (
                    <tr key={lead.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* 1. Contact / Patient */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{lead.name || 'Unknown'}</div>
                        <div className="text-slate-500 font-mono text-[11px]">{lead.phone}</div>
                        {lead.city && (
                          <div className="text-[11px] text-purple-700 flex items-center gap-1 mt-0.5">
                            <MapPin className="h-3 w-3" /> {lead.city}
                          </div>
                        )}
                      </td>

                      {/* 2. Meta Ad Campaign */}
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-800">
                          {lead.ad_name || 'Direct / Organic'}
                        </div>
                        {lead.ad_id && (
                          <div className="text-[10px] text-slate-400 font-mono">ID: {lead.ad_id}</div>
                        )}
                        {lead.health_concern && (
                          <Badge variant="outline" className="text-[10px] mt-1 bg-purple-50 text-purple-700">
                            {lead.health_concern}
                          </Badge>
                        )}
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
                          {lead.ai_analysis?.dropout_reason || 'कोई ड्रॉप-ऑफ नहीं'}
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setScriptModalLead(lead)}
                            className="h-6 px-2 text-[11px] gap-1 text-purple-700 border-purple-200 hover:bg-purple-50"
                          >
                            <PhoneCall className="h-3 w-3" />
                            📞 AI Script देखें
                          </Button>
                        </div>
                      </td>

                      {/* 5. Status */}
                      <td className="py-3 px-4 text-center">
                        {isBooked ? (
                          <Badge className="bg-emerald-600 text-white text-[11px]">Confirmed</Badge>
                        ) : (
                          <Badge variant="outline" className="text-amber-700 bg-amber-50 text-[11px]">
                            Pending
                          </Badge>
                        )}
                      </td>

                      {/* 6. Action */}
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

      {/* Calling Script Popup Dialog */}
      <Dialog open={!!scriptModalLead} onOpenChange={(open) => !open && setScriptModalLead(null)}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          {scriptModalLead && (
            <div className="space-y-4">
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-purple-100 text-purple-700 rounded-lg">
                    <PhoneCall className="h-5 w-5" />
                  </div>
                  <div>
                    <DialogTitle className="text-lg font-bold text-slate-900">
                      Telecalling Script & Lead Intelligence
                    </DialogTitle>
                    <DialogDescription className="text-xs text-slate-500">
                      मरीज की चैट विश्लेषण, ड्रॉप-ऑफ का कारण एवं कॉल पर क्या बोलना है
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              {/* Patient Info Card */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-500">मरीज का नाम:</span>
                  <div className="font-bold text-slate-900">{scriptModalLead.name || 'Unknown'}</div>
                </div>
                <div>
                  <span className="text-slate-500">फोन नंबर:</span>
                  <div className="font-bold text-purple-700 flex items-center gap-1">
                    <a href={`tel:${scriptModalLead.phone}`} className="hover:underline">
                      {scriptModalLead.phone}
                    </a>
                  </div>
                </div>
                <div>
                  <span className="text-slate-500">शहर / लोकेशन:</span>
                  <div className="font-semibold text-slate-800">{scriptModalLead.city || 'जानकारी नहीं'}</div>
                </div>
                <div>
                  <span className="text-slate-500">बीमारी / समस्या:</span>
                  <div className="font-semibold text-pink-700">{scriptModalLead.health_concern || 'General'}</div>
                </div>
              </div>

              {/* Dropout Reason Analysis */}
              <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 text-xs space-y-1">
                <div className="font-bold text-amber-900 flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  क्या कमी रही (Why Did Lead Drop Off?):
                </div>
                <p className="text-amber-800 leading-relaxed font-medium">
                  {scriptModalLead.ai_analysis?.dropout_reason || 'कोई विशेष ड्रॉप-ऑफ संकेत नहीं मिला।'}
                </p>
              </div>

              {/* Telecaller Script */}
              <div className="p-4 bg-purple-50/70 rounded-xl border border-purple-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-xs text-purple-950 flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-purple-600" />
                    कॉल पर बोलने वाली पिच (Telecalling Script):
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopyScript(scriptModalLead.ai_analysis?.calling_pitch || '')}
                    className="h-7 text-xs gap-1 border-purple-300 text-purple-700 hover:bg-purple-100"
                  >
                    {copiedScript ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {copiedScript ? 'कॉपी हो गया' : 'Copy Script'}
                  </Button>
                </div>

                <div className="p-3 bg-white rounded-lg border border-purple-100 text-xs text-slate-800 leading-relaxed whitespace-pre-line font-normal">
                  {scriptModalLead.ai_analysis?.calling_pitch}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setScriptModalLead(null)}
                >
                  बंद करें (Close)
                </Button>
                <Button
                  size="sm"
                  onClick={() => router.push(`/inbox?contactId=${scriptModalLead.id}`)}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  <MessageSquare className="h-4 w-4 mr-1.5" />
                  Chat पर जाएं
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
