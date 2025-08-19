export default function AboutPage() {
  return (
    <div className="py-8">
      <div className="max-w-4xl mx-auto">
        <div className="glass-panel p-8 lg:p-12 space-y-8">
          <div className="space-y-4">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-brand-400 to-brand-300 bg-clip-text text-transparent">About StyleSync</h1>
            <p className="text-lg text-slate-300 leading-relaxed">
              StyleSync is an AI-powered writing tool that helps maintain consistent personal writing style across all your content. 
              Instead of replacing your voice with generic AI text, it learns and enhances your unique writing patterns.
            </p>
          </div>

          <div className="space-y-6">
            <div className="space-y-4">
              <h2 className="text-2xl font-semibold text-brand-300">How It Works</h2>
              <div className="space-y-3 text-slate-300">
                <p>StyleSync analyzes your writing samples to understand your unique patterns:</p>
                <ul className="space-y-2 list-disc list-inside ml-4">
                  <li>Sentence structure and length preferences</li>
                  <li>Vocabulary choices and complexity levels</li>
                  <li>Tone and formality patterns</li>
                  <li>Punctuation and stylistic habits</li>
                </ul>
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-2xl font-semibold text-brand-300">Responsible AI Use</h2>
              <div className="bg-slate-800/50 border border-white/10 rounded-lg p-6 space-y-3">
                <ul className="space-y-2 text-slate-300">
                  <li className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-brand-400 flex-shrink-0 mt-2"></div>
                    <span>Always disclose AI assistance when sharing output</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-brand-400 flex-shrink-0 mt-2"></div>
                    <span>Maintain academic integrity in educational settings</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-brand-400 flex-shrink-0 mt-2"></div>
                    <span>Respect copyright and originality of source materials</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-brand-400 flex-shrink-0 mt-2"></div>
                    <span>Use as a writing enhancement tool, not replacement</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-2xl font-semibold text-brand-300">Technology Stack</h2>
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                  <h3 className="font-medium text-white">Frontend</h3>
                  <ul className="space-y-1 text-slate-400">
                    <li>• Next.js 14 with TypeScript</li>
                    <li>• React with Modern Hooks</li>
                    <li>• Tailwind CSS for Styling</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h3 className="font-medium text-white">AI & Backend</h3>
                  <ul className="space-y-1 text-slate-400">
                    <li>• GROQ API Integration</li>
                    <li>• Advanced Text Analysis</li>
                    <li>• Supabase Authentication</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
