'use client';

import React, { useState } from 'react';
import {
  PhoneCall,
  Volume2,
  Play,
  Loader2,
  Check,
  Sparkles,
  Info,
  ExternalLink,
  ShieldCheck,
  Headphones,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { VoicePersona } from '@/lib/voice/voice-agent-service';

export function VoiceSettings() {
  const [selectedVoice, setSelectedVoice] = useState<VoicePersona>('shimmer');
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [speechSpeed, setSpeechSpeed] = useState<number>(1.0);
  const [saving, setSaving] = useState(false);

  // Play Sample Audio for female voice
  const handlePlaySample = async (voice: VoicePersona) => {
    setPlayingVoice(voice);
    const sampleText =
      'नमस्ते जी! मैं Gynocci Femtech से डॉ. शिखा बात कर रही हूँ। आप बिल्कुल निश्चिंत रहिये, हमारे 5 सीनियर डॉक्टरों का पैनल आपकी सहायता के लिए सदैव तत्पर है।';

    try {
      const res = await fetch('/api/voice/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: sampleText, voice, speed: speechSpeed }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.audioBase64) {
          const audio = new Audio(data.audioBase64);
          audio.onended = () => setPlayingVoice(null);
          await audio.play();
          return;
        }
      }
    } catch {
      // Fallback to browser TTS
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(sampleText);
      utterance.lang = 'hi-IN';
      utterance.pitch = 1.1;
      utterance.onend = () => setPlayingVoice(null);
      window.speechSynthesis.speak(utterance);
    } else {
      setPlayingVoice(null);
    }
  };

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      toast.success('वॉयस सेटिंग्स सुरक्षित कर दी गईं!');
    }, 400);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-border pb-5">
        <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <PhoneCall className="size-6 text-rose-500" />
          AI Voice Calling Agent Settings (कॉलिंग एजेंट)
        </h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          प्राकृतिक महिला वॉयस (Natural Human Female Voice), बोलने का टोन, स्पीड और लाइव कॉलिंग कॉन्फ़िगरेशन।
        </p>
      </div>

      {/* Female Voice Selection Cards */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Headphones className="size-5 text-rose-500" />
              महिला वॉयस का चुनाव (Select Human Female Voice)
            </span>
            <Badge variant="outline" className="text-xs bg-rose-50 text-rose-700 border-rose-200">
              Ultra-Realistic AI Voice
            </Badge>
          </CardTitle>
          <CardDescription className="text-xs">
            OpenAI Realtime एवं Neural TTS आधारित स्वाभाविक मानवीय हिंदी आवाज़ें।
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {
                id: 'shimmer',
                name: 'डॉ. शिखा (Shimmer)',
                tag: 'Recommended for Gynocci',
                desc: 'बेहद सौम्य, शांत, हमदर्द और भरोसेमंद महिला स्वर — मेडिकल और मातृत्व परामर्श के लिए सबसे उत्तम।',
              },
              {
                id: 'nova',
                name: 'डॉ. सुमन (Nova)',
                tag: 'Warm & Energetic',
                desc: 'गर्मजोशी भरी, स्पष्ट और सक्रिय बातचीत वाली महिला आवाज़ — टेलीकॉलिंग और फॉलो-अप के लिए शानदार।',
              },
              {
                id: 'sage',
                name: 'डॉ. अंजलि (Sage)',
                tag: 'Calm & Professional',
                desc: 'गंभीर, तसल्लीबख्श और परिपक्व क्लीनिकल आवाज़ — केस डिस्कशन के लिए उपयुक्त।',
              },
            ].map((v) => {
              const active = selectedVoice === v.id;
              const isPlaying = playingVoice === v.id;
              return (
                <div
                  key={v.id}
                  onClick={() => setSelectedVoice(v.id as VoicePersona)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                    active
                      ? 'border-rose-500 bg-rose-50/40 dark:bg-rose-950/20 ring-1 ring-rose-500 shadow-xs'
                      : 'border-border hover:border-slate-300 bg-card'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-sm text-foreground">{v.name}</span>
                      {active && <Check className="size-4 text-rose-600" />}
                    </div>
                    <Badge variant="secondary" className="text-[10px] font-medium mb-2 bg-muted text-muted-foreground">
                      {v.tag}
                    </Badge>
                    <p className="text-xs text-muted-foreground leading-relaxed">{v.desc}</p>
                  </div>

                  <div className="pt-3 mt-2 border-t border-border/50">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePlaySample(v.id as VoicePersona);
                      }}
                      className="w-full text-xs gap-1.5 cursor-pointer text-rose-600 border-rose-200 hover:bg-rose-50"
                    >
                      {isPlaying ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Play className="size-3.5 fill-current" />
                      )}
                      {isPlaying ? 'आवाज़ बज रही है...' : 'आवाज़ का सैंपल सुनें'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Speed control */}
          <div className="pt-2 flex items-center justify-between max-w-sm">
            <span className="text-xs font-medium text-foreground">बोलने की गति (Speech Speed):</span>
            <div className="flex items-center gap-1.5">
              {[0.9, 1.0, 1.1].map((s) => (
                <Button
                  key={s}
                  type="button"
                  variant={speechSpeed === s ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSpeechSpeed(s)}
                  className="h-7 px-2.5 text-xs cursor-pointer"
                >
                  {s}x
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Telephony Gateway Setup Guide */}
      <Card className="border border-border/80 bg-linear-to-r from-slate-50 via-background to-slate-50 dark:from-slate-900/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="size-5 text-emerald-600" />
            मोबाइल सिम कॉलिंग गेटवे (Telephony Provider Setup)
          </CardTitle>
          <CardDescription className="text-xs">
            जब आप प्रोटोटाइप से आगे बढ़कर सीधे मरीज के सिम कार्ड पर घंटी बजाना चाहेंगे, तो यह सेटिंग्स काम आएंगी:
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-xs text-muted-foreground leading-relaxed">
          <div className="bg-background p-3 rounded-lg border border-border">
            <div className="font-semibold text-foreground mb-1">मुफ्त टेस्टिंग विकल्प (Free Trial):</div>
            <p>
              Bland.ai, Vapi.ai या Twilio पर नया अकाउंट बनाने पर आपको लगभग <strong>$10 से $15 (करीब 50-100 कॉलिंग मिनट्स) का फ्री ट्रायल</strong> मिलता है। इसके लिए आपको कोई अतिरिक्त भुगतान नहीं करना पड़ता।
            </p>
          </div>

          <div className="bg-background p-3 rounded-lg border border-border">
            <div className="font-semibold text-foreground mb-1">वेबहुक एंडपॉइंट्स (Webhooks for Live Calls):</div>
            <p className="font-mono text-[11px] text-slate-700 dark:text-slate-300">
              • Call Initiate API: <code>/api/voice/call</code><br />
              • Call Streaming Webhook: <code>/api/voice/chat</code>
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="bg-rose-600 hover:bg-rose-700 text-white cursor-pointer">
          {saving ? 'सुरक्षित हो रहा है...' : 'Save Voice Settings (सेव करें)'}
        </Button>
      </div>
    </div>
  );
}
