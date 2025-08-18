import Link from 'next/link';

const hasModel = !!process.env.GROQ_API_KEY;

export default function LandingPage() {
  return (
    <div className="relative">
      <section className="grid gap-10 md:grid-cols-2 items-center">
        <div className="space-y-6">
          <h1 className="text-5xl font-bold leading-tight tracking-tight">
            Your voice. <span className="text-brand-400">Consistent</span>. Authentically assisted.
          </h1>
          <p className="text-lg text-slate-300 max-w-prose">
            Stylesync helps you build a reusable profile of your writing tone, pacing & lexical preferences, then applies it to ethically paraphrased drafts. Always disclose AI assistance and respect originality.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link href="/style/onboarding" className="px-6 py-3 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-900 font-semibold shadow-subtle-glow transition">Create your style →</Link>
            <Link href="/paraphrase" className="px-6 py-3 rounded-xl border border-white/15 hover:border-brand-400/60 text-slate-200 hover:text-white transition">Try paraphraser</Link>
          </div>
          <ul className="grid gap-3 text-sm text-slate-400 list-disc pl-5 max-w-md">
            <li>Transparent & responsible use</li>
            <li>Style profiles & paraphrase history synced to your account (with Supabase)</li>
            <li>{hasModel ? 'Optional Groq model paraphrasing (with fallback heuristic)' : 'Heuristic paraphrasing with optional model support if you add a Groq API key'}</li>
          </ul>
        </div>
        <div className="relative">
          <div className="glass-panel p-6 h-full flex flex-col justify-between min-h-[320px]">
            <div>
              <h2 className="font-semibold mb-2 text-brand-300">How it works</h2>
              <ol className="list-decimal pl-5 space-y-2 text-sm text-slate-300">
                <li>Answer a brief style questionnaire + paste sample writing.</li>
                <li>We extract surface style traits (tempo, formality, vividness) locally.</li>
                <li>Paraphrase drafts with gentle rewrites reflecting your profile.</li>
              </ol>
            </div>
            <div className="mt-6 text-xs text-slate-500 space-y-1">
              {!hasModel && (
                <p>Currently running in heuristic mode. Add a Groq API key (GROQ_API_KEY + optional GROQ_MODEL) and set STYLESYNC_API_KEY for authorized model paraphrasing in <code className="text-slate-300">/src/app/api/paraphrase/route.ts</code>.</p>
              )}
              {hasModel && (
                <p>Model paraphrasing enabled (Groq). Unauthorized or disabled requests gracefully fall back to heuristic rewrites.</p>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
