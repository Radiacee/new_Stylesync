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
  const [isAnimating, setIsAnimating] = useState(false);

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

  // Handle mode switching with animation
  const handleModeSwitch = () => {
    setIsAnimating(true);
    setMsg(''); // Clear any existing messages
    setTimeout(() => {
      setMode(mode === 'signin' ? 'signup' : 'signin');
      setIsAnimating(false);
    }, 150);
  };

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

  // Lock scroll on this page only - REMOVED to allow scrolling
  // useEffect(() => {
  //   const originalOverflow = document.documentElement.style.overflow;
  //   const originalBodyOverflow = document.body.style.overflow;
  //   document.documentElement.style.overflow = 'hidden';
  //   document.body.style.overflow = 'hidden';
  //   return () => {
  //     document.documentElement.style.overflow = originalOverflow;
  //     document.body.style.overflow = originalBodyOverflow;
  //   };
  // }, []);

  if (checking) {
    return (
      <div className="min-h-screen md:min-h-dvh relative">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-brand-500/3 rounded-full blur-3xl animate-pulse" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/3 rounded-full blur-3xl animate-pulse delay-1000" />
        </div>
        
        <div className="flex min-h-screen items-center justify-center p-6 relative z-10">
          <div className="flex flex-col items-center gap-8 animate-fade-in">
            <div className="relative">
              <div className="h-16 w-16 rounded-full border-4 border-brand-500/30 animate-pulse" />
              <div className="absolute inset-0 h-16 w-16 rounded-full border-4 border-brand-500 border-t-transparent animate-spin" />
            </div>
            <div className="text-center space-y-3">
              <p className="text-lg font-medium text-slate-200">StyleSync</p>
              <p className="text-sm text-slate-400 tracking-wider uppercase">Authenticating</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen md:min-h-dvh relative">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-brand-500/3 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/3 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>
      
      <div className="flex min-h-screen">
        {/* Left side - Branding/Info */}
        <div className="hidden lg:flex lg:w-1/2 xl:w-3/5 flex-col justify-center px-8 lg:px-12 xl:px-20 relative z-10">
          <div className="max-w-2xl animate-fade-in-up">
            <h1 className="text-4xl lg:text-5xl xl:text-6xl font-bold bg-gradient-to-r from-brand-400 to-brand-300 bg-clip-text text-transparent mb-6 lg:mb-8">
              StyleSync
            </h1>
            <p className="text-lg lg:text-xl xl:text-2xl text-slate-300 mb-8 lg:mb-12 leading-relaxed max-w-lg">
              Transform your writing with AI-powered paraphrasing that matches your unique style
            </p>
            <div className="space-y-4 lg:space-y-6 text-slate-400">
              <div className="flex items-center gap-3 lg:gap-4">
                <div className="w-2 h-2 bg-brand-500 rounded-full flex-shrink-0"></div>
                <span className="text-base lg:text-lg">Personalized style analysis</span>
              </div>
              <div className="flex items-center gap-3 lg:gap-4">
                <div className="w-2 h-2 bg-brand-500 rounded-full flex-shrink-0"></div>
                <span className="text-base lg:text-lg">Advanced AI paraphrasing</span>
              </div>
              <div className="flex items-center gap-3 lg:gap-4">
                <div className="w-2 h-2 bg-brand-500 rounded-full flex-shrink-0"></div>
                <span className="text-base lg:text-lg">Seamless writing workflow</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right side - Auth Form */}
        <div className="w-full lg:w-1/2 xl:w-2/5 flex items-center justify-center p-4 lg:p-6 xl:p-8 relative z-10">
          <div className={`w-full max-w-sm lg:max-w-md space-y-3 lg:space-y-4 transform transition-all duration-700 ease-out animate-fade-in-up ${isAnimating ? 'scale-95 opacity-80' : 'scale-100 opacity-100'}`}>
            {/* Mobile branding */}
            <div className="text-center lg:hidden mb-4 lg:mb-6">
              <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-brand-400 to-brand-300 bg-clip-text text-transparent mb-2">
                StyleSync
              </h1>
              <p className="text-slate-400 text-sm sm:text-base">AI-powered writing transformation</p>
            </div>

            {/* Auth card */}
            <div className="glass-panel p-5 lg:p-6 xl:p-7 space-y-4 lg:space-y-5">
              {/* Header */}
              <div className="text-center space-y-1">
                <h2 className={`text-xl lg:text-2xl xl:text-3xl font-bold text-slate-100 transition-all duration-300 ${isAnimating ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'}`}>
                  {mode === 'signin' ? 'Welcome Back' : 'Get Started'}
                </h2>
                <p className={`text-slate-400 text-sm lg:text-base transition-all duration-300 delay-75 ${isAnimating ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'}`}>
                  {mode === 'signin' ? 'Sign in to continue your writing journey' : 'Create your account and start transforming text'}
                </p>
              </div>

              {!supabase && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 lg:p-4">
                  <p className="text-xs lg:text-sm text-amber-400">⚠️ Supabase environment variables missing.</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className={`space-y-3 lg:space-y-4 transition-all duration-300 delay-100 ${isAnimating ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}`}>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-300">Email Address</label>
                  <input 
                    type="email" 
                    value={email} 
                    onChange={e=>setEmail(e.target.value)} 
                    required 
                    className="w-full rounded-lg bg-slate-800/60 border border-white/10 px-3 lg:px-4 py-3 lg:py-4 text-sm lg:text-base placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500/50 transition-all duration-200" 
                    placeholder="Enter your email address"
                  />
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-300">Password</label>
                  <input 
                    type="password" 
                    value={pw} 
                    onChange={e=>setPw(e.target.value)} 
                    required 
                    className="w-full rounded-lg bg-slate-800/60 border border-white/10 px-3 lg:px-4 py-3 lg:py-4 text-sm lg:text-base placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500/50 transition-all duration-200" 
                    placeholder="Enter your password"
                  />
                </div>
                
                <button 
                  disabled={loading} 
                  className="w-full px-4 lg:px-6 py-3 lg:py-4 rounded-lg bg-gradient-to-r from-brand-500 to-brand-400 hover:from-brand-400 hover:to-brand-300 text-slate-900 font-semibold disabled:opacity-50 disabled:cursor-not-allowed transform transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center shadow-lg hover:shadow-brand-500/25 text-sm lg:text-base mt-3 lg:mt-4"
                >
                  {loading ? (
                    <div className="flex items-center gap-2 lg:gap-3">
                      <div className="h-4 w-4 lg:h-5 lg:w-5 border-2 border-slate-900/30 border-t-slate-900 animate-spin rounded-full" />
                      <span>{mode === 'signin' ? 'Signing In...' : 'Creating Account...'}</span>
                    </div>
                  ) : (
                    <span>{mode === 'signin' ? 'Sign In' : 'Create Account'}</span>
                  )}
                </button>
              </form>

              {/* Mode Switch */}
              <div className={`text-center transition-all duration-300 delay-150 ${isAnimating ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}`}>
                <button 
                  onClick={handleModeSwitch} 
                  className="text-slate-400 hover:text-brand-400 transition-colors duration-200 group text-sm lg:text-base"
                >
                  {mode === 'signin' ? "Don't have an account? " : "Already have an account? "}
                  <span className="text-brand-400 group-hover:text-brand-300 font-medium">
                    {mode === 'signin' ? 'Sign up' : 'Sign in'}
                  </span>
                </button>
              </div>

              {/* Message */}
              {msg && (
                <div className={`text-center transition-all duration-300 ${msg.includes('error') || msg.includes('Error') ? 'text-red-400' : msg.includes('email') ? 'text-emerald-400' : 'text-brand-400'} animate-fade-in`}>
                  <div className="bg-slate-800/60 border border-white/10 rounded-lg p-3 lg:p-4">
                    <p className="text-sm lg:text-base">{msg}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
