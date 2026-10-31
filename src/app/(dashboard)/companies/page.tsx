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
  PauseCircle,
  PlayCircle,
  Trash2,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface CompanyItem {
  id: string;
  name: string;
  createdAt: string;
  status: "active" | "suspended" | "cancelled";
  suspensionReason: string | null;
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

  // Action modals state
  const [actionCompany, setActionCompany] = useState<CompanyItem | null>(null);
  const [actionType, setActionType] = useState<"hold" | "resume" | "delete" | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

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

  const handleConfirmAction = async () => {
    if (!actionCompany || !actionType) return;
    setActionLoading(true);

    try {
      if (actionType === "hold" || actionType === "resume") {
        const nextStatus = actionType === "hold" ? "suspended" : "active";
        const res = await fetch(`/api/admin/companies/${actionCompany.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: nextStatus,
            reason: actionType === "hold" ? "Suspended by Super Admin" : null,
          }),
        });

        const j = await res.json();
        if (!res.ok) {
          throw new Error(j.error || "Failed to update company status");
        }

        toast.success(
          actionType === "hold"
            ? `${actionCompany.name} access has been put ON HOLD.`
            : `${actionCompany.name} access has been RESTORED.`
        );
      } else if (actionType === "delete") {
        const res = await fetch(`/api/admin/companies/${actionCompany.id}`, {
          method: "DELETE",
        });

        const j = await res.json();
        if (!res.ok) {
          throw new Error(j.error || "Failed to delete company");
        }

        toast.success(`${actionCompany.name} has been deleted permanently.`);
      }

      await fetchCompanies();
      setActionCompany(null);
      setActionType(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Action failed";
      toast.error(msg);
    } finally {
      setActionLoading(false);
    }
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
              Super Admin Control
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your SaaS client companies: monitor active services, copy IDs, or hold / delete access.
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
              Super Admin SaaS Controls:
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              <strong>Hold / Pause:</strong> Kisi company ka subscription expire hone par ya payment na aane par aap <em>&quot;Hold / Suspend&quot;</em> kar sakte hain. Unka pura dashboard lock ho jaayega. Payment aate hi <em>&quot;Resume Access&quot;</em> dabate hi wapas chal padega.<br />
              <strong>Delete:</strong> Company ko hamesha ke liye hatane ke liye Delete dabayein.<br />
              <strong>Copy ID:</strong> Kisi bhi company ki technical issue aane par unka ID copy karke mujhe de sakte hain.
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
            {filteredCompanies.map((c) => {
              const isSuspended = c.status === "suspended";
              return (
                <Card
                  key={c.id}
                  className={`overflow-hidden transition-all ${
                    isSuspended
                      ? "border-amber-500/50 bg-amber-500/[0.02]"
                      : "hover:border-primary/40"
                  }`}
                >
                  <CardHeader className="bg-muted/30 pb-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <CardTitle className="text-base font-semibold">
                            {c.name}
                          </CardTitle>

                          {/* Suspension Badge */}
                          {isSuspended ? (
                            <Badge variant="destructive" className="text-xs gap-1">
                              <ShieldAlert className="h-3.5 w-3.5" />
                              On Hold / Suspended
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs"
                            >
                              Active
                            </Badge>
                          )}

                          {c.whatsapp.connected && (
                            <Badge
                              variant="outline"
                              className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs gap-1"
                            >
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              WhatsApp Live
                            </Badge>
                          )}
                          {c.ai.configured && (
                            <Badge
                              variant="outline"
                              className="border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs"
                            >
                              AI: {c.ai.provider?.toUpperCase()} ({c.ai.model})
                            </Badge>
                          )}
                        </div>
                        <CardDescription className="mt-1 flex items-center gap-2 text-xs">
                          <span>
                            Owner: <strong>{c.owner?.name || "N/A"}</strong> ({c.owner?.email || "N/A"})
                          </span>
                          <span>•</span>
                          <span>Joined: {new Date(c.createdAt).toLocaleDateString()}</span>
                        </CardDescription>
                      </div>

                      {/* Action Bar (Copy ID, Hold/Resume, Delete) */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Company ID */}
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

                        {/* Hold / Resume Toggle */}
                        {isSuspended ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1.5 border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400"
                            onClick={() => {
                              setActionCompany(c);
                              setActionType("resume");
                            }}
                          >
                            <PlayCircle className="h-3.5 w-3.5" />
                            Resume Access
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1.5 border-amber-500/40 text-amber-600 hover:bg-amber-500/10 dark:text-amber-400"
                            onClick={() => {
                              setActionCompany(c);
                              setActionType("hold");
                            }}
                          >
                            <PauseCircle className="h-3.5 w-3.5" />
                            Hold / Suspend
                          </Button>
                        )}

                        {/* Delete Company */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            setActionCompany(c);
                            setActionType("delete");
                          }}
                          title="Delete Company"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
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
                        <span
                          className={`text-[11px] font-semibold ${
                            c.whatsapp.connected ? "text-emerald-500" : "text-muted-foreground"
                          }`}
                        >
                          {c.whatsapp.connected ? "Active" : "Not Connected"}
                        </span>
                      </div>
                      {c.whatsapp.connected ? (
                        <div className="space-y-0.5 text-xs text-muted-foreground">
                          <p className="truncate">
                            Phone Number ID:{" "}
                            <span className="font-mono text-foreground font-medium">
                              {c.whatsapp.phoneNumberId}
                            </span>
                          </p>
                          {c.whatsapp.wabaId && (
                            <p className="truncate">
                              WABA ID:{" "}
                              <span className="font-mono text-foreground">
                                {c.whatsapp.wabaId}
                              </span>
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
                        <span
                          className={`text-[11px] font-semibold ${
                            c.ai.configured ? "text-indigo-500" : "text-muted-foreground"
                          }`}
                        >
                          {c.ai.configured ? "Configured" : "Not Setup"}
                        </span>
                      </div>
                      {c.ai.configured ? (
                        <div className="space-y-0.5 text-xs text-muted-foreground">
                          <p>
                            Provider:{" "}
                            <span className="font-medium text-foreground capitalize">
                              {c.ai.provider}
                            </span>
                          </p>
                          <p>
                            Model:{" "}
                            <span className="font-mono text-foreground">
                              {c.ai.model}
                            </span>
                          </p>
                          <p>
                            Status:{" "}
                            <span
                              className={
                                c.ai.isActive && c.ai.autoReply
                                  ? "text-emerald-500 font-medium"
                                  : "text-amber-500 font-medium"
                              }
                            >
                              {c.ai.isActive && c.ai.autoReply
                                ? "Auto-reply live"
                                : "Manual / Draft only"}
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
                          <div className="text-sm font-bold text-foreground">
                            {c.contactsCount}
                          </div>
                          <div className="text-[10px] text-muted-foreground">Contacts</div>
                        </div>
                        <div className="rounded bg-muted/50 p-1.5 text-center">
                          <div className="text-sm font-bold text-foreground">
                            {c.conversationsCount}
                          </div>
                          <div className="text-[10px] text-muted-foreground">Chat Threads</div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Action Confirmation Dialog */}
      <Dialog
        open={Boolean(actionCompany && actionType)}
        onOpenChange={(open) => {
          if (!open) {
            setActionCompany(null);
            setActionType(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {actionType === "hold" && "Hold Company Access"}
              {actionType === "resume" && "Resume Company Access"}
              {actionType === "delete" && "Delete Company Permanently"}
            </DialogTitle>
            <DialogDescription className="pt-2 text-sm leading-relaxed">
              {actionType === "hold" && (
                <>
                  Are you sure you want to put <strong>{actionCompany?.name}</strong> on hold?
                  Their users will be locked out with a suspension notice until you restore access.
                </>
              )}
              {actionType === "resume" && (
                <>
                  Are you sure you want to reactivate access for <strong>{actionCompany?.name}</strong>?
                  Their team members will be able to access the dashboard and chats immediately.
                </>
              )}
              {actionType === "delete" && (
                <span className="text-destructive">
                  Warning: Deleting <strong>{actionCompany?.name}</strong> will permanently remove all their WhatsApp configs, AI configurations, contacts, and chat history. This action cannot be undone.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setActionCompany(null);
                setActionType(null);
              }}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              variant={actionType === "delete" ? "destructive" : "default"}
              onClick={handleConfirmAction}
              disabled={actionLoading}
              className="gap-2"
            >
              {actionLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {actionType === "hold" && "Confirm Hold"}
              {actionType === "resume" && "Reactivate Access"}
              {actionType === "delete" && "Delete Permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
