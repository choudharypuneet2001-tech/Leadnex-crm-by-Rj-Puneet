'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Video,
  ExternalLink,
  Copy,
  Check,
  Share2,
  Sparkles,
  Phone,
  MessageSquare,
  ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DEFAULT_DISEASE_VIDEOS,
  findDiseaseVideo,
  type DiseaseVideoEntry,
} from '@/lib/ai/disease-video-links';

interface SendDiseaseVideoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientName?: string | null;
  phone?: string | null;
  initialConcernOrAd?: string | null;
}

export function getWhatsAppPhoneDigits(phone?: string | null): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

export function SendDiseaseVideoModal({
  open,
  onOpenChange,
  patientName,
  phone,
  initialConcernOrAd,
}: SendDiseaseVideoModalProps) {
  const [videos, setVideos] = useState<DiseaseVideoEntry[]>(DEFAULT_DISEASE_VIDEOS);
  const [selectedCategory, setSelectedCategory] = useState<string>('pcod_pcos');
  const [messageText, setMessageText] = useState<string>('');
  const [copied, setCopied] = useState(false);

  // Load custom/managed videos from API if present
  useEffect(() => {
    let mounted = true;
    fetch('/api/settings/disease-videos')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (mounted && data?.videos && Array.isArray(data.videos)) {
          setVideos(data.videos);
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  // When opened or initial concern changes, auto-detect best matching disease video
  useEffect(() => {
    if (!open) return;
    const match = findDiseaseVideo(initialConcernOrAd, videos);
    const activeEntry = match || videos.find((v) => v.youtubeUrl) || videos[0];
    if (activeEntry) {
      setSelectedCategory(activeEntry.category);
    }
  }, [open, initialConcernOrAd, videos]);

  // Active selected video entry
  const currentEntry = useMemo(() => {
    return videos.find((v) => v.category === selectedCategory) || videos[0];
  }, [videos, selectedCategory]);

  // Construct patient-personalized message
  useEffect(() => {
    if (!currentEntry) return;
    const displayName = patientName && patientName !== 'Unknown' ? `${patientName} जी` : 'जी';

    const text =
      `🌸 *${currentEntry.diseaseNameHindi} के लिए विशेष चिकित्सकीय मार्गदर्शन:*\n\n` +
      `नमस्ते ${displayName},\n` +
      `${currentEntry.emotionalHookHindi}\n\n` +
      `📺 *वीडियो देखें:* ${currentEntry.youtubeUrl || '(वीडियो लिंक जल्द उपलब्ध होगा)'}\n\n` +
      `_यदि वीडियो देखने के बाद आपका कोई भी सवाल हो, तो आप बेझिझक हमसे यहाँ पूछ सकती हैं। हमारे डॉक्टर आपकी सहायता के लिए सदैव तत्पर हैं।_ 🙏`;

    setMessageText(text);
  }, [currentEntry, patientName]);

  const handleCopy = () => {
    if (!messageText) return;
    navigator.clipboard.writeText(messageText);
    setCopied(true);
    toast.success('भावनात्मक वीडियो संदेश कॉपी हो गया!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenWhatsApp = () => {
    const waPhone = getWhatsAppPhoneDigits(phone);
    if (!waPhone) {
      toast.error('मरीज का फोन नंबर उपलब्ध नहीं है');
      return;
    }
    const waUrl = `https://wa.me/${waPhone}?text=${encodeURIComponent(messageText)}`;
    window.open(waUrl, '_blank');
    toast.success('WhatsApp खुल रहा है, बस सेंड दबाएं!');
    onOpenChange(false);
  };

  const availableVideos = videos.filter((v) => v.youtubeUrl && v.youtubeUrl.trim().length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 gap-0 overflow-hidden border-rose-200">
        <DialogHeader className="p-4 pb-3 bg-linear-to-r from-rose-50 via-purple-50/50 to-background border-b border-rose-100">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Video className="size-5 text-rose-600" />
              मरीज को YouTube वीडियो व भावनात्मक मैसेज भेजें
            </DialogTitle>
            <Badge variant="outline" className="text-xs bg-rose-100/70 text-rose-800 border-rose-300">
              1-Click Send
            </Badge>
          </div>
          <DialogDescription className="text-xs text-slate-500 mt-1">
            मरीज के नाम व बीमारी के अनुसार तैयार दिल को छूने वाला मैसेज और YouTube वीडियो लिंक
          </DialogDescription>
        </DialogHeader>

        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Patient Details & Disease Dropdown */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200/80">
            <div>
              <span className="text-[11px] font-medium text-slate-500 block">मरीज का विवरण (Patient):</span>
              <div className="font-semibold text-sm text-slate-900 mt-0.5">
                {patientName || 'मरीज'}
              </div>
              <div className="text-xs text-slate-600 font-mono flex items-center gap-1 mt-0.5">
                <Phone className="size-3 text-emerald-600" />
                {phone || 'No phone'}
              </div>
            </div>

            <div>
              <span className="text-[11px] font-medium text-slate-500 block mb-1">
                बीमारी चुनें (Select Disease Video):
              </span>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full text-xs h-8 px-2 rounded-md border border-slate-300 bg-white font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-rose-500 cursor-pointer"
              >
                {availableVideos.map((v) => (
                  <option key={v.category} value={v.category}>
                    {v.diseaseNameHindi}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Current Video Info Banner */}
          {currentEntry && (
            <div className="flex items-center justify-between p-2.5 rounded-md bg-rose-50/70 border border-rose-200 text-xs">
              <div className="flex items-center gap-2 truncate">
                <Sparkles className="size-4 text-rose-600 shrink-0" />
                <span className="font-semibold text-rose-950 truncate">
                  {currentEntry.title}
                </span>
              </div>
              {currentEntry.youtubeUrl && (
                <a
                  href={currentEntry.youtubeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-rose-600 hover:text-rose-800 font-medium inline-flex items-center gap-1 text-[11px] shrink-0 hover:underline"
                >
                  <ExternalLink className="size-3" />
                  चलाकर देखें
                </a>
              )}
            </div>
          )}

          {/* Editable WhatsApp Message Preview */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label className="font-semibold text-slate-700 flex items-center gap-1.5">
                <MessageSquare className="size-3.5 text-emerald-600" />
                WhatsApp मैसेज प्रीव्यू (आप इसे एडिट भी कर सकते हैं):
              </label>
              <button
                type="button"
                onClick={handleCopy}
                className="text-[11px] text-purple-700 hover:underline flex items-center gap-1 cursor-pointer"
              >
                {copied ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
                {copied ? 'कॉपी हो गया!' : 'Copy Text'}
              </button>
            </div>

            <Textarea
              rows={7}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              className="text-xs bg-emerald-50/20 border-emerald-200 focus:border-emerald-400 font-sans leading-relaxed text-slate-800"
            />
          </div>
        </div>

        <DialogFooter className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="text-xs gap-1.5 cursor-pointer"
          >
            {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
            Copy Message
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs cursor-pointer"
            >
              बंद करें
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleOpenWhatsApp}
              disabled={!phone}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5 text-xs shadow-sm cursor-pointer"
            >
              <Share2 className="size-3.5" />
              📲 WhatsApp पर भेजें (Open in WhatsApp)
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
