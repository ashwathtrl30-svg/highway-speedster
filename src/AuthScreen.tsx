import { useState } from 'react'
import { loginWithApple, loginWithGoogle, sendEmailLogin } from './supabase'

export function AuthScreen() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const run = async (fn: () => Promise<any>) => {
    setBusy(true); setMessage('')
    try {
      const { error } = await fn()
      if (error) throw error
      setMessage('Check your email or complete the sign-in window to continue.')
    } catch (e: any) {
      setMessage(e?.message || 'Sign-in failed. Please try again.')
    } finally { setBusy(false) }
  }

  return <div className="fixed inset-0 z-[200] flex items-center justify-center bg-gradient-to-b from-indigo-950 via-purple-950 to-black px-5">
    <div className="w-full max-w-md rounded-3xl border border-white/10 bg-black/50 p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
      <div className="text-center">
        <div className="text-5xl mb-3">🏍️</div>
        <h1 className="text-3xl font-black text-white">HIGHWAY SPEEDSTER</h1>
        <p className="mt-2 text-sm text-gray-400">Sign in to protect your progress and play across devices.</p>
      </div>
      <div className="mt-7 space-y-3">
        <button disabled={busy} onClick={() => run(loginWithGoogle)} className="w-full rounded-xl bg-white px-4 py-3 font-bold text-black disabled:opacity-50">Continue with Google</button>
        <button disabled={busy} onClick={() => run(loginWithApple)} className="w-full rounded-xl bg-white px-4 py-3 font-bold text-black disabled:opacity-50">Continue with Apple</button>
      </div>
      <div className="my-5 flex items-center gap-3 text-xs text-gray-500"><span className="h-px flex-1 bg-white/10"/><span>OR EMAIL</span><span className="h-px flex-1 bg-white/10"/></div>
      <form onSubmit={(e) => { e.preventDefault(); if (email.trim()) void run(() => sendEmailLogin(email)) }} className="space-y-3">
        <input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-yellow-400/50"/>
        <button disabled={busy || !email.trim()} className="w-full rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 px-4 py-3 font-black text-white disabled:opacity-50">Email me a secure sign-in link</button>
      </form>
      {message && <p className="mt-4 text-center text-xs text-gray-400">{message}</p>}
      <p className="mt-5 text-center text-[10px] text-gray-600">Your game save is associated with your authenticated account. Sign-in credentials are handled by Supabase Auth.</p>
    </div>
  </div>
