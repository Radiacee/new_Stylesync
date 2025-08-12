import './globals.css';
import type { ReactNode } from 'react';
import Link from 'next/link';

export const metadata = {
  title: 'Stylesync',
  description: 'Personalize paraphrasing to your authentic writing voice (ethical, transparent use).'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <header className="fixed top-0 inset-x-0 z-40 backdrop-blur-xl bg-slate-950/70 border-b border-white/10">
          <nav className="mx-auto max-w-6xl px-6 py-3 flex items-center gap-8">
            <Link href="/" className="font-bold text-lg tracking-tight bg-gradient-to-r from-brand-300 to-brand-500 bg-clip-text text-transparent">Stylesync</Link>
            <div className="flex gap-6 text-sm text-slate-300">
              <Link href="/style/onboarding" className="hover:text-white transition">Create Style</Link>
              <Link href="/paraphrase" className="hover:text-white transition">Paraphrase</Link>
              <Link href="/about" className="hover:text-white transition">About</Link>
            </div>
            <div className="ml-auto flex gap-3">
              <button className="px-4 py-2 rounded-lg bg-brand-500/90 hover:bg-brand-400 text-slate-900 font-semibold shadow-subtle-glow transition">Sign In</button>
            </div>
          </nav>
        </header>
        <main className="pt-20 pb-16 min-h-screen mx-auto max-w-6xl px-6">{children}</main>
        <footer className="mt-8 py-10 text-center text-xs text-slate-500">Built responsibly. Avoid misuse; do not present AI-assisted text as purely human authored without disclosure.</footer>
      </body>
    </html>
  );
}
