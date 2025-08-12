"use client";
import { useState, useEffect } from 'react';
import { loadProfile, saveProfile, type StyleProfile } from '../../../lib/styleProfile.ts';

const initial: StyleProfile = {
  id: 'local',
  createdAt: 0,
  updatedAt: 0,
  tone: 'balanced',
  formality: 0.5,
  pacing: 0.5,
  descriptiveness: 0.5,
  directness: 0.5,
  sampleExcerpt: '',
  customLexicon: [],
  notes: ''
};

export default function StyleOnboardingPage() {
  const [profile, setProfile] = useState<StyleProfile>(initial);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const existing = loadProfile();
    if (existing) setProfile(existing);
  }, []);

  function update<K extends keyof StyleProfile>(key: K, value: StyleProfile[K]) {
    setProfile(p => ({ ...p, [key]: value, updatedAt: Date.now(), createdAt: p.createdAt || Date.now() }));
    setSaved(false);
  }

  function handleSave() {
    saveProfile(profile);
    setSaved(true);
  }

  return (
    <div className="grid gap-10 lg:grid-cols-5">
      <div className="lg:col-span-3 space-y-8">
        <div className="glass-panel p-6 space-y-4">
          <h1 className="text-2xl font-semibold">Create your style profile</h1>
          <p className="text-sm text-slate-300">Adjust sliders & provide a short sample (150+ words) of your own writing. Data stays local in this prototype.</p>
          <div className="grid gap-6">
            <SliderField label="Formality" value={profile.formality} onChange={v => update('formality', v)} helper="Casual ↔ Academic" />
            <SliderField label="Pacing" value={profile.pacing} onChange={v => update('pacing', v)} helper="Measured ↔ Rapid" />
            <SliderField label="Descriptiveness" value={profile.descriptiveness} onChange={v => update('descriptiveness', v)} helper="Minimal ↔ Vivid" />
            <SliderField label="Directness" value={profile.directness} onChange={v => update('directness', v)} helper="Implicit ↔ Straightforward" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Overall tone keyword</label>
            <input value={profile.tone} onChange={e => update('tone', e.target.value)} className="w-full rounded-lg bg-slate-800/60 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">Sample excerpt <span className="text-xs text-slate-400 font-normal">(150-400 words)</span></label>
            <textarea value={profile.sampleExcerpt} onChange={e => update('sampleExcerpt', e.target.value)} rows={8} className="w-full rounded-lg bg-slate-800/60 border border-white/10 px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-brand-500" placeholder="Paste a paragraph or two you wrote..." />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Custom lexicon (comma separated words you often use)</label>
            <input value={profile.customLexicon.join(',')} onChange={e => update('customLexicon', e.target.value.split(',').map(s => s.trim()).filter(Boolean))} className="w-full rounded-lg bg-slate-800/60 border border-white/10 px-3 py-2 text-sm" placeholder="e.g. nuance, scaffold, iterate" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Notes / nuance descriptors</label>
            <textarea value={profile.notes} onChange={e => update('notes', e.target.value)} rows={3} className="w-full rounded-lg bg-slate-800/60 border border-white/10 px-3 py-2 text-sm" placeholder="e.g. Avoid hype; prefer concrete verbs; light humor acceptable." />
          </div>
          <button onClick={handleSave} className="px-5 py-2 rounded-lg bg-brand-500 hover:bg-brand-400 text-slate-900 font-semibold transition disabled:opacity-50" disabled={!profile.sampleExcerpt.trim()}>Save profile</button>
          {saved && <p className="text-xs text-emerald-400">Saved locally ✓</p>}
        </div>
      </div>
      <aside className="lg:col-span-2 flex flex-col gap-6">
        <div className="glass-panel p-5 text-sm space-y-3">
          <h2 className="font-semibold text-brand-300">Why these sliders?</h2>
            <p>They capture surface-level style signals used to steer paraphrasing heuristics. More advanced versions could learn vector embeddings of your samples.</p>
            <p className="text-xs text-slate-400">Privacy: Data is stored in <code>localStorage</code>. Clear it anytime via browser dev tools.</p>
        </div>
        <div className="glass-panel p-5 text-xs text-slate-400 space-y-2">
          <p>Ethics: This tool is not for evading detection or misrepresenting authorship. Always cite original sources and disclose AI assistance.</p>
        </div>
      </aside>
    </div>
  );
}

function SliderField({ label, value, onChange, helper }: { label: string; value: number; onChange: (v: number) => void; helper: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-400">
        <span>{label}</span>
        <span className="font-mono text-slate-500">{Math.round(value * 100)}</span>
      </div>
      <input type="range" min={0} max={1} step={0.01} value={value} onChange={e => onChange(parseFloat(e.target.value))} className="w-full accent-brand-500" />
      <div className="text-[10px] text-slate-500">{helper}</div>
    </div>
  );
}
