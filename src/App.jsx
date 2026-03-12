import { useState, useEffect } from 'react'
import { Routes, Route, useLocation, Navigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  ArrowRightIcon, 
  DocumentTextIcon, 
  FolderIcon,
  ShieldCheckIcon,
  BoltIcon,
  ChartBarSquareIcon,
  CheckCircleIcon,
  SunIcon,
  MoonIcon,
  UserCircleIcon
} from '@heroicons/react/24/outline'
import { useAuth } from './contexts/AuthContext.jsx'
import Dashboard from './components/Dashboard.jsx'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>
  }
  return user ? children : <Navigate to="/" replace />
}

function App() {
  const [darkMode, setDarkMode] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [toast, setToast] = useState(null)
  const { user, logout } = useAuth()
  const location = useLocation()

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [darkMode])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(timer)
  }, [toast])

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleGoogleSignIn = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth-status`, {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Auth service unavailable')
      }

      const status = await response.json()
      if (!status.googleOAuthConfigured) {
        throw new Error('Google login is not configured on this server yet.')
      }

      window.location.href = `${API_BASE_URL}/auth/google`
    } catch (error) {
      setToast({ type: 'error', message: error.message || 'Login failed. Please try again.' })
    }
  }

  const isDashboard = location.pathname === '/dashboard'

  return (
    <>
      {!isDashboard && (
        <div className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled ? 'bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-lg' : 'bg-transparent'
        }`}>
          <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div className="flex items-center space-x-2">
                <div className="w-10 h-10 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center">
                  <DocumentTextIcon className="w-6 h-6 text-white" />
                </div>
                <span className="text-xl font-bold bg-gradient-to-r from-cyan-700 to-blue-700 bg-clip-text text-transparent dark:from-cyan-300 dark:to-blue-300">
                  API Tracker
                </span>
              </div>
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setDarkMode(!darkMode)}
                  className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-800 transition-colors"
                >
                  {darkMode ? <SunIcon className="w-6 h-6" /> : <MoonIcon className="w-6 h-6" />}
                </button>
                
                {user ? (
                  <>
                    <Link
                      to="/dashboard"
                      className="px-6 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 rounded-xl shadow-lg transition-all duration-200 flex items-center space-x-2"
                    >
                      <FolderIcon className="w-4 h-4" />
                      <span>Dashboard</span>
                    </Link>
                    <button
                      onClick={logout}
                      className="px-6 py-2.5 text-sm font-medium text-gray-900 dark:text-white bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl shadow-lg border border-gray-200 dark:border-slate-700 transition-all duration-200 flex items-center space-x-2"
                    >
                      <UserCircleIcon className="w-4 h-4" />
                      <span>Logout</span>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={handleGoogleSignIn}
                    className="px-6 py-2.5 text-sm font-medium text-gray-900 dark:text-white bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl shadow-lg border border-gray-200 dark:border-slate-700 transition-all duration-200 flex items-center space-x-2"
                  >
                    <span>Continue with Google</span>
                    <ArrowRightIcon className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </nav>
        </div>
      )}

      <AnimatePresence mode="wait">
        <Routes>
          <Route path="/" element={
            <LandingPage onGoogleSignIn={handleGoogleSignIn} />
          } />
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AnimatePresence>

      {!isDashboard && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: scrolled ? 1 : 0 }}
          className="fixed bottom-8 right-8 w-14 h-14 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-2xl shadow-2xl border-0 p-0 flex items-center justify-center backdrop-blur-sm z-40 hover:shadow-3xl transition-all duration-300"
          onClick={scrollToTop}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          <ArrowRightIcon className="w-6 h-6 rotate-90" />
        </motion.button>
      )}

      {toast && !isDashboard && (
        <div className="fixed top-24 right-6 z-[70]">
          <div className={`rounded-xl px-4 py-3 shadow-xl border text-sm ${
            toast.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-700'
              : 'bg-emerald-50 border-emerald-200 text-emerald-700'
          }`}>
            {toast.message}
          </div>
        </div>
      )}
    </>
  )
}

function LandingPage({ onGoogleSignIn }) {
  const featureCards = [
    {
      title: 'Structured Collections',
      description: 'Group endpoints by project, keep request presets, and avoid scattered Postman tabs.',
      icon: FolderIcon,
      accent: 'from-cyan-500 to-blue-600'
    },
    {
      title: 'Live Response Clarity',
      description: 'Inspect headers, body, status, and response timing in one workflow without context switching.',
      icon: ChartBarSquareIcon,
      accent: 'from-emerald-500 to-teal-600'
    },
    {
      title: 'Secure Team Access',
      description: 'Use session-based sign-in and keep each workspace isolated to the signed-in user.',
      icon: ShieldCheckIcon,
      accent: 'from-orange-500 to-amber-600'
    }
  ]

  const proofStats = [
    { label: 'Collections', value: '120+' },
    { label: 'Daily test runs', value: '4.8k' },
    { label: 'Avg debug time saved', value: '37%' }
  ]

  const trustItems = ['Fintech API Team', 'B2B SaaS Core', 'Internal Dev Platform', 'QA Automation Squad']

  const operationalChecks = [
    'Response history with searchable trails',
    'Raw and form-data request modes',
    'Collection-first workflow for teams',
    'Export-ready API snapshots'
  ]

  return (
    <main className="min-h-screen overflow-hidden bg-slate-100 text-slate-950 dark:bg-slate-950 dark:text-white">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_12%_16%,_rgba(6,182,212,0.22),_transparent_28%),radial-gradient(circle_at_88%_10%,_rgba(59,130,246,0.2),_transparent_24%),radial-gradient(circle_at_50%_70%,_rgba(16,185,129,0.12),_transparent_26%),linear-gradient(180deg,_rgba(248,250,252,0.95),_rgba(226,232,240,0.9))] dark:bg-[radial-gradient(circle_at_12%_16%,_rgba(6,182,212,0.18),_transparent_30%),radial-gradient(circle_at_88%_10%,_rgba(37,99,235,0.2),_transparent_30%),radial-gradient(circle_at_50%_70%,_rgba(16,185,129,0.12),_transparent_30%),linear-gradient(180deg,_rgba(2,6,23,0.98),_rgba(15,23,42,0.96))]" />

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-12">
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_1fr]">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-2xl"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200/90 bg-white px-4 py-2 text-sm font-semibold text-cyan-800 shadow-sm dark:border-cyan-900/60 dark:bg-slate-900 dark:text-cyan-200">
              <BoltIcon className="h-4 w-4" />
              Professional API Ops Workspace
            </div>
            <h1 className="mt-6 text-5xl font-black leading-[0.95] tracking-tight text-slate-950 dark:text-white sm:text-6xl">
              Build confidence in every
              <span className="block bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 bg-clip-text text-transparent dark:from-cyan-300 dark:via-blue-300 dark:to-indigo-300">
                API release
              </span>
              before production.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600 dark:text-slate-300">
              API Tracker gives engineering and QA teams a single control room for requests, responses, history, and rollout readiness.
            </p>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <button
                onClick={onGoogleSignIn}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-700 px-6 py-4 text-base font-semibold text-white shadow-xl transition hover:translate-y-[-1px] hover:bg-cyan-800 dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400"
              >
                Continue with Google
                <ArrowRightIcon className="h-5 w-5" />
              </button>
              <Link
                to="/dashboard"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-6 py-4 text-base font-semibold text-slate-800 shadow-sm transition hover:translate-y-[-1px] hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
              >
                Open dashboard preview
                <FolderIcon className="h-5 w-5" />
              </Link>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {proofStats.map((item) => (
                <div key={item.label} className="rounded-2xl border border-white/70 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
                  <div className="text-2xl font-black text-slate-950 dark:text-white">{item.value}</div>
                  <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">{item.label}</div>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="relative"
          >
            <div className="pointer-events-none absolute -left-6 -top-8 h-36 w-36 rounded-full bg-cyan-400/20 blur-3xl dark:bg-cyan-500/15" />
            <div className="pointer-events-none absolute -bottom-6 -right-4 h-32 w-32 rounded-full bg-blue-500/20 blur-3xl dark:bg-blue-600/15" />
            <div className="relative overflow-hidden rounded-[30px] border border-white/70 bg-white/90 p-4 shadow-[0_35px_80px_-35px_rgba(2,6,23,0.45)] backdrop-blur dark:border-slate-800 dark:bg-slate-900/85">
              <motion.div
                aria-label="Analytics dashboard workspace"
                className="h-[420px] w-full rounded-[22px] bg-cover bg-center"
                style={{ backgroundImage: "url('https://contentstatic.techgig.com/thumb/msid-121108662,width-800,resizemode-4/16-API-terms-you-need-to-know-as-a-developer.jpg?52688')" }}
                initial={{ scale: 1.08, opacity: 0.85 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.9, ease: 'easeOut' }}
              />
              <div className="pointer-events-none absolute inset-4 rounded-[22px] bg-gradient-to-b from-slate-950/5 via-transparent to-slate-950/30" />
            </div>
          </motion.div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        <div className="rounded-3xl border border-slate-200/80 bg-white/75 p-5 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/75">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Trusted by growing teams</div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {trustItems.map((item) => (
              <div key={item} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-200">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-black tracking-tight">Designed for fast, reliable API delivery</h2>
            <p className="mt-2 text-slate-600 dark:text-slate-300">Everything you need to test, inspect, and share API behavior cleanly.</p>
          </div>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {featureCards.map((feature, index) => {
            const Icon = feature.icon
            return (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + index * 0.08 }}
                className="rounded-[28px] border border-white/70 bg-white/80 p-7 shadow-lg backdrop-blur dark:border-slate-800 dark:bg-slate-900/80"
              >
                <div className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${feature.accent} text-white shadow-lg`}>
                  <Icon className="h-7 w-7" />
                </div>
                <h3 className="mt-5 text-xl font-bold text-slate-950 dark:text-white">{feature.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-400">{feature.description}</p>
              </motion.div>
            )
          })}
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {operationalChecks.map((item, index) => (
            <motion.div
              key={item}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + index * 0.08 }}
              className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/80 px-5 py-4 dark:border-slate-800 dark:bg-slate-900/75"
            >
              <CheckCircleIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              <span className="text-sm font-medium">{item}</span>
            </motion.div>
          ))}
        </div>
        <div className="mt-10 rounded-3xl border border-cyan-200/70 bg-gradient-to-r from-cyan-600 to-blue-700 px-6 py-8 text-white shadow-xl dark:border-cyan-900/40">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-2xl font-black">Ship your next API change with confidence</h3>
              <p className="mt-1 text-cyan-100">Sign in, open workspace, and validate every endpoint in minutes.</p>
            </div>
            <button
              onClick={onGoogleSignIn}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-3 text-sm font-semibold text-cyan-800 transition hover:bg-cyan-50"
            >
              Start Free with Google
              <ArrowRightIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>
    </main>
  )
}

export default App

