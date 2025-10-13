"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient.ts';

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState<'signin'|'signup'>('signin');
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState<'error' | 'success' | 'info'>('info');
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
    }, 250); // Change mode during animation
    setTimeout(() => {
      setIsAnimating(false);
    }, 500); // End animation after mode change
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) { 
      setMsg('Supabase not configured'); 
      setMsgType('error');
      return; 
    }
    setLoading(true); 
    setMsg('');
    
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
        
        if (error) {
          // Handle specific signup errors
          if (error.message.includes('already registered')) {
            setMsg('This email is already registered. Please sign in instead.');
            setMsgType('error');
          } else if (error.message.includes('password')) {
            setMsg('Password must be at least 6 characters long.');
            setMsgType('error');
          } else {
            setMsg(error.message);
            setMsgType('error');
          }
          throw error;
        }
        
        setMsg('Success! Check your email to confirm your account.');
        setMsgType('success');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
        
        if (error) {
          // Handle specific signin errors
          if (error.message.includes('Invalid login credentials')) {
            setMsg('Incorrect email or password. Please try again.');
            setMsgType('error');
          } else if (error.message.includes('Email not confirmed')) {
            setMsg('Please confirm your email address before signing in.');
            setMsgType('error');
          } else {
            setMsg(error.message);
            setMsgType('error');
          }
          throw error;
        }
        
        setMsg('Signed in successfully! Redirecting...');
        setMsgType('success');
        // Redirect quickly (allow short user feedback)
        setTimeout(() => router.replace('/paraphrase'), 300);
      }
    } catch (err: any) { 
      // Error already handled above
    } finally { 
      setLoading(false); 
    }
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
    <div className="min-h-screen md:min-h-dvh relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-brand-500/3 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/3 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>
      
      <div className="flex min-h-screen items-center pb-20">
        {/* Left side - Branding/Info */}
        <div className="hidden lg:flex lg:w-1/2 xl:w-3/5 flex-col justify-center px-8 lg:px-12 xl:px-20 relative z-10">
          <div className="max-w-2xl">
            <h1 className="text-4xl lg:text-5xl xl:text-6xl font-bold bg-gradient-to-r from-brand-400 to-brand-300 bg-clip-text text-transparent mb-6 lg:mb-8 pb-2">
              StyleSync
            </h1>
            <div 
              key={mode}
              className={`transition-all duration-300 ${isAnimating ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'}`}
            >
              <p className="text-lg lg:text-xl xl:text-2xl text-slate-300 mb-8 lg:mb-12 leading-relaxed max-w-lg">
                {mode === 'signin' 
                  ? 'Welcome back! Continue your journey to transform writing with AI-powered paraphrasing that matches your unique style' 
                  : 'Join StyleSync and start transforming your writing with AI-powered paraphrasing tailored to your personal style'}
              </p>
              <div className="space-y-4 lg:space-y-6 text-slate-400">
                {mode === 'signin' ? (
                  <>
                    <div className="flex items-center gap-3 lg:gap-4">
                      <div className="w-2 h-2 bg-brand-500 rounded-full flex-shrink-0"></div>
                      <span className="text-base lg:text-lg">Access your saved style profiles</span>
                    </div>
                    <div className="flex items-center gap-3 lg:gap-4">
                      <div className="w-2 h-2 bg-brand-500 rounded-full flex-shrink-0"></div>
                      <span className="text-base lg:text-lg">Continue your writing transformation</span>
                    </div>
                    <div className="flex items-center gap-3 lg:gap-4">
                      <div className="w-2 h-2 bg-brand-500 rounded-full flex-shrink-0"></div>
                      <span className="text-base lg:text-lg">Pick up where you left off</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-3 lg:gap-4">
                      <div className="w-2 h-2 bg-brand-500 rounded-full flex-shrink-0"></div>
                      <span className="text-base lg:text-lg">Create personalized style profiles</span>
                    </div>
                    <div className="flex items-center gap-3 lg:gap-4">
                      <div className="w-2 h-2 bg-brand-500 rounded-full flex-shrink-0"></div>
                      <span className="text-base lg:text-lg">Advanced AI paraphrasing engine</span>
                    </div>
                    <div className="flex items-center gap-3 lg:gap-4">
                      <div className="w-2 h-2 bg-brand-500 rounded-full flex-shrink-0"></div>
                      <span className="text-base lg:text-lg">Start transforming in seconds</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right side - Auth Form */}
        <div className="w-full lg:w-1/2 xl:w-2/5 flex items-center justify-center p-4 lg:p-6 xl:p-8 relative z-10">
          <div className={`w-full max-w-sm lg:max-w-md space-y-3 lg:space-y-4 transform transition-all duration-700 ease-out animate-fade-in-up ${isAnimating ? 'scale-95 opacity-80' : 'scale-100 opacity-100'}`}>
            {/* Mobile branding */}
            <div className="text-center lg:hidden mb-3 lg:mb-4">
              <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-brand-400 to-brand-300 bg-clip-text text-transparent mb-2 pb-1">
                StyleSync
              </h1>
              <p className="text-slate-400 text-sm sm:text-base">AI-powered writing transformation</p>
            </div>

            {/* Auth card */}
            <div className="glass-panel p-4 lg:p-5 xl:p-6 space-y-3 lg:space-y-4">
              {/* Header */}
              <div className="text-center space-y-1">
                <h2 className={`text-xl lg:text-2xl xl:text-3xl font-bold text-slate-100 transition-all duration-300 ${isAnimating ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'}`}>
                  {mode === 'signin' ? 'Welcome Back' : 'Get Started'}
                </h2>
                <p className={`text-slate-400 text-xs lg:text-sm transition-all duration-300 delay-75 ${isAnimating ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'}`}>
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
                  <div className="relative">
                    <input 
                      type={showPassword ? "text" : "password"}
                      value={pw} 
                      onChange={e=>setPw(e.target.value)} 
                      required 
                      className="w-full rounded-lg bg-slate-800/60 border border-white/10 px-3 lg:px-4 py-3 lg:py-4 pr-12 text-sm lg:text-base placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500/50 transition-all duration-200" 
                      placeholder="Enter your password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 lg:right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300 transition-colors duration-200 focus:outline-none"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      )}
                    </button>
                  </div>
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
                <div className={`text-center transition-all duration-300 animate-fade-in`}>
                  <div className={`rounded-lg p-3 lg:p-4 border ${
                    msgType === 'error' 
                      ? 'bg-red-500/10 border-red-500/30 text-red-400' 
                      : msgType === 'success'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : 'bg-brand-500/10 border-brand-500/30 text-brand-400'
                  }`}>
                    <div className="flex items-start gap-3">
                      {msgType === 'error' && (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 flex-shrink-0 mt-0.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                        </svg>
                      )}
                      {msgType === 'success' && (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 flex-shrink-0 mt-0.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                      <p className="text-sm lg:text-base text-left flex-1">{msg}</p>
                    </div>
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
