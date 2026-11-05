'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Building2,
  ChevronsUpDown,
  Check,
  Sparkles,
  Receipt,
  Shield,
  Loader2,
  Radio,
  Settings,
} from 'lucide-react';
import { toast } from 'sonner';

interface Workspace {
  id: string;
  name: string;
  isCurrent: boolean;
  status: string;
  whatsappConnected: boolean;
  aiActive: boolean;
  category: 'marketing' | 'billing' | 'admin' | 'general';
  description: string;
}

export function WorkspaceSwitcher() {
  const router = useRouter();
  const { account, accountId, refreshProfile } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  const fetchWorkspaces = useCallback(async () => {
    try {
      const res = await fetch('/api/account/workspaces', {
        cache: 'no-store',
      });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.workspaces)) {
        setWorkspaces(data.workspaces);
      }
    } catch (e) {
      console.error('Failed to load workspaces:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces, accountId]);

  const currentWorkspace = workspaces.find((w) => w.isCurrent) || {
    id: accountId || '',
    name: account?.name || 'Workspace',
    isCurrent: true,
    status: 'active',
    whatsappConnected: true,
    aiActive: true,
    category: account?.name?.toLowerCase().includes('billing') ? 'billing' : 'marketing',
    description: '',
  };

  const handleSwitch = async (targetId: string, name: string) => {
    if (targetId === accountId || switchingId) return;

    setSwitchingId(targetId);
    try {
      const res = await fetch('/api/account/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetAccountId: targetId }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to switch workspace');
      }

      toast.success(`Switched to ${name}`);
      await refreshProfile();
      // Reload to ensure all server components and caches align immediately
      setTimeout(() => {
        window.location.reload();
      }, 350);
    } catch (err: any) {
      console.error('Workspace switch error:', err);
      toast.error(err.message || 'Could not switch workspace');
      setSwitchingId(null);
    }
  };

  const getWorkspaceIcon = (cat: string) => {
    if (cat === 'billing') {
      return <Receipt className="h-4 w-4 text-sky-500" />;
    }
    if (cat === 'marketing') {
      return <Sparkles className="h-4 w-4 text-emerald-500" />;
    }
    if (cat === 'admin') {
      return <Shield className="h-4 w-4 text-purple-500" />;
    }
    return <Building2 className="h-4 w-4 text-muted-foreground" />;
  };

  // If there's only 1 workspace or loading, show compact pill
  if (loading && workspaces.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground">
        <Building2 className="h-3.5 w-3.5 animate-pulse" />
        <span className="truncate font-medium">{account?.name || 'Loading...'}</span>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex h-9 items-center gap-2 rounded-md border border-border/80 bg-background/80 px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-muted/60 focus:outline-none data-popup-open:bg-muted/70 sm:px-3 sm:text-sm"
        aria-label="Switch workspace"
      >
        <div className="flex items-center gap-2 truncate">
          {getWorkspaceIcon(currentWorkspace.category)}
          <span className="max-w-[130px] truncate sm:max-w-[190px]">
            {currentWorkspace.name}
          </span>
          {currentWorkspace.aiActive ? (
            <Badge
              variant="outline"
              className="hidden border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 md:inline-flex"
            >
              AI Active
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="hidden border-zinc-500/30 bg-zinc-500/10 px-1.5 py-0 text-[10px] font-semibold text-zinc-600 dark:text-zinc-400 md:inline-flex"
            >
              AI Off
            </Badge>
          )}
        </div>
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[320px] p-2">
        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
          Switch Workspace
        </div>
        <div className="space-y-1">
          {workspaces.map((ws) => {
            const isSelected = ws.id === accountId;
            const isPending = switchingId === ws.id;

            return (
              <DropdownMenuItem
                key={ws.id}
                onClick={() => handleSwitch(ws.id, ws.name)}
                disabled={isPending}
                className={`flex cursor-pointer items-start gap-2.5 rounded-md p-2 text-xs transition-colors ${
                  isSelected
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'hover:bg-muted'
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  {isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  ) : (
                    getWorkspaceIcon(ws.category)
                  )}
                </div>

                <div className="flex flex-1 flex-col overflow-hidden">
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate font-medium text-foreground">
                      {ws.name}
                    </span>
                    {isSelected && (
                      <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                    )}
                  </div>
                  <span className="truncate text-[11px] text-muted-foreground">
                    {ws.description}
                  </span>

                  <div className="mt-1 flex items-center gap-1.5">
                    {ws.aiActive ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                        <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        AI Auto-reply Live
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-zinc-500">
                        <span className="size-1.5 rounded-full bg-zinc-400" />
                        AI Disabled (Human Only)
                      </span>
                    )}

                    {ws.whatsappConnected ? (
                      <span className="text-[10px] text-muted-foreground">
                        • WhatsApp Linked
                      </span>
                    ) : (
                      <span className="text-[10px] text-amber-600 dark:text-amber-400">
                        • Needs Number Setup
                      </span>
                    )}
                  </div>
                </div>
              </DropdownMenuItem>
            );
          })}
        </div>

        <DropdownMenuSeparator className="my-1.5" />

        <div className="flex items-center justify-between px-2 py-1 text-[11px] text-muted-foreground">
          <span>Data & Contacts are 100% Isolated</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/settings')}
            className="h-6 px-1.5 text-[11px] text-primary hover:text-primary"
          >
            <Settings className="mr-1 h-3 w-3" />
            Settings
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
