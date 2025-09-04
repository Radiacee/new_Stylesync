"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';

const ADMIN_EMAILS = [
  'banlutachristiandave2@gmail.com',
  'admin@stylesync.com',
];

export default function AuthConfirmPage() {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Processing authentication...');

  useEffect(() => {
    const handleAuthConfirmation = async () => {
      if (!supabase) {
        setStatus('error');
        setMessage('Authentication service unavailable');
        return;
      }

      try {
        // Get tokens from URL hash or search params
        const hash = window.location.hash.substring(1);
        const searchParams = new URLSearchParams(window.location.search);
        
        let access_token, refresh_token;
        
        if (hash) {
          const hashParams = new URLSearchParams(hash);
          access_token = hashParams.get('access_token');
          refresh_token = hashParams.get('refresh_token');
        } else {
          access_token = searchParams.get('access_token');
          refresh_token = searchParams.get('refresh_token');
        }

        if (access_token && refresh_token) {
          // Set the session with the tokens
          const { data, error } = await supabase.auth.setSession({
            access_token,
            refresh_token
          });

          if (error) {
            console.error('Auth error:', error);
            setStatus('error');
            setMessage(`Authentication failed: ${error.message}`);
            return;
          }

          if (data.user) {
            setStatus('success');
            setMessage('Authentication successful! Redirecting...');
            
            // Check if user is admin and redirect accordingly
            const isAdmin = ADMIN_EMAILS.includes(data.user.email || '');
            const redirectPath = isAdmin ? '/admin' : '/paraphrase';
            
            // Wait a moment then redirect
            setTimeout(() => {
              router.push(redirectPath);
            }, 2000);
          } else {
            setStatus('error');
            setMessage('No user data received');
          }
        } else {
          // Try to handle other auth flows
          const { data, error } = await supabase.auth.getSession();
          
          if (data.session) {
            setStatus('success');
            setMessage('Already authenticated! Redirecting...');
            
            // Check if user is admin and redirect accordingly
            const { data: { user } } = await supabase.auth.getUser();
            const isAdmin = user && ADMIN_EMAILS.includes(user.email || '');
            const redirectPath = isAdmin ? '/admin' : '/paraphrase';
            
            setTimeout(() => {
              router.push(redirectPath);
            }, 1000);
          } else {
            setStatus('error');
            setMessage('No authentication tokens found');
          }
        }
      } catch (err) {
        console.error('Auth confirmation error:', err);
        setStatus('error');
        setMessage('An unexpected error occurred');
      }
    };

    handleAuthConfirmation();
  }, [router]);

  return (
    <div className="min-h-screen md:min-h-dvh relative">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-brand-500/3 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/3 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="flex min-h-screen items-center justify-center p-6 relative z-10">
        <div className="w-full max-w-md glass-panel p-12 space-y-8 animate-fade-in-up">
          <div className="text-center space-y-4">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-brand-400 to-brand-300 bg-clip-text text-transparent">
              StyleSync
            </h1>
            <p className="text-base text-slate-400">Email Confirmation</p>
          </div>

          {status === 'loading' && (
            <div className="space-y-8 text-center animate-fade-in">
              <div className="relative mx-auto w-16 h-16">
                <div className="absolute inset-0 rounded-full border-4 border-brand-500/30 animate-pulse" />
                <div className="absolute inset-0 rounded-full border-4 border-brand-500 border-t-transparent animate-spin" />
              </div>
              <div className="space-y-4">
                <p className="text-slate-200 font-medium text-lg">Processing Authentication</p>
                <p className="text-base text-slate-400">{message}</p>
              </div>
            </div>
          )}

          {status === 'success' && (
            <div className="space-y-8 text-center animate-fade-in">
              <div className="mx-auto w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="space-y-4">
                <p className="text-emerald-400 font-semibold text-xl">Success!</p>
                <p className="text-slate-300 text-base">{message}</p>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="space-y-8 text-center animate-fade-in">
              <div className="mx-auto w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div className="space-y-6">
                <div className="space-y-4">
                  <p className="text-red-400 font-semibold text-xl">Authentication Failed</p>
                  <p className="text-slate-300 text-base">{message}</p>
                </div>
                <button
                  onClick={() => router.push('/auth/sign-in')}
                  className="w-full px-6 py-4 rounded-lg bg-gradient-to-r from-brand-500 to-brand-400 hover:from-brand-400 hover:to-brand-300 text-slate-900 font-semibold transform transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-brand-500/25 text-base"
                >
                  Return to Sign In
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
