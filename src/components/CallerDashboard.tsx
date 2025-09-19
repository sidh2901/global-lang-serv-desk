import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { startRealtime, RealtimeHandle } from '../lib/realtime'
import { RingToneGenerator, playNotificationSound } from '../lib/audio'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { useToast } from '../hooks/use-toast'
import { 
  Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX, 
  LogOut, User, Languages, Clock, PhoneCall 
} from 'lucide-react'

const LANGUAGES = [
  { code: 'marathi', label: 'मराठी (Marathi)', flag: '🇮🇳' },
  { code: 'spanish', label: 'Español (Spanish)', flag: '🇪🇸' },
  { code: 'english', label: 'English', flag: '🇺🇸' },
  { code: 'hindi', label: 'हिन्दी (Hindi)', flag: '🇮🇳' },
  { code: 'french', label: 'Français (French)', flag: '🇫🇷' },
  { code: 'german', label: 'Deutsch (German)', flag: '🇩🇪' },
]

type CallState = 'idle' | 'waiting' | 'ringing' | 'connected' | 'ended'

export default function CallerDashboard() {
  const { toast } = useToast()
  const [user, setUser] = useState<any>(null)
  const [callState, setCallState] = useState<CallState>('idle')
  const [currentSession, setCurrentSession] = useState<any>(null)
  const [callDuration, setCallDuration] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const [language, setLanguage] = useState('marathi')
  const [currentSpeech, setCurrentSpeech] = useState('')
  const [currentTranslation, setCurrentTranslation] = useState('')
  const [isListening, setIsListening] = useState(false)

  const realtimeRef = useRef<RealtimeHandle | null>(null)
  const ringToneRef = useRef<RingToneGenerator | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    fetchUserProfile()
    ringToneRef.current = new RingToneGenerator()
    
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (ringToneRef.current) ringToneRef.current.stop()
      if (realtimeRef.current) realtimeRef.current.hangup()
    }
  }, [])

  useEffect(() => {
    if (callState === 'connected') {
      timerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1)
      }, 1000)
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      if (callState === 'idle') {
        setCallDuration(0)
      }
    }
  }, [callState])

  const fetchUserProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      
      if (profile) {
        setUser(profile)
        setLanguage(profile.language)
      }
    }
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const startCall = async () => {
    try {
      setCallState('waiting')
      toast({ title: 'Requesting call...', description: 'Looking for available agent' })

      // Create call session
      const { data: session, error } = await supabase
        .from('call_sessions')
        .insert({
          caller_id: user.id,
          status: 'waiting',
          caller_language: language,
        })
        .select()
        .single()

      if (error) throw error
      setCurrentSession(session)

      // Listen for agent pickup
      const subscription = supabase
        .channel(`call_${session.id}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'call_sessions',
          filter: `id=eq.${session.id}`,
        }, (payload) => {
          const updatedSession = payload.new
          if (updatedSession.status === 'ringing') {
            setCallState('ringing')
            ringToneRef.current?.start()
            toast({ title: 'Agent found!', description: 'Connecting your call...' })
          } else if (updatedSession.status === 'connected') {
            setCallState('connected')
            ringToneRef.current?.stop()
            initializeWebRTC(updatedSession)
            toast({ title: 'Call connected!', description: 'You can now speak' })
          }
        })
        .subscribe()

      // Auto-timeout after 30 seconds
      setTimeout(() => {
        if (callState === 'waiting') {
          endCall()
          toast({ 
            title: 'No agents available', 
            description: 'Please try again later',
            variant: 'destructive'
          })
        }
      }, 30000)

    } catch (error: any) {
      console.error('Failed to start call:', error)
      toast({ 
        title: 'Call failed', 
        description: error.message,
        variant: 'destructive'
      })
      setCallState('idle')
    }
  }

  const endCall = async () => {
    try {
      if (currentSession) {
        await supabase
          .from('call_sessions')
          .update({ 
            status: 'ended',
            ended_at: new Date().toISOString(),
            duration: callDuration
          })
          .eq('id', currentSession.id)
      }

      setCallState('ended')
      ringToneRef.current?.stop()
      
      if (realtimeRef.current) {
        realtimeRef.current.hangup()
        realtimeRef.current = null
      }
      
      setIsListening(false)
      setCurrentSpeech('')
      setCurrentTranslation('')

      setTimeout(() => {
        setCallState('idle')
        setCurrentSession(null)
      }, 2000)

      toast({ title: 'Call ended', description: `Duration: ${formatDuration(callDuration)}` })
    } catch (error: any) {
      console.error('Error ending call:', error)
    }
  }

  const initializeWebRTC = async (session: any) => {
    try {
      const agentLang = LANGUAGES.find(l => l.code === session.agent_language)?.label || 'Spanish'
      
      const handle = await startRealtime({
        targetLanguage: agentLang,
        voice: 'coral',
        onPartial: (text) => setCurrentTranslation(text),
        onFinal: (text) => {
          setCurrentTranslation(text)
          playNotificationSound()
        },
        onSourceFinal: (text) => setCurrentSpeech(text),
        onError: (error) => {
          console.error('Realtime error:', error)
          toast({ 
            title: 'Translation error', 
            description: 'Connection to translation service failed',
            variant: 'destructive'
          })
        }
      })

      realtimeRef.current = handle
      setIsListening(true)
    } catch (error: any) {
      console.error('WebRTC initialization failed:', error)
      toast({ 
        title: 'Connection failed', 
        description: 'Unable to establish voice connection',
        variant: 'destructive'
      })
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  const getLangInfo = (code: string) => LANGUAGES.find(l => l.code === code)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 bg-blue-600 rounded-lg grid place-items-center font-bold text-white text-lg">
              ASJ
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Caller Dashboard</h1>
              <p className="text-sm text-slate-500">Welcome, {user?.name}</p>
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
            
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Call Control */}
          <Card className="bg-white shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="w-5 h-5" />
                Call Control
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              
              {/* Main Call Button */}
              <div className="text-center">
                <div 
                  className={`w-24 h-24 mx-auto rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer ${
                    callState === 'idle' ? 'bg-green-500 hover:bg-green-600' :
                    callState === 'connected' ? 'bg-red-500 hover:bg-red-600' :
                    callState === 'ringing' ? 'bg-blue-500 animate-pulse' :
                    'bg-slate-400'
                  }`}
                  onClick={() => {
                    if (callState === 'idle') startCall()
                    else if (callState === 'connected') endCall()
                  }}
                >
                  {callState === 'idle' && <Phone className="w-8 h-8 text-white" />}
                  {callState === 'waiting' && <PhoneCall className="w-8 h-8 text-white animate-spin" />}
                  {callState === 'ringing' && <PhoneCall className="w-8 h-8 text-white" />}
                  {callState === 'connected' && <PhoneOff className="w-8 h-8 text-white" />}
                  {callState === 'ended' && <PhoneOff className="w-8 h-8 text-white" />}
                </div>
                
                <p className="mt-4 text-sm font-medium text-slate-700">
                  {callState === 'idle' && 'Start Call'}
                  {callState === 'waiting' && 'Finding Agent...'}
                  {callState === 'ringing' && 'Connecting...'}
                  {callState === 'connected' && 'End Call'}
                  {callState === 'ended' && 'Call Ended'}
                </p>
              </div>

              {/* Call Controls */}
              {callState === 'connected' && (
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsMuted(!isMuted)}
                    className={isMuted ? 'bg-red-50 border-red-200' : ''}
                  >
                    {isMuted ? <MicOff className="w-4 h-4 mr-2" /> : <Mic className="w-4 h-4 mr-2" />}
                    {isMuted ? 'Unmute' : 'Mute'}
                  </Button>
                  
                  <Button variant="outline" size="sm" disabled>
                    <Volume2 className="w-4 h-4 mr-2" />
                    Volume
                  </Button>
                </div>
              )}

              {/* Language Selection */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-slate-700">Your Language</label>
                <Select 
                  value={language} 
                  onValueChange={setLanguage}
                  disabled={callState !== 'idle'}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map(lang => (
                      <SelectItem key={lang.code} value={lang.code}>
                        {lang.flag} {lang.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Live Translation */}
          <Card className="bg-white shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Languages className="w-5 h-5" />
                Live Translation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              
              {/* Your Speech */}
              <div className="p-4 bg-slate-50 rounded-lg border">
                <div className="flex items-center gap-2 mb-2">
                  <User className="w-4 h-4 text-slate-600" />
                  <span className="text-sm font-medium text-slate-700">
                    You ({getLangInfo(language)?.label})
                  </span>
                  {isListening && (
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  )}
                </div>
                <p className="text-slate-900 min-h-[24px]">
                  {currentSpeech || (callState === 'connected' ? 'Speak now...' : 'Not connected')}
                </p>
              </div>

              {/* Agent Translation */}
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2 mb-2">
                  <Languages className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-700">
                    Agent Translation
                  </span>
                </div>
                <p className="text-slate-900 min-h-[24px]">
                  {currentTranslation || (callState === 'connected' ? 'Listening...' : 'Not connected')}
                </p>
              </div>

              {/* Call Status */}
              <div className="text-center py-4">
                {callState === 'waiting' && (
                  <div className="flex items-center justify-center gap-2 text-slate-600">
                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    <span>Looking for available agent...</span>
                  </div>
                )}
                {callState === 'ringing' && (
                  <div className="flex items-center justify-center gap-2 text-blue-600">
                    <PhoneCall className="w-4 h-4 animate-pulse" />
                    <span>Agent found! Connecting...</span>
                  </div>
                )}
                {callState === 'connected' && (
                  <div className="flex items-center justify-center gap-2 text-green-600">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span>Connected - Speak naturally</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}