import Link from 'next/link';

const hasModel = !!process.env.GROQ_API_KEY;

export default function LandingPage() {
  return (
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
            <Link href="/style/onboarding" className="px-8 py-4 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-900 font-semibold shadow-subtle-glow transition text-center">Create Style Profile</Link>
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
    </div>
  );
}
