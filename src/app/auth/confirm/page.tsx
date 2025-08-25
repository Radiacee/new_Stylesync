"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';

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
            
            // Wait a moment then redirect
            setTimeout(() => {
              router.push('/paraphrase');
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
            setTimeout(() => {
              router.push('/paraphrase');
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
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-blue-900 flex items-center justify-center px-4">
      <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-8 max-w-md w-full text-center">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-2">StyleSync</h1>
          <p className="text-gray-300">Email Confirmation</p>
        </div>

        {status === 'loading' && (
          <div className="space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400 mx-auto"></div>
            <p className="text-gray-300">{message}</p>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-4">
            <div className="text-green-400 text-4xl">✓</div>
            <p className="text-green-300 font-medium">{message}</p>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-4">
            <div className="text-red-400 text-4xl">✗</div>
            <p className="text-red-300 font-medium">{message}</p>
            <button
              onClick={() => router.push('/auth/sign-in')}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Return to Sign In
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
