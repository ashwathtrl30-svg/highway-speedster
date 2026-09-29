import { useEffect, useState } from 'react'
import { loginWithApple, loginWithGoogle, sendEmailLogin } from './supabase'

function readAuthError() {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const query = new URLSearchParams(window.location.search)
  const code = hash.get('error_code') || query.get('error_code')
  const description = hash.get('error_description') || query.get('error_description')
  if (!code && !description) return ''

  // Remove auth error details from the visible URL after capturing them.
  if (window.location.hash || window.location.search) {
    window.history.replaceState({}, document.title, window.location.pathname)
  }

  return description ? decodeURIComponent(description.replace(/\+/g, ' ')) : 'Social sign-in could not be completed.'
}

export function AuthScreen() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const authError = readAuthError()
    if (authError) setMessage(authError)
  }, [])

  const run = async (fn: () => Promise<any>) => {
    setBusy(true)
    setMessage('')
    try {
      const result = await fn()
      if (result?.error) throw result.error
      if (result?.data?.url) {
        // OAuth redirects are handled by Supabase Auth. This message only
        // appears when the browser remains on the game page.
        setMessage('Opening secure sign-in…')
      } else {
        setMessage('Check your email for the secure sign-in link.')
      }
    } catch (error: any) {
      setMessage(error?.message || 'Sign-in failed. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="fixed inset-0 z-[200] overflow-y-auto bg-gradient-to-b from-indigo-950 via-purple-950 to-black px-4 py-8 sm:px-6 sm:py-12">
      <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center">
        <section className="w-full max-w-lg rounded-[2rem] border border-white/10 bg-black/55 p-6 shadow-2xl backdrop-blur-2xl sm:p-9">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-4xl shadow-lg sm:h-20 sm:w-20 sm:text-5xl">
              🏍️
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-yellow-400/80">Your progress, protected</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">HIGHWAY SPEEDSTER</h1>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-gray-400">
              Sign in once to keep your scores, coins, vehicles, skins, power-ups and playtime connected to your account.
            </p>
          </div>

          <div className="mt-8 grid gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => void run(loginWithGoogle)}
              className="flex min-h-14 w-full items-center justify-center rounded-2xl border border-white/15 bg-white px-4 py-3.5 text-sm font-black text-black shadow-lg transition hover:bg-gray-100 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 sm:text-base"
            >
              Continue with Google
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={() => void run(loginWithApple)}
              className="flex min-h-14 w-full items-center justify-center rounded-2xl border border-white/15 bg-white px-4 py-3.5 text-sm font-black text-black shadow-lg transition hover:bg-gray-100 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 sm:text-base"
            >
              Continue with Apple
            </button>
          </div>

          <div className="my-7 flex items-center gap-3">
            <span className="h-px flex-1 bg-white/10" />
            <span className="text-[10px] font-black tracking-[0.2em] text-gray-600">OR USE EMAIL</span>
            <span className="h-px flex-1 bg-white/10" />
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault()
              if (email.trim()) void run(() => sendEmailLogin(email))
            }}
            className="space-y-3"
          >
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500" htmlFor="auth-email">
              Email address
            </label>
            <input
              id="auth-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className="min-h-14 w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 text-white placeholder:text-gray-600 outline-none transition focus:border-yellow-400/50 focus:bg-white/[0.08]"
            />
            <button
              type="submit"
              disabled={busy || !email.trim()}
              className="min-h-14 w-full rounded-2xl bg-gradient-to-r from-yellow-500 to-orange-500 px-4 py-3.5 text-sm font-black text-white shadow-lg shadow-orange-500/10 transition hover:from-yellow-400 hover:to-orange-400 active:scale-[0.99] disabled:cursor-not-allowed disabled:from-gray-700 disabled:to-gray-800 disabled:opacity-60 sm:text-base"
            >
              Email me a secure sign-in link
            </button>
          </form>

          <div className="mt-7 rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-4">
            <p className="text-center text-xs leading-5 text-gray-500">
              Your provider credentials are handled by Supabase Auth. The game does not store Google or Apple passwords.
            </p>
          </div>

          {message && (
            <div
              role="status"
              className="mt-5 rounded-2xl border border-yellow-400/10 bg-yellow-400/5 px-4 py-3 text-center text-xs leading-5 text-gray-300"
            >
              {message}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
