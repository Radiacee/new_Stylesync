"use client";

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { AuthStatus } from './AuthStatus';
import WelcomeModal from './WelcomeModal';
import { ThemeToggle } from './ThemeToggle';
import { useState } from 'react';

interface ConditionalLayoutProps {
  children: React.ReactNode;
}

export function ConditionalLayout({ children }: ConditionalLayoutProps) {
  const pathname = usePathname();
  const isAdminRoute = pathname.startsWith('/admin');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (isAdminRoute) {
    // Admin routes get no main app layout
    return <div className="admin-wrapper">{children}</div>;
  }

  // Regular routes get the normal layout
  return (
    <>
      <WelcomeModal />
      <header className="fixed top-0 inset-x-0 z-40 backdrop-blur-xl bg-slate-50 dark:bg-slate-950/70 border-b border-white/10">
        <nav className="mx-auto max-w-6xl px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between">
            {/* Left side - Logo and Nav Links grouped together */}
            <div className="flex items-center gap-8">
              {/* Logo */}
              <Link href="/" className="font-bold text-lg tracking-tight bg-gradient-to-r from-brand-600 to-brand-500 dark:from-brand-300 dark:to-brand-400 bg-clip-text text-transparent pb-1 pr-1">
                StyleSync
              </Link>

              {/* Desktop Navigation */}
              <div className="hidden md:flex gap-6 text-sm">
                <Link 
                  href="/style/onboarding" 
                  className={`hover:text-slate-900 dark:text-white transition ${
                    pathname.startsWith('/style') 
                      ? 'text-brand-600 dark:text-brand-400 font-semibold' 
                      : 'text-slate-800 dark:text-slate-300'
                  }`}
                >
                  Create Style
                </Link>
                <Link 
                  href="/paraphrase" 
                  className={`hover:text-slate-900 dark:text-white transition ${
                    pathname === '/paraphrase' 
                      ? 'text-brand-600 dark:text-brand-400 font-semibold' 
                      : 'text-slate-800 dark:text-slate-300'
                  }`}
                >
                  Paraphrase
                </Link>
                <Link 
                  href="/writing-guide" 
                  className={`hover:text-slate-900 dark:text-white transition ${
                    pathname === '/writing-guide' 
                      ? 'text-brand-600 dark:text-brand-400 font-semibold' 
                      : 'text-slate-800 dark:text-slate-300'
                  }`}
                >
                  Writing Guide
                </Link>
                <Link 
                  href="/about" 
                  className={`hover:text-slate-900 dark:text-white transition ${
                    pathname === '/about' 
                      ? 'text-brand-600 dark:text-brand-400 font-semibold' 
                      : 'text-slate-800 dark:text-slate-300'
                  }`}
                >
                  About
                </Link>
                <Link 
                  href="/pricing" 
                  className={`hover:text-amber-500 transition font-bold flex items-center gap-1 ${
                    pathname === '/pricing' 
                      ? 'text-amber-500' 
                      : 'text-amber-600 dark:text-amber-400'
                  }`}
                >
                  Premium 👑
                </Link>
              </div>
            </div>

            {/* Right side - Auth Status & Theme Toggle */}
            <div className="hidden md:flex gap-3 items-center">
              <ThemeToggle />
              <AuthStatus />
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-white/10 transition-colors text-slate-800 dark:text-slate-300 ml-auto"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden mt-3 pt-3 border-t border-white/10 space-y-3 text-left">
              <Link 
                href="/style/onboarding" 
                className={`block py-2 text-sm hover:text-slate-900 dark:text-white transition text-left ${
                  pathname.startsWith('/style') 
                    ? 'text-brand-600 dark:text-brand-400 font-semibold' 
                    : 'text-slate-800 dark:text-slate-300'
                }`}
                onClick={() => setMobileMenuOpen(false)}
              >
                Create Style
              </Link>
              <Link 
                href="/paraphrase" 
                className={`block py-2 text-sm hover:text-slate-900 dark:text-white transition text-left ${
                  pathname === '/paraphrase' 
                    ? 'text-brand-600 dark:text-brand-400 font-semibold' 
                    : 'text-slate-800 dark:text-slate-300'
                }`}
                onClick={() => setMobileMenuOpen(false)}
              >
                Paraphrase
              </Link>
              <Link 
                href="/writing-guide" 
                className={`block py-2 text-sm hover:text-slate-900 dark:text-white transition text-left ${
                  pathname === '/writing-guide' 
                    ? 'text-brand-600 dark:text-brand-400 font-semibold' 
                    : 'text-slate-800 dark:text-slate-300'
                }`}
                onClick={() => setMobileMenuOpen(false)}
              >
                Writing Guide
              </Link>
              <Link 
                href="/about" 
                className={`block py-2 text-sm hover:text-slate-900 dark:text-white transition text-left ${
                  pathname === '/about' 
                    ? 'text-brand-600 dark:text-brand-400 font-semibold' 
                    : 'text-slate-800 dark:text-slate-300'
                }`}
                onClick={() => setMobileMenuOpen(false)}
              >
                About
              </Link>
              <Link 
                href="/pricing" 
                className={`block py-2 text-sm transition text-left font-bold flex items-center gap-1 ${
                  pathname === '/pricing' 
                    ? 'text-amber-500' 
                    : 'text-amber-600 dark:text-amber-400 hover:text-amber-500'
                }`}
                onClick={() => setMobileMenuOpen(false)}
              >
                Premium 👑
              </Link>
              <div className="pt-3 border-t border-white/10 flex flex-col gap-3">
                <div className="flex items-center justify-between px-2">
                  <span className="text-sm text-slate-600 dark:text-slate-500 dark:text-slate-400">Theme</span>
                  <ThemeToggle />
                </div>
                <AuthStatus />
              </div>
            </div>
          )}
        </nav>
      </header>
      <main className="pt-20 pb-16 min-h-screen mx-auto max-w-6xl px-6">
        {children}
      </main>
      <footer className="mt-8 py-10 text-center text-xs text-slate-600 dark:text-slate-500">
        Built responsibly. Avoid misuse; do not present AI-assisted text as purely human authored without disclosure.
      </footer>
    </>
  );
}
