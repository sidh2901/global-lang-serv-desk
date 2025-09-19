import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Database = {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string
          email: string
          role: 'caller' | 'agent'
          name: string
          language: string
          created_at: string
        }
        Insert: {
          id: string
          email: string
          role: 'caller' | 'agent'
          name: string
          language: string
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          role?: 'caller' | 'agent'
          name?: string
          language?: string
          created_at?: string
        }
      }
      call_sessions: {
        Row: {
          id: string
          caller_id: string
          agent_id: string | null
          status: 'waiting' | 'ringing' | 'connected' | 'ended'
          caller_language: string
          agent_language: string | null
          started_at: string
          ended_at: string | null
          duration: number | null
        }
        Insert: {
          id?: string
          caller_id: string
          agent_id?: string | null
          status?: 'waiting' | 'ringing' | 'connected' | 'ended'
          caller_language: string
          agent_language?: string | null
          started_at?: string
          ended_at?: string | null
          duration?: number | null
        }
        Update: {
          id?: string
          caller_id?: string
          agent_id?: string | null
          status?: 'waiting' | 'ringing' | 'connected' | 'ended'
          caller_language?: string
          agent_language?: string | null
          started_at?: string
          ended_at?: string | null
          duration?: number | null
        }
      }
    }
  }
}