"use client";
import { useEffect, useState } from 'react';
import { loadProfile, type StyleProfile } from '../../lib/styleProfile.ts';
import { paraphraseWithProfile } from '../../lib/paraphrase.ts';

export default function ParaphrasePage() {
  const [profile, setProfile] = useState<StyleProfile | null>(null);
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { setProfile(loadProfile()); }, []);

  async function handleParaphrase() {
    setBusy(true);
    try {
      // In a real app, call your backend / LLM here.
      const result = paraphraseWithProfile(input, profile || undefined);
      setOutput(result);
    } finally { setBusy(false); }
  }

  return (
    <div className="grid gap-10 lg:grid-cols-5">
      <div className="lg:col-span-3 space-y-6">
        <div className="glass-panel p-5 space-y-4">
          <h1 className="text-2xl font-semibold">Paraphrase</h1>
          {!profile && <p className="text-xs text-amber-400">No style profile found. Create one for better alignment.</p>}
          <textarea value={input} onChange={e => setInput(e.target.value)} placeholder="Paste text to paraphrase..." rows={10} className="w-full rounded-lg bg-slate-800/60 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          <div className="flex gap-3">
            <button onClick={handleParaphrase} disabled={!input.trim() || busy} className="px-5 py-2 rounded-lg bg-brand-500 hover:bg-brand-400 text-slate-900 font-semibold disabled:opacity-40 transition">{busy ? 'Processing…' : 'Paraphrase'}</button>
            <button onClick={() => { setInput(''); setOutput(''); }} className="px-5 py-2 rounded-lg border border-white/10 hover:border-brand-400/60 text-slate-200 text-sm">Reset</button>
          </div>
        </div>
        {output && (
          <div className="glass-panel p-5 space-y-3">
            <h2 className="font-semibold text-brand-300">Result</h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-200">{output}</p>
            <p className="text-[10px] text-slate-500">Review carefully; ensure meaning fidelity & cite sources. Disclose assistance.</p>
          </div>
        )}
      </div>
      <aside className="lg:col-span-2 space-y-6">
        <div className="glass-panel p-5 text-sm space-y-2">
          <h2 className="font-semibold text-brand-300">Current Style Snapshot</h2>
          {profile ? (
            <ul className="text-xs grid gap-1 text-slate-300">
              <li><strong>Tone:</strong> {profile.tone}</li>
              <li><strong>Formality:</strong> {pct(profile.formality)}</li>
              <li><strong>Pacing:</strong> {pct(profile.pacing)}</li>
              <li><strong>Descriptiveness:</strong> {pct(profile.descriptiveness)}</li>
              <li><strong>Directness:</strong> {pct(profile.directness)}</li>
              {profile.customLexicon.length > 0 && <li><strong>Lexicon:</strong> {profile.customLexicon.join(', ')}</li>}
              {profile.notes && <li><strong>Notes:</strong> {profile.notes}</li>}
            </ul>
          ) : <p className="text-xs text-slate-400">No profile loaded.</p>}
        </div>
        <div className="glass-panel p-5 text-xs text-slate-400 space-y-2">
          <p>Prototype uses heuristic lexical & sentence-level rewrites. Swap in a secure API for production. Never misrepresent authorship.</p>
        </div>
      </aside>
    </div>
  );
}

function pct(v: number) { return Math.round(v * 100) + '%'; }
