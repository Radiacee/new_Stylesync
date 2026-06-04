'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import UAT_FeedbackModal from '../components/UAT_FeedbackModal';

const hasModel = !!process.env.GROQ_API_KEY;

export default function LandingPage() {
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    // Show modal immediately on homepage
    const dismissed = localStorage.getItem('uat_feedback_dismissed');
    if (!dismissed) {
      setShowFeedbackModal(true);
    }
  }, []);

  return (
    <>
      <div className="py-8 lg:py-16">
      <section className="grid gap-12 lg:grid-cols-2 items-center">
        <div className="space-y-8">
          <div className="space-y-6">
            <h1 className="text-4xl lg:text-5xl font-bold leading-tight tracking-tight">
              Your voice. <span className="text-brand-400">Consistent</span>. AI-enhanced.
            </h1>
            <p className="text-lg lg:text-xl text-slate-300 max-w-prose leading-relaxed">
              Transform any text to match your unique writing style with AI-powered analysis.
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4">
            <Link href="/style/onboarding" className="px-8 py-4 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-900 font-semibold shadow-subtle-glow transition text-center">Create Your Style</Link>
            <Link href="/paraphrase" className="px-8 py-4 rounded-xl border border-white/15 hover:border-brand-400/60 text-slate-200 hover:text-white transition text-center">Start Paraphrasing</Link>
          </div>
          
          <ul className="space-y-3 text-slate-400">
            <li className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-brand-400 flex-shrink-0"></div>
              <span>Maintain your authentic writing voice</span>
            </li>
            <li className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-brand-400 flex-shrink-0"></div>
              <span>Consistent style across all content</span>
            </li>
            <li className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-brand-400 flex-shrink-0"></div>
              <span>AI-powered text transformation</span>
            </li>
          </ul>
        </div>
        
        <div className="relative">
          <div className="glass-panel p-8 h-full flex flex-col justify-between min-h-[400px]">
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-brand-300">How it works</h2>
              <ol className="space-y-4 text-slate-300">
                <li className="flex gap-4">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-500 text-slate-900 text-sm font-bold flex items-center justify-center">1</span>
                  <span>Create your style profile with sample writing</span>
                </li>
                <li className="flex gap-4">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-500 text-slate-900 text-sm font-bold flex items-center justify-center">2</span>
                  <span>AI analyzes your tone, formality, and patterns</span>
                </li>
                <li className="flex gap-4">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-500 text-slate-900 text-sm font-bold flex items-center justify-center">3</span>
                  <span>Transform any text to match your style</span>
                </li>
              </ol>
            </div>
            <div className="pt-6 border-t border-white/10">
              <p className="text-xs text-slate-500">Powered by advanced AI models for intelligent style analysis and text transformation.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-16 grid gap-12 lg:grid-cols-2 items-start">
        <div className="rounded-[32px] border border-white/10 bg-slate-950/70 p-8 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.85)]">
          <p className="text-sm uppercase tracking-[0.3em] text-brand-300">Why it helps</p>
          <h2 className="mt-4 text-3xl font-semibold text-slate-100">Write faster with consistent style</h2>
          <p className="mt-4 text-slate-400 max-w-prose">Stylesync uses your own examples to learn your tone and sentence style, so every rewrite stays true to your voice while improving clarity and flow.</p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-5">
              <p className="font-semibold text-slate-100">Less rewriting</p>
              <p className="mt-2 text-sm text-slate-400">Reduce the time you spend fixing drafts and drafts again.</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-5">
              <p className="font-semibold text-slate-100">Consistent tone</p>
              <p className="mt-2 text-sm text-slate-400">Keep one voice across emails, posts, reports, and documents.</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-5">
              <p className="font-semibold text-slate-100">Smart suggestions</p>
              <p className="mt-2 text-sm text-slate-400">Get improvements that match your unique phrasing and formality.</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-5">
              <p className="font-semibold text-slate-100">More confidence</p>
              <p className="mt-2 text-sm text-slate-400">Publish or send writing that feels polished and authentic.</p>
            </div>
          </div>
        </div>

        <div className="rounded-[32px] border border-white/10 bg-slate-950/70 p-8 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.85)]">
          <p className="text-sm uppercase tracking-[0.3em] text-brand-300">How to use it</p>
          <h2 className="mt-4 text-3xl font-semibold text-slate-100">Start in three easy steps</h2>
          <ul className="mt-6 space-y-4 text-slate-300 text-sm">
            <li className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              <p className="font-semibold text-slate-100">1. Create a style profile</p>
              <p className="mt-1 text-slate-400">Submit a few examples of your best writing so the AI can learn your preferences.</p>
            </li>
            <li className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              <p className="font-semibold text-slate-100">2. Analyze your text</p>
              <p className="mt-1 text-slate-400">Use the analysis tools to see how your style is represented across tone, rhythm, and structure.</p>
            </li>
            <li className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              <p className="font-semibold text-slate-100">3. Rewrite with confidence</p>
              <p className="mt-1 text-slate-400">Paraphrase any draft and keep your meaning while the AI aligns it with your style.</p>
            </li>
          </ul>
        </div>
      </section>

      <section className="mt-16 grid gap-8 lg:grid-cols-3 items-start">
        <div className="rounded-[32px] border border-white/10 bg-slate-950/70 p-8 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.85)]">
          <p className="text-sm uppercase tracking-[0.3em] text-brand-300">For your work</p>
          <h3 className="mt-4 text-2xl font-semibold text-slate-100">Draft faster</h3>
          <p className="mt-3 text-slate-400 text-sm">Turn notes, ideas, or rough drafts into clean text without losing your voice.</p>
        </div>
        <div className="rounded-[32px] border border-white/10 bg-slate-950/70 p-8 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.85)]">
          <p className="text-sm uppercase tracking-[0.3em] text-brand-300">For your brand</p>
          <h3 className="mt-4 text-2xl font-semibold text-slate-100">Stay consistent</h3>
          <p className="mt-3 text-slate-400 text-sm">Keep the same style across emails, posts, and reports so your message feels cohesive.</p>
        </div>
        <div className="rounded-[32px] border border-white/10 bg-slate-950/70 p-8 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.85)]">
          <p className="text-sm uppercase tracking-[0.3em] text-brand-300">For your process</p>
          <h3 className="mt-4 text-2xl font-semibold text-slate-100">Own your voice</h3>
          <p className="mt-3 text-slate-400 text-sm">Use AI as a partner that enhances your writing without taking over your personality.</p>
        </div>
      </section>
    </div>

    {/* UAT Feedback Modal */}
    {isMounted && (
      <UAT_FeedbackModal
        formLink="https://forms.gle/5q3h5uUhPSDMqAKAA"
        isOpen={showFeedbackModal}
        onClose={() => setShowFeedbackModal(false)}
      />
    )}
    </>
  );
}
