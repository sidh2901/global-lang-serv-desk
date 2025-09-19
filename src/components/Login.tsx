import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { useToast } from '../hooks/use-toast'
import { Phone, Headphones } from 'lucide-react'

const LANGUAGES = [
  { code: 'marathi', label: 'मराठी (Marathi)', flag: '🇮🇳' },
  { code: 'spanish', label: 'Español (Spanish)', flag: '🇪🇸' },
  { code: 'english', label: 'English', flag: '🇺🇸' },
  { code: 'hindi', label: 'हिन्दी (Hindi)', flag: '🇮🇳' },
  { code: 'french', label: 'Français (French)', flag: '🇫🇷' },
  { code: 'german', label: 'Deutsch (German)', flag: '🇩🇪' },
]

export default function Login() {
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('login')
  const { toast } = useToast()

  const [loginForm, setLoginForm] = useState({
    email: '',
    password: ''
  })

  const [signupForm, setSignupForm] = useState({
    email: '',
    password: '',
    name: '',
    role: 'caller' as 'caller' | 'agent',
    language: 'english'
  })

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: loginForm.email,
        password: loginForm.password,
      })

      if (error) throw error

      toast({
        title: 'Welcome back!',
        description: 'Successfully logged in.',
      })
    } catch (error: any) {
      toast({
        title: 'Login failed',
        description: error.message,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { data, error } = await supabase.auth.signUp({
        email: signupForm.email,
        password: signupForm.password,
      })

      if (error) throw error

      if (data.user) {
        // Create user profile
        const { error: profileError } = await supabase
          .from('user_profiles')
          .insert({
            id: data.user.id,
            email: signupForm.email,
            name: signupForm.name,
            role: signupForm.role,
            language: signupForm.language,
          })

        if (profileError) throw profileError

        toast({
          title: 'Account created!',
          description: 'Welcome to ASJ Call Center.',
        })
      }
    } catch (error: any) {
      toast({
        title: 'Signup failed',
        description: error.message,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="h-16 w-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-2xl">ASJ</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">ASJ Call Center</h1>
          <p className="text-gray-600 mt-2">Professional Multilingual Support</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Access Your Account</CardTitle>
            <CardDescription>
              Sign in to your caller or agent dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="Enter your email"
                      value={loginForm.email}
                      onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="Enter your password"
                      value={loginForm.password}
                      onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? 'Signing in...' : 'Sign In'}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Full Name</Label>
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder="Enter your full name"
                      value={signupForm.name}
                      onChange={(e) => setSignupForm({ ...signupForm, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="Enter your email"
                      value={signupForm.email}
                      onChange={(e) => setSignupForm({ ...signupForm, email: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="Create a password"
                      value={signupForm.password}
                      onChange={(e) => setSignupForm({ ...signupForm, password: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Account Type</Label>
                    <Select value={signupForm.role} onValueChange={(value: 'caller' | 'agent') => setSignupForm({ ...signupForm, role: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="caller">
                          <div className="flex items-center">
                            <Phone className="w-4 h-4 mr-2" />
                            Caller
                          </div>
                        </SelectItem>
                        <SelectItem value="agent">
                          <div className="flex items-center">
                            <Headphones className="w-4 h-4 mr-2" />
                            Agent
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="language">Primary Language</Label>
                    <Select value={signupForm.language} onValueChange={(value) => setSignupForm({ ...signupForm, language: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LANGUAGES.map((lang) => (
                          <SelectItem key={lang.code} value={lang.code}>
                            {lang.flag} {lang.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? 'Creating account...' : 'Create Account'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <div className="mt-6 text-center text-sm text-gray-600">
          <p>Demo Accounts:</p>
          <p>Caller: caller@demo.com / password</p>
          <p>Agent: agent@demo.com / password</p>
        </div>
      </div>
    </div>
  )
}