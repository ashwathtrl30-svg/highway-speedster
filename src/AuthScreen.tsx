import { useState } from 'react'
import { loginWithApple, loginWithGoogle, sendEmailLogin } from './supabase'

export function AuthScreen() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const run = async (fn: () => Promise<any>) => {
    setBusy(true); setMessage('')
    try {
      const result = await fn()
      if (result?.error) throw result.error
      setMessage('Continue in the sign-in window, or check your email for the secure link.')
    } catch (error: any) {
      setMessage(error?.message || 'Sign-in failed. Please try again.')
    } finally { setBusy(false) }
  }

  return (
    <main className="fixed inset-0 z-[200] flex items-center justify-center bg-gradient-to-b from-indigo-950 via-purple-950 to-black px-5">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-black/50 p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
        <div className="text-center">
          <div className="mb-3 text-5xl">🏍️</div>
          <h1 className="text-3xl font-black text-white">HIGHWAY SPEEDSTER</h1>
          <p className="mt-2 text-sm text-gray-400">Sign in to protect your progress and play across devices.</p>
        </div>
        <div className="mt-7 space-y-3">
          <button type="button" disabled={busy} onClick={() => void run(loginWithGoogle)} className="w-full rounded-xl bg-white px-4 py-3 font-bold text-black disabled:opacity-50">Continue with Google</button>
          <button type="button" disabled={busy} onClick={() => void run(loginWithApple)} className="w-full rounded-xl bg-white px-4 py-3 font-bold text-black disabled:opacity-50">Continue with Apple</button>
        </div>
        <div className="my-5 flex items-center gap-3 text-xs text-gray-500"><span className="h-px flex-1 bg-white/10" /><span>OR EMAIL</span><span className="h-px flex-1 bg-white/10" /></div>
        <form onSubmit={(event) => { event.preventDefault(); if (email.trim()) void run(() => sendEmailLogin(email)) }} className="space-y-3">
          <input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none" />
          <button type="submit" disabled={busy || !email.trim()} className="w-full rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 px-4 py-3 font-black text-white disabled:opacity-50">Email me a secure sign-in link</button>
        </form>
        {message && <p role="status" className="mt-4 text-center text-xs text-gray-400">{message}</p>}
        <p className="mt-5 text-center text-[10px] text-gray-600">Authentication credentials are handled by Supabase Auth; the game does not store provider passwords.</p>
      </section>
    </main>
  )
}
