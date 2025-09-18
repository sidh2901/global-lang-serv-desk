'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Phone, PhoneCall, PhoneOff, Mic, MicOff, Volume2, VolumeX, 
  Download, Settings, Languages, User, Headphones, Clock,
  PhoneIncoming, PhoneOutgoing, Pause, Play, UserCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

/** =================== ASJ Professional Call Center Branding =================== */
const BRAND = {
  logo: 'ASJ',
  name: 'ASJ Call Center',
  tagline: 'Professional Multilingual Support',
  accentBg: 'bg-blue-600',
  accentHover: 'hover:bg-blue-700',
  textTitle: 'text-slate-900',
  textMuted: 'text-slate-500',
  surface: 'bg-white',
  border: 'border-slate-200',
  ring: 'ring-1 ring-slate-200',
};

/** === Language Options === */
const LANGUAGE_OPTIONS = [
  { code: 'marathi', label: 'मराठी (Marathi)', flag: '🇮🇳' },
  { code: 'spanish', label: 'Español (Spanish)', flag: '🇪🇸' },
  { code: 'english', label: 'English', flag: '🇺🇸' },
  { code: 'hindi', label: 'हिन्दी (Hindi)', flag: '🇮🇳' },
  { code: 'french', label: 'Français (French)', flag: '🇫🇷' },
  { code: 'german', label: 'Deutsch (German)', flag: '🇩🇪' },
] as const;
type Lang = typeof LANGUAGE_OPTIONS[number]['code'];

const VOICES = ['alloy','ash','ballad','coral','echo','fable','nova','onyx','sage','shimmer'] as const;
type Voice = typeof VOICES[number];

type CallState = 'idle' | 'dialing' | 'ringing' | 'connected' | 'on-hold' | 'ended';

interface CallSession {
  id: string;
  startTime: Date;
  duration: number;
  callerLanguage: Lang;
  agentLanguage: Lang;
}

interface TranscriptEntry {
  id: string;
  timestamp: Date;
  speaker: 'caller' | 'agent';
  originalText: string;
  translatedText: string;
  language: Lang;
  targetLanguage: Lang;
}

export default function ASJCallCenter() {
  const { toast } = useToast();

  // Call State Management
  const [callState, setCallState] = useState<CallState>('idle');
  const [currentSession, setCurrentSession] = useState<CallSession | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [isAgent, setIsAgent] = useState(false); // Toggle between caller/agent view

  // Audio & Controls
  const [isMuted, setIsMuted] = useState(false);
  const [isOnHold, setIsOnHold] = useState(false);
  const [volume, setVolume] = useState(0.8);

  // Language Settings
  const [callerLanguage, setCallerLanguage] = useState<Lang>('marathi');
  const [agentLanguage, setAgentLanguage] = useState<Lang>('spanish');
  const [voice, setVoice] = useState<Voice>('coral');

  // Real-time Translation
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [currentSpeech, setCurrentSpeech] = useState('');
  const [currentTranslation, setCurrentTranslation] = useState('');
  const [isListening, setIsListening] = useState(false);

  // WebRTC & Audio
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ringToneRef = useRef<HTMLAudioElement | null>(null);

  // Call Timer
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Language helpers
  const getLangInfo = (code: Lang) => LANGUAGE_OPTIONS.find(l => l.code === code);
  const currentUserLang = isAgent ? agentLanguage : callerLanguage;
  const targetLang = isAgent ? callerLanguage : agentLanguage;

  // Initialize audio elements
  useEffect(() => {
    // Create ring tone (using Web Audio API for realistic ring)
    const createRingTone = () => {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(440, audioContext.currentTime); // A4 note
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      
      return { audioContext, oscillator, gainNode };
    };

    if (typeof window !== 'undefined') {
      audioRef.current = new Audio();
      audioRef.current.autoplay = true;
      audioRef.current.playsInline = true;
    }
  }, []);

  // Call Timer Effect
  useEffect(() => {
    if (callState === 'connected') {
      timerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (callState === 'idle') {
        setCallDuration(0);
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [callState]);

  // Format call duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Simulate ring tone
  const playRingTone = () => {
    // Create a simple ring tone pattern
    const ring = () => {
      const beep = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT');
      beep.volume = 0.3;
      beep.play().catch(() => {});
    };

    if (callState === 'ringing') {
      ring();
      setTimeout(() => {
        if (callState === 'ringing') ring();
      }, 1000);
      setTimeout(() => {
        if (callState === 'ringing') ring();
      }, 2000);
      setTimeout(() => {
        if (callState === 'ringing') playRingTone();
      }, 4000);
    }
  };

  // Start Call
  const startCall = async () => {
    try {
      setCallState('dialing');
      toast({ title: 'Initiating call...', description: 'Connecting to agent' });

      // Simulate dialing delay
      setTimeout(() => {
        setCallState('ringing');
        playRingTone();
        toast({ title: 'Calling...', description: 'Waiting for agent to answer' });
      }, 1500);

      // Simulate agent pickup (or auto-pickup for demo)
      setTimeout(() => {
        if (!isAgent) {
          // Agent picks up automatically for demo
          answerCall();
        }
      }, 5000);

    } catch (error) {
      console.error('Failed to start call:', error);
      toast({ title: 'Call failed', description: 'Unable to connect. Please try again.' });
      setCallState('idle');
    }
  };

  // Answer Call (Agent)
  const answerCall = async () => {
    try {
      setCallState('connected');
      setCurrentSession({
        id: `ASJ-${Date.now()}`,
        startTime: new Date(),
        duration: 0,
        callerLanguage,
        agentLanguage,
      });

      // Initialize WebRTC connection
      await initializeWebRTC();
      
      toast({ 
        title: 'Call connected', 
        description: `${getLangInfo(callerLanguage)?.label} ↔ ${getLangInfo(agentLanguage)?.label}` 
      });

    } catch (error) {
      console.error('Failed to answer call:', error);
      toast({ title: 'Connection failed', description: 'Unable to establish call. Please try again.' });
      endCall();
    }
  };

  // End Call
  const endCall = () => {
    setCallState('ended');
    
    // Cleanup WebRTC
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (dcRef.current) {
      dcRef.current.close();
      dcRef.current = null;
    }

    setTimeout(() => {
      setCallState('idle');
      setCurrentSession(null);
      setTranscript([]);
      setCurrentSpeech('');
      setCurrentTranslation('');
    }, 2000);

    toast({ title: 'Call ended', description: `Duration: ${formatDuration(callDuration)}` });
  };

  // Initialize WebRTC for real-time translation
  const initializeWebRTC = async () => {
    try {
      // Get ephemeral token
      const tokenRes = await fetch('/api/token');
      
      if (!tokenRes.ok) {
        const errorData = await tokenRes.json();
        throw new Error(errorData.error || `Token request failed: ${tokenRes.status}`);
      }
      
      const tokenData = await tokenRes.json();
      const EPHEMERAL_KEY = tokenData?.client_secret?.value;

      if (!EPHEMERAL_KEY) {
        console.error('Token response:', tokenData);
        throw new Error('No ephemeral key in response. Please check your OPENAI_API_KEY in .env file.');
      }

      // Create peer connection
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }],
      });
      pcRef.current = pc;

      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const [track] = stream.getTracks();
      pc.addTrack(track, stream);

      // Handle remote audio
      pc.ontrack = (e) => {
        if (audioRef.current) {
          audioRef.current.srcObject = e.streams[0];
          audioRef.current.volume = volume;
          audioRef.current.muted = isMuted;
        }
      };

      // Create data channel
      const dc = pc.createDataChannel('translation');
      dcRef.current = dc;

      dc.onopen = () => {
        setIsListening(true);
        // Send initial session config
        dc.send(JSON.stringify({
          type: 'session.update',
          session: {
            instructions: `You are a professional interpreter. Translate ${getLangInfo(currentUserLang)?.label} to ${getLangInfo(targetLang)?.label}. Speak the translation clearly.`,
            voice: voice,
          }
        }));
      };

      dc.onmessage = handleTranslationMessage;

      // SDP exchange
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpRes = await fetch(`https://api.openai.com/v1/realtime?model=gpt-realtime`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${EPHEMERAL_KEY}`,
          'Content-Type': 'application/sdp',
          'OpenAI-Beta': 'realtime=v1',
        },
        body: offer.sdp,
      });

      const answerSdp = await sdpRes.text();
      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

    } catch (error) {
      console.error('WebRTC initialization failed:', error);
      throw error;
    }
  };

  // Handle translation messages
  const handleTranslationMessage = (event: MessageEvent) => {
    try {
      const message = JSON.parse(event.data);
      
      switch (message.type) {
        case 'input_audio_buffer.transcription.delta':
          setCurrentSpeech(prev => prev + (message.delta || ''));
          break;
          
        case 'response.output_text.delta':
          setCurrentTranslation(prev => prev + (message.delta || ''));
          break;
          
        case 'response.completed':
          if (currentSpeech && currentTranslation) {
            setTranscript(prev => [...prev, {
              id: Date.now().toString(),
              timestamp: new Date(),
              speaker: isAgent ? 'agent' : 'caller',
              originalText: currentSpeech,
              translatedText: currentTranslation,
              language: currentUserLang,
              targetLanguage: targetLang,
            }]);
            setCurrentSpeech('');
            setCurrentTranslation('');
          }
          break;
      }
    } catch (error) {
      console.error('Translation message error:', error);
    }
  };

  // Toggle hold
  const toggleHold = () => {
    setIsOnHold(!isOnHold);
    if (audioRef.current) {
      audioRef.current.muted = !isOnHold ? true : isMuted;
    }
    toast({ 
      title: isOnHold ? 'Call resumed' : 'Call on hold',
      description: isOnHold ? 'Audio restored' : 'Audio paused'
    });
  };

  // Download transcript
  const downloadTranscript = () => {
    const content = transcript.map(entry => 
      `[${entry.timestamp.toLocaleTimeString()}] ${entry.speaker.toUpperCase()}\n` +
      `Original (${getLangInfo(entry.language)?.label}): ${entry.originalText}\n` +
      `Translation (${getLangInfo(entry.targetLanguage)?.label}): ${entry.translatedText}\n\n`
    ).join('');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `call-transcript-${currentSession?.id || 'session'}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={cn('h-10 w-10 rounded-lg grid place-items-center font-bold text-white text-lg', BRAND.accentBg)}>
              {BRAND.logo}
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">{BRAND.name}</h1>
              <p className="text-sm text-slate-500">{BRAND.tagline}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Badge variant={callState === 'connected' ? 'default' : 'secondary'} className="px-3 py-1">
              {callState === 'connected' ? (
                <>
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse" />
                  Connected • {formatDuration(callDuration)}
                </>
              ) : (
                <>
                  <div className="w-2 h-2 bg-slate-400 rounded-full mr-2" />
                  {callState.charAt(0).toUpperCase() + callState.slice(1)}
                </>
              )}
            </Badge>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAgent(!isAgent)}
              className="border-slate-300"
            >
              {isAgent ? <Headphones className="w-4 h-4 mr-2" /> : <User className="w-4 h-4 mr-2" />}
              {isAgent ? 'Agent View' : 'Caller View'}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Panel - Call Controls */}
          <div className="lg:col-span-1">
            <Card className="bg-white shadow-lg border-slate-200">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center justify-between">
                  <span>Call Control</span>
                  {currentSession && (
                    <Badge variant="outline" className="text-xs">
                      {currentSession.id}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                
                {/* Main Call Button */}
                <div className="text-center">
                  <div className="relative">
                    <div className={cn(
                      'w-24 h-24 mx-auto rounded-full flex items-center justify-center transition-all duration-300',
                      callState === 'idle' ? 'bg-green-500 hover:bg-green-600 cursor-pointer' :
                      callState === 'connected' ? 'bg-red-500 hover:bg-red-600 cursor-pointer' :
                      callState === 'ringing' ? 'bg-blue-500 animate-pulse' :
                      'bg-slate-400'
                    )}
                    onClick={() => {
                      if (callState === 'idle') startCall();
                      else if (callState === 'connected') endCall();
                      else if (callState === 'ringing' && isAgent) answerCall();
                    }}
                    >
                    {callState === 'idle' && <Phone className="w-8 h-8 text-white" />}
                    {callState === 'dialing' && <PhoneOutgoing className="w-8 h-8 text-white" />}
                    {callState === 'ringing' && (
                      isAgent ? <PhoneIncoming className="w-8 h-8 text-white" /> : <PhoneCall className="w-8 h-8 text-white" />
                    )}
                    {callState === 'connected' && <PhoneOff className="w-8 h-8 text-white" />}
                    {callState === 'ended' && <PhoneOff className="w-8 h-8 text-white" />}
                  </div>
                  
                  {callState === 'ringing' && (
                    <div className="absolute inset-0 rounded-full border-4 border-blue-300 animate-ping" />
                  )}
                  </div>
                  
                  <p className="mt-4 text-sm font-medium text-slate-700">
                    {callState === 'idle' && 'Start Call'}
                    {callState === 'dialing' && 'Connecting...'}
                    {callState === 'ringing' && (isAgent ? 'Incoming Call - Click to Answer' : 'Ringing...')}
                    {callState === 'connected' && 'End Call'}
                    {callState === 'ended' && 'Call Ended'}
                  </p>
                </div>

                <Separator />

                {/* Call Controls */}
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsMuted(!isMuted)}
                    disabled={callState !== 'connected'}
                    className={isMuted ? 'bg-red-50 border-red-200' : ''}
                  >
                    {isMuted ? <MicOff className="w-4 h-4 mr-2" /> : <Mic className="w-4 h-4 mr-2" />}
                    {isMuted ? 'Unmute' : 'Mute'}
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={toggleHold}
                    disabled={callState !== 'connected'}
                    className={isOnHold ? 'bg-yellow-50 border-yellow-200' : ''}
                  >
                    {isOnHold ? <Play className="w-4 h-4 mr-2" /> : <Pause className="w-4 h-4 mr-2" />}
                    {isOnHold ? 'Resume' : 'Hold'}
                  </Button>
                </div>

                <Separator />

                {/* Language Settings */}
                <div className="space-y-4">
                  <h3 className="font-medium text-slate-900">Language Settings</h3>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-2 block">
                        Caller Language
                      </label>
                      <select
                        value={callerLanguage}
                        onChange={(e) => setCallerLanguage(e.target.value as Lang)}
                        className="w-full p-2 border border-slate-300 rounded-md text-sm"
                        disabled={callState === 'connected'}
                      >
                        {LANGUAGE_OPTIONS.map(lang => (
                          <option key={lang.code} value={lang.code}>
                            {lang.flag} {lang.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-2 block">
                        Agent Language
                      </label>
                      <select
                        value={agentLanguage}
                        onChange={(e) => setAgentLanguage(e.target.value as Lang)}
                        className="w-full p-2 border border-slate-300 rounded-md text-sm"
                        disabled={callState === 'connected'}
                      >
                        {LANGUAGE_OPTIONS.map(lang => (
                          <option key={lang.code} value={lang.code}>
                            {lang.flag} {lang.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Voice Settings */}
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">
                    Voice
                  </label>
                  <select
                    value={voice}
                    onChange={(e) => setVoice(e.target.value as Voice)}
                    className="w-full p-2 border border-slate-300 rounded-md text-sm"
                  >
                    {VOICES.map(v => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Panel - Live Translation & Transcript */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Live Translation */}
            <Card className="bg-white shadow-lg border-slate-200">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center justify-between">
                  <span>Live Translation</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {getLangInfo(currentUserLang)?.flag} {getLangInfo(currentUserLang)?.label}
                    </Badge>
                    <span className="text-slate-400">→</span>
                    <Badge variant="outline" className="text-xs">
                      {getLangInfo(targetLang)?.flag} {getLangInfo(targetLang)?.label}
                    </Badge>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                
                {/* Current Speech */}
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={cn(
                      'w-3 h-3 rounded-full',
                      isListening && callState === 'connected' ? 'bg-green-500 animate-pulse' : 'bg-slate-300'
                    )} />
                    <span className="text-sm font-medium text-slate-700">
                      {isAgent ? 'Agent' : 'Caller'} Speaking ({getLangInfo(currentUserLang)?.label})
                    </span>
                  </div>
                  <p className="text-slate-900 min-h-[24px]">
                    {currentSpeech || (callState === 'connected' ? 'Listening...' : 'Not connected')}
                  </p>
                </div>

                {/* Translation */}
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Languages className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-700">
                      Translation ({getLangInfo(targetLang)?.label})
                    </span>
                  </div>
                  <p className="text-slate-900 min-h-[24px]">
                    {currentTranslation || (callState === 'connected' ? 'Translating...' : 'Not connected')}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Call Transcript */}
            <Card className="bg-white shadow-lg border-slate-200">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center justify-between">
                  <span>Call Transcript</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-500">
                      {transcript.length} messages
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={downloadTranscript}
                      disabled={transcript.length === 0}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {transcript.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>Call transcript will appear here</p>
                    </div>
                  ) : (
                    transcript.map((entry) => (
                      <div key={entry.id} className="border border-slate-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge variant={entry.speaker === 'caller' ? 'default' : 'secondary'}>
                              {entry.speaker === 'caller' ? (
                                <User className="w-3 h-3 mr-1" />
                              ) : (
                                <UserCheck className="w-3 h-3 mr-1" />
                              )}
                              {entry.speaker.toUpperCase()}
                            </Badge>
                            <span className="text-xs text-slate-500">
                              {entry.timestamp.toLocaleTimeString()}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-slate-500">
                            {getLangInfo(entry.language)?.flag} → {getLangInfo(entry.targetLanguage)?.flag}
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="p-3 bg-slate-50 rounded border">
                            <p className="text-xs text-slate-500 mb-1">Original</p>
                            <p className="text-sm text-slate-900">{entry.originalText}</p>
                          </div>
                          <div className="p-3 bg-blue-50 rounded border border-blue-200">
                            <p className="text-xs text-blue-600 mb-1">Translation</p>
                            <p className="text-sm text-slate-900">{entry.translatedText}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Hidden audio element */}
      <audio ref={audioRef} />
    </div>
  );
}