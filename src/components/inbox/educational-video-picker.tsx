'use client';

import React, { useState, useEffect } from 'react';
import { Video, Search, Sparkles, ExternalLink, ArrowRight, Play } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DEFAULT_DISEASE_VIDEOS,
  type DiseaseVideoEntry,
} from '@/lib/ai/disease-video-links';

interface EducationalVideoPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (message: string) => void;
  patientName?: string | null;
}

export function EducationalVideoPicker({
  open,
  onOpenChange,
  onSelect,
  patientName,
}: EducationalVideoPickerProps) {
  const [videos, setVideos] = useState<DiseaseVideoEntry[]>(DEFAULT_DISEASE_VIDEOS);
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch custom/managed videos from API if present
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

  const handlePick = (entry: DiseaseVideoEntry) => {
    const displayName = patientName && patientName !== 'Unknown' ? `${patientName} जी` : 'जी';

    const text =
      `🌸 *${entry.diseaseNameHindi} के लिए विशेष चिकित्सकीय मार्गदर्शन:*\n\n` +
      `नमस्ते ${displayName},\n` +
      `${entry.emotionalHookHindi}\n\n` +
      `📺 *वीडियो देखें:* ${entry.youtubeUrl}\n\n` +
      `_यदि वीडियो देखने के बाद आपका कोई भी सवाल हो, तो आप बेझिझक हमसे यहाँ पूछ सकती हैं। हमारे डॉक्टर आपकी सहायता के लिए सदैव तत्पर हैं।_ 🙏`;

    onSelect(text);
    onOpenChange(false);
  };

  const activeVideos = videos.filter((v) => v.youtubeUrl && v.youtubeUrl.trim().length > 0);
  const filtered = activeVideos.filter((v) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      v.diseaseNameHindi.toLowerCase().includes(q) ||
      v.category.toLowerCase().includes(q) ||
      v.title.toLowerCase().includes(q)
    );
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 gap-0 overflow-hidden border-rose-200">
        <DialogHeader className="p-4 pb-3 bg-linear-to-r from-rose-50 via-purple-50/40 to-background border-b border-rose-100">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Video className="size-5 text-rose-600" />
              YouTube वीडियो व भावनात्मक मैसेज चुनें
            </DialogTitle>
            <Badge variant="outline" className="text-xs bg-rose-100/70 text-rose-800 border-rose-300">
              1-Click Insert
            </Badge>
          </div>
          <DialogDescription className="text-xs text-slate-500 mt-1">
            बीमारी पर क्लिक करते ही बना-बनाया भावनात्मक मैसेज व यूट्यूब लिंक मैसेज बॉक्स में भर जाएगा।
          </DialogDescription>
        </DialogHeader>

        <div className="p-4 space-y-3">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              placeholder="बीमारी खोजें (PCOD, Tubal Blockage, Sperm, Infertility, AMH...)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 text-xs h-9"
            />
          </div>

          {/* Videos Grid */}
          <div className="max-h-[60vh] overflow-y-auto space-y-2 pr-1">
            {filtered.map((entry) => (
              <div
                key={entry.category}
                onClick={() => handlePick(entry)}
                className="group p-3 rounded-lg border border-slate-200/90 hover:border-rose-300 hover:bg-rose-50/40 transition-all cursor-pointer flex items-center justify-between gap-3 shadow-2xs"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-slate-900 group-hover:text-rose-700 transition-colors">
                      {entry.diseaseNameHindi}
                    </span>
                    <Badge variant="secondary" className="text-[10px] font-mono py-0 px-1 text-slate-500">
                      {entry.category}
                    </Badge>
                  </div>
                  <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                    {entry.title}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono truncate mt-0.5 flex items-center gap-1">
                    <Play className="size-2.5 text-rose-500 fill-current" />
                    {entry.youtubeUrl}
                  </div>
                </div>

                <div className="flex items-center gap-1 text-rose-600 font-medium text-xs shrink-0 group-hover:translate-x-0.5 transition-transform">
                  <span>Insert</span>
                  <ArrowRight className="size-3.5" />
                </div>
              </div>
            ))}

            {filtered.length === 0 && (
              <div className="text-center py-8 text-xs text-slate-400">
                कोई वीडियो लिंक नहीं मिला।
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
