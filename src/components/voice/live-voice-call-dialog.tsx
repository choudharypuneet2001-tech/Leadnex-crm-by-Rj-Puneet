'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileText,
  User,
  Heart,
  Play,
  RotateCcw,
  Send,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { createClient } from '@/lib/supabase/client';
import { addContactTag } from '@/lib/contacts/tag-api';
import type { VoicePersona } from '@/lib/voice/voice-agent-service';

interface LiveVoiceCallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientName?: string | null;
  phone?: string | null;
  concern?: string | null;
  city?: string | null;
  adName?: string | null;
  contactId?: string | null;
}

interface TranscriptItem {
  id: string;
  sender: 'ai' | 'patient';
  text: string;
  timestamp: string;
}

export function LiveVoiceCallDialog({
  open,
  onOpenChange,
  patientName,
  phone,
  concern,
  city,
  adName,
  contactId,
}: LiveVoiceCallDialogProps) {
  const supabase = createClient();

  // Call Status: idle | ringing | connected | ended
  const [callState, setCallState] = useState<'idle' | 'ringing' | 'connected' | 'ended'>('idle');
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [userInput, setUserInput] = useState('');
  const [loadingReply, setLoadingReply] = useState(false);
  const [savingOutcome, setSavingOutcome] = useState(false);
  const [detectedDisposition, setDetectedDisposition] = useState<string>('Interested');
  const [tagColor, setTagColor] = useState<string>('#8b5cf6');

  // Selected Female Voice Persona
  const [voicePersona, setVoicePersona] = useState<VoicePersona>('shimmer');

  // Audio elements & timers
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const recognitionRef = useRef<any>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  // Format Call Timer (00:00)
  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Scroll transcript to bottom
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  // Handle Call Timer
  useEffect(() => {
    if (callState === 'connected') {
      timerIntervalRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [callState]);

  // Start Live Audio Call
  const startCall = async () => {
    setCallState('ringing');
    setCallDuration(0);
    setTranscript([]);

    // Simulate 1.5s ringing before doctor AI answers
    setTimeout(async () => {
      setCallState('connected');

      // AI initial greeting
      const pName = patientName && patientName !== 'Unknown' ? `${patientName} जी` : 'जी';
      const initialGreeting = `नमस्ते ${pName}! मैं Gynocci Femtech से डॉ. शिखा बात कर रही हूँ। आशा है आप और आपका परिवार सकुशल हैं?`;

      const initialItem: TranscriptItem = {
        id: Math.random().toString(),
        sender: 'ai',
        text: initialGreeting,
        timestamp: new Date().toLocaleTimeString('hi-IN', { hour: '2-digit', minute: '2-digit' }),
      };

      setTranscript([initialItem]);
      await playSpeechAudio(initialGreeting, voicePersona);
    }, 1500);
  };

  // Play Speech Audio via OpenAI TTS or browser fallback
  const playSpeechAudio = async (text: string, voice: VoicePersona) => {
    setIsAiSpeaking(true);
    try {
      const res = await fetch('/api/voice/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.audioBase64) {
          if (!audioPlayerRef.current) {
            audioPlayerRef.current = new Audio();
          }
          audioPlayerRef.current.src = data.audioBase64;
          audioPlayerRef.current.onended = () => {
            setIsAiSpeaking(false);
          };
          await audioPlayerRef.current.play();
          return;
        }
      }
    } catch (err) {
      console.warn('[live-voice-call] audio playback fallback to browser speech:', err);
    }

    // Browser Speech Synthesis Fallback (zero latency, zero cost)
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'hi-IN';
      utterance.rate = 0.95;
      utterance.pitch = 1.1; // Softer female tone
      utterance.onend = () => setIsAiSpeaking(false);
      window.speechSynthesis.speak(utterance);
    } else {
      setIsAiSpeaking(false);
    }
  };

  // Send Patient speech to AI Agent
  const handleSendPatientSpeech = async (patientSpeech: string) => {
    if (!patientSpeech.trim() || loadingReply) return;

    const userText = patientSpeech.trim();
    setUserInput('');

    // Add Patient speech to transcript
    const patientItem: TranscriptItem = {
      id: Math.random().toString(),
      sender: 'patient',
      text: userText,
      timestamp: new Date().toLocaleTimeString('hi-IN', { hour: '2-digit', minute: '2-digit' }),
    };

    setTranscript((prev) => [...prev, patientItem]);
    setLoadingReply(true);

    try {
      const history = transcript.map((t) => ({
        role: t.sender === 'ai' ? ('assistant' as const) : ('user' as const),
        content: t.text,
      }));

      const res = await fetch('/api/voice/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userText,
          history,
          patientName,
          phone,
          concern,
          city,
          adName,
          voice: voicePersona,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to get reply');

      const aiReplyText = data.text;
      if (data.disposition) setDetectedDisposition(data.disposition);
      if (data.tagColor) setTagColor(data.tagColor);

      // Add AI reply to transcript
      const aiItem: TranscriptItem = {
        id: Math.random().toString(),
        sender: 'ai',
        text: aiReplyText,
        timestamp: new Date().toLocaleTimeString('hi-IN', { hour: '2-digit', minute: '2-digit' }),
      };
      setTranscript((prev) => [...prev, aiItem]);

      // Play audio response
      if (data.audioBase64) {
        if (!audioPlayerRef.current) audioPlayerRef.current = new Audio();
        audioPlayerRef.current.src = data.audioBase64;
        setIsAiSpeaking(true);
        audioPlayerRef.current.onended = () => setIsAiSpeaking(false);
        await audioPlayerRef.current.play();
      } else {
        await playSpeechAudio(aiReplyText, voicePersona);
      }
    } catch (err: any) {
      toast.error(err.message || 'कॉल में त्रुटि आई');
      setIsAiSpeaking(false);
    } finally {
      setLoadingReply(false);
    }
  };

  // Toggle Live Microphone Listening (Web Speech API)
  const toggleListening = () => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      toast.info('कृपया नीचे दिए गए बटन्स या टाइप करके बोलें');
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'hi-IN';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event: any) => {
        const spoken = event.results[0][0].transcript;
        if (spoken) {
          handleSendPatientSpeech(spoken);
        }
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  // End Call
  const handleEndCall = () => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    }
    setCallState('ended');
  };

  // Save Call Transcript & Disposition to CRM
  const handleSaveToCrm = async () => {
    if (!contactId && !phone) {
      toast.error('कॉन्टैक्ट रिकॉर्ड नहीं मिला');
      return;
    }

    setSavingOutcome(true);
    try {
      const transcriptSummary = transcript
        .map((t) => `${t.sender === 'ai' ? 'डॉ. शिखा (AI)' : 'मरीज'}: ${t.text}`)
        .join('\n');

      const noteText = `📞 AI Voice Call Completed (${formatTimer(callDuration)}):\nनतीजा: ${detectedDisposition}\n\n[कॉल ट्रांसक्रिप्ट]:\n${transcriptSummary.slice(0, 800)}...`;

      // 1. Save note to contact_notes
      if (contactId) {
        await supabase.from('contact_notes').insert({
          contact_id: contactId,
          note_text: noteText,
        });

        // 2. Add disposition tag
        try {
          const { data: existingTag } = await supabase
            .from('tags')
            .select('id')
            .eq('name', detectedDisposition)
            .maybeSingle();

          if (existingTag?.id) {
            await addContactTag(contactId, existingTag.id);
          }
        } catch {
          // ignore tag lookup
        }
      }

      toast.success('कॉल ट्रांसक्रिप्ट और नोट्स CRM में सफलतापूर्वक सेव हो गए!');
      onOpenChange(false);
    } catch (err: any) {
      toast.error('नोट्स सेव करने में त्रुटि आई');
    } finally {
      setSavingOutcome(false);
    }
  };

  // When modal closes, clean up audio
  useEffect(() => {
    if (!open) {
      if (audioPlayerRef.current) audioPlayerRef.current.pause();
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setCallState('idle');
    } else {
      // Auto-start call when opened
      startCall();
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden border-slate-700 bg-slate-950 text-slate-100 shadow-2xl">
        <DialogHeader className="p-4 bg-linear-to-b from-slate-900 to-slate-950 border-b border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
              <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
                Gynocci AI Voice Calling Agent
              </DialogTitle>
            </div>
            <Badge
              variant="outline"
              className="text-[10px] font-mono border-emerald-500/40 text-emerald-400 bg-emerald-950/40"
            >
              {callState === 'connected' ? `LIVE • ${formatTimer(callDuration)}` : callState.toUpperCase()}
            </Badge>
          </div>
          <DialogDescription className="text-xs text-slate-400 mt-1">
            डॉ. शिखा (प्राकृतिक महिला स्वास्थ्य विशेषज्ञ) • Natural Female Human Voice
          </DialogDescription>
        </DialogHeader>

        {/* Call Visual Stage */}
        <div className="p-5 flex flex-col items-center justify-center border-b border-slate-850 bg-gradient-radial from-slate-900 via-slate-950 to-slate-950">
          {/* Animated Avatar / Waveform */}
          <div className="relative flex items-center justify-center my-3">
            <div
              className={`absolute -inset-3 rounded-full transition-all duration-500 ${
                isAiSpeaking
                  ? 'bg-rose-500/25 blur-lg scale-110 animate-pulse'
                  : isListening
                  ? 'bg-emerald-500/25 blur-lg scale-110 animate-pulse'
                  : 'bg-slate-800/20'
              }`}
            />
            <div className="relative h-20 w-20 rounded-full border-2 border-rose-500/60 bg-linear-to-tr from-rose-950 via-slate-900 to-purple-950 flex flex-col items-center justify-center shadow-inner">
              <Heart className={`h-8 w-8 text-rose-400 ${isAiSpeaking ? 'animate-bounce' : ''}`} />
              <span className="text-[9px] font-bold text-rose-200 mt-0.5">डॉ. शिखा</span>
            </div>
          </div>

          {/* Caller Details & State */}
          <div className="text-center space-y-1">
            <h3 className="font-bold text-base text-white tracking-wide">
              {patientName || 'मरीज (Patient)'}
            </h3>
            <div className="text-xs text-slate-400 font-mono">
              {phone ? `+91 ${phone}` : 'No phone'} • {city || 'City'}
            </div>
            {concern && (
              <Badge variant="secondary" className="text-[11px] bg-slate-850 text-purple-300 border-purple-500/30">
                {concern}
              </Badge>
            )}

            {/* Speaking / Listening Status Indicator */}
            <div className="pt-2">
              {callState === 'ringing' ? (
                <span className="text-xs text-amber-400 animate-pulse flex items-center justify-center gap-1.5 font-medium">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> कॉल कनेक्ट हो रही है...
                </span>
              ) : isAiSpeaking ? (
                <span className="text-xs text-rose-400 font-semibold flex items-center justify-center gap-1.5 animate-pulse">
                  <Volume2 className="h-4 w-4" /> डॉ. शिखा बोल रही हैं (Audio Playing)...
                </span>
              ) : isListening ? (
                <span className="text-xs text-emerald-400 font-semibold flex items-center justify-center gap-1.5 animate-pulse">
                  <Mic className="h-4 w-4" /> मरीज की बात सुन रहे हैं (Listening)...
                </span>
              ) : callState === 'connected' ? (
                <span className="text-xs text-slate-400">आप बोलिए या नीचे से विकल्प चुनें...</span>
              ) : (
                <span className="text-xs text-red-400">कॉल समाप्त (Call Ended)</span>
              )}
            </div>
          </div>
        </div>

        {/* Live Conversation Transcript Box */}
        <div className="p-4 bg-slate-900/60 max-h-52 min-h-36 overflow-y-auto space-y-2.5 text-xs">
          {transcript.map((item) => (
            <div
              key={item.id}
              className={`flex flex-col ${item.sender === 'ai' ? 'items-start' : 'items-end'}`}
            >
              <span className="text-[10px] text-slate-400 px-1 mb-0.5">
                {item.sender === 'ai' ? 'डॉ. शिखा (AI)' : 'मरीज (आप)'} • {item.timestamp}
              </span>
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2 leading-relaxed ${
                  item.sender === 'ai'
                    ? 'bg-rose-950/60 border border-rose-800/40 text-rose-100 rounded-tl-xs'
                    : 'bg-emerald-950/70 border border-emerald-800/40 text-emerald-100 rounded-tr-xs'
                }`}
              >
                {item.text}
              </div>
            </div>
          ))}
          {loadingReply && (
            <div className="flex items-center gap-1.5 text-slate-400 text-xs italic">
              <Loader2 className="h-3 w-3 animate-spin text-rose-400" /> AI सोच रही हैं...
            </div>
          )}
          <div ref={transcriptEndRef} />
        </div>

        {/* Quick Speech Chips for Instant CEO Demo / Quiet Testing */}
        {callState === 'connected' && (
          <div className="p-3 bg-slate-950 border-t border-slate-850">
            <span className="text-[10px] font-semibold text-slate-400 block mb-1.5 uppercase tracking-wider">
              क्विक डेमो सवाल (क्लिक करें, AI तुरंत बोलेगी):
            </span>
            <div className="flex flex-wrap gap-1.5">
              {[
                'मुझे PCOD है और पीरियड्स नहीं आ रहे',
                'ट्यूब ब्लॉक की रिपोर्ट आई है, क्या सर्जरी जरूरी है?',
                'कंसल्टेशन फीस ₹499 बहुत ज्यादा लग रही है',
                'जयपुर या दिल्ली क्लिनिक का पता क्या है?',
                'हाँ, मेरा अपॉइंटमेंट बुक कर दीजिये',
              ].map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => handleSendPatientSpeech(chip)}
                  disabled={loadingReply}
                  className="text-[11px] px-2.5 py-1 rounded-full bg-slate-850 hover:bg-slate-800 text-slate-200 border border-slate-700 hover:border-rose-400/50 transition-colors cursor-pointer text-left"
                >
                  💬 {chip}
                </button>
              ))}
            </div>

            {/* Custom Input + Mic Bar */}
            <div className="mt-2.5 flex items-center gap-2">
              <div className="relative flex-1">
                <Input
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSendPatientSpeech(userInput);
                  }}
                  placeholder="यहाँ टाइप करें या माइक पर बोलें..."
                  className="bg-slate-900 border-slate-700 text-xs h-8 text-white placeholder:text-slate-500"
                  disabled={loadingReply}
                />
              </div>

              {/* Speak into mic button */}
              <Button
                type="button"
                variant={isListening ? 'destructive' : 'outline'}
                size="sm"
                onClick={toggleListening}
                className={`h-8 px-2.5 text-xs gap-1 cursor-pointer ${
                  isListening
                    ? 'animate-pulse bg-red-600 text-white'
                    : 'border-emerald-600/50 text-emerald-400 hover:bg-emerald-950'
                }`}
                title="माइक से बोलें (Speak via microphone)"
              >
                <Mic className="h-3.5 w-3.5" />
                {isListening ? 'सुन रहे हैं...' : 'माइक'}
              </Button>

              <Button
                type="button"
                size="sm"
                onClick={() => handleSendPatientSpeech(userInput)}
                disabled={loadingReply || !userInput.trim()}
                className="h-8 px-2.5 bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between">
          {callState === 'connected' ? (
            <>
              <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <Badge variant="outline" className="border-rose-500/40 text-rose-300 text-[10px]">
                  Voice: {voicePersona} (Female)
                </Badge>
              </div>

              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleEndCall}
                className="gap-1.5 text-xs bg-red-600 hover:bg-red-700 text-white font-semibold cursor-pointer shadow-md"
              >
                <PhoneOff className="h-4 w-4" />
                End Call (कॉल काटें)
              </Button>
            </>
          ) : callState === 'ended' ? (
            <div className="w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <span className="text-xs text-slate-400 block">कॉल का नतीजा (Disposition):</span>
                <Badge
                  className="text-xs font-semibold mt-0.5"
                  style={{ backgroundColor: `${tagColor}25`, color: tagColor, borderColor: tagColor }}
                >
                  {detectedDisposition}
                </Badge>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={startCall}
                  className="text-xs gap-1 border-slate-700 text-slate-300 hover:text-white cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  फिर से कॉल करें
                </Button>

                <Button
                  type="button"
                  size="sm"
                  onClick={handleSaveToCrm}
                  disabled={savingOutcome}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs gap-1.5 cursor-pointer shadow-md"
                >
                  {savingOutcome ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  Save Notes to CRM
                </Button>
              </div>
            </div>
          ) : (
            <div className="w-full flex justify-end">
              <Button size="sm" onClick={startCall} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5">
                <Phone className="h-4 w-4" /> Call Connect करें
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
