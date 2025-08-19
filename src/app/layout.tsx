import './globals.css';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { AuthStatus } from '../components/AuthStatus.tsx';

export const metadata = {
  title: 'StyleSync',
  description: 'Personalize paraphrasing to your authentic writing voice (ethical, transparent use).'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      {/* suppressHydrationWarning on body to ignore extension-injected attrs (e.g. Grammarly) */}
      <body suppressHydrationWarning>
        <header className="fixed top-0 inset-x-0 z-40 backdrop-blur-xl bg-slate-950/70 border-b border-white/10">
          <nav className="mx-auto max-w-6xl px-6 py-3 flex items-center gap-8">
            <Link href="/" className="font-bold text-lg tracking-tight bg-gradient-to-r from-brand-300 to-brand-500 bg-clip-text text-transparent">StyleSync</Link>
            <div className="flex gap-6 text-sm text-slate-300">
              <Link href="/style/onboarding" className="hover:text-white transition">Create Style</Link>
              <Link href="/paraphrase" className="hover:text-white transition">Paraphrase</Link>
              <Link href="/about" className="hover:text-white transition">About</Link>
            </div>
            <div className="ml-auto flex gap-3 items-center">
              <AuthStatus />
            </div>
          </nav>
        </header>
        <main className="pt-20 pb-16 min-h-screen mx-auto max-w-6xl px-6">{children}</main>
        <footer className="mt-8 py-10 text-center text-xs text-slate-500">Built responsibly. Avoid misuse; do not present AI-assisted text as purely human authored without disclosure.</footer>
      </body>
    </html>
  );
}
