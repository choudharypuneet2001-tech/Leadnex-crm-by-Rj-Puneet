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
  Radio,
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
  const [provider, setProvider] = useState<VoiceProvider>('elevenlabs');
  const [selectedVoice, setSelectedVoice] = useState<string>('monika_sogam');
  const [customVoiceId, setCustomVoiceId] = useState<string>('');
  const [elevenLabsApiKey, setElevenLabsApiKey] = useState<string>('');
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [speechSpeed, setSpeechSpeed] = useState<number>(1.0);
  const [saving, setSaving] = useState(false);

  // Load saved preferences from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedProvider = (localStorage.getItem('gynocci_voice_provider') as VoiceProvider) || 'elevenlabs';
      const savedVoice = localStorage.getItem('gynocci_voice_id') || 'monika_sogam';
      const savedCustomId = localStorage.getItem('gynocci_custom_voice_id') || '';
      const savedElevenKey = localStorage.getItem('gynocci_elevenlabs_key') || '';

      setProvider(savedProvider);
      setSelectedVoice(savedVoice);
      setCustomVoiceId(savedCustomId);
      setElevenLabsApiKey(savedElevenKey);
    }
  }, []);

  // Play Sample Audio for selected voice
  const handlePlaySample = async (voiceKey: string, explicitVoiceId?: string) => {
    setPlayingVoice(voiceKey);
    const sampleText =
      'नमस्ते जी! मैं Gynocci Femtech से डॉ. शिखा बात कर रही हूँ। आप बिल्कुल निश्चिंत रहिये, हमारे 5 सीनियर डॉक्टरों का विशेषज्ञ पैनल आपकी रिपोर्ट्स की पूरी जांच करेगा।';

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
      toast.error('ऑडियो सैंपल प्ले करने में समस्या आई। कृपया API Key जांचें।');
    } finally {
      setPlayingVoice(null);
    }
  };

  const handleSave = () => {
    setSaving(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem('gynocci_voice_provider', provider);
      localStorage.setItem('gynocci_voice_id', selectedVoice);
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
          प्राकृतिक भारतीय हिंदी महिला स्वर (Natural Indian Hindi Female Voice), ElevenLabs इंटीग्रेशन और लाइव कॉलिंग कॉन्फ़िगरेशन।
        </p>
      </div>

      {/* Voice Engine / Provider Selection */}
      <Card className="border-rose-200 bg-rose-50/20 dark:bg-rose-950/10">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Sparkles className="size-5 text-rose-500" />
              Voice Engine (वॉइस इंजन का चुनाव)
            </span>
            <Badge className="bg-rose-500 text-white font-semibold text-xs">
              ElevenLabs (100% Human Indian Hindi)
            </Badge>
          </CardTitle>
          <CardDescription className="text-xs">
            OpenAI की आवाज़ों में हल्का विदेशी एक्सेंट होता है, जबकि **ElevenLabs** में असली भारतीय हिंदी महिला का नैचुरल लहजा, सांस और ठहराव मिलता है।
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div
              onClick={() => setProvider('elevenlabs')}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                provider === 'elevenlabs'
                  ? 'border-rose-500 bg-white dark:bg-slate-900 ring-2 ring-rose-500/30 shadow-xs'
                  : 'border-border bg-card hover:border-slate-300'
              }`}
            >
              <div className={`mt-0.5 rounded-full p-1.5 ${provider === 'elevenlabs' ? 'bg-rose-500 text-white' : 'bg-muted text-muted-foreground'}`}>
                <Sparkles className="size-4" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-foreground">ElevenLabs (अनुशंसित)</span>
                  {provider === 'elevenlabs' && <Check className="size-4 text-rose-600 font-bold" />}
                </div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Monika Sogam और Kanishka जैसी 100% स्वाभाविक, भारतीय हिंदी महिला की आवाज।
                </p>
              </div>
            </div>

            <div
              onClick={() => setProvider('openai')}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                provider === 'openai'
                  ? 'border-rose-500 bg-white dark:bg-slate-900 ring-2 ring-rose-500/30 shadow-xs'
                  : 'border-border bg-card hover:border-slate-300'
              }`}
            >
              <div className={`mt-0.5 rounded-full p-1.5 ${provider === 'openai' ? 'bg-rose-500 text-white' : 'bg-muted text-muted-foreground'}`}>
                <Volume2 className="size-4" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-foreground">OpenAI TTS (बैकअप)</span>
                  {provider === 'openai' && <Check className="size-4 text-rose-600 font-bold" />}
                </div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Shimmer / Nova आवाज़ें — फास्ट हैं पर हिंदी में न्यूट्रल/अमेरिकन एक्सेंट रहता है।
                </p>
              </div>
            </div>
          </div>

          {/* ElevenLabs API Key Field */}
          {provider === 'elevenlabs' && (
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-rose-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Key className="size-3.5 text-rose-500" />
                  ElevenLabs API Key
                </label>
                <a
                  href="https://elevenlabs.io"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-rose-600 hover:underline flex items-center gap-1 font-medium"
                >
                  ElevenLabs पर फ्री अकाउंट बनाएं (10,000 अक्षर फ्री)
                  <ExternalLink className="size-3" />
                </a>
              </div>
              <Input
                type="password"
                placeholder="sk_xxxxxxxxxxxxxxxxxxxxxxxxx (या .env.local में ELEVENLABS_API_KEY डालें)"
                value={elevenLabsApiKey}
                onChange={(e) => setElevenLabsApiKey(e.target.value)}
                className="font-mono text-xs bg-background"
              />
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                💡 <strong>टिप:</strong> यदि आपने <code>.env.local</code> में <code>ELEVENLABS_API_KEY=...</code> सेट किया हुआ है, तो यहाँ डालने की आवश्यकता नहीं है, सिस्टम अपने आप ले लेगा।
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Female Voice Selection Cards */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Headphones className="size-5 text-rose-500" />
              भारतीय महिला वॉयस का चुनाव (Select Indian Female Voice)
            </span>
            <Badge variant="outline" className="text-xs bg-rose-50 text-rose-700 border-rose-200">
              Natural Human Touch
            </Badge>
          </CardTitle>
          <CardDescription className="text-xs">
            अपनी पसंद की स्वाभाविक हिंदी महिला वॉयस चुनें और उसका ऑडियो सैंपल सुनकर देखें।
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Monika Sogam (ElevenLabs) */}
            <div
              onClick={() => setSelectedVoice('monika_sogam')}
              className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                selectedVoice === 'monika_sogam'
                  ? 'border-rose-500 bg-rose-50/40 dark:bg-rose-950/20 ring-1 ring-rose-500 shadow-xs'
                  : 'border-border hover:border-slate-300 bg-card'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-sm text-foreground">Monika Sogam (ElevenLabs)</span>
                  {selectedVoice === 'monika_sogam' && <Check className="size-4 text-rose-600 font-bold" />}
                </div>
                <Badge variant="secondary" className="text-[10px] font-semibold mb-2 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                  Top Recommended for Gynocci
                </Badge>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  बेहद शांत, स्वाभाविक और हमदर्द भारतीय महिला स्वर — बिल्कुल एक अनुभवी सीनियर महिला डॉक्टर जैसी टोन।
                </p>
                <div className="mt-2 text-[10px] font-mono text-muted-foreground/80">
                  Voice ID: 1qEiC6qsybMkmnNdVMbK
                </div>
              </div>

              <div className="pt-3 mt-3 border-t border-border/50">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePlaySample('monika_sogam', '1qEiC6qsybMkmnNdVMbK');
                  }}
                  className="w-full text-xs gap-1.5 cursor-pointer text-rose-600 border-rose-200 hover:bg-rose-50"
                >
                  {playingVoice === 'monika_sogam' ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Play className="size-3.5 fill-current" />
                  )}
                  {playingVoice === 'monika_sogam' ? 'आवाज़ बज रही है...' : 'Monika की आवाज़ सुनें'}
                </Button>
              </div>
            </div>

            {/* Kanishka / Custom Voice ID */}
            <div
              onClick={() => setSelectedVoice('custom')}
              className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                selectedVoice === 'custom'
                  ? 'border-rose-500 bg-rose-50/40 dark:bg-rose-950/20 ring-1 ring-rose-500 shadow-xs'
                  : 'border-border hover:border-slate-300 bg-card'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-sm text-foreground">कनिष्का / Custom Voice ID</span>
                  {selectedVoice === 'custom' && <Check className="size-4 text-rose-600 font-bold" />}
                </div>
                <Badge variant="secondary" className="text-[10px] font-semibold mb-2 bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300">
                  Custom Voice Lab
                </Badge>
                <p className="text-xs text-muted-foreground leading-relaxed mb-2">
                  ElevenLabs Voice Lab या Community से किसी भी क्लोन की Voice ID यहाँ डालें (जैसे Kanishka)।
                </p>
                <Input
                  placeholder="Paste ElevenLabs Voice ID"
                  value={customVoiceId}
                  onChange={(e) => {
                    setCustomVoiceId(e.target.value);
                    setSelectedVoice('custom');
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="h-7 text-xs font-mono bg-background"
                />
              </div>

              <div className="pt-3 mt-3 border-t border-border/50">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePlaySample('custom', customVoiceId.trim() || '1qEiC6qsybMkmnNdVMbK');
                  }}
                  className="w-full text-xs gap-1.5 cursor-pointer text-purple-600 border-purple-200 hover:bg-purple-50"
                >
                  {playingVoice === 'custom' ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Play className="size-3.5 fill-current" />
                  )}
                  {playingVoice === 'custom' ? 'आवाज़ बज रही है...' : 'Custom आवाज़ सुनें'}
                </Button>
              </div>
            </div>

            {/* DB Indian Female */}
            <div
              onClick={() => setSelectedVoice('db_indian')}
              className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                selectedVoice === 'db_indian'
                  ? 'border-rose-500 bg-rose-50/40 dark:bg-rose-950/20 ring-1 ring-rose-500 shadow-xs'
                  : 'border-border hover:border-slate-300 bg-card'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-sm text-foreground">DB Indian (ElevenLabs)</span>
                  {selectedVoice === 'db_indian' && <Check className="size-4 text-rose-600 font-bold" />}
                </div>
                <Badge variant="secondary" className="text-[10px] font-semibold mb-2 bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
                  Melodious & Conversational
                </Badge>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  मधुर, स्पष्ट और युवा भारतीय महिला स्वर — फॉलो-अप और अपॉइंटमेंट रिमाइंडर के लिए बढ़िया।
                </p>
                <div className="mt-2 text-[10px] font-mono text-muted-foreground/80">
                  Voice ID: 2F1KINpxsttim2WfMbVs
                </div>
              </div>

              <div className="pt-3 mt-3 border-t border-border/50">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePlaySample('db_indian', '2F1KINpxsttim2WfMbVs');
                  }}
                  className="w-full text-xs gap-1.5 cursor-pointer text-blue-600 border-blue-200 hover:bg-blue-50"
                >
                  {playingVoice === 'db_indian' ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Play className="size-3.5 fill-current" />
                  )}
                  {playingVoice === 'db_indian' ? 'आवाज़ बज रही है...' : 'DB Indian आवाज़ सुनें'}
                </Button>
              </div>
            </div>
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
              Vapi.ai या Twilio पर नया अकाउंट बनाने पर आपको लगभग <strong>$10 का फ्री ट्रायल क्रेडिट</strong> मिलता है। ElevenLabs को Vapi में 1-क्लिक में जोड़ा जा सकता है जिससे Monika Sogam या Kanishka की आवाज़ सीधे मरीज़ के फोन पर कॉल करेगी।
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
