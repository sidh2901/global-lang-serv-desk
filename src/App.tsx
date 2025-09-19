import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { User } from '@supabase/supabase-js'
import Login from './components/Login'
import CallerDashboard from './components/CallerDashboard'
import AgentDashboard from './components/AgentDashboard'
import { Toaster } from './components/ui/toaster'

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [userRole, setUserRole] = useState<'caller' | 'agent' | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchUserRole(session.user.id)
      } else {
        setLoading(false)
      }
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchUserRole(session.user.id)
      } else {
        setUserRole(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const fetchUserRole = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', userId)
        .single()

      if (error) throw error
      setUserRole(data.role)
    } catch (error) {
      console.error('Error fetching user role:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Login />
  }

  return (
    <>
      <Routes>
        <Route 
          path="/" 
          element={
            userRole === 'caller' ? <Navigate to="/caller" replace /> :
            userRole === 'agent' ? <Navigate to="/agent" replace /> :
            <Navigate to="/login" replace />
          } 
        />
        <Route 
          path="/caller" 
          element={userRole === 'caller' ? <CallerDashboard /> : <Navigate to="/" replace />} 
        />
        <Route 
          path="/agent" 
          element={userRole === 'agent' ? <AgentDashboard /> : <Navigate to="/" replace />} 
        />
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster />
    </>
  )
}

export default App