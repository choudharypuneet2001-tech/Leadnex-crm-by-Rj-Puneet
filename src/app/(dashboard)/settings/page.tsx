'use client';

import { Suspense, useEffect, useMemo, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ShieldAlert } from 'lucide-react';

import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { SettingsRail } from '@/components/settings/settings-rail';
import { SettingsOverview } from '@/components/settings/settings-overview';
import { ProfileForm } from '@/components/settings/profile-form';
import { SecurityPanel } from '@/components/settings/security-panel';
import { AppearancePanel } from '@/components/settings/appearance-panel';
import { WhatsAppConfig } from '@/components/settings/whatsapp-config';
import { TemplateManager } from '@/components/settings/template-manager';
import { QuickRepliesManager } from '@/components/settings/quick-replies-manager';
import { FieldsAndTagsPanel } from '@/components/settings/fields-and-tags-panel';
import { DealsSettings } from '@/components/settings/deals-settings';
import { MembersTab } from '@/components/settings/members-tab';
import { ApiKeysSettings } from '@/components/settings/api-keys-settings';
import {
  resolveSection,
  type SettingsSection,
} from '@/components/settings/settings-sections';

// `useSearchParams` opts this page out of static prerendering unless it
// sits under a Suspense boundary. Without one, the production build hits
// the "missing Suspense with CSR bailout" error and the whole page bails
// to client-side rendering — shipping a settings screen whose rail never
// wires up its click handlers. You land on the section the URL carried
// (the account-menu Settings link points at `?tab=whatsapp`) and can't
// navigate away. Mirror the login/signup split: a thin wrapper supplies
// the boundary; the inner component reads the query string.
export default function SettingsPage() {
  return (
    <Suspense fallback={null}>
      <SettingsPageInner />
    </Suspense>
  );
}

function SettingsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { defaultCurrency, canManageMembers, canManageTechSettings } = useAuth();
  const { mode } = useTheme();
  const t = useTranslations('Settings');

  // The URL (`?tab=`) is the single source of truth for the active
  // section — deep-linkable, and it keeps the existing links in the
  // app sidebar/header working. Legacy tab values (tags, custom-fields)
  // resolve onto their new home; unknown/empty → the Overview landing.
  const section = resolveSection(searchParams.get('tab'));

  const isSectionAllowed = useMemo(() => {
    if (section === 'whatsapp' || section === 'api') return canManageTechSettings;
    if (section === 'members') return canManageMembers;
    return true;
  }, [section, canManageTechSettings, canManageMembers]);

  const go = (next: SettingsSection) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', next);
    router.replace(`/settings?${params.toString()}`, { scroll: false });
  };

  useEffect(() => {
    if (!isSectionAllowed && (section === 'whatsapp' || section === 'api' || section === 'members')) {
      go('overview');
    }
  }, [section, isSectionAllowed]);

  // Cheap, fetch-free rail hints. The Overview landing carries the
  // full live status/counts; the rail just surfaces the two that are
  // already in context.
  const hints: Partial<Record<SettingsSection, ReactNode>> = useMemo(
    () => ({
      appearance: mode.charAt(0).toUpperCase() + mode.slice(1),
      deals: defaultCurrency,
    }),
    [mode, defaultCurrency],
  );

  const accessDeniedPanel = (
    <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card p-12 text-center">
      <ShieldAlert className="size-12 text-destructive" />
      <h3 className="mt-4 text-lg font-semibold text-foreground">Access Restricted</h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        You do not have permission to access this section. Technical configurations are restricted to administrators.
      </p>
    </div>
  );

  const panel: Record<SettingsSection, ReactNode> = {
    overview: <SettingsOverview onSelect={go} />,
    profile: <ProfileForm />,
    security: <SecurityPanel />,
    appearance: <AppearancePanel />,
    whatsapp: canManageTechSettings ? <WhatsAppConfig /> : accessDeniedPanel,
    templates: <TemplateManager />,
    'quick-replies': <QuickRepliesManager />,
    fields: <FieldsAndTagsPanel />,
    deals: <DealsSettings />,
    members: canManageMembers ? <MembersTab /> : accessDeniedPanel,
    api: canManageTechSettings ? <ApiKeysSettings /> : accessDeniedPanel,
  };

  const activeSection = isSectionAllowed ? section : 'overview';

  return (
    <div>
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {t('pageTitle')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('pageDesc')}
        </p>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[236px_minmax(0,1fr)] lg:items-start">
        <SettingsRail active={activeSection} onSelect={go} hints={hints} />
        <div className="min-w-0">{panel[activeSection]}</div>
      </div>
    </div>
  );
}
