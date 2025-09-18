'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Mic, MicOff, Volume2, VolumeX, Download, RefreshCcw, Settings, Languages,
  ClipboardCopy, Check, AlertTriangle, User, Headphones, Repeat2, Shield
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

/** =================== ASJ Branding (Executive theme) =================== */
const BRAND = {
  logo: 'ASJ',
  accentBg: 'bg-indigo-600',
  textTitle: 'text-neutral-900',
  textMuted: 'text-neutral-500',
  outlineBtn: 'bg-white/90 backdrop-blur border border-neutral-200',
  ring: 'ring-1 ring-neutral-200',
  surface: 'bg-white',
};

/** === Language directory (extend anytime) === */
const LANGUAGE_OPTIONS = [
  { code: 'english',    label: 'English'    },
  { code: 'marathi',    label: 'Marathi'    },
  { code: 'marwari',    label: 'Marwari (Marwadi)' },
  { code: 'spanish',    label: 'Spanish'    },
  { code: 'hindi',      label: 'Hindi'      },
  { code: 'french',     label: 'French'     },
  { code: 'german',     label: 'German'     },
  { code: 'italian',    label: 'Italian'    },
  { code: 'portuguese', label: 'Portuguese' },
  { code: 'russian',    label: 'Russian'    },
  { code: 'arabic',     label: 'Arabic'     },
  { code: 'bengali',    label: 'Bengali'    },
  { code: 'chinese',    label: 'Chinese'    },
  { code: 'japanese',   label: 'Japanese'   },
  { code: 'korean',     label: 'Korean'     },
  { code: 'tamil',      label: 'Tamil'      },
  { code: 'telugu',     label: 'Telugu'     },
  { code: 'urdu',       label: 'Urdu'       },
  { code: 'turkish',    label: 'Turkish'    },
  { code: 'thai',       label: 'Thai'       },
  { code: 'swahili',    label: 'Swahili'    },
] as const;
type Lang = typeof LANGUAGE_OPTIONS[number]['code'];

const VOICES = [
  'alloy','ash','ballad','coral','echo','fable','nova','onyx','sage','shimmer'
] as const;
type Voice = typeof VOICES[number];

interface TranscriptEntry {
  id: string;
  timestamp: Date;
  speaker: 'caller' | 'agent';
  sourceText: string;
  translatedText: string;
  sourceLanguage: Lang;
  targetLanguage: Lang;
}

interface ConnectionStatus {
  websocket: boolean;
  webrtc: boolean;
  asr: boolean;
  translator: boolean;
  tts: boolean;
}

const LANG_PILL: Partial<Record<Lang, string>> = {
  marathi: 'bg-blue-100 text-blue-800',
  marwari: 'bg-amber-100 text-amber-900',
  spanish: 'bg-orange-100 text-orange-800',
  english: 'bg-neutral-100 text-neutral-800',
  hindi: 'bg-rose-100 text-rose-800',
  french: 'bg-indigo-100 text-indigo-800',
  german: 'bg-yellow-100 text-yellow-800',
  japanese: 'bg-emerald-100 text-emerald-800',
  chinese: 'bg-cyan-100 text-cyan-800',
  arabic: 'bg-violet-100 text-violet-800',
  portuguese: 'bg-green-100 text-green-800',
  russian: 'bg-red-100 text-red-800',
  tamil: 'bg-pink-100 text-pink-800',
  telugu: 'bg-purple-100 text-purple-800',
};

export default function ASJServiceDesk() {
  const { toast } = useToast();

  // Roles & session
  const [role, setRole] = useState<'caller' | 'agent'>('caller');
  const [caseId, setCaseId] = useState<string | null>(null);
  useEffect(() => { setCaseId(`ASJ-${Math.floor(10000 + Math.random() * 90000)}`); }, []);

  // Controls
  const [isMuted, setIsMuted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);

  // Settings (persisted)
  const [voice, setVoice] = useState<Voice>('coral');
  const [roleLang, setRoleLang] = useState<{ caller: Lang; agent: Lang }>({
    caller: 'marathi',
    agent:  'spanish',
  });
  useEffect(() => {
    try {
      const saved = localStorage.getItem('asj-settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.voice) setVoice(parsed.voice);
        if (parsed.roleLang?.caller && parsed.roleLang?.agent) setRoleLang(parsed.roleLang);
      }
    } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem('asj-settings', JSON.stringify({ voice, roleLang })); } catch {}
  }, [voice, roleLang]);

  // Direction by role
  const direction = {
    source: roleLang[role],
    target: role === 'caller' ? roleLang.agent : roleLang.caller,
  };

  // Live content
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [currentSourceText, setCurrentSourceText] = useState('');
  const [currentTranslatedText, setCurrentTranslatedText] = useState('');

  // Health
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    websocket: false, webrtc: false, asr: false, translator: false, tts: false,
  });

  // WebRTC
  // refs near your other refs
const pcRef = useRef<RTCPeerConnection | null>(null);
const dcRef = useRef<RTCDataChannel | null>(null);

// NEW: queue + helper
const pendingMsgsRef = useRef<any[]>([]);

function sendJSON(obj: any) {
  const dc = dcRef.current;
  if (dc && dc.readyState === "open") {
    dc.send(JSON.stringify(obj));
  } else {
    // Not open yet — queue it
    pendingMsgsRef.current.push(obj);
  }
}

  const outAudioRef = useRef<HTMLAudioElement | null>(null);

  const langLabel = (code: Lang) => LANGUAGE_OPTIONS.find(l => l.code === code)?.label ?? code;
  const langPill = (code: Lang) => LANG_PILL[code] ?? 'bg-neutral-100 text-neutral-800';

  // rolling buffers to accumulate deltas
  const liveSourceRef = useRef("");
  const liveTranslatedRef = useRef("");

  const buildInstruction = (src: string, dst: string) =>
    `You are a simultaneous interpreter. You will hear ${src}.
     Transcribe and translate into ${dst}. Speak the translation.
     Stream only the translated text; no extra words.`;

  // Keep audio element in sync
  useEffect(() => { if (outAudioRef.current) outAudioRef.current.muted = isMuted; }, [isMuted]);

  /** DataChannel messages (server → client) */
  function handleRealtimeMessage(ev: MessageEvent) {
    try {
      const event = JSON.parse(ev.data);

      // ASR deltas (naming can vary by build)
      if (event.type === "input_audio_buffer.transcription.delta" || event.type === "transcript.delta") {
        liveSourceRef.current += event.delta || "";
        setCurrentSourceText(liveSourceRef.current);
        setConnectionStatus(s => ({ ...s, asr: true }));
      }

      // Output text deltas
      if (event.type === "response.output_text.delta" || event.type === "response.delta") {
        const delta = event.delta || event.output_text_delta || "";
        liveTranslatedRef.current += delta;
        setCurrentTranslatedText(liveTranslatedRef.current);
        setConnectionStatus(s => ({ ...s, translator: true, tts: true }));
      }

      // A turn finished -> commit
      if (event.type === "response.completed" || event.type === "turn.end") {
        const source = liveSourceRef.current.trim();
        const translated = liveTranslatedRef.current.trim();
        if (source || translated) {
          setTranscript(prev => [
            ...prev,
            {
              id: String(Date.now()),
              timestamp: new Date(),
              speaker: role,
              sourceText: source,
              translatedText: translated,
              sourceLanguage: direction.source,
              targetLanguage: direction.target,
            },
          ]);
        }
        liveSourceRef.current = "";
        liveTranslatedRef.current = "";
        setCurrentSourceText("");
        setCurrentTranslatedText("");
      }
    } catch {
      // not a JSON event (e.g., stats) — ignore
    }
  }

  /** Connect (WebRTC) per docs */
  async function connect() {
  if (connected) return;
  setBusy(true);

  try {
    // 1) get ephemeral key
    const token = await fetch("/api/token").then(r => r.json());
    const EPHEMERAL_KEY: string | undefined =
      token?.client_secret?.value || token?.value;
    if (!EPHEMERAL_KEY) throw new Error("No ephemeral key from /api/token");

    // 2) create peer connection (add a STUN server for reliability)
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }],
    });
    pcRef.current = pc;

    // remote audio
    const audioEl = document.createElement("audio");
    audioEl.autoplay = true;
    audioEl.playsInline = true;
    audioEl.muted = isMuted;
    pc.ontrack = (e) => (audioEl.srcObject = e.streams[0]);

    // data channel
    const dc = pc.createDataChannel("oai-events");
    dcRef.current = dc;

    dc.addEventListener("open", () => {
      // FLUSH any queued messages
      for (const m of pendingMsgsRef.current) dc.send(JSON.stringify(m));
      pendingMsgsRef.current = [];

      setConnected(true);
      setConnectionStatus(s => ({ ...s, webrtc: true }));
      toast({ title: "Connected", description: "WebRTC channel open" });
    });

    dc.addEventListener("message", handleRealtimeMessage);
    dc.addEventListener("close", () => {
      setConnected(false);
      setConnectionStatus(s => ({ ...s, webrtc: false }));
    });
    dc.addEventListener("error", (e) => {
      console.error("DataChannel error:", e);
    });

    // local mic
    const ms = await navigator.mediaDevices.getUserMedia({ audio: true });
    const [track] = ms.getTracks();
    pc.addTrack(track, ms);

    // 3) SDP offer/answer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const baseUrl = "https://api.openai.com/v1/realtime/calls";
    const model = encodeURIComponent(
      process.env.NEXT_PUBLIC_REALTIME_MODEL || "gpt-realtime"
    );

    const sdpResp = await fetch(`${baseUrl}?model=${model}`, {
      method: "POST",
      body: offer.sdp,
      headers: {
        Authorization: `Bearer ${EPHEMERAL_KEY}`,
        "Content-Type": "application/sdp",
        
      },
    });

    const answer = { type: "answer" as const, sdp: await sdpResp.text() };
    await pc.setRemoteDescription(answer);

    // 4) Queue the initial session.update; it will send on 'open'
    const instr = buildInstruction(
      langLabel(direction.source),
      langLabel(direction.target)
    );
    sendJSON({
      type: "session.update",
      session: { instructions: instr, audio: { output: { voice } } },
    });

  } catch (e) {
    console.error(e);
    toast({ title: "Connect failed", description: "See console for details." });
    disconnect();
  } finally {
    setBusy(false);
  }
}


  /** Disconnect */
  function disconnect() {
    try {
      dcRef.current?.close();
      pcRef.current?.getSenders().forEach(s => s.track?.stop());
      pcRef.current?.close();
    } catch {}
    dcRef.current = null;
    pcRef.current = null;
    setConnected(false);
    setConnectionStatus(s => ({ ...s, webrtc: false, asr: false, translator: false, tts: false }));
    liveSourceRef.current = "";
    liveTranslatedRef.current = "";
    setCurrentSourceText("");
    setCurrentTranslatedText("");
  }

  // Push live updates when role/lang/voice change
  useEffect(() => {
  if (!pcRef.current || !dcRef.current) return; // nothing to send to yet
  const instr = buildInstruction(
    langLabel(direction.source),
    langLabel(direction.target)
  );
  sendJSON({
    type: "session.update",
    session: { instructions: instr, audio: { output: { voice } } },
  });
}, [direction.source, direction.target, role, voice]);
// eslint-disable-line

  /** Utilities */
  const clearSession = () => {
    setTranscript([]); setCurrentSourceText(''); setCurrentTranslatedText('');
    setConnectionStatus(s => ({ ...s, asr: false, translator: false, tts: false }));
    toast({ title: 'Session cleared', description: 'Transcript and live captions reset.' });
  };
  const copyLatest = async () => {
    const last = transcript[transcript.length - 1];
    if (!last?.translatedText) return;
    await navigator.clipboard.writeText(last.translatedText);
    toast({ title: 'Copied translation', description: 'Latest translated text copied.' });
  };
  const downloadTranscript = () => {
    const text = transcript.map(e =>
      `[${e.timestamp.toLocaleTimeString()}] ${e.speaker.toUpperCase()} | ${langLabel(e.sourceLanguage)} → ${langLabel(e.targetLanguage)}\n` +
      `• Source: ${e.sourceText}\n• Translated: ${e.translatedText}\n`
    ).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = `${caseId ?? 'ASJ'}-transcript-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    toast({ title: 'Transcript downloaded', description: `Saved as ${caseId}-transcript-*.txt` });
  };
  const swapLanguages = () => {
    setRoleLang(prev => ({ caller: prev.agent, agent: prev.caller }));
    toast({ title: 'Languages swapped', description: 'Caller/Agent languages flipped.' });
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* hidden audio element for model speech */}
      <audio ref={outAudioRef} autoPlay playsInline />

      {/* top bar */}
      <div className="border-b border-neutral-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn('h-8 w-8 rounded-md grid place-items-center font-extrabold text-white', BRAND.accentBg)}>
              {BRAND.logo}
            </div>
            <div className="leading-tight">
              <div className={cn('text-sm font-semibold tracking-tight', BRAND.textTitle)}>ASJ OmniDesk</div>
              <div className={cn('text-[11px]', BRAND.textMuted)}>Enterprise Multilingual Service Desk</div>
            </div>
            <Badge variant="secondary" className="ml-2">BETA</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={connected ? 'bg-emerald-600' : 'bg-neutral-400'}>
              {connected ? 'Live' : 'Idle'}
            </Badge>
            <Badge variant="outline">Case: {caseId ?? '—'}</Badge>
            <Button variant="outline" size="sm" onClick={clearSession} className={BRAND.outlineBtn}>
              <RefreshCcw className="mr-2 h-4 w-4" /> Reset
            </Button>
            <Button variant="outline" size="sm" onClick={() => setIsMuted(m => !m)} className={BRAND.outlineBtn}>
              {isMuted ? <VolumeX className="mr-2 h-4 w-4" /> : <Volume2 className="mr-2 h-4 w-4" />}
              {isMuted ? 'Muted' : 'Unmuted'}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Role & Settings */}
        <Card className={cn(BRAND.surface, BRAND.ring, 'shadow-sm mb-6')}>
          <CardContent className="py-4 space-y-4">
            {/* Role toggle */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-neutral-900">Active speaker</span>
                <div className="flex rounded-md border border-neutral-200 bg-white overflow-hidden">
                  <button
                    onClick={() => setRole('caller')}
                    className={cn(
                      'px-4 py-2 text-sm flex items-center gap-2',
                      role === 'caller' ? 'bg-neutral-900 text-white' : 'text-neutral-700 hover:bg-neutral-50'
                    )}
                    title="Caller speaks"
                  >
                    <User className="h-4 w-4" /> Caller
                  </button>
                  <button
                    onClick={() => setRole('agent')}
                    className={cn(
                      'px-4 py-2 text-sm flex items-center gap-2 border-l',
                      role === 'agent' ? 'bg-neutral-900 text-white' : 'text-neutral-700 hover:bg-neutral-50'
                    )}
                    title="Agent speaks"
                  >
                    <Headphones className="h-4 w-4" /> Agent
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={swapLanguages}
                  title="Swap Caller/Agent languages (⌘/Ctrl+S)"
                  className="bg-indigo-600 text-white border-0"
                >
                  <Repeat2 className="h-4 w-4 mr-2" /> Swap
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={connected ? disconnect : connect}
                  disabled={busy}
                  className={connected ? 'border-neutral-200' : 'bg-indigo-600 text-white border-0'}
                  title={connected ? 'Disconnect' : 'Connect'}
                >
                  {connected ? <MicOff className="mr-2 h-4 w-4" /> : <Mic className="mr-2 h-4 w-4" />}
                  {connected ? 'Disconnect' : 'Connect'}
                </Button>
              </div>
            </div>

            {/* Role language selects + Voice */}
            <div className="flex flex-col lg:flex-row lg:items-center gap-4">
              <LabeledSelect
                icon={<Languages className="h-4 w-4 text-neutral-500" />}
                label="Caller speaks"
                value={roleLang.caller}
                onChange={(v) => setRoleLang(p => ({ ...p, caller: v as Lang }))}
              />
              <LabeledSelect
                icon={<Languages className="h-4 w-4 text-neutral-500" />}
                label="Agent speaks"
                value={roleLang.agent}
                onChange={(v) => setRoleLang(p => ({ ...p, agent: v as Lang }))}
              />

              <Separator orientation="vertical" className="hidden lg:block h-6" />

              <LabeledSelect
                icon={<Settings className="h-4 w-4 text-neutral-500" />}
                label="Voice"
                value={voice}
                onChange={(v) => setVoice(v as Voice)}
                options={VOICES.map(v => ({ value: v, label: v }))}
              />

              <Separator orientation="vertical" className="hidden lg:block h-6" />

              <div className="flex items-center gap-2 text-neutral-500">
                <Shield className="h-4 w-4" />
                <span className="text-sm">Disclosure: This voice is AI-generated.</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Controls & Live */}
          <div className="lg:col-span-1">
            <Card className={cn(BRAND.surface, BRAND.ring, 'shadow-sm')}>
              <CardHeader className="pb-2">
                <CardTitle className="text-neutral-900 flex items-center justify-between">
                  <span>Call Controls</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className={langPill(direction.source)}>
                      {langLabel(direction.source)}
                    </Badge>
                    <Badge variant="outline">{role === 'caller' ? 'Caller' : 'Agent'}</Badge>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center">
                  <div
                    className={cn(
                      'relative w-28 h-28 mx-auto grid place-items-center rounded-xl border border-neutral-200',
                      connected ? 'bg-indigo-600' : 'bg-neutral-50'
                    )}
                  >
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={connected ? disconnect : connect}
                      className="w-20 h-20 rounded-xl"
                      disabled={busy}
                      title={busy ? 'Connecting…' : connected ? 'Disconnect' : 'Connect'}
                    >
                      {connected ? <MicOff className="w-10 h-10 text-white" /> : <Mic className="w-10 h-10 text-neutral-700" />}
                    </Button>
                  </div>
                  <p className={cn('text-xs mt-2', BRAND.textMuted)}>
                    {busy ? 'Connecting…' : connected ? 'Live (WebRTC)' : 'Click to connect'}
                  </p>
                </div>

                <Separator />

                {/* Actions */}
                <div className="flex flex-wrap gap-2 justify-between">
                  <Button variant="outline" size="sm" onClick={downloadTranscript} className={BRAND.outlineBtn}>
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </Button>
                  <Button variant="outline" size="sm" onClick={copyLatest} disabled={!transcript.length} className={BRAND.outlineBtn}>
                    <ClipboardCopy className="mr-2 h-4 w-4" />
                    Copy latest
                  </Button>
                </div>

                <Separator />

                {/* Health */}
                <div className="grid grid-cols-3 gap-3">
                  <HealthPill label="ASR" ok={connectionStatus.asr} />
                  <HealthPill label="Translate" ok={connectionStatus.translator} />
                  <HealthPill label="TTS" ok={connectionStatus.tts} />
                </div>
              </CardContent>
            </Card>

            <Card className={cn(BRAND.surface, BRAND.ring, 'shadow-sm mt-6')}>
              <CardHeader className="pb-2">
                <CardTitle className="text-neutral-900">Live Caption</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="p-3 bg-white border border-neutral-200 rounded-md min-h-[70px]" aria-live="polite">
                  <p className="text-xs text-neutral-500 mb-1">
                    Source ({langLabel(direction.source)})
                  </p>
                  <p className="text-sm text-neutral-900">{connected ? (currentSourceText || 'Listening…') : '—'}</p>
                </div>

                <div className="p-3 mt-3 rounded-md min-h-[70px] border border-neutral-200" aria-live="polite">
                  <div className="rounded-md -m-3 p-3 border-l-2 border-indigo-500 bg-indigo-50/60">
                    <p className="text-xs text-indigo-700 mb-1">
                      Translation ({langLabel(direction.target)})
                    </p>
                    <p className="text-sm text-neutral-900">
                      {connected ? (currentTranslatedText || 'Translating…') : '—'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right: Transcript */}
          <div className="lg:col-span-2">
            <Card className={cn(BRAND.surface, BRAND.ring, 'shadow-sm h-full')}>
              <CardHeader className="pb-2">
                <CardTitle className="text-neutral-900 flex items-center justify-between">
                  <span>Conversation</span>
                  <div className="text-xs text-neutral-500">
                    {transcript.length ? `${transcript.length} message${transcript.length > 1 ? 's' : ''}` : 'No messages yet'}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-[560px] overflow-y-auto pr-1">
                  {!transcript.length ? (
                    <div className="flex items-center gap-2 text-neutral-500 text-sm py-8">
                      <AlertTriangle className="h-4 w-4" />
                      Connect and speak to populate the transcript.
                    </div>
                  ) : (
                    transcript.map((entry) => (
                      <div key={entry.id} className="rounded-md border border-neutral-200 p-3 bg-white">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className={langPill(entry.sourceLanguage)}>
                              {entry.speaker.toUpperCase()}
                            </Badge>
                            <span className="text-xs text-neutral-500">
                              {langLabel(entry.sourceLanguage)} → {langLabel(entry.targetLanguage)}
                            </span>
                          </div>
                          <span className="text-xs text-neutral-500">{entry.timestamp.toLocaleTimeString()}</span>
                        </div>
                        <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="p-2 rounded bg-neutral-50 border border-neutral-200">
                            <p className="text-[11px] text-neutral-500">Source</p>
                            <p className="text-sm text-neutral-900">{entry.sourceText}</p>
                          </div>
                          <div className="p-2 rounded bg-white border border-indigo-200">
                            <p className="text-[11px] text-indigo-700">Translated</p>
                            <p className="text-sm text-neutral-900">{entry.translatedText}</p>
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

        {/* Footer */}
        <div className={cn('text-[11px] mt-6 text-center', BRAND.textMuted)}>
          © {new Date().getFullYear()} <span className="font-semibold text-neutral-800">ASJ</span> • OmniDesk — Precision. Clarity. Scale.
        </div>
      </div>
    </div>
  );
}

/** ---------- Reusable bits ---------- */
function LabeledSelect({
  icon, label, value, onChange, options,
}: {
  icon: React.ReactNode; label: string; value: string; onChange: (v: string) => void;
  options?: { value: string; label: string }[];
}) {
  const built = options ?? LANGUAGE_OPTIONS.map(l => ({ value: l.code, label: l.label }));
  return (
    <div className="flex items-center gap-2">
      {icon}
      <span className="text-sm font-medium text-neutral-800">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 rounded-md border border-neutral-200 px-3 text-sm bg-white"
      >
        {built.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select>
    </div>
  );
}

function HealthPill({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className={cn(
      'rounded-md px-2 py-1 text-xs font-medium inline-flex items-center gap-2 border',
      ok ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
         : 'bg-amber-50 text-amber-700 border-amber-200'
    )}>
      <span className={cn('h-2.5 w-2.5 rounded-full', ok ? 'bg-emerald-500' : 'bg-amber-500')} />
      {label}
      {ok ? <Check className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
    </div>
  );
}
