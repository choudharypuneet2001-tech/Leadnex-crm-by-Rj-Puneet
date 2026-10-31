"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { isSuperAdminEmail } from "@/lib/auth/roles";
import {
  Building2,
  Copy,
  Check,
  Search,
  MessageSquare,
  Bot,
  Users,
  ShieldCheck,
  Calendar,
  Sparkles,
  Radio,
  ExternalLink,
  Loader2,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface CompanyItem {
  id: string;
  name: string;
  createdAt: string;
  owner: {
    name: string | null;
    email: string;
  } | null;
  memberCount: number;
  contactsCount: number;
  conversationsCount: number;
  whatsapp: {
    connected: boolean;
    phoneNumberId?: string;
    wabaId?: string;
  };
  ai: {
    configured: boolean;
    provider?: string;
    model?: string;
    isActive?: boolean;
    autoReply?: boolean;
  };
}

interface SummaryData {
  totalCompanies: number;
  activeWhatsApp: number;
  activeAi: number;
  totalContacts: number;
  totalConversations: number;
}

export default function CompaniesPage() {
  const { profile, profileLoading } = useAuth();
  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const isSuperAdmin = useMemo(
    () => isSuperAdminEmail(profile?.email),
    [profile?.email]
  );

  const fetchCompanies = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/companies");
      if (!res.ok) {
        throw new Error("Failed to load companies");
      }
      const data = await res.json();
      setCompanies(data.companies || []);
      setSummary(data.summary || null);
    } catch (err) {
      toast.error("Failed to load companies data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin) {
      fetchCompanies();
    }
  }, [isSuperAdmin]);

  const copyToClipboard = (id: string, name: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    toast.success(`Copied Company ID for ${name}`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredCompanies = useMemo(() => {
    if (!search.trim()) return companies;
    const q = search.toLowerCase().trim();
    return companies.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        (c.owner?.email && c.owner.email.toLowerCase().includes(q)) ||
        (c.owner?.name && c.owner.name.toLowerCase().includes(q)) ||
        (c.whatsapp.phoneNumberId && c.whatsapp.phoneNumberId.includes(q))
    );
  }, [companies, search]);

  if (profileLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-3 text-center">
        <ShieldCheck className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Super Admin Access Only</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          This portal is reserved for the platform owner to monitor all onboarded
          companies and their service statuses.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Building2 className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Companies & Brands</h1>
            <Badge variant="secondary" className="font-mono text-xs">
              Super Admin View
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Monitor all companies using your SaaS platform, their unique Company IDs, and active integrations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchCompanies}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI Stats */}
      {summary && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Companies
              </CardTitle>
              <Building2 className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalCompanies}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Registered workspaces
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                WhatsApp Active
              </CardTitle>
              <Radio className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {summary.activeWhatsApp} / {summary.totalCompanies}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Connected Cloud APIs
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                AI Agents Live
              </CardTitle>
              <Bot className="h-4 w-4 text-indigo-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                {summary.activeAi} / {summary.totalCompanies}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Auto-reply bots enabled
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Platform Activity
              </CardTitle>
              <Users className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {summary.totalContacts} <span className="text-sm font-normal text-muted-foreground">contacts</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {summary.totalConversations} active chat threads
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Helpful SaaS Diagnostic Note */}
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm text-foreground">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
          <div className="space-y-1">
            <p className="font-semibold text-primary">
              Troubleshooting & Support Workflow:
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Jab bhi kisi specific company (jaise Company B) ke system mein koi dikkat ya error aaye, to niche di gayi table se unka <strong>Company ID (UUID)</strong> copy karein.
              Aap mujhe (AI) ko seedha bol sakte hain: <em>&quot;Company B (ID: <code>{companies[1]?.id || "UUID"}</code>) mein webhook/reply problem aa rahi hai&quot;</em> — jisse bina kisi aur brand ke data ko chhue, seedha usi company ka diagnosis aur fix ho sakega.
            </p>
          </div>
        </div>
      </div>

      {/* Search & List */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search companies by name, email, Company ID, or Phone Number ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex h-64 items-center justify-center rounded-lg border bg-card">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredCompanies.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center rounded-lg border bg-card p-6 text-center text-muted-foreground">
            <AlertCircle className="h-8 w-8 mb-2" />
            <p className="font-medium">No companies found</p>
            <p className="text-xs">Try adjusting your search criteria.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredCompanies.map((c) => (
              <Card key={c.id} className="overflow-hidden transition-all hover:border-primary/40">
                <CardHeader className="bg-muted/30 pb-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <CardTitle className="text-base font-semibold">
                          {c.name}
                        </CardTitle>
                        {c.whatsapp.connected && (
                          <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            WhatsApp Live
                          </Badge>
                        )}
                        {c.ai.configured && (
                          <Badge variant="outline" className="border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs">
                            AI: {c.ai.provider?.toUpperCase()} ({c.ai.model})
                          </Badge>
                        )}
                        {!c.whatsapp.connected && !c.ai.configured && (
                          <Badge variant="secondary" className="text-xs">
                            New / Setup Pending
                          </Badge>
                        )}
                      </div>
                      <CardDescription className="mt-1 flex items-center gap-2 text-xs">
                        <span>Owner: <strong>{c.owner?.name || "N/A"}</strong> ({c.owner?.email || "N/A"})</span>
                        <span>•</span>
                        <span>Joined: {new Date(c.createdAt).toLocaleDateString()}</span>
                      </CardDescription>
                    </div>

                    {/* Company ID Pill with 1-Click Copy */}
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1 text-xs">
                        <span className="font-mono text-muted-foreground text-[11px]">ID:</span>
                        <code className="font-mono text-xs font-medium text-foreground">
                          {c.id}
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 ml-1 text-muted-foreground hover:text-foreground"
                          onClick={() => copyToClipboard(c.id, c.name)}
                          title="Copy Company ID"
                        >
                          {copiedId === c.id ? (
                            <Check className="h-3.5 w-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="grid gap-4 pt-4 sm:grid-cols-3">
                  {/* WhatsApp Integration Status */}
                  <div className="rounded-md border p-3 bg-card space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                        <Radio className="h-3.5 w-3.5 text-emerald-500" /> WhatsApp Cloud API
                      </span>
                      <span className={`text-[11px] font-semibold ${c.whatsapp.connected ? "text-emerald-500" : "text-muted-foreground"}`}>
                        {c.whatsapp.connected ? "Active" : "Not Connected"}
                      </span>
                    </div>
                    {c.whatsapp.connected ? (
                      <div className="space-y-0.5 text-xs text-muted-foreground">
                        <p className="truncate">
                          Phone Number ID: <span className="font-mono text-foreground font-medium">{c.whatsapp.phoneNumberId}</span>
                        </p>
                        {c.whatsapp.wabaId && (
                          <p className="truncate">
                            WABA ID: <span className="font-mono text-foreground">{c.whatsapp.wabaId}</span>
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">
                        Company has not entered Meta credentials yet.
                      </p>
                    )}
                  </div>

                  {/* AI Agent Status */}
                  <div className="rounded-md border p-3 bg-card space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                        <Bot className="h-3.5 w-3.5 text-indigo-500" /> AI Auto-Reply Agent
                      </span>
                      <span className={`text-[11px] font-semibold ${c.ai.configured ? "text-indigo-500" : "text-muted-foreground"}`}>
                        {c.ai.configured ? "Configured" : "Not Setup"}
                      </span>
                    </div>
                    {c.ai.configured ? (
                      <div className="space-y-0.5 text-xs text-muted-foreground">
                        <p>
                          Provider: <span className="font-medium text-foreground capitalize">{c.ai.provider}</span>
                        </p>
                        <p>
                          Model: <span className="font-mono text-foreground">{c.ai.model}</span>
                        </p>
                        <p>
                          Status: <span className={c.ai.isActive && c.ai.autoReply ? "text-emerald-500 font-medium" : "text-amber-500 font-medium"}>
                            {c.ai.isActive && c.ai.autoReply ? "Auto-reply live" : "Manual / Draft only"}
                          </span>
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">
                        No AI API key or system prompt set up.
                      </p>
                    )}
                  </div>

                  {/* Usage & Team Metrics */}
                  <div className="rounded-md border p-3 bg-card space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-amber-500" /> Usage & Team
                      </span>
                      <span className="text-[11px] font-medium text-muted-foreground">
                        {c.memberCount} {c.memberCount === 1 ? "user" : "users"}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div className="rounded bg-muted/50 p-1.5 text-center">
                        <div className="text-sm font-bold text-foreground">{c.contactsCount}</div>
                        <div className="text-[10px] text-muted-foreground">Contacts</div>
                      </div>
                      <div className="rounded bg-muted/50 p-1.5 text-center">
                        <div className="text-sm font-bold text-foreground">{c.conversationsCount}</div>
                        <div className="text-[10px] text-muted-foreground">Chat Threads</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
