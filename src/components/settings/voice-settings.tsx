'use client';

import React, { useState, useEffect } from 'react';
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
  Key,
  BadgeCheck,
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
import {
  ELEVENLABS_INDIAN_FEMALE_VOICES,
  type VoicePersona,
  type VoiceProvider,
} from '@/lib/voice/voice-agent-service';

export function VoiceSettings() {
  const [provider, setProvider] = useState<VoiceProvider>('openai');
  const [selectedVoice, setSelectedVoice] = useState<string>('nova');
  const [customVoiceId, setCustomVoiceId] = useState<string>('');
  const [elevenLabsApiKey, setElevenLabsApiKey] = useState<string>('');
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [speechSpeed, setSpeechSpeed] = useState<number>(0.93);
  const [saving, setSaving] = useState(false);

  // Load saved preferences from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedProvider = (localStorage.getItem('gynocci_voice_provider') as VoiceProvider) || 'openai';
      const savedVoice = localStorage.getItem('gynocci_voice_id') || 'nova';
      const savedCustomId = localStorage.getItem('gynocci_custom_voice_id') || '';
      const savedElevenKey = localStorage.getItem('gynocci_elevenlabs_key') || '';
      const savedSpeed = Number(localStorage.getItem('gynocci_voice_speed')) || 0.93;

      setProvider(savedProvider);
      setSelectedVoice(savedVoice);
      setCustomVoiceId(savedCustomId);
      setElevenLabsApiKey(savedElevenKey);
      setSpeechSpeed(savedSpeed);
    }
  }, []);

  // Play Sample Audio for selected voice
  const handlePlaySample = async (voiceKey: string, explicitVoiceId?: string) => {
    setPlayingVoice(voiceKey);
    // Phonetically enriched Hindi text for zero-robotics natural flow
    const sampleText =
      'नमस्ते जी, मैं गायनोसी फेमटेक से डॉ. शिखा बात कर रही हूँ। आप बिल्कुल निश्चिंत रहिये, हमारे पाँच सीनियर डॉक्टरों का विशेषज्ञ पैनल केवल चार सौ निन्यानवे रुपये में आपकी पूरी केस हिस्ट्री समझेगा।';

    try {
      const activeVoiceId =
        explicitVoiceId ||
        (voiceKey === 'custom'
          ? customVoiceId.trim() || ELEVENLABS_INDIAN_FEMALE_VOICES.monika_sogam.id
          : ELEVENLABS_INDIAN_FEMALE_VOICES[voiceKey]?.id);

      const res = await fetch('/api/voice/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: sampleText,
          provider: provider,
          voice: voiceKey,
          voiceId: activeVoiceId,
          speed: speechSpeed,
          customElevenLabsApiKey: elevenLabsApiKey.trim() || undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.audioBase64) {
          const audio = new Audio(data.audioBase64);
          audio.onended = () => setPlayingVoice(null);
          audio.onerror = () => setPlayingVoice(null);
          await audio.play();
          return;
        }
      } else {
        const errJson = await res.json().catch(() => ({}));
        if (errJson.error) {
          toast.error(errJson.error);
        }
      }
    } catch (err: any) {
      console.warn('Sample playback failed:', err);
      toast.error('ऑडियो सैंपल प्ले करने में समस्या आई।');
    } finally {
      setPlayingVoice(null);
    }
  };

  const handleSave = () => {
    setSaving(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem('gynocci_voice_provider', provider);
      localStorage.setItem('gynocci_voice_id', selectedVoice);
      localStorage.setItem('gynocci_voice_speed', String(speechSpeed));
      localStorage.setItem('gynocci_custom_voice_id', customVoiceId.trim());
      if (elevenLabsApiKey.trim()) {
        localStorage.setItem('gynocci_elevenlabs_key', elevenLabsApiKey.trim());
      }
    }
    setTimeout(() => {
      setSaving(false);
      toast.success('वॉयस सेटिंग्स सफलतापूर्वक सेव कर दी गईं!');
    }, 300);
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
          प्राकृतिक मानवीय महिला स्वर (Natural Human Female Voice), बिना किसी अतिरिक्त पेड प्लान के, सीधे आपके $10 OpenAI रीचार्ज से ट्यून किया हुआ।
        </p>
      </div>

      {/* No Paid Plan Needed Banner */}
      <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 flex items-start gap-3">
        <BadgeCheck className="size-5 text-emerald-600 mt-0.5 shrink-0" />
        <div className="text-xs space-y-1">
          <div className="font-semibold text-emerald-900 dark:text-emerald-200">
            कोई नया प्लान या ElevenLabs सब्सक्रिप्शन लेने की ज़रूरत नहीं है!
          </div>
          <p className="text-emerald-800/80 dark:text-emerald-300/80 leading-relaxed">
            हमने आपके <strong>$10 OpenAI बैलेंस</strong> के साथ ही <strong>High-Definition (tts-1-hd)</strong> मॉडल और <strong>हिंदी फोनेटिक नॉर्मलाइज़र</strong> जोड़ दिया है। अब संख्याएँ (जैसे ₹499), अंग्रेजी नाम (Gynocci) और मेडिकल टर्म्स बिना किसी रोबोटिक विदेशी एक्सेंट के बिल्कुल स्वाभाविक भारतीय महिला के लहजे में बोले जाएंगे।
          </p>
        </div>
      </div>

      {/* Recommended OpenAI HD Female Voices */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Headphones className="size-5 text-rose-500" />
              भारतीय महिला वॉयस का चुनाव (Select Female Voice)
            </span>
            <Badge className="bg-rose-500 text-white font-semibold text-xs">
              OpenAI HD Studio (Zero Extra Cost)
            </Badge>
          </CardTitle>
          <CardDescription className="text-xs">
            प्राकृतिक फोनेटिक ट्यूनिंग के साथ स्वाभाविक मानवीय हिंदी आवाज़ें:
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Nova HD - Best for Indian Doctor Cadence */}
            <div
              onClick={() => {
                setProvider('openai');
                setSelectedVoice('nova');
              }}
              className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                provider === 'openai' && selectedVoice === 'nova'
                  ? 'border-rose-500 bg-rose-50/40 dark:bg-rose-950/20 ring-1 ring-rose-500 shadow-xs'
                  : 'border-border hover:border-slate-300 bg-card'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-sm text-foreground">डॉ. शिखा (Nova HD)</span>
                  {provider === 'openai' && selectedVoice === 'nova' && (
                    <Check className="size-4 text-rose-600 font-bold" />
                  )}
                </div>
                <Badge variant="secondary" className="text-[10px] font-semibold mb-2 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                  Top Recommended (सबसे स्वाभाविक)
                </Badge>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  हमदर्द, सकारात्मक और शांत महिला डॉक्टर स्वर — 0.93x स्पीड व फोनेटिक हिंदी ट्यूनिंग के साथ बिल्कुल स्वाभाविक मानवीय टोन।
                </p>
              </div>

              <div className="pt-3 mt-3 border-t border-border/50">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setProvider('openai');
                    handlePlaySample('nova');
                  }}
                  className="w-full text-xs gap-1.5 cursor-pointer text-rose-600 border-rose-200 hover:bg-rose-50"
                >
                  {playingVoice === 'nova' ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Play className="size-3.5 fill-current" />
                  )}
                  {playingVoice === 'nova' ? 'आवाज़ बज रही है...' : 'Nova HD आवाज़ सुनें'}
                </Button>
              </div>
            </div>

            {/* Shimmer HD */}
            <div
              onClick={() => {
                setProvider('openai');
                setSelectedVoice('shimmer');
              }}
              className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                provider === 'openai' && selectedVoice === 'shimmer'
                  ? 'border-rose-500 bg-rose-50/40 dark:bg-rose-950/20 ring-1 ring-rose-500 shadow-xs'
                  : 'border-border hover:border-slate-300 bg-card'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-sm text-foreground">डॉ. सुमन (Shimmer HD)</span>
                  {provider === 'openai' && selectedVoice === 'shimmer' && (
                    <Check className="size-4 text-rose-600 font-bold" />
                  )}
                </div>
                <Badge variant="secondary" className="text-[10px] font-semibold mb-2 bg-muted text-muted-foreground">
                  Calm & Soothing
                </Badge>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  सौम्य, गंभीर और तसल्लीबख्श क्लीनिकल आवाज़ — मेडिकल रिपोर्ट्स और रिपोर्ट्स समझाने के लिए उत्तम।
                </p>
              </div>

              <div className="pt-3 mt-3 border-t border-border/50">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setProvider('openai');
                    handlePlaySample('shimmer');
                  }}
                  className="w-full text-xs gap-1.5 cursor-pointer text-slate-700 dark:text-slate-200 border-border hover:bg-muted"
                >
                  {playingVoice === 'shimmer' ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Play className="size-3.5 fill-current" />
                  )}
                  {playingVoice === 'shimmer' ? 'आवाज़ बज रही है...' : 'Shimmer HD आवाज़ सुनें'}
                </Button>
              </div>
            </div>

            {/* Alloy HD */}
            <div
              onClick={() => {
                setProvider('openai');
                setSelectedVoice('alloy');
              }}
              className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                provider === 'openai' && selectedVoice === 'alloy'
                  ? 'border-rose-500 bg-rose-50/40 dark:bg-rose-950/20 ring-1 ring-rose-500 shadow-xs'
                  : 'border-border hover:border-slate-300 bg-card'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-sm text-foreground">डॉ. अंजलि (Alloy HD)</span>
                  {provider === 'openai' && selectedVoice === 'alloy' && (
                    <Check className="size-4 text-rose-600 font-bold" />
                  )}
                </div>
                <Badge variant="secondary" className="text-[10px] font-semibold mb-2 bg-muted text-muted-foreground">
                  Articulate & Balanced
                </Badge>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  स्पष्ट, संतुलित और दोस्ताना बातचीत वाला स्वर — टेलीकॉलिंग और अपॉइंटमेंट कन्फर्मेशन के लिए उपयोगी।
                </p>
              </div>

              <div className="pt-3 mt-3 border-t border-border/50">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setProvider('openai');
                    handlePlaySample('alloy');
                  }}
                  className="w-full text-xs gap-1.5 cursor-pointer text-slate-700 dark:text-slate-200 border-border hover:bg-muted"
                >
                  {playingVoice === 'alloy' ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Play className="size-3.5 fill-current" />
                  )}
                  {playingVoice === 'alloy' ? 'आवाज़ बज रही है...' : 'Alloy HD आवाज़ सुनें'}
                </Button>
              </div>
            </div>
          </div>

          {/* Speed Control (0.93x is human cadence sweet spot) */}
          <div className="pt-3 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2 max-w-lg">
            <div>
              <span className="text-xs font-semibold text-foreground block">
                बोलने की गति (Speech Speed / Doctor Cadence):
              </span>
              <span className="text-[11px] text-muted-foreground">
                (0.93x गति पर आवाज़ में स्वाभाविक ठहराव और हमदर्दी सबसे अच्छी लगती है)
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {[
                { label: '0.88x (धीमा)', val: 0.88 },
                { label: '0.93x (सर्वश्रेष्ठ)', val: 0.93 },
                { label: '1.0x (सामान्य)', val: 1.0 },
              ].map((s) => (
                <Button
                  key={s.val}
                  type="button"
                  variant={speechSpeed === s.val ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSpeechSpeed(s.val)}
                  className={`h-7 px-2.5 text-xs cursor-pointer ${speechSpeed === s.val ? 'bg-rose-600 hover:bg-rose-700 text-white' : ''}`}
                >
                  {s.label}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Optional ElevenLabs Section (For users who already have a key) */}
      <Card className="border-border/60 bg-muted/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Sparkles className="size-4 text-purple-500" />
              वैकल्पिक: ElevenLabs (केवल यदि आपके पास पहले से Key हो)
            </span>
            <Badge variant="outline" className="text-[10px] text-muted-foreground">
              Optional / वैकल्पिक
            </Badge>
          </CardTitle>
          <CardDescription className="text-xs">
            आपको ElevenLabs खरीदने की कोई आवश्यकता नहीं है। यदि आपके पास पहले से कोई फ्री या पेड की मौजूद हो, तो आप यहाँ डाल सकते हैं।
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Input
              type="password"
              placeholder="ElevenLabs Key (वैकल्पिक - छोड़ सकते हैं)"
              value={elevenLabsApiKey}
              onChange={(e) => setElevenLabsApiKey(e.target.value)}
              className="text-xs font-mono bg-background max-w-md h-8"
            />
            {elevenLabsApiKey.trim() && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setProvider('elevenlabs');
                  handlePlaySample('monika_sogam', '1qEiC6qsybMkmnNdVMbK');
                }}
                className="h-8 text-xs cursor-pointer text-purple-600"
              >
                Monika आवाज़ टेस्ट करें
              </Button>
            )}
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
