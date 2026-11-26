'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Video,
  ExternalLink,
  Save,
  RefreshCw,
  FileSpreadsheet,
  Plus,
  Trash2,
  CheckCircle2,
  HelpCircle,
  Sparkles,
  Link as LinkIcon,
  Search,
  Copy,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import type { DiseaseVideoEntry } from '@/lib/ai/disease-video-links';

export function DiseaseVideosSettings() {
  const [videos, setVideos] = useState<DiseaseVideoEntry[]>([]);
  const [googleSheetsUrl, setGoogleSheetsUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // CSV Paste Modal state
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [csvPasteText, setCsvPasteText] = useState('');

  // Add / Edit Custom Disease Modal
  const [customModalOpen, setCustomModalOpen] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [customKeywords, setCustomKeywords] = useState('');
  const [customHook, setCustomHook] = useState('');

  // Fetch current videos
  const fetchVideos = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/settings/disease-videos');
      if (res.ok) {
        const data = await res.json();
        setVideos(data.videos || []);
        if (data.googleSheetsUrl) setGoogleSheetsUrl(data.googleSheetsUrl);
      }
    } catch {
      toast.error('वीडियो लिंक्स लोड करने में विफल');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchVideos();
  }, []);

  // Update URL for a single category
  const handleUpdateUrl = (category: string, newUrl: string) => {
    setVideos((prev) =>
      prev.map((v) => (v.category === category ? { ...v, youtubeUrl: newUrl } : v))
    );
  };

  // Save changes to DB
  const handleSave = async () => {
    try {
      setSaving(true);
      const res = await fetch('/api/settings/disease-videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          videos,
          googleSheetsUrl,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');

      toast.success('सभी वीडियो लिंक्स सफलतापूर्वक सुरक्षित कर दिए गए!');
    } catch (err: any) {
      toast.error(err.message || 'सेव करने में त्रुटि आई');
    } finally {
      setSaving(false);
    }
  };

  // Sync from Google Sheets URL
  const handleSyncSheet = async () => {
    if (!googleSheetsUrl.trim()) {
      toast.error('कृपया पहले Google Sheets का लिंक डालें');
      return;
    }

    try {
      setSyncing(true);
      const res = await fetch('/api/settings/disease-videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sync_sheet',
          googleSheetsUrl,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to sync Google Sheets');

      setVideos(data.videos || []);
      toast.success(data.message || 'Google Sheets से वीडियो लिंक्स सफलतापूर्वक सिंक हो गए!');
    } catch (err: any) {
      toast.error(err.message || 'Google Sheets सिंक विफल रहा');
    } finally {
      setSyncing(false);
    }
  };

  // Import raw pasted CSV
  const handleImportCsv = async () => {
    if (!csvPasteText.trim()) {
      toast.error('कृपया CSV या Excel का टेक्स्ट पेस्ट करें');
      return;
    }

    try {
      setSaving(true);
      const res = await fetch('/api/settings/disease-videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'import_csv',
          csvText: csvPasteText,
          googleSheetsUrl,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to import CSV');

      setVideos(data.videos || []);
      setCsvModalOpen(false);
      setCsvPasteText('');
      toast.success(data.message || 'Excel/CSV सफलतापूर्वक इम्पोर्ट हो गया!');
    } catch (err: any) {
      toast.error(err.message || 'इम्पोर्ट विफल रहा');
    } finally {
      setSaving(false);
    }
  };

  // Reset to default links
  const handleReset = async () => {
    if (!confirm('क्या आप सच में सभी वीडियो लिंक्स को डिफॉल्ट सेटिंग्स पर रीसेट करना चाहते हैं?')) return;
    try {
      setSaving(true);
      const res = await fetch('/api/settings/disease-videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Reset failed');
      setVideos(data.videos || []);
      toast.success('डिफॉल्ट वीडियो लिंक्स रीस्टोर हो गए!');
    } catch (err: any) {
      toast.error(err.message || 'रीसेट विफल रहा');
    } finally {
      setSaving(false);
    }
  };

  // Add Custom Disease & Auto-Save
  const handleAddCustom = async () => {
    if (!customName.trim() || !customUrl.trim()) {
      toast.error('बीमारी का नाम और वीडियो लिंक आवश्यक हैं');
      return;
    }

    const cat = customCategory.trim() || customName.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
    const kws = customKeywords.split(',').map((k) => k.trim().toLowerCase()).filter(Boolean);
    if (!kws.includes(customName.toLowerCase())) kws.push(customName.toLowerCase());

    const newEntry: DiseaseVideoEntry = {
      category: cat,
      diseaseNameHindi: customName,
      title: customName,
      youtubeUrl: customUrl.trim(),
      keywords: kws,
      emotionalHookHindi: customHook.trim() || 'हमारे विशेषज्ञ डॉक्टर का यह महत्वपूर्ण वीडियो आपकी समस्या के सही समाधान के लिए जरूर देखें:',
      clinicalReasonHindi: 'विशेषज्ञ डॉक्टर्स द्वारा व्यक्तिगत परामर्श आवश्यक है।',
      treatmentApproachHindi: 'आयुर्वेद में बिना साइड इफेक्ट के प्राकृतिक उपचार उपलब्ध है।',
    };

    const updatedVideos = [...videos, newEntry];
    setVideos(updatedVideos);

    try {
      setSaving(true);
      const res = await fetch('/api/settings/disease-videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          videos: updatedVideos,
          googleSheetsUrl,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');

      setCustomModalOpen(false);
      setCustomName('');
      setCustomCategory('');
      setCustomUrl('');
      setCustomKeywords('');
      setCustomHook('');
      toast.success('नई बीमारी का वीडियो लिंक सफलतापूर्वक जोड़कर सेव कर दिया गया!');
    } catch (err: any) {
      toast.error(err.message || 'सेव करने में त्रुटि आई');
    } finally {
      setSaving(false);
    }
  };

  const filteredVideos = videos.filter((v) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      v.diseaseNameHindi.toLowerCase().includes(term) ||
      v.category.toLowerCase().includes(term) ||
      v.title.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header & Description */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-5">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Video className="size-6 text-rose-500" />
            बीमारी अनुसार YouTube वीडियो लिंक्स (Educational Videos)
          </h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            जब मरीज व्हाट्सएप पर अपनी समस्या बताता है या टेलीकॉलर कॉल करता है, तो AI एजेंट स्वतः उसकी बीमारी अनुसार सही YouTube वीडियो लिंक व भावनात्मक मैसेज प्रस्तुत करता है।
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCsvModalOpen(true)}
            className="gap-1.5 cursor-pointer text-xs"
          >
            <FileSpreadsheet className="size-3.5 text-emerald-600" />
            Paste from Excel
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            disabled={saving}
            className="text-xs text-muted-foreground hover:text-destructive cursor-pointer"
          >
            Reset Defaults
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="gap-1.5 cursor-pointer text-xs bg-rose-600 hover:bg-rose-700 text-white"
          >
            {saving ? <RefreshCw className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
            Save All Changes
          </Button>
        </div>
      </div>

      {/* Google Sheets Sync Card */}
      <Card className="border border-border/80 bg-linear-to-r from-rose-50/50 via-background to-amber-50/40 dark:from-rose-950/20 dark:to-background">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center justify-between">
            <span className="flex items-center gap-2">
              <FileSpreadsheet className="size-4 text-emerald-600" />
              Google Sheets Live Sync (ऑटोमैटिक शीट से लिंक्स अपडेट करें)
            </span>
            <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
              ⚡ 1-Click Sync
            </Badge>
          </CardTitle>
          <CardDescription className="text-xs">
            अपनी Google Sheet का लिंक यहाँ पेस्ट करें। जब भी आप शीट में नए लिंक्स जोड़ेंगे, बस &ldquo;Sync Now&rdquo; दबाने पर पूरा सिस्टम स्वतः अपडेट हो जाएगा।
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="https://docs.google.com/spreadsheets/d/.../edit#gid=0"
                value={googleSheetsUrl}
                onChange={(e) => setGoogleSheetsUrl(e.target.value)}
                className="pl-9 text-xs font-mono"
              />
            </div>
            <Button
              onClick={handleSyncSheet}
              disabled={syncing || !googleSheetsUrl.trim()}
              className="gap-1.5 shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
            >
              <RefreshCw className={`size-3.5 ${syncing ? 'animate-spin' : ''}`} />
              Sync Now
            </Button>
          </div>
          <div className="mt-2 text-[11px] text-muted-foreground flex items-center gap-1.5">
            <HelpCircle className="size-3 text-amber-500" />
            <span>
              शीट को <strong>&ldquo;Anyone with the link can view&rdquo;</strong> पर रखें। शीट के कॉलम: <code>Disease Name, YouTube Link</code>
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Filter and Add Bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            placeholder="बीमारी खोजें (PCOD, Tubal, Sperm, AMH...)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 text-xs h-9"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCustomModalOpen(true)}
          className="gap-1 text-xs cursor-pointer"
        >
          <Plus className="size-3.5 text-rose-500" />
          Add Custom Disease Link
        </Button>
      </div>

      {/* Disease Video Cards List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredVideos.map((entry) => {
          const hasLink = !!entry.youtubeUrl && entry.youtubeUrl.trim().length > 0;
          return (
            <Card
              key={entry.category}
              className={`border transition-all ${
                hasLink ? 'border-border/80 bg-card' : 'border-dashed border-amber-300/80 bg-amber-50/20'
              }`}
            >
              <CardHeader className="p-4 pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                      {entry.diseaseNameHindi}
                      {hasLink && <CheckCircle2 className="size-3.5 text-emerald-500" />}
                    </h3>
                    <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                      {entry.title || entry.category}
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-[10px] font-mono shrink-0">
                    {entry.category}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-1 space-y-3">
                {/* Video Link Input */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="font-medium text-slate-700 dark:text-slate-300">YouTube / Video URL:</span>
                    {hasLink ? (
                      <a
                        href={entry.youtubeUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-rose-600 hover:text-rose-700 hover:underline inline-flex items-center gap-1 text-[11px]"
                      >
                        <ExternalLink className="size-3" />
                        वीडियो खोलकर देखें
                      </a>
                    ) : (
                      <span className="text-amber-600 font-medium">लिंक खाली है (No Link)</span>
                    )}
                  </div>
                  <Input
                    value={entry.youtubeUrl || ''}
                    placeholder="https://www.youtube.com/watch?v=..."
                    onChange={(e) => handleUpdateUrl(entry.category, e.target.value)}
                    className="text-xs h-8 font-mono"
                  />
                </div>

                {/* Emotional Hook Preview */}
                <div className="rounded-md bg-muted/50 p-2.5 text-[11px] text-muted-foreground border border-border/50">
                  <div className="font-medium text-foreground text-[11px] mb-1 flex items-center gap-1">
                    <Sparkles className="size-3 text-rose-500" />
                    मरीज को जाने वाला भावनात्मक मैसेज:
                  </div>
                  <p className="line-clamp-2 italic">{entry.emotionalHookHindi}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* CSV / Excel Paste Modal */}
      <Dialog open={csvModalOpen} onOpenChange={setCsvModalOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden shadow-2xl border">
          <DialogHeader className="p-4 sm:p-5 pb-3 border-b shrink-0 bg-muted/10">
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <FileSpreadsheet className="size-5 text-emerald-600" />
              Excel / CSV से वीडियो लिंक्स पेस्ट करें
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              अपनी Excel शीट से पंक्तियाँ कॉपी करके यहाँ सीधे पेस्ट करें। सिस्टम अपने-आप बीमारी और लिंक को पहचान कर अपडेट कर देगा।
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
            <div className="text-[11px] bg-slate-50 dark:bg-slate-900 p-2.5 rounded border text-muted-foreground font-mono">
              उदाहरण फॉर्मेट:<br />
              PCOD/PCOS,https://www.youtube.com/watch?v=SIwdLPiapGk<br />
              Infertility,https://youtu.be/Ff7-H4rdh34<br />
              Tubal Blockage,https://www.youtube.com/watch?v=DaGu2ZeSuBg
            </div>

            <Textarea
              rows={8}
              placeholder="यहाँ अपनी Excel शीट से कॉपी किया हुआ डाटा पेस्ट करें..."
              value={csvPasteText}
              onChange={(e) => setCsvPasteText(e.target.value)}
              className="font-mono text-xs"
            />
          </div>

          <DialogFooter className="p-3.5 sm:p-4 border-t bg-muted/30 shrink-0 flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setCsvModalOpen(false)}>
              रद्द करें
            </Button>
            <Button
              size="sm"
              onClick={handleImportCsv}
              disabled={saving || !csvPasteText.trim()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs h-8.5 gap-1.5"
            >
              {saving ? <RefreshCw className="size-3.5 animate-spin" /> : 'इम्पोर्ट व सेव करें'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Custom Disease Modal */}
      <Dialog open={customModalOpen} onOpenChange={setCustomModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden shadow-2xl border">
          <DialogHeader className="p-4 sm:p-5 pb-3 border-b shrink-0 bg-muted/10">
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <Plus className="size-5 text-rose-500" />
              नई बीमारी का वीडियो लिंक जोड़ें
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              अपनी नई बीमारी का नाम, YouTube / Instagram वीडियो लिंक, कीवर्ड्स और भावनात्मक मैसेज दर्ज करें।
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 text-xs">
            <div>
              <label className="font-semibold block mb-1 text-slate-700 dark:text-slate-300">
                बीमारी का नाम (Hindi/English): <span className="text-rose-500">*</span>
              </label>
              <Input
                placeholder="उदा. Tubal Blockage / फेलोपियन ट्यूब ब्लॉकेज"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                className="h-8.5 text-xs"
              />
            </div>

            <div>
              <label className="font-semibold block mb-1 text-slate-700 dark:text-slate-300">
                Video Link (YouTube / Instagram): <span className="text-rose-500">*</span>
              </label>
              <Input
                placeholder="https://www.youtube.com/watch?v=... या Instagram Reel Link"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                className="h-8.5 text-xs font-mono"
              />
            </div>

            <div>
              <label className="font-semibold block mb-1 text-slate-700 dark:text-slate-300">
                पहचान के कीवर्ड्स (कॉमा से अलग करें):
              </label>
              <Input
                placeholder="उदा. tubal blockage, ट्यूब ब्लॉक, बंद ट्यूब, दोनों ट्यूब बंद"
                value={customKeywords}
                onChange={(e) => setCustomKeywords(e.target.value)}
                className="h-8.5 text-xs"
              />
              <span className="text-[10px] text-muted-foreground mt-0.5 block">
                मरीज जब व्हाट्सएप पर इनमें से कोई भी शब्द लिखेगा, तो यह वीडियो अपने आप मैच हो जाएगा।
              </span>
            </div>

            <div>
              <label className="font-semibold block mb-1 text-slate-700 dark:text-slate-300">
                भावनात्मक मैसेज (Emotional Message):
              </label>
              <Textarea
                rows={6}
                placeholder="मरीज को वीडियो देखने के लिए प्रेरित करने वाला प्यारा संदेश..."
                value={customHook}
                onChange={(e) => setCustomHook(e.target.value)}
                className="text-xs font-sans resize-y min-h-[100px] leading-relaxed"
              />
              <span className="text-[10px] text-muted-foreground mt-0.5 block">
                यह मैसेज वीडियो लिंक के साथ मरीज को भेजा जाएगा।
              </span>
            </div>
          </div>

          <DialogFooter className="p-3.5 sm:p-4 border-t bg-muted/30 shrink-0 flex items-center justify-between gap-2">
            <span className="text-[11px] text-muted-foreground hidden sm:inline">
              * जोड़ते ही यह सिस्टम में सुरक्षित हो जाएगा
            </span>
            <div className="flex items-center gap-2 ml-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCustomModalOpen(false)}
                disabled={saving}
                className="text-xs h-8.5 cursor-pointer"
              >
                रद्द करें
              </Button>
              <Button
                size="sm"
                onClick={handleAddCustom}
                disabled={saving || !customName.trim() || !customUrl.trim()}
                className="bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs h-8.5 gap-1.5 shadow-sm cursor-pointer"
              >
                {saving ? (
                  <>
                    <RefreshCw className="size-3.5 animate-spin" />
                    सेव हो रहा है...
                  </>
                ) : (
                  <>
                    <Save className="size-3.5" />
                    जोड़ें व सेव करें (Add & Save)
                  </>
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
