"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient.ts';

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [mode, setMode] = useState<'signin'|'signup'>('signin');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  // Pre-check existing session and redirect home if already signed in
  useEffect(() => {
    let active = true;
    (async () => {
      if (!supabase) { setChecking(false); return; }
      try {
        const { data } = await supabase.auth.getUser();
        if (active && data.user) {
          router.replace('/');
          return; // do not unset checking until navigation
        }
      } finally { if (active) setChecking(false); }
    })();
    return () => { active = false; };
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) { setMsg('Supabase not configured'); return; }
    setLoading(true); setMsg('');
    try {
      if (mode === 'signup') {
        // Get the current origin for redirect URL
        const redirectUrl = `${window.location.origin}/auth/callback`;
        
        const { error } = await supabase.auth.signUp({ 
          email, 
          password: pw,
          options: {
            emailRedirectTo: redirectUrl
          }
        });
        if (error) throw error; 
        setMsg('Check your email to confirm your account.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
        if (error) throw error; setMsg('Signed in. Redirecting...');
        // Redirect quickly (allow short user feedback)
        setTimeout(() => router.replace('/paraphrase'), 300);
      }
    } catch (err: any) { setMsg(err.message); }
    finally { setLoading(false); }
  }

  // Lock scroll on this page only
  useEffect(() => {
    const originalOverflow = document.documentElement.style.overflow;
    const originalBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = originalOverflow;
      document.body.style.overflow = originalBodyOverflow;
    };
  }, []);

  if (checking) {
    return (
      <div className="min-h-screen md:min-h-dvh overflow-hidden flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4 -translate-y-[2vh] md:-translate-y-[4vh] transition-transform">
          <div className="h-12 w-12 rounded-full border-4 border-brand-500 border-t-transparent animate-spin" aria-label="Loading" />
          <p className="text-xs text-slate-400 tracking-wide uppercase">Loading</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen md:min-h-dvh overflow-hidden flex items-center justify-center p-4">
      <div className="w-full max-w-sm glass-panel p-6 space-y-5 -translate-y-[2vh] md:-translate-y-[4vh] transition-transform">
      <h1 className="text-xl font-semibold">{mode === 'signin' ? 'Sign In' : 'Create Account'}</h1>
      {!supabase && <p className="text-xs text-amber-400">Supabase env vars missing.</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <label className="text-xs uppercase tracking-wide text-slate-400">Email</label>
          <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required className="w-full rounded-md bg-slate-800/60 border border-white/10 px-3 py-2 text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-xs uppercase tracking-wide text-slate-400">Password</label>
          <input type="password" value={pw} onChange={e=>setPw(e.target.value)} required className="w-full rounded-md bg-slate-800/60 border border-white/10 px-3 py-2 text-sm" />
        </div>
        <button disabled={loading} className="w-full px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-400 text-slate-900 font-semibold disabled:opacity-50 flex items-center justify-center">
          {loading ? (
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 border-2 border-slate-900 border-t-transparent animate-spin rounded-full" />
              <span>{mode==='signin'?'Signing In':'Creating'}</span>
            </div>
          ) : (mode==='signin'?'Sign In':'Sign Up')}
        </button>
      </form>
      <div className="text-xs text-slate-400 flex justify-between">
        <button onClick={()=>setMode(mode==='signin'?'signup':'signin')} className="underline">{mode==='signin'?'Need an account?':'Have an account?'}</button>
      </div>
      {msg && <p className="text-xs text-slate-300">{msg}</p>}
      </div>
    </div>
  );
}
