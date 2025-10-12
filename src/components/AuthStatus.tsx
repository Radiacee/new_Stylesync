"use client";
import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient.ts';
import { clearProfile } from '../lib/styleProfile.ts';
import { clearLocalParaphraseHistory } from '../lib/paraphraseHistory.ts';
import { FullScreenSpinner } from './FullScreenSpinner';
import Link from 'next/link';

const ADMIN_EMAILS = [
  'banlutachristiandave2@gmail.com',
  'admin@stylesync.com',
];

export function AuthStatus() {
  // Stable placeholder so initial server & client HTML match.
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [transitioning, setTransitioning] = useState(false);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    const prevEmailRef = { current: email } as { current: string | null };
    const initialHydratedRef = { current: false };
    if (supabase) {
      supabase.auth.getUser().then(({ data }) => {
        const existing = data.user?.email ?? null;
        setEmail(existing);
        prevEmailRef.current = existing; // establish baseline so first listener event doesn't trigger reload
        initialHydratedRef.current = true;
        setReady(true);
      });
      const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
        const nextEmail = session?.user?.email ?? null;
        const prev = prevEmailRef.current;
        const changed = prev !== nextEmail;
        if (changed) {
          setTransitioning(true);
          prevEmailRef.current = nextEmail;
          setEmail(nextEmail);
        }
        if (event === 'SIGNED_OUT' || (!nextEmail && prev)) {
          clearProfile();
          try { localStorage.removeItem('stylesync.profiles.v1'); } catch {}
          try { localStorage.removeItem('stylesync.profiles.activeId'); } catch {}
          try { clearLocalParaphraseHistory(); } catch {}
        }
        if (changed) {
          // Avoid reload loop on sign-in page itself
          const path = typeof window !== 'undefined' ? window.location.pathname : '';
          const isInitialSignedIn = !initialHydratedRef.current || (!prev && nextEmail);
          // Only reload on real transitions (not initial hydration where user already signed in)
          if (path !== '/auth/sign-in' && !isInitialSignedIn) {
            setTimeout(() => { if (typeof window !== 'undefined') window.location.reload(); }, 40);
          } else {
            // Stop spinner after short delay on sign-in page
            setTimeout(() => setTransitioning(false), 400);
          }
          initialHydratedRef.current = true;
        } else if (transitioning) {
          // Stop spinner if nothing changed
            setTimeout(() => setTransitioning(false), 300);
        }
      });
      unsub = () => listener.subscription.unsubscribe();
    } else {
      setReady(true);
    }
    return () => { unsub?.(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once

  if (!ready) {
    return <FullScreenSpinner label="Checking session" />;
  }

  if (!supabase || !email) {
    return <>
      <Link href="/auth/sign-in" className="block w-full md:w-auto text-center px-4 py-2 rounded-lg bg-brand-500/90 hover:bg-brand-400 text-slate-900 font-semibold transition">
        Sign In
      </Link>
      {transitioning && <FullScreenSpinner label="Refreshing session" />}
    </>;
  }

  return <>
    <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-2 text-xs w-full md:w-auto">
      {ADMIN_EMAILS.includes(email) && (
        <Link 
          href="/admin" 
          className="px-3 py-1 rounded bg-purple-600 hover:bg-purple-700 text-white font-medium transition text-xs text-center"
        >
          Admin
        </Link>
      )}
      <span className="text-slate-300 truncate" suppressHydrationWarning>{email}</span>
      <button 
        onClick={() => supabase?.auth.signOut()} 
        className="text-slate-400 hover:text-white text-left md:text-center py-1"
      >
        Sign out
      </button>
    </div>
    {transitioning && <FullScreenSpinner label="Refreshing session" />}
  </>;
}
