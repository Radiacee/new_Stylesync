"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState<'error' | 'success'>('error');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  // Pre-check session: user must be logged in (which recovery redirect handles)
  useEffect(() => {
    let active = true;
    (async () => {
      if (!supabase) { setChecking(false); return; }
      try {
        const { data } = await supabase.auth.getUser();
        if (active && !data.user) {
          // If no active session, redirect to sign-in
          router.replace('/auth/sign-in');
          return;
        }
      } finally { if (active) setChecking(false); }
    })();
    return () => { active = false; };
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) { 
      setMsg('Authentication service unavailable'); 
      setMsgType('error');
      return; 
    }

    if (password.length < 6) {
      setMsg('Password must be at least 6 characters long.');
      setMsgType('error');
      return;
    }

    if (password !== confirmPassword) {
      setMsg('Passwords do not match. Please verify.');
      setMsgType('error');
      return;
    }

    setLoading(true);
    setMsg('');

    try {
      const { error } = await supabase.auth.updateUser({ password });
      
      if (error) {
        setMsg(error.message);
        setMsgType('error');
        throw error;
      }

      setMsg('Password updated successfully! Redirecting...');
      setMsgType('success');
      setTimeout(() => router.replace('/paraphrase'), 1500);
    } catch (err) {
      // already set error msg
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen md:min-h-dvh relative">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-brand-500/3 rounded-full blur-3xl animate-pulse" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/3 rounded-full blur-3xl animate-pulse delay-1000" />
        </div>
        <div className="flex min-h-screen items-center justify-center p-6 relative z-10">
          <div className="flex flex-col items-center gap-8">
            <div className="relative">
              <div className="h-16 w-16 rounded-full border-4 border-brand-500/30 animate-pulse" />
              <div className="absolute inset-0 h-16 w-16 rounded-full border-4 border-brand-500 border-t-transparent animate-spin" />
            </div>
            <div className="text-center space-y-3">
              <p className="text-lg font-medium text-slate-200">StyleSync</p>
              <p className="text-sm text-slate-400 tracking-wider uppercase">Loading Session</p>
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

      <div className="flex min-h-screen items-center justify-center p-4 lg:p-6 relative z-10 pb-20">
        <div className="w-full max-w-sm lg:max-w-md space-y-3 lg:space-y-4 transform transition-all duration-700 ease-out animate-fade-in-up">
          
          {/* Logo Branding */}
          <div className="text-center mb-3">
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-brand-400 to-brand-300 bg-clip-text text-transparent mb-2 pb-1">
              StyleSync
            </h1>
            <p className="text-slate-400 text-sm sm:text-base">Change Account Password</p>
          </div>

          {/* Form Card */}
          <div className="glass-panel p-4 lg:p-5 xl:p-6 space-y-3 lg:space-y-4">
            <div className="text-center space-y-1">
              <h2 className="text-xl lg:text-2xl font-bold text-slate-100">Set New Password</h2>
              <p className="text-slate-400 text-xs lg:text-sm">
                Enter your new password below to update your account credentials.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 lg:space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-300">New Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full rounded-lg bg-slate-800/60 border border-white/10 px-3 lg:px-4 py-3 lg:py-4 pr-12 text-sm lg:text-base placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500/50 transition-all duration-200"
                    placeholder="Min. 6 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 lg:right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300 transition-colors focus:outline-none"
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

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-300">Confirm Password</label>
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full rounded-lg bg-slate-800/60 border border-white/10 px-3 lg:px-4 py-3 lg:py-4 text-sm lg:text-base placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500/50 transition-all duration-200"
                  placeholder="Repeat new password"
                />
              </div>

              <button
                disabled={loading}
                className="w-full px-4 lg:px-6 py-3 lg:py-4 rounded-lg bg-gradient-to-r from-brand-500 to-brand-400 hover:from-brand-400 hover:to-brand-300 text-slate-900 font-semibold disabled:opacity-50 disabled:cursor-not-allowed transform transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center shadow-lg hover:shadow-brand-500/25 text-sm lg:text-base mt-4"
              >
                {loading ? (
                  <div className="flex items-center gap-2 lg:gap-3">
                    <div className="h-4 w-4 lg:h-5 lg:w-5 border-2 border-slate-900/30 border-t-slate-900 animate-spin rounded-full" />
                    <span>Updating...</span>
                  </div>
                ) : (
                  <span>Update Password</span>
                )}
              </button>
            </form>

            {/* Error/Success Messages */}
            {msg && (
              <div className="text-center animate-fade-in mt-3">
                <div className={`rounded-lg p-3 lg:p-4 border ${
                  msgType === 'error'
                    ? 'bg-red-500/10 border-red-500/30 text-red-400'
                    : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                }`}>
                  <div className="flex items-start gap-3">
                    {msgType === 'error' ? (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 flex-shrink-0 mt-0.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 flex-shrink-0 mt-0.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                    <p className="text-xs sm:text-sm text-left flex-1">{msg}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
