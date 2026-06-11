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

        <section className="mt-24">
          <div className="text-center mb-16">
            <p className="text-sm uppercase tracking-[0.3em] text-brand-300 font-bold mb-4">Why it helps</p>
            <h2 className="text-3xl md:text-5xl font-bold text-slate-100 mb-6">Write faster with consistent style</h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">Stylesync uses your own examples to learn your tone and sentence style, so every rewrite stays true to your voice while improving clarity and flow.</p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-[24px] border border-white/5 bg-slate-900/50 p-6 shadow-xl relative overflow-hidden group hover:border-white/10 transition-colors">
              <div className="absolute inset-0 bg-gradient-to-br from-brand-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-xl mb-4 group-hover:scale-110 transition-transform">⚡</div>
              <p className="font-bold text-lg text-slate-100 mb-2">Less rewriting</p>
              <p className="text-sm text-slate-400 leading-relaxed">Reduce the time you spend fixing drafts and editing over and over again.</p>
            </div>
            <div className="rounded-[24px] border border-white/5 bg-slate-900/50 p-6 shadow-xl relative overflow-hidden group hover:border-white/10 transition-colors">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-xl mb-4 group-hover:scale-110 transition-transform">🎯</div>
              <p className="font-bold text-lg text-slate-100 mb-2">Consistent tone</p>
              <p className="text-sm text-slate-400 leading-relaxed">Keep one voice across emails, posts, reports, and all your important documents.</p>
            </div>
            <div className="rounded-[24px] border border-white/5 bg-slate-900/50 p-6 shadow-xl relative overflow-hidden group hover:border-white/10 transition-colors">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-xl mb-4 group-hover:scale-110 transition-transform">💡</div>
              <p className="font-bold text-lg text-slate-100 mb-2">Smart suggestions</p>
              <p className="text-sm text-slate-400 leading-relaxed">Get improvements that actually match your unique phrasing and level of formality.</p>
            </div>
            <div className="rounded-[24px] border border-white/5 bg-slate-900/50 p-6 shadow-xl relative overflow-hidden group hover:border-white/10 transition-colors">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-xl mb-4 group-hover:scale-110 transition-transform">✨</div>
              <p className="font-bold text-lg text-slate-100 mb-2">More confidence</p>
              <p className="text-sm text-slate-400 leading-relaxed">Publish or send writing that feels incredibly polished and 100% authentic.</p>
            </div>
          </div>
        </section>

        <section className="mt-32">
          <div className="text-center mb-20">
            <p className="text-sm uppercase tracking-[0.3em] text-brand-300 font-bold mb-4">How it works</p>
            <h2 className="text-3xl md:text-5xl font-bold text-slate-100">The complete writing workflow</h2>
          </div>

          <div className="space-y-32">
            {/* Step 1: Create Style */}
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="order-2 lg:order-1 relative group">
                 <div className="absolute inset-0 bg-brand-500/20 blur-[100px] rounded-full group-hover:bg-brand-500/30 transition-all duration-700"></div>
                 <div className="relative rounded-[24px] border border-white/10 bg-[#0f172a]/90 backdrop-blur-xl p-6 md:p-8 shadow-2xl transform transition-transform duration-500 hover:-translate-y-2">
                    <div className="flex justify-center mb-8">
                      <div className="inline-flex rounded-xl border border-white/10 bg-black/40 p-1">
                        <div className="px-6 py-2 rounded-lg bg-brand-500 text-slate-900 text-sm font-bold shadow-md flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                          Upload Essays
                        </div>
                        <div className="px-6 py-2 rounded-lg text-slate-400 text-sm font-medium hover:text-white transition-colors flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                          Answer Questions
                        </div>
                      </div>
                    </div>
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-300 ml-1">Profile Name</label>
                        <div className="w-full h-12 rounded-xl bg-black/50 border border-white/5 flex items-center px-4">
                          <span className="text-slate-500 text-sm">e.g., My Academic Style, Casual Blog Style</span>
                        </div>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-slate-900/60 p-5">
                        <div className="flex justify-between items-center mb-4">
                           <span className="text-sm font-bold text-white">Your Writing Samples</span>
                           <span className="text-xs text-yellow-500 font-bold tracking-wide">0 essays • 0 words</span>
                        </div>
                        <div className="w-full h-32 rounded-xl bg-black/40 border border-white/5 border-dashed p-4 flex flex-col justify-center items-center text-center hover:bg-white/5 transition-colors cursor-pointer group/upload">
                           <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center mb-3 group-hover/upload:bg-brand-500/20 group-hover/upload:text-brand-400 transition-colors">
                             <svg className="w-5 h-5 text-slate-400 group-hover/upload:text-brand-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                           </div>
                           <span className="text-slate-400 text-sm font-medium">Paste your essay or writing sample here...</span>
                        </div>
                      </div>
                      <div className="pt-2">
                         <div className="w-full py-4 rounded-xl bg-brand-500/10 border border-brand-500/30 text-brand-400 hover:bg-brand-500/20 text-center font-bold text-sm cursor-pointer transition-colors shadow-[0_0_15px_rgba(56,189,248,0.15)]">Analyze Style</div>
                      </div>
                    </div>
                 </div>
              </div>
              <div className="order-1 lg:order-2 lg:pl-16">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-brand-500/10 text-brand-400 font-bold text-xl mb-6 border border-brand-500/20 shadow-[0_0_15px_rgba(56,189,248,0.15)]">1</div>
                <h3 className="text-3xl lg:text-4xl font-bold text-slate-100 mb-6">Create your style profile</h3>
                <p className="text-slate-400 text-lg leading-relaxed">
                  Upload your previous essays, articles, or emails. Our AI analyzes your unique vocabulary, sentence structure, and tone to build a comprehensive profile of how you write natively.
                </p>
              </div>
            </div>

            {/* Step 2: Analysis */}
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="lg:pr-16">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 font-bold text-xl mb-6 border border-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.15)]">2</div>
                <h3 className="text-3xl lg:text-4xl font-bold text-slate-100 mb-6">Understand your voice</h3>
                <p className="text-slate-400 text-lg leading-relaxed">
                  Get deep insights into your writing habits. See your average sentence length, vocabulary richness, and readability score. Learn what you're doing well and where you can immediately improve.
                </p>
              </div>
              <div className="relative group">
                 <div className="absolute inset-0 bg-indigo-500/20 blur-[100px] rounded-full group-hover:bg-indigo-500/30 transition-all duration-700"></div>
                 <div className="relative rounded-[24px] border border-white/10 bg-[#0f172a]/90 backdrop-blur-xl p-6 md:p-8 shadow-2xl transform transition-transform duration-500 hover:-translate-y-2">
                    <div className="rounded-xl bg-slate-900/80 border border-white/5 p-6 mb-6 shadow-inner">
                      <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 text-xl">👤</div>
                        <div>
                          <div className="text-base font-bold text-white mb-1">Your Writing Analysis</div>
                          <div className="text-xs text-slate-400">Personalized feedback based on your profile essay</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                         <div className="text-center p-3 rounded-xl bg-black/40 border border-white/5">
                           <div className="text-2xl font-bold text-white mb-1">209</div>
                           <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Words</div>
                         </div>
                         <div className="text-center p-3 rounded-xl bg-black/40 border border-white/5">
                           <div className="text-2xl font-bold text-white mb-1">21</div>
                           <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Avg Length</div>
                         </div>
                         <div className="text-center p-3 rounded-xl bg-black/40 border border-white/5">
                           <div className="text-xl font-bold text-amber-400 mb-1 mt-1">Complex</div>
                           <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Readability</div>
                         </div>
                      </div>
                    </div>
                    <div className="space-y-4">
                       <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-5 hover:bg-green-500/10 transition-colors cursor-default">
                         <div className="flex items-center gap-3 mb-2">
                           <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center text-green-500 text-xs font-bold">✓</div>
                           <span className="text-sm font-bold text-white">Strong Vocabulary Variety</span>
                         </div>
                         <p className="text-xs text-slate-400 pl-8 leading-relaxed">Your writing shows excellent word choice with 76% unique content words across paragraphs.</p>
                       </div>
                       <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-5 hover:bg-yellow-500/10 transition-colors cursor-default">
                         <div className="flex items-center gap-3 mb-2">
                           <div className="w-5 h-5 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-500 text-xs">⚡</div>
                           <span className="text-sm font-bold text-white">Add Transition Words</span>
                         </div>
                         <p className="text-xs text-slate-400 pl-8 leading-relaxed">Transition words help readers follow your ideas. Consider adding some to improve flow.</p>
                       </div>
                    </div>
                 </div>
              </div>
            </div>

            {/* Step 3: Paraphrase */}
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="order-2 lg:order-1 relative group">
                 <div className="absolute inset-0 bg-blue-500/20 blur-[100px] rounded-full group-hover:bg-blue-500/30 transition-all duration-700"></div>
                 <div className="relative rounded-[24px] border border-white/10 bg-[#0f172a]/90 backdrop-blur-xl p-6 md:p-8 shadow-2xl transform transition-transform duration-500 hover:-translate-y-2">
                    <div className="flex justify-between items-center mb-8">
                       <h3 className="text-2xl font-bold text-white">Paraphrase</h3>
                       <div className="px-4 py-1.5 rounded-lg bg-slate-800 border border-white/10 text-xs text-slate-300 flex items-center gap-2 shadow-inner">
                         <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.6)]"></span>
                         Analytics Active
                       </div>
                    </div>
                    
                    <div className="rounded-xl border border-white/10 bg-slate-900/80 p-3 mb-6 flex gap-2 overflow-x-auto hide-scrollbar shadow-inner">
                       <div className="px-4 py-2 rounded-lg bg-brand-500 text-slate-900 text-sm font-bold whitespace-nowrap shadow-md cursor-pointer">✍️ My Style</div>
                       <div className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-300 text-sm hover:bg-white/10 transition-colors whitespace-nowrap cursor-pointer">👔 Formal</div>
                       <div className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-300 text-sm hover:bg-white/10 transition-colors whitespace-nowrap cursor-pointer">☕ Casual</div>
                       <div className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-300 text-sm hover:bg-white/10 transition-colors whitespace-nowrap cursor-pointer">🎓 Academic</div>
                    </div>

                    <div className="space-y-6">
                      <div>
                        <label className="text-xs font-semibold text-slate-300 ml-1 mb-2 block">Input Text</label>
                        <div className="w-full h-36 rounded-xl bg-black/50 border border-white/5 p-5 relative shadow-inner">
                           <span className="text-slate-500 text-sm">Paste text to paraphrase...</span>
                           <div className="absolute bottom-3 right-3 flex gap-2">
                             <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-400 hover:text-white cursor-pointer transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg></div>
                           </div>
                        </div>
                      </div>
                      <div className="flex gap-4 pt-2">
                        <div className="flex-1 py-3 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-900 font-bold text-center text-sm shadow-[0_0_20px_rgba(56,189,248,0.3)] cursor-pointer transition-all hover:-translate-y-0.5">Paraphrase</div>
                        <div className="px-8 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-sm border border-white/10 text-center font-medium cursor-pointer transition-colors">Reset</div>
                      </div>
                    </div>
                 </div>
              </div>
              <div className="order-1 lg:order-2 lg:pl-16">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-400 font-bold text-xl mb-6 border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.15)]">3</div>
                <h3 className="text-3xl lg:text-4xl font-bold text-slate-100 mb-6">Rewrite with confidence</h3>
                <p className="text-slate-400 text-lg leading-relaxed">
                  Drop any text into the paraphraser and select your style profile. The AI will completely rewrite the text to match your unique voice, maintaining the original meaning while fixing clarity and flow.
                </p>
              </div>
            </div>
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
