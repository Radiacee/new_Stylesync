"use client";
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { loadProfile, saveProfile, type StyleProfile, loadProfileRemote, saveProfileRemote, styleProfilesTableExists, upsertProfileLocal, setActiveProfileId, listProfiles } from '../../../lib/styleProfile.ts';
import { analyzeSampleStyle, type SampleStyle } from '../../../lib/paraphrase.ts';
import { supabase } from '../../../lib/supabaseClient.ts';
import { FullScreenSpinner } from '../../../components/FullScreenSpinner';

const initial: StyleProfile = {
  id: 'local',
  createdAt: 0,
  updatedAt: 0,
  name: 'Default Style',
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
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-400">Loading…</div>}>
      <OnboardingInner />
    </Suspense>
  );
}

function OnboardingInner() {
  const search = useSearchParams();
  const router = useRouter();
  const [profile, setProfile] = useState<StyleProfile>(initial);
  const [saved, setSaved] = useState(false);
  const [remoteStatus, setRemoteStatus] = useState<'idle'|'saving'|'ok'|'error'|'missing'>('idle');
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [remoteTableMissing, setRemoteTableMissing] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<SampleStyle | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);

  useEffect(() => {
    // Check authentication first
    (async () => {
      if (supabase) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push('/auth/sign-in');
          return;
        }
      } else {
        // No supabase - redirect to sign in
        router.push('/auth/sign-in');
        return;
      }
      setAuthChecked(true);
    })();

    const isNew = search.get('new') === '1';
    if (isNew) {
      // Fresh blank profile with new UUID - don't load any existing data
      const now = Date.now();
      const blank: StyleProfile = {
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
        name: 'New Style',
        tone: 'balanced',
        formality: 0.5,
        pacing: 0.5,
        descriptiveness: 0.5,
        directness: 0.5,
        sampleExcerpt: '',
        customLexicon: [],
        notes: ''
      };
      setProfile(blank);
    } else {
      // Only load existing profiles when not creating new
      const local = loadProfile();
      if (local) setProfile(local);
      (async () => {
        if (supabase) {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const exists = await styleProfilesTableExists();
            if (!exists) { setRemoteTableMissing(true); setRemoteStatus('missing'); return; }
            const remote = await loadProfileRemote(user.id);
            if (remote) setProfile(remote);
          }
        }
      })();
    }
  }, [search, router]);

  function update<K extends keyof StyleProfile>(key: K, value: StyleProfile[K]) {
    setProfile(p => ({ ...p, [key]: value, updatedAt: Date.now(), createdAt: p.createdAt || Date.now() }));
    setSaved(false);
  }

  function clearCustomLexicon() {
    setProfile(p => ({ ...p, customLexicon: [], updatedAt: Date.now() }));
    setSaved(false);
  }

  function handleAnalyze() {
    if (!profile.sampleExcerpt.trim()) {
      alert('Please enter some sample text to analyze.');
      return;
    }
    
    const analysis = analyzeSampleStyle(profile.sampleExcerpt);
    setAnalysisResult(analysis);
    setShowAnalysis(true);
  }

  function handleApplyAnalysis() {
    if (!analysisResult) return;
    
    // Apply insights from analysis to the profile
    const updates: Partial<StyleProfile> = {};
    
    // ALWAYS start with empty customLexicon to ensure clean slate
    updates.customLexicon = [];
    
    // Set formality based on contractions usage
    if (analysisResult.usesContractions) {
      updates.formality = Math.max(0.1, Math.min(0.4, profile.formality * 0.7)); // More casual
    } else {
      updates.formality = Math.min(0.9, Math.max(0.6, profile.formality * 1.3)); // More formal  
    }
    
    // Set descriptiveness based on adjective density
    if (analysisResult.adjectiveDensity > 0.15) {
      updates.descriptiveness = Math.min(0.9, Math.max(0.6, analysisResult.adjectiveDensity * 4)); // More descriptive
    } else if (analysisResult.adjectiveDensity < 0.05) {
      updates.descriptiveness = Math.max(0.1, analysisResult.adjectiveDensity * 6); // Less descriptive
    } else {
      updates.descriptiveness = Math.min(0.8, Math.max(0.2, analysisResult.adjectiveDensity * 5)); // Balanced
    }
    
    // Set pacing based on sentence length
    if (analysisResult.avgSentenceLength > 20) {
      updates.pacing = Math.max(0.1, Math.min(0.4, 0.8 - (analysisResult.avgSentenceLength - 20) * 0.02)); // Slower pacing for longer sentences
    } else if (analysisResult.avgSentenceLength < 12) {
      updates.pacing = Math.min(0.9, Math.max(0.6, 0.3 + (12 - analysisResult.avgSentenceLength) * 0.05)); // Faster pacing for shorter sentences
    } else {
      updates.pacing = 0.5; // Balanced for average length
    }
    
    // Set directness based on question ratio and personal voice
    if (analysisResult.questionRatio > 0.1 || analysisResult.personalVoice === 'second-person') {
      updates.directness = Math.min(0.9, Math.max(0.6, 0.7 + analysisResult.questionRatio * 2)); // More direct
    } else if (analysisResult.personalVoice === 'third-person') {
      updates.directness = Math.max(0.1, Math.min(0.5, 0.4 - analysisResult.questionRatio)); // Less direct
    } else {
      updates.directness = 0.5; // Balanced
    }
    
    // Update tone based on analysis - be more specific
    if (analysisResult.toneBalance === 'positive') {
      updates.tone = 'encouraging';
    } else if (analysisResult.toneBalance === 'negative') {
      updates.tone = 'critical';
    } else {
      updates.tone = 'balanced'; // Default for neutral
    }
    
    // Add preferred adverbs and transitions to custom lexicon but start fresh
    const newLexicon: string[] = [];
    
    // Add top adverbs if they're not too common
    if (analysisResult.topAdverbs && analysisResult.topAdverbs.length > 0) {
      const commonAdverbs = ['really', 'very', 'quite', 'pretty', 'fairly', 'just', 'only', 'even', 'still', 'already'];
      const uniqueAdverbs = analysisResult.topAdverbs
        .filter(adv => !commonAdverbs.includes(adv.toLowerCase()))
        .slice(0, 3); // Limit to top 3
      newLexicon.push(...uniqueAdverbs);
    }
    
    // Add preferred transitions if they exist
    if (analysisResult.preferredTransitions && analysisResult.preferredTransitions.length > 0) {
      const transitions = analysisResult.preferredTransitions.slice(0, 2); // Limit to top 2
      newLexicon.push(...transitions);
    }
    
    // Set the new lexicon (limit total to 8 items for manageability)
    updates.customLexicon = newLexicon.slice(0, 8);
    
    // Apply all updates at once
    setProfile(p => ({ 
      ...p, 
      ...updates, 
      styleAnalysis: analysisResult, // Store the analysis for future reference
      updatedAt: Date.now() 
    }));
    
    setSaved(false);
    setShowAnalysis(false);
    
    // Show success message with details
    setTimeout(() => {
      const changesApplied = [];
      if (updates.tone) changesApplied.push(`Tone: ${updates.tone}`);
      if (updates.formality !== undefined) changesApplied.push(`Formality: ${Math.round(updates.formality * 100)}%`);
      if (updates.descriptiveness !== undefined) changesApplied.push(`Descriptiveness: ${Math.round(updates.descriptiveness * 100)}%`);
      if (updates.pacing !== undefined) changesApplied.push(`Pacing: ${Math.round(updates.pacing * 100)}%`);
      if (updates.directness !== undefined) changesApplied.push(`Directness: ${Math.round(updates.directness * 100)}%`);
      if (updates.customLexicon && updates.customLexicon.length > 0) changesApplied.push(`Keywords: ${updates.customLexicon.join(', ')}`);
      
      alert(`Analysis applied! Profile updated with:\n\n${changesApplied.join('\n')}`);
    }, 100);
  }

  async function handleSave() {
    setBusy(true); setSaved(false); setRemoteError(null);
    try {
      // For new profiles, ensure we have a unique ID that doesn't conflict with existing ones
      let profileToSave = profile;
      const isNew = search.get('new') === '1';
      if (isNew) {
        const existingProfiles = listProfiles();
        // Make sure we have a truly unique ID
        let newId = profileToSave.id;
        while (existingProfiles.some((p: StyleProfile) => p.id === newId)) {
          newId = crypto.randomUUID();
        }
        profileToSave = { ...profile, id: newId };
      }
      
      // Ensure profile has a stable UUID (migrate legacy 'local')
      const withId: StyleProfile = profileToSave.id === 'local' ? { ...profileToSave, id: crypto.randomUUID() } : profileToSave;
      // Ensure name is properly set - use the current profile's name from the form
      const withName: StyleProfile = { ...withId, name: profile.name };
      
      saveProfile(withName); // legacy single-slot
      // Also add/update in multi-profile list
      upsertProfileLocal(withName);
      setActiveProfileId(withName.id);
      if (supabase) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          try {
            setRemoteStatus('saving');
            const newId = await saveProfileRemote({ ...withName, userId: user.id, id: withName.id });
            if (newId && newId !== withName.id) {
              const updatedProfile = { ...withName, id: newId };
              setProfile(p => updatedProfile);
              upsertProfileLocal(updatedProfile);
              setActiveProfileId(newId);
            } else {
              setProfile(withName);
            }
            setRemoteStatus('ok');
            setSaved(true);
            // Redirect to paraphrase page after successful save
            setTimeout(() => router.push('/paraphrase'), 1000);
            return; // success path
          } catch (e: any) {
            console.error(e);
            setRemoteStatus(remoteTableMissing ? 'missing' : 'error');
            setRemoteError(e?.message || 'Remote save failed');
          }
        }
      }
      setSaved(true);
      // Redirect to paraphrase page after successful local save
      setTimeout(() => router.push('/paraphrase'), 1000);
    } finally { setBusy(false); }
  }

  return (
    <div className="grid gap-10 lg:grid-cols-5">
      <div className="lg:col-span-3 space-y-8">
        <div className="glass-panel p-6 space-y-4">
          <h1 className="text-2xl font-semibold">Create Style Profile</h1>
          <p className="text-sm text-slate-300">Define your writing style with sample text and preferences.</p>
          {remoteTableMissing && (
            <div className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded p-2">
              Remote table <code>style_profiles</code> not found. Run the provided SQL in your Supabase project then refresh this page.
            </div>
          )}
          <div className="grid gap-6">
            <SliderField label="Formality" value={profile.formality} onChange={v => update('formality', v)} helper="Casual ↔ Academic" />
            <SliderField label="Pacing" value={profile.pacing} onChange={v => update('pacing', v)} helper="Measured ↔ Rapid" />
            <SliderField label="Descriptiveness" value={profile.descriptiveness} onChange={v => update('descriptiveness', v)} helper="Minimal ↔ Vivid" />
            <SliderField label="Directness" value={profile.directness} onChange={v => update('directness', v)} helper="Implicit ↔ Straightforward" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Profile name</label>
            <input value={profile.name || ''} onChange={e => update('name', e.target.value)} className="w-full rounded-lg bg-slate-800/60 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" placeholder="e.g. Academic Concise" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Overall tone keyword</label>
            <input value={profile.tone} onChange={e => update('tone', e.target.value)} className="w-full rounded-lg bg-slate-800/60 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium flex items-center gap-2">
                Sample excerpt 
                <span className="text-xs text-slate-400 font-normal">(150-400 words)</span>
              </label>
              <button 
                onClick={handleAnalyze}
                disabled={!profile.sampleExcerpt.trim()}
                className="px-3 py-1 text-xs rounded-md bg-blue-600 hover:bg-blue-500 text-white font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Analyze
              </button>
            </div>
            <textarea 
              value={profile.sampleExcerpt} 
              onChange={e => update('sampleExcerpt', e.target.value)} 
              rows={8} 
              className="w-full rounded-lg bg-slate-800/60 border border-white/10 px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-brand-500" 
              placeholder="Paste a paragraph or two you wrote..." 
            />
            
            {/* Analysis Results Modal */}
            {showAnalysis && analysisResult && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-slate-900 rounded-xl border border-white/10 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-white">Writing Style Analysis</h3>
                      <button 
                        onClick={() => setShowAnalysis(false)}
                        className="text-slate-400 hover:text-white transition"
                      >
                        ✕
                      </button>
                    </div>
                    
                    <div className="space-y-4 text-sm">
                      {/* Sentence Structure */}
                      <div className="bg-slate-800/50 rounded-lg p-4">
                        <h4 className="font-medium text-white mb-2">Sentence Structure</h4>
                        <div className="space-y-1 text-slate-300">
                          <p>• Average sentence length: <span className="text-white font-medium">{Math.round(analysisResult.avgSentenceLength)} words</span></p>
                          <p>• Length variation: <span className="text-white font-medium">±{Math.round(analysisResult.sentenceLengthStd)} words</span></p>
                          <p>• Average clauses per sentence: <span className="text-white font-medium">{analysisResult.avgClausesPerSentence?.toFixed(1) || 'N/A'}</span></p>
                          <p>• Uses contractions: <span className="text-white font-medium">{analysisResult.usesContractions ? 'Yes' : 'No'}</span></p>
                          {analysisResult.questionRatio > 0 && (
                            <p>• Questions: <span className="text-white font-medium">{(analysisResult.questionRatio * 100).toFixed(1)}%</span> of sentences</p>
                          )}
                          {analysisResult.exclamatoryRatio > 0 && (
                            <p>• Exclamations: <span className="text-white font-medium">{(analysisResult.exclamatoryRatio * 100).toFixed(1)}%</span> of sentences</p>
                          )}
                        </div>
                      </div>
                      
                      {/* Construction Patterns */}
                      {analysisResult.constructionPatterns && (
                        <div className="bg-slate-800/50 rounded-lg p-4">
                          <h4 className="font-medium text-white mb-2">Sentence Construction</h4>
                          <div className="space-y-1 text-slate-300">
                            {analysisResult.constructionPatterns.subordinateClauseRatio > 0.2 && (
                              <p>• Subordinate clauses: <span className="text-white font-medium">{(analysisResult.constructionPatterns.subordinateClauseRatio * 100).toFixed(0)}%</span> (because, although, when)</p>
                            )}
                            {analysisResult.constructionPatterns.coordinateClauseRatio > 0.2 && (
                              <p>• Coordinate clauses: <span className="text-white font-medium">{(analysisResult.constructionPatterns.coordinateClauseRatio * 100).toFixed(0)}%</span> (and, but, or)</p>
                            )}
                            {analysisResult.constructionPatterns.parentheticalRatio > 0.1 && (
                              <p>• Parenthetical elements: <span className="text-white font-medium">{(analysisResult.constructionPatterns.parentheticalRatio * 100).toFixed(0)}%</span> of sentences</p>
                            )}
                            {analysisResult.constructionPatterns.frontLoadedDependentRatio > 0.1 && (
                              <p>• Front-loaded dependent clauses: <span className="text-white font-medium">{(analysisResult.constructionPatterns.frontLoadedDependentRatio * 100).toFixed(0)}%</span></p>
                            )}
                            {analysisResult.parallelStructureRatio > 0.05 && (
                              <p>• Parallel structures: <span className="text-white font-medium">{(analysisResult.parallelStructureRatio * 100).toFixed(0)}%</span> (X, Y, and Z patterns)</p>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* Voice & Tone */}
                      <div className="bg-slate-800/50 rounded-lg p-4">
                        <h4 className="font-medium text-white mb-2">Voice & Tone</h4>
                        <div className="space-y-1 text-slate-300">
                          <p>• Personal voice: <span className="text-white font-medium">{analysisResult.personalVoice}</span> perspective</p>
                          <p>• Tone balance: <span className="text-white font-medium">{analysisResult.toneBalance}</span></p>
                          <p>• Vocabulary complexity: <span className="text-white font-medium">{(analysisResult.vocabularyComplexity * 100).toFixed(1)}%</span> complex words</p>
                          <p>• Average word length: <span className="text-white font-medium">{analysisResult.avgWordLength.toFixed(1)} characters</span></p>
                        </div>
                      </div>
                      
                      {/* Writing Patterns */}
                      <div className="bg-slate-800/50 rounded-lg p-4">
                        <h4 className="font-medium text-white mb-2">Writing Patterns</h4>
                        <div className="space-y-1 text-slate-300">
                          <p>• Descriptive language: <span className="text-white font-medium">{(analysisResult.adjectiveDensity * 100).toFixed(1)}%</span> of words</p>
                          <p>• Conjunction density: <span className="text-white font-medium">{analysisResult.conjunctionDensity.toFixed(1)} per sentence</span></p>
                          {analysisResult.preferredTransitions.length > 0 && (
                            <p>• Preferred transitions: <span className="text-white font-medium">{analysisResult.preferredTransitions.join(', ')}</span></p>
                          )}
                          {analysisResult.topAdverbs.length > 0 && (
                            <p>• Common adverbs: <span className="text-white font-medium">{analysisResult.topAdverbs.join(', ')}</span></p>
                          )}
                          {analysisResult.commonStarters.length > 0 && (
                            <p>• Common sentence starters: <span className="text-white font-medium">{analysisResult.commonStarters.join(', ')}</span></p>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex gap-3 mt-6">
                      <button 
                        onClick={handleApplyAnalysis}
                        className="flex-1 px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-400 text-slate-900 font-semibold transition"
                      >
                        Apply to Profile
                      </button>
                      <button 
                        onClick={() => setShowAnalysis(false)}
                        className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium transition"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Keywords (optional)</label>
              {profile.customLexicon.length > 0 && (
                <button 
                  onClick={clearCustomLexicon}
                  className="text-xs text-slate-400 hover:text-white transition px-2 py-1 rounded bg-slate-700 hover:bg-slate-600"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <input 
                value={profile.customLexicon.join(',')} 
                onChange={e => update('customLexicon', e.target.value.split(',').map(s => s.trim()).filter(Boolean))} 
                className="flex-1 rounded-lg bg-slate-800/60 border border-white/10 px-3 py-2 text-sm" 
                placeholder="e.g. innovative, strategic, efficient" 
              />
            </div>
            <p className="text-xs text-slate-400">Use "Analyze" to extract keywords from your sample text</p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Notes (optional)</label>
            <textarea value={profile.notes} onChange={e => update('notes', e.target.value)} rows={3} className="w-full rounded-lg bg-slate-800/60 border border-white/10 px-3 py-2 text-sm" placeholder="e.g. Professional tone, avoid jargon" />
          </div>
          <button onClick={handleSave} className="px-5 py-2 rounded-lg bg-brand-500 hover:bg-brand-400 text-slate-900 font-semibold transition disabled:opacity-50" disabled={!profile.sampleExcerpt.trim() || busy}>{busy ? 'Saving…' : 'Create Profile'}</button>
          <div className="space-y-1">
            {saved && (
              <p className="text-xs text-emerald-400 flex items-center gap-2">
                <span>Saved locally ✓</span>
                {supabase && remoteStatus === 'ok' && <span className="text-emerald-300">Remote ✓</span>}
                {supabase && remoteStatus === 'saving' && <span className="text-slate-400">Syncing…</span>}
                {supabase && remoteStatus === 'missing' && <span className="text-amber-400">Remote table missing</span>}
                {supabase && remoteStatus === 'error' && <span className="text-amber-400">Remote failed</span>}
              </p>
            )}
            {remoteError && (
              <p className="text-[10px] text-amber-400">{remoteError}</p>
            )}
            {remoteStatus === 'missing' && (
              <details className="text-[10px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded p-2">
                <summary className="cursor-pointer mb-1">Create style_profiles table (SQL)</summary>
                <pre className="whitespace-pre-wrap leading-snug">
create table if not exists public.style_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text,
  tone text not null,
  formality real not null,
  pacing real not null,
  descriptiveness real not null,
  directness real not null,
  sample_excerpt text,
  custom_lexicon text[] default '{}',
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.style_profiles enable row level security;
create policy if not exists "Allow user select own" on public.style_profiles for select using (auth.uid() = user_id);
create policy if not exists "Allow user insert own" on public.style_profiles for insert with check (auth.uid() = user_id);
create policy if not exists "Allow user update own" on public.style_profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy if not exists "Allow user delete own" on public.style_profiles for delete using (auth.uid() = user_id);
                </pre>
              </details>
            )}
          </div>
        </div>
      </div>
      <aside className="lg:col-span-2 flex flex-col gap-6">
        <div className="glass-panel p-5 text-sm space-y-3">
          <h2 className="font-semibold text-brand-300">Style Parameters</h2>
            <p>These settings help define your unique writing style for consistent text transformation.</p>
        </div>
        <div className="glass-panel p-5 text-xs text-slate-400 space-y-2">
          <p>Remember to always cite sources and disclose AI assistance when appropriate.</p>
        </div>
      </aside>
  {busy && <FullScreenSpinner label="Saving style profile" />}
  {!authChecked && <FullScreenSpinner label="Checking authentication" />}
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
