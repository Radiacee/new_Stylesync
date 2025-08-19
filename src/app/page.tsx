import Link from 'next/link';

const hasModel = !!process.env.GROQ_API_KEY;

export default function LandingPage() {
  return (
    <div className="relative">
      <section className="grid gap-10 md:grid-cols-2 items-center">
        <div className="space-y-6">
          <h1 className="text-5xl font-bold leading-tight tracking-tight">
            Your voice. <span className="text-brand-400">Consistent</span>. AI-enhanced.
          </h1>
          <p className="text-lg text-slate-300 max-w-prose">
            Transform any text to match your unique writing style with AI-powered analysis.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link href="/style/onboarding" className="px-6 py-3 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-900 font-semibold shadow-subtle-glow transition">Create Style Profile</Link>
            <Link href="/paraphrase" className="px-6 py-3 rounded-xl border border-white/15 hover:border-brand-400/60 text-slate-200 hover:text-white transition">Start Paraphrasing</Link>
          </div>
          <ul className="grid gap-3 text-sm text-slate-400 list-disc pl-5 max-w-md">
            <li>Maintain your authentic writing voice</li>
            <li>Consistent style across all content</li>
            <li>AI-powered text transformation</li>
          </ul>
        </div>
        <div className="relative">
          <div className="glass-panel p-6 h-full flex flex-col justify-between min-h-[320px]">
            <div>
              <h2 className="font-semibold mb-2 text-brand-300">How it works</h2>
              <ol className="list-decimal pl-5 space-y-2 text-sm text-slate-300">
                <li>Create your style profile with sample writing</li>
                <li>AI analyzes your tone, formality, and patterns</li>
                <li>Transform any text to match your style</li>
              </ol>
            </div>
            <div className="mt-6 text-xs text-slate-500 space-y-1">
              <p>Powered by advanced AI models for intelligent style analysis and text transformation.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
