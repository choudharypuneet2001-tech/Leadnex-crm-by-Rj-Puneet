"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  BarChart3,
  Building2,
  Calendar,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  ExternalLink,
  Filter,
  Lightbulb,
  MapPin,
  Megaphone,
  MessageSquare,
  Phone,
  RefreshCw,
  Search,
  Sparkles,
  Stethoscope,
  TrendingUp,
  User,
  Users,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import type {
  AnalyticsDateRangePreset,
  AnalyticsLeadItem,
  AnalyticsSummary,
} from "@/lib/analytics/types";

export default function AnalyticsPage() {
  const router = useRouter();
  const { account } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  // State
  const [rangePreset, setRangePreset] = useState<AnalyticsDateRangePreset>("all");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");
  const [selectedAdFilter, setSelectedAdFilter] = useState<string>("all");
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Leads table local search & status filter
  const [leadsSearch, setLeadsSearch] = useState<string>("");
  const [leadsStatusFilter, setLeadsStatusFilter] = useState<"all" | "booked" | "pending">("all");

  // Fetch analytics summary from API
  const fetchAnalytics = useCallback(async () => {
    try {
      setRefreshing(true);
      const params = new URLSearchParams();
      params.set("range", rangePreset);
      if (rangePreset === "custom") {
        if (customFrom) params.set("from", new Date(customFrom).toISOString());
        if (customTo) {
          const toDate = new Date(customTo);
          toDate.setHours(23, 59, 59, 999);
          params.set("to", toDate.toISOString());
        }
      }
      if (selectedAdFilter && selectedAdFilter !== "all") {
        params.set("ad_name", selectedAdFilter);
      }

      const res = await fetch(`/api/analytics?${params.toString()}`);
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to load analytics");
      }

      setSummary(json.data);
    } catch (err) {
      console.error("[analytics page] fetch error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to load analytics");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [rangePreset, customFrom, customTo, selectedAdFilter]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Export filtered leads to CSV
  const handleExportCsv = useCallback(() => {
    if (!summary || summary.leads.length === 0) {
      toast.error("No leads to export for this selection");
      return;
    }

    const headers = [
      "Lead Date & Time",
      "Patient Name",
      "Gender",
      "Phone Number",
      "City",
      "Meta Ad Campaign",
      "Meta Ad ID",
      "Health Concern / Disease",
      "Concern Category",
      "Booking Status",
      "Booking Query ID",
      "Consultation Mode",
      "Clinic Location",
      "Follow-up Notes",
    ];

    const rows = summary.leads.map((l) => [
      new Date(l.created_at).toLocaleString("en-IN"),
      l.name,
      l.gender,
      l.phone,
      l.city || "",
      l.ad_name || "Direct / Organic WhatsApp",
      l.ad_id || "",
      l.health_concern || "",
      l.concern_category,
      l.has_booking ? "Booking Confirmed" : "Booking Pending (Follow-up)",
      l.booking_query_id || "",
      l.consultation_type === "clinic_visit" ? "Clinic Visit" : l.has_booking ? "Video Consultation" : "",
      l.clinic_location || "",
      l.notes || "",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [
        headers.join(","),
        ...rows.map((r) =>
          r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
        ),
      ].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    const todayStr = new Date().toISOString().slice(0, 10);
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `gynocci_leads_analytics_${rangePreset}_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${summary.leads.length} leads to CSV`);
  }, [summary, rangePreset]);

  // Handle open conversation in Inbox
  const handleOpenInbox = async (lead: AnalyticsLeadItem) => {
    if (lead.conversation_id) {
      router.push(`/inbox?c=${lead.conversation_id}`);
      return;
    }

    if (lead.phone) {
      try {
        const digits = lead.phone.replace(/\D/g, "");
        const last10 = digits.slice(-10);
        const { data: contacts } = await supabase
          .from("contacts")
          .select("id")
          .ilike("phone", `%${last10}%`)
          .limit(1);

        if (contacts && contacts[0]) {
          const { data: conv } = await supabase
            .from("conversations")
            .select("id")
            .eq("contact_id", contacts[0].id)
            .order("last_message_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (conv?.id) {
            router.push(`/inbox?c=${conv.id}`);
            return;
          }
        }
      } catch (err) {
        console.warn("[analytics] inbox lookup failed:", err);
      }
    }

    router.push("/inbox");
  };

  // Filtered Leads for the table
  const tableLeads = useMemo(() => {
    if (!summary?.leads) return [];
    const q = leadsSearch.trim().toLowerCase();

    return summary.leads.filter((l) => {
      if (leadsStatusFilter === "booked" && !l.has_booking) return false;
      if (leadsStatusFilter === "pending" && l.has_booking) return false;

      if (!q) return true;

      return (
        l.name.toLowerCase().includes(q) ||
        l.phone.includes(q) ||
        (l.city && l.city.toLowerCase().includes(q)) ||
        (l.ad_name && l.ad_name.toLowerCase().includes(q)) ||
        (l.health_concern && l.health_concern.toLowerCase().includes(q)) ||
        (l.concern_category && l.concern_category.toLowerCase().includes(q)) ||
        (l.booking_query_id && l.booking_query_id.toLowerCase().includes(q))
      );
    });
  }, [summary?.leads, leadsSearch, leadsStatusFilter]);

  // Copy ad hook to clipboard
  const handleCopyHook = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Ad Hook copied to clipboard!");
  };

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-xs">
            <BarChart3 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              Analytics & Ad Performance
              <Badge variant="outline" className="text-xs bg-primary/5 text-primary border-primary/20">
                Gynocci Intelligence
              </Badge>
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              मेटा विज्ञापनों (Meta Ads), बीमारियों (Health Concerns), शहरों एवं AI विज्ञापन सुझावों का संपूर्ण विश्लेषण
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAnalytics}
            disabled={refreshing}
            className="h-9 gap-1.5 shadow-xs"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={handleExportCsv}
            disabled={!summary || summary.leads.length === 0}
            className="h-9 gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-xs"
          >
            <Download className="h-4 w-4" />
            Export CSV ({summary?.leads.length || 0})
          </Button>
        </div>
      </div>

      {/* Date Range & Ad Filter Controls */}
      <Card className="shadow-xs border-border/80">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* Date Preset Buttons */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mr-1 flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" /> Date:
              </span>
              {[
                { id: "today", label: "आज (Today)" },
                { id: "yesterday", label: "कल (Yesterday)" },
                { id: "7d", label: "पिछले 7 दिन (7 Days)" },
                { id: "30d", label: "पिछले 30 दिन (30 Days)" },
                { id: "this_month", label: "इस महीने (This Month)" },
                { id: "all", label: "सब (All Time)" },
                { id: "custom", label: "कस्टम (Custom)" },
              ].map((p) => {
                const isActive = rangePreset === p.id;
                return (
                  <Button
                    key={p.id}
                    variant={isActive ? "default" : "outline"}
                    size="sm"
                    className={`h-8 text-xs transition-all ${
                      isActive
                        ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    onClick={() => setRangePreset(p.id as AnalyticsDateRangePreset)}
                  >
                    {p.label}
                  </Button>
                );
              })}
            </div>

            {/* Ad Campaign Dropdown Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Megaphone className="h-3.5 w-3.5" /> Ad Filter:
              </span>
              <select
                value={selectedAdFilter}
                onChange={(e) => setSelectedAdFilter(e.target.value)}
                className="h-8 rounded-lg border border-input bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
              >
                <option value="all">All Ad Campaigns (सभी विज्ञापन)</option>
                {summary?.ad_performance.map((ad, idx) => (
                  <option key={idx} value={ad.ad_name}>
                    {ad.ad_name} ({ad.leads_count} leads, {ad.bookings_count} booked)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Custom Date Range Picker when "custom" is active */}
          {rangePreset === "custom" && (
            <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border/60">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">From Date:</span>
                <Input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="h-8 w-36 text-xs"
                />
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">To Date:</span>
                <Input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="h-8 w-36 text-xs"
                />
              </div>
              <Button
                size="sm"
                className="h-8 text-xs bg-primary text-primary-foreground"
                onClick={fetchAnalytics}
              >
                Apply Date Range
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top 5 KPI Summary Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Total Leads</span>
            <Users className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">
            {summary?.total_leads ?? 0}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
            {summary?.date_range_label || "All Leads received"}
          </p>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Total Bookings</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {summary?.total_bookings ?? 0}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Confirmed consultations
          </p>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Conversion Rate</span>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-blue-600 dark:text-blue-400">
            {summary?.conversion_rate ?? 0}%
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Leads to booked ratio
          </p>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Clinic Visits</span>
            <Building2 className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-600 dark:text-amber-400">
            {summary?.clinic_visits ?? 0}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            vs {summary?.video_consultations ?? 0} Video Calls
          </p>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-xs col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Meta Ad Leads</span>
            <Megaphone className="h-4 w-4 text-purple-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-purple-600 dark:text-purple-400">
            {summary?.meta_ad_leads ?? 0}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {summary?.organic_leads ?? 0} Direct / Organic
          </p>
        </div>
      </div>

      {/* SECTION 1: Meta Ad Campaigns Leaderboard (कौनसे Ad से सबसे ज्यादा Leads व Bookings आई) */}
      <Card className="shadow-xs">
        <CardHeader className="pb-3 border-b border-border/60">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-purple-500" />
                Meta Ads Performance & Attribution Leaderboard
              </CardTitle>
              <CardDescription className="text-xs">
                विज्ञापनों की रैंकिंग — किस Ad Campaign से सबसे ज्यादा Leads और Appointments Book हुईं
              </CardDescription>
            </div>
            {selectedAdFilter !== "all" && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-primary h-7"
                onClick={() => setSelectedAdFilter("all")}
              >
                Clear Ad Filter
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              Loading Meta Ad attribution data...
            </div>
          ) : !summary || summary.ad_performance.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              No Meta Ad attribution found for this date range.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[50px] text-center">#</TableHead>
                    <TableHead className="min-w-[220px]">Meta Ad Name / Campaign</TableHead>
                    <TableHead className="text-center">Total Leads</TableHead>
                    <TableHead className="text-center">Bookings Done</TableHead>
                    <TableHead className="min-w-[140px]">Conversion Rate</TableHead>
                    <TableHead>Top Concern Inquired</TableHead>
                    <TableHead>Top City</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.ad_performance.map((ad, idx) => {
                    const isSelected = selectedAdFilter === ad.ad_name;
                    return (
                      <TableRow
                        key={idx}
                        className={`transition-colors ${
                          isSelected ? "bg-primary/10 hover:bg-primary/15" : "hover:bg-muted/50"
                        }`}
                      >
                        <TableCell className="text-center font-bold text-xs text-muted-foreground">
                          {idx + 1}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-xs text-foreground flex items-center gap-1.5">
                            <span className="truncate max-w-[260px]">{ad.ad_name}</span>
                            {isSelected && (
                              <Badge variant="secondary" className="text-[10px] h-4 px-1 bg-primary/20 text-primary">
                                Active Filter
                              </Badge>
                            )}
                          </div>
                          {ad.ad_id && (
                            <p className="text-[10px] text-muted-foreground font-mono">
                              ID: {ad.ad_id}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="text-center font-bold text-xs">
                          {ad.leads_count}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="inline-flex items-center justify-center font-bold text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                            {ad.bookings_count}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-semibold text-foreground">
                                {ad.conversion_rate}%
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {ad.clinic_visits} clinic / {ad.video_consultations} video
                              </span>
                            </div>
                            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full"
                                style={{ width: `${Math.min(ad.conversion_rate, 100)}%` }}
                              />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          <Badge variant="outline" className="text-[11px] font-normal">
                            {ad.top_concern}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {ad.top_city}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant={isSelected ? "default" : "outline"}
                            size="sm"
                            className="h-7 text-xs px-2.5"
                            onClick={() =>
                              setSelectedAdFilter(isSelected ? "all" : ad.ad_name)
                            }
                          >
                            <Filter className="h-3 w-3 mr-1" />
                            {isSelected ? "Remove Filter" : "Filter Leads"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* SECTION 2: AI Health Concern / Disease Breakdown (AI Analyzation: सबसे ज्यादा कौनसी बीमारी से मरीज आ रहे हैं) */}
      <Card className="shadow-xs">
        <CardHeader className="pb-3 border-b border-border/60">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Stethoscope className="h-4 w-4 text-pink-500" />
                AI Health Concern & Disease Breakdown
              </CardTitle>
              <CardDescription className="text-xs">
                AI विश्लेषण: किस बीमारी (PCOD, ट्यूब ब्लॉकेज, इनफर्टिलिटी, स्पर्म काउंट, लो AMH) से जुड़े सबसे ज्यादा मरीज आ रहे हैं
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          {loading ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              Analyzing patient health inquiries...
            </div>
          ) : !summary || summary.health_concerns.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              No health concern data available for this range.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {summary.health_concerns.map((hc, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-border/80 bg-card p-4 hover:border-primary/40 transition-colors shadow-2xs space-y-2.5"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-semibold text-xs text-foreground">
                        {hc.category}
                      </h4>
                      <p className="text-[11px] text-muted-foreground font-medium">
                        {hc.label_hi}
                      </p>
                    </div>
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
                      style={{ backgroundColor: hc.color }}
                    >
                      {hc.count} queries
                    </span>
                  </div>

                  {/* Progress bar for share */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>Share of Total Queries:</span>
                      <span className="font-semibold text-foreground">{hc.percentage}%</span>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          backgroundColor: hc.color,
                          width: `${Math.min(hc.percentage, 100)}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Conversion pill */}
                  <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[11px]">
                    <span className="text-muted-foreground">Appointments Booked:</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      {hc.bookings_count} ({hc.conversion_rate}% Conv.)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* SECTION 3: Two Columns: Left = Gender Ratio (Male vs Female), Right = Top Cities (शीर्ष शहर) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Gender Ratio (4 cols) */}
        <Card className="lg:col-span-5 shadow-xs flex flex-col">
          <CardHeader className="pb-3 border-b border-border/60">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <User className="h-4 w-4 text-blue-500" />
              Patient Gender Ratio (जेंडर अनुपात)
            </CardTitle>
            <CardDescription className="text-xs">
              महिला एवं पुरुष पेशेंट्स का अनुपात (Inquirers Demographics)
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 flex-1 flex flex-col justify-between space-y-4">
            <div className="space-y-4">
              {/* Dual Visual Bar */}
              <div className="h-5 w-full bg-muted rounded-full overflow-hidden flex shadow-inner">
                <div
                  className="bg-pink-500 h-full flex items-center justify-center text-[10px] font-bold text-white transition-all"
                  style={{ width: `${summary?.gender_stats.female_percentage ?? 80}%` }}
                >
                  {(summary?.gender_stats.female_percentage ?? 0) > 15
                    ? `♀ ${summary?.gender_stats.female_percentage}%`
                    : ""}
                </div>
                <div
                  className="bg-blue-500 h-full flex items-center justify-center text-[10px] font-bold text-white transition-all"
                  style={{ width: `${summary?.gender_stats.male_percentage ?? 20}%` }}
                >
                  {(summary?.gender_stats.male_percentage ?? 0) > 15
                    ? `♂ ${summary?.gender_stats.male_percentage}%`
                    : ""}
                </div>
              </div>

              {/* Female Card */}
              <div className="flex items-center justify-between p-3 rounded-lg border border-pink-500/20 bg-pink-500/5">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-full bg-pink-500/10 text-pink-600 dark:text-pink-400 flex items-center justify-center font-bold text-sm">
                    ♀
                  </div>
                  <div>
                    <h5 className="font-semibold text-xs text-foreground">Female Patients (महिलाएं)</h5>
                    <p className="text-[11px] text-muted-foreground">Direct patient inquiries</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-base font-bold text-pink-600 dark:text-pink-400">
                    {summary?.gender_stats.female_count ?? 0}
                  </span>
                  <p className="text-[10px] text-muted-foreground">
                    {summary?.gender_stats.female_percentage ?? 0}%
                  </p>
                </div>
              </div>

              {/* Male Card */}
              <div className="flex items-center justify-between p-3 rounded-lg border border-blue-500/20 bg-blue-500/5">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-sm">
                    ♂
                  </div>
                  <div>
                    <h5 className="font-semibold text-xs text-foreground">Male Inquirers (पति / पुरुष)</h5>
                    <p className="text-[11px] text-muted-foreground">Husband / couple inquiries</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-base font-bold text-blue-600 dark:text-blue-400">
                    {summary?.gender_stats.male_count ?? 0}
                  </span>
                  <p className="text-[10px] text-muted-foreground">
                    {summary?.gender_stats.male_percentage ?? 0}%
                  </p>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-muted/50 border border-border/40 text-[11px] text-muted-foreground leading-relaxed">
              💡 <strong>AI Demographic Insight:</strong> गायनोकी में अधिकांश लीड्स सीधे महिला पेशेंट्स की हैं, जबकि लगभग {summary?.gender_stats.male_percentage ?? 15}% लीड्स पतियों द्वारा अपनी पत्नी के इनफर्टिलिटी या ट्यूब ब्लॉकेज इलाज के लिए आ रही हैं।
            </div>
          </CardContent>
        </Card>

        {/* Right Column: Top Cities (7 cols) */}
        <Card className="lg:col-span-7 shadow-xs flex flex-col">
          <CardHeader className="pb-3 border-b border-border/60">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <MapPin className="h-4 w-4 text-emerald-500" />
              Top Cities Breakdown (शीर्ष शहर एवं क्लीनिक निकटता)
            </CardTitle>
            <CardDescription className="text-xs">
              किन शहरों से सबसे ज्यादा लीड्स आ रही हैं और क्या वहां गायनोकी की क्लीनिक शाखा मौजूद है
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 flex-1">
            {loading ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                Loading city analytics...
              </div>
            ) : !summary || summary.top_cities.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                No city data available for this range.
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-[40px] text-center">#</TableHead>
                      <TableHead>City Name (शहर)</TableHead>
                      <TableHead className="text-center">Leads</TableHead>
                      <TableHead className="text-center">Bookings</TableHead>
                      <TableHead>Mode Split</TableHead>
                      <TableHead className="text-right">Clinic Availability</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.top_cities.slice(0, 10).map((city, idx) => (
                      <TableRow key={idx} className="hover:bg-muted/50 text-xs">
                        <TableCell className="text-center font-bold text-muted-foreground">
                          {idx + 1}
                        </TableCell>
                        <TableCell className="font-semibold text-foreground">
                          {city.city}
                        </TableCell>
                        <TableCell className="text-center font-medium">
                          {city.leads_count}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">
                            {city.bookings_count} ({city.conversion_rate}%)
                          </span>
                        </TableCell>
                        <TableCell className="text-[11px] text-muted-foreground whitespace-nowrap">
                          {city.clinic_visits > 0 && (
                            <span className="text-amber-600 dark:text-amber-400 font-medium mr-1.5">
                              {city.clinic_visits} Clinic
                            </span>
                          )}
                          {city.video_consultations > 0 && (
                            <span className="text-blue-600 dark:text-blue-400 font-medium">
                              {city.video_consultations} Video
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          {city.has_clinic ? (
                            <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20 text-[10px] font-medium">
                              🏥 Clinic Branch
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
                              📹 Video Consult
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* SECTION 4: AI Marketing & Ad Campaign Recommendations Engine (kis tarah ke ads chalane chaiye) */}
      <Card className="shadow-xs border-primary/20 bg-gradient-to-br from-primary/[0.03] via-card to-card">
        <CardHeader className="pb-3 border-b border-border/60">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2 text-foreground">
                <Sparkles className="h-5 w-5 text-primary" />
                AI Ad Campaign Strategist & Marketing Recommendations
              </CardTitle>
              <CardDescription className="text-xs">
                मेटा (Facebook & Instagram) पर कौनसे ऐड्स चलाएं, कौनसी हेडलाइन्स व हुक्स सबसे ज्यादा रिजल्ट देंगे — संपूर्ण AI रिपोर्ट
              </CardDescription>
            </div>
            <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">
              AI Powered Strategy
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-5 space-y-5">
          {summary?.ai_recommendations ? (
            <>
              {/* Executive Summary & Budget Advice */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-primary/20 bg-background/80 shadow-2xs space-y-2">
                  <h4 className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                    Winning Health Concern (सर्वाधिक कन्वर्शन)
                  </h4>
                  <div className="text-sm font-bold text-primary">
                    {summary.ai_recommendations.winning_concern} (
                    {summary.ai_recommendations.winning_conversion_rate}% Conversion)
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {summary.ai_recommendations.budget_advice}
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-border bg-background/80 shadow-2xs space-y-2">
                  <h4 className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 text-amber-500" />
                    Target Cities Strategy (भूगोल एवं विज्ञापन विस्तार)
                  </h4>
                  <div className="text-xs font-semibold text-foreground">
                    High-Intent Cities:{" "}
                    <span className="text-muted-foreground font-normal">
                      {summary.ai_recommendations.high_intent_cities.join(", ") || "Jaipur, Delhi, Lucknow, Punjab"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {summary.ai_recommendations.summary}
                  </p>
                </div>
              </div>

              {/* Ready-to-use Meta Ad Creative Hooks in Hindi */}
              <div className="space-y-3">
                <h4 className="font-semibold text-xs text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Lightbulb className="h-4 w-4 text-amber-500" />
                  3 High-Converting Meta Ad Creative Hooks (हिंदी विज्ञापन कॉपी):
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {summary.ai_recommendations.creative_hooks.map((hook, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl border border-border/80 bg-background p-4 shadow-2xs flex flex-col justify-between space-y-3 hover:border-primary/40 transition-colors"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                            Angle {idx + 1}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="h-6 w-6 text-muted-foreground hover:text-foreground"
                            onClick={() => handleCopyHook(`${hook.hook_hindi}\n\n${hook.body_hindi}`)}
                            title="Copy Ad Copy"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>

                        <h5 className="font-bold text-xs text-foreground leading-snug">
                          {hook.title}
                        </h5>

                        <div className="p-2.5 rounded-lg bg-muted/60 border border-border/40 text-xs font-medium text-foreground">
                          "{hook.hook_hindi}"
                        </div>

                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {hook.body_hindi}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-border/40 space-y-1.5 text-[11px]">
                        <div className="text-emerald-700 dark:text-emerald-300 font-medium">
                          📲 CTA: {hook.recommended_cta}
                        </div>
                        <div className="text-muted-foreground text-[10px]">
                          🎯 Audience: {hook.target_audience}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="p-6 text-center text-xs text-muted-foreground">
              Generating AI recommendations...
            </div>
          )}
        </CardContent>
      </Card>

      {/* SECTION 5: Filtered Leads List Table (तारीख और विज्ञापन अनुसार पूरी लीड्स सूची + Export CSV) */}
      <Card className="shadow-xs">
        <CardHeader className="pb-3 border-b border-border/60">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Filtered Leads Table ({tableLeads.length} Leads)
              </CardTitle>
              <CardDescription className="text-xs">
                चयनित दिनांक और विज्ञापन अनुसार लीड्स की सूची — एक क्लिक में इनबॉक्स चैट खोलें या CSV डाउनलोड करें
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search name, phone, city, concern..."
                  value={leadsSearch}
                  onChange={(e) => setLeadsSearch(e.target.value)}
                  className="h-8 w-48 sm:w-64 pl-8 text-xs"
                />
              </div>

              {/* Status Filter */}
              <div className="flex items-center rounded-lg bg-muted/60 p-0.5 border border-border/60">
                <button
                  className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                    leadsStatusFilter === "all"
                      ? "bg-background text-foreground shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => setLeadsStatusFilter("all")}
                >
                  All ({summary?.leads.length || 0})
                </button>
                <button
                  className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                    leadsStatusFilter === "booked"
                      ? "bg-background text-emerald-600 dark:text-emerald-400 shadow-2xs font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => setLeadsStatusFilter("booked")}
                >
                  Booked ({summary?.total_bookings || 0})
                </button>
                <button
                  className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                    leadsStatusFilter === "pending"
                      ? "bg-background text-amber-600 dark:text-amber-400 shadow-2xs font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => setLeadsStatusFilter("pending")}
                >
                  Pending ({(summary?.total_leads ?? 0) - (summary?.total_bookings ?? 0)})
                </button>
              </div>

              {/* Table level CSV Export */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCsv}
                disabled={tableLeads.length === 0}
                className="h-8 gap-1 text-xs shadow-xs"
              >
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              Loading leads table...
            </div>
          ) : tableLeads.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              No leads found matching your criteria.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[125px]">Date & Time</TableHead>
                    <TableHead className="min-w-[170px]">Patient Name</TableHead>
                    <TableHead className="min-w-[140px]">Phone Number</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead className="min-w-[180px]">Meta Ad Campaign</TableHead>
                    <TableHead className="min-w-[170px]">Health Concern</TableHead>
                    <TableHead className="min-w-[140px]">Booking Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableLeads.map((lead) => {
                    const phoneDigits = lead.phone.replace(/\D/g, "");
                    const waUrl = `https://wa.me/${phoneDigits}`;

                    return (
                      <TableRow key={lead.id} className="hover:bg-muted/50 transition-colors text-xs">
                        {/* Date */}
                        <TableCell className="text-muted-foreground whitespace-nowrap">
                          {new Date(lead.created_at).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </TableCell>

                        {/* Patient Name */}
                        <TableCell>
                          <div className="flex items-center gap-1.5 font-semibold text-foreground">
                            <span>{lead.name}</span>
                            <span
                              className={`text-[10px] px-1 rounded-sm font-bold ${
                                lead.gender === "female"
                                  ? "bg-pink-500/10 text-pink-600 dark:text-pink-400"
                                  : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                              }`}
                            >
                              {lead.gender === "female" ? "♀" : "♂"}
                            </span>
                          </div>
                        </TableCell>

                        {/* Phone with WhatsApp & Call */}
                        <TableCell>
                          <div className="font-mono text-muted-foreground">{lead.phone}</div>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px]">
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-0.5"
                            >
                              WhatsApp
                            </a>
                            <span className="text-muted-foreground/40">•</span>
                            <a
                              href={`tel:${lead.phone}`}
                              className="text-primary hover:underline flex items-center gap-0.5"
                            >
                              Call
                            </a>
                          </div>
                        </TableCell>

                        {/* City */}
                        <TableCell>
                          {lead.city ? (
                            <span className="inline-flex items-center gap-1 text-foreground">
                              <MapPin className="h-3 w-3 text-muted-foreground" />
                              {lead.city}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/60 italic">Not shared</span>
                          )}
                        </TableCell>

                        {/* Meta Ad */}
                        <TableCell>
                          {lead.ad_name ? (
                            <div>
                              <Badge
                                variant="outline"
                                className="text-[11px] font-medium bg-purple-500/5 text-purple-700 dark:text-purple-300 border-purple-500/20 max-w-[200px] truncate"
                              >
                                📢 {lead.ad_name}
                              </Badge>
                              {lead.ad_id && (
                                <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                                  ID: {lead.ad_id}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground/70 text-[11px]">
                              Direct / Organic
                            </span>
                          )}
                        </TableCell>

                        {/* Health Concern */}
                        <TableCell>
                          <Badge variant="secondary" className="text-[11px] font-normal mb-0.5">
                            {lead.concern_category}
                          </Badge>
                          {lead.health_concern && (
                            <p className="text-[11px] text-muted-foreground line-clamp-1">
                              {lead.health_concern}
                            </p>
                          )}
                        </TableCell>

                        {/* Booking Status */}
                        <TableCell>
                          {lead.has_booking ? (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 className="h-3.5 w-3.5" /> Confirmed
                              </span>
                              {lead.booking_query_id && (
                                <p
                                  onClick={() => router.push("/bookings")}
                                  className="text-[11px] font-mono text-primary font-medium hover:underline cursor-pointer flex items-center gap-0.5"
                                  title="View in Bookings"
                                >
                                  {lead.booking_query_id}
                                  <ExternalLink className="h-2.5 w-2.5" />
                                </p>
                              )}
                              {lead.consultation_type && (
                                <span className="text-[10px] text-muted-foreground block">
                                  {lead.consultation_type === "clinic_visit"
                                    ? "🏥 Clinic Visit"
                                    : "📹 Video Call"}
                                </span>
                              )}
                            </div>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-[11px] text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/5"
                            >
                              ⏳ Pending Follow-up
                            </Badge>
                          )}
                        </TableCell>

                        {/* Action: Open Inbox */}
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1 border-primary/20 text-primary hover:bg-primary/10"
                            onClick={() => handleOpenInbox(lead)}
                          >
                            <MessageSquare className="h-3 w-3" />
                            Chat in Inbox
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
