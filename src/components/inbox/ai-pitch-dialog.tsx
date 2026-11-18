'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sparkles,
  Phone,
  MessageSquare,
  Copy,
  Check,
  AlertCircle,
  Activity,
  MapPin,
  Tag as TagIcon,
  Loader2,
  RefreshCw,
  Lightbulb,
  Plus,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatTelUri, formatPhoneDisplay } from '@/lib/whatsapp/phone-utils';
import { addContactTag } from '@/lib/contacts/tag-api';
import { createClient } from '@/lib/supabase/client';

interface AiPitchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId?: string | null;
  contactId?: string | null;
  patientName?: string | null;
}

export function AiPitchDialog({
  open,
  onOpenChange,
  conversationId,
  contactId,
  patientName,
}: AiPitchDialogProps) {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [tagAssigning, setTagAssigning] = useState(false);
  const [tagAssigned, setTagAssigned] = useState(false);

  const fetchAnalysis = async () => {
    if (!conversationId && !contactId) return;
    setLoading(true);
    setError(null);
    setTagAssigned(false);

    try {
      const res = await fetch('/api/ai/analyze-patient', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, contactId }),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result?.error || 'Failed to analyze patient chat');
      }

      setData(result);
    } catch (err: any) {
      console.error('Fetch analysis failed:', err);
      setError(err?.message || 'Could not generate pitch');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && (conversationId || contactId)) {
      fetchAnalysis();
    } else {
      setData(null);
      setError(null);
    }
  }, [open, conversationId, contactId]);

  const copyScript = () => {
    if (!data?.analysis?.telecalling_script) return;
    const s = data.analysis.telecalling_script;
    const textToCopy = `📞 Gynocci Calling Script (${data?.patient?.name || patientName || 'Patient'}):\n\n1. Opening:\n${s.opening}\n\n2. Empathy & Reassurance:\n${s.empathy_and_reassurance}\n\n3. Objection Rebuttal:\n${s.objection_handling}\n\n4. Closing Pitch:\n${s.closing_offer}`;

    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    toast.success('Calling pitch copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAssignRecommendedTag = async () => {
    if (!data?.patient?.id || !data?.analysis?.recommended_tag) return;
    setTagAssigning(true);

    try {
      // Find matching tag or create it
      const tagName = data.analysis.recommended_tag.trim();
      const { data: existingTags } = await supabase
        .from('tags')
        .select('*')
        .ilike('name', tagName)
        .limit(1);

      let targetTagId = existingTags && existingTags[0]?.id;

      if (!targetTagId) {
        // Find by partial match
        const { data: anyTags } = await supabase
          .from('tags')
          .select('*')
          .limit(1);
        targetTagId = anyTags && anyTags[0]?.id;
      }

      if (targetTagId) {
        await addContactTag(data.patient.id, targetTagId);
        setTagAssigned(true);
        toast.success(`Tag "${tagName}" assigned to patient`);
      } else {
        toast.info(`Please create tag "${tagName}" in Settings`);
      }
    } catch (err) {
      console.warn('Assign tag error:', err);
      toast.error('Could not assign tag automatically');
    } finally {
      setTagAssigning(false);
    }
  };

  const handleOpenInbox = () => {
    onOpenChange(false);
    if (data?.patient?.conversationId) {
      router.push(`/inbox?c=${data.patient.conversationId}`);
    } else {
      router.push('/inbox');
    }
  };

  const analysis = data?.analysis;
  const patient = data?.patient;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between pr-4">
            <Badge
              variant="outline"
              className="gap-1 border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300 font-medium"
            >
              <Sparkles className="h-3 w-3 text-purple-600 dark:text-purple-400" />
              AI Chat Analysis & Pitch Advisor
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchAnalysis}
              disabled={loading}
              className="h-7 px-2 text-xs text-muted-foreground gap-1"
            >
              <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
              Re-analyze
            </Button>
          </div>
          <DialogTitle className="text-xl mt-1 flex items-center gap-2">
            <span>{patient?.name || patientName || 'Patient'}</span>
            {patient?.city && (
              <span className="text-xs font-normal text-muted-foreground flex items-center gap-0.5">
                <MapPin className="h-3 w-3 text-rose-500" />
                {patient.city}
              </span>
            )}
          </DialogTitle>
          <DialogDescription>
            Smart calling guide and objection-handling script based on WhatsApp chat history.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">
                Analyzing patient conversation...
              </p>
              <p className="text-xs text-muted-foreground">
                Extracting health concerns, objections, and generating custom calling pitch.
              </p>
            </div>
          </div>
        ) : error ? (
          <div className="p-4 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/20 text-center space-y-3">
            <AlertCircle className="h-6 w-6 text-rose-600 dark:text-rose-400 mx-auto" />
            <p className="text-sm font-medium text-rose-800 dark:text-rose-300">
              {error}
            </p>
            <Button size="sm" variant="outline" onClick={fetchAnalysis}>
              Try Again
            </Button>
          </div>
        ) : analysis ? (
          <div className="space-y-4 py-2 text-xs">
            {/* Patient & Dropout Breakdown */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="p-3 rounded-lg border bg-muted/40 space-y-1">
                <span className="font-semibold text-muted-foreground uppercase tracking-wider text-[10px] flex items-center gap-1">
                  <Activity className="h-3 w-3 text-amber-500" />
                  Health Concern
                </span>
                <p className="text-foreground font-medium text-xs">
                  {analysis.patient_summary?.concern || 'Reproductive / Hormonal health consultation'}
                </p>
                {analysis.patient_summary?.mindset && (
                  <p className="text-[11px] text-muted-foreground pt-0.5">
                    Mindset: {analysis.patient_summary.mindset}
                  </p>
                )}
              </div>

              <div className="p-3 rounded-lg border border-rose-500/20 bg-rose-500/5 space-y-1">
                <span className="font-semibold text-rose-700 dark:text-rose-400 uppercase tracking-wider text-[10px] flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Why Haven&apos;t They Booked? (Objection)
                </span>
                <p className="text-foreground font-medium text-xs">
                  {analysis.dropout_reason || analysis.key_objection || 'Needs personal call guidance on fees/process.'}
                </p>
              </div>
            </div>

            {/* Calling Pitch Script */}
            {analysis.telecalling_script && (
              <div className="p-3.5 rounded-xl border border-purple-500/30 bg-purple-500/5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-purple-900 dark:text-purple-300 text-xs flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                    Phone Call Script (कॉल पर क्या और कैसे बोलें)
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyScript}
                    className="h-6 px-2 text-[11px] gap-1 border-purple-500/30 text-purple-700 dark:text-purple-300 hover:bg-purple-500/10"
                  >
                    {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                    {copied ? 'Copied' : 'Copy Script'}
                  </Button>
                </div>

                {/* 4 Steps Script */}
                <div className="space-y-2">
                  <div className="bg-background/80 p-2.5 rounded-lg border text-xs space-y-1">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase">
                      1. शुरुआत (Opening Greeting):
                    </span>
                    <p className="text-foreground font-medium">
                      &quot;{analysis.telecalling_script.opening}&quot;
                    </p>
                  </div>

                  <div className="bg-background/80 p-2.5 rounded-lg border text-xs space-y-1">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase">
                      2. विश्वास व सहानुभूति (Empathy & Root-Cause Reassurance):
                    </span>
                    <p className="text-foreground font-medium">
                      &quot;{analysis.telecalling_script.empathy_and_reassurance}&quot;
                    </p>
                  </div>

                  <div className="bg-background/80 p-2.5 rounded-lg border border-amber-500/30 text-xs space-y-1">
                    <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 uppercase">
                      3. आपत्ति का समाधान (Handling Hesitation / Objection):
                    </span>
                    <p className="text-foreground font-medium">
                      &quot;{analysis.telecalling_script.objection_handling}&quot;
                    </p>
                  </div>

                  <div className="bg-background/80 p-2.5 rounded-lg border border-emerald-500/30 text-xs space-y-1">
                    <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase">
                      4. बुकिंग ऑफर (Closing Offer Pitch):
                    </span>
                    <p className="text-foreground font-medium">
                      &quot;{analysis.telecalling_script.closing_offer}&quot;
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Key Benefits to pitch */}
            {analysis.key_benefits_to_pitch && analysis.key_benefits_to_pitch.length > 0 && (
              <div className="p-3 rounded-lg border bg-muted/40 space-y-1.5">
                <span className="font-semibold text-muted-foreground uppercase tracking-wider text-[10px] flex items-center gap-1">
                  <Lightbulb className="h-3 w-3 text-amber-500" />
                  Key Points to Emphasize
                </span>
                <ul className="list-disc pl-4 space-y-1 text-foreground">
                  {analysis.key_benefits_to_pitch.map((pt: string, idx: number) => (
                    <li key={idx}>{pt}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recommended Tag */}
            {analysis.recommended_tag && (
              <div className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/30">
                <div className="flex items-center gap-1.5">
                  <TagIcon className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs text-muted-foreground">Recommended Tag:</span>
                  <Badge variant="secondary" className="font-medium text-xs">
                    {analysis.recommended_tag}
                  </Badge>
                </div>
                {patient?.id && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={tagAssigning || tagAssigned}
                    onClick={handleAssignRecommendedTag}
                    className="h-6 px-2 text-[11px] gap-1"
                  >
                    {tagAssigned ? <Check className="h-3 w-3 text-emerald-500" /> : <Plus className="h-3 w-3" />}
                    {tagAssigned ? 'Assigned' : 'Assign Tag'}
                  </Button>
                )}
              </div>
            )}
          </div>
        ) : null}

        <DialogFooter className="flex flex-col sm:flex-row items-center gap-2 pt-2">
          {patient?.phone && (
            <a
              href={formatTelUri(patient.phone)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm transition-colors"
            >
              <Phone className="h-3.5 w-3.5 fill-current" />
              Call Now ({formatPhoneDisplay(patient.phone)})
            </a>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenInbox}
            className="w-full sm:w-auto gap-1 text-xs"
          >
            <MessageSquare className="h-3.5 w-3.5 text-primary" />
            Open in Inbox
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto text-xs"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
