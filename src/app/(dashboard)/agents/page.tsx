'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Bot, Sparkles, Settings2, BarChart3 } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { AiPlayground } from '@/components/agents/ai-playground';
import { AiUsageCard } from '@/components/agents/ai-usage';
import { AiConfig } from '@/components/settings/ai-config';
import { useAuth } from '@/hooks/use-auth';
import { canEditSettings } from '@/lib/auth/roles';

type Tab = 'playground' | 'setup' | 'usage';

export default function AgentsPage() {
  const t = useTranslations('Agents');
  const { accountRole, canManageTechSettings } = useAuth();
  const canViewUsage = accountRole ? canEditSettings(accountRole) : false;
  const [tab, setTab] = useState<Tab>('playground');
  const [decided, setDecided] = useState(false);

  // Land first-time tech admins on Setup, returning users and non-tech users on Playground.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!canManageTechSettings) {
          if (!cancelled) setTab('playground');
          return;
        }
        const res = await fetch('/api/ai/config');
        const data = await res.json().catch(() => ({}));
        if (!cancelled) setTab(data?.configured ? 'playground' : 'setup');
      } catch {
        if (!cancelled) setTab('playground');
      } finally {
        if (!cancelled) setDecided(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canManageTechSettings]);

  const activeTab = !canManageTechSettings && tab === 'setup' ? 'playground' : tab;

  return (
    <div>
      <div className="flex items-center gap-2">
        <Bot className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {t('title')}
        </h1>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {t('description')}
      </p>

      {decided && (
        <Tabs
          value={activeTab}
          onValueChange={(v) => {
            if (v === 'setup' && !canManageTechSettings) return;
            setTab(v as Tab);
          }}
          className="mt-6"
        >
          <TabsList>
            <TabsTrigger value="playground">
              <Sparkles className="mr-1.5 h-4 w-4" /> {t('tabPlayground')}
            </TabsTrigger>
            {canManageTechSettings && (
              <TabsTrigger value="setup">
                <Settings2 className="mr-1.5 h-4 w-4" /> {t('tabSetup')}
              </TabsTrigger>
            )}
            {canViewUsage && (
              <TabsTrigger value="usage">
                <BarChart3 className="mr-1.5 h-4 w-4" /> {t('tabUsage')}
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="playground" className="mt-4">
            <AiPlayground onGoToSetup={canManageTechSettings ? () => setTab('setup') : undefined} />
          </TabsContent>

          {canManageTechSettings && (
            <TabsContent value="setup" className="mt-4">
              <AiConfig />
            </TabsContent>
          )}

          {canViewUsage && (
            <TabsContent value="usage" className="mt-4">
              <AiUsageCard />
            </TabsContent>
          )}
        </Tabs>
      )}
    </div>
  );
}
