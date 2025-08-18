"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { loadProfile, type StyleProfile, listProfiles, getActiveProfileId, loadProfileRemote, upsertProfileLocal, loadProfilesRemote, syncLocalProfilesToRemote } from '../../lib/styleProfile.ts';
import { paraphraseWithProfile, analyzeSampleStyle } from '../../lib/paraphrase.ts';
import { FullScreenSpinner } from '../../components/FullScreenSpinner';
import { StyleProfileManager } from '../../components/StyleProfileManager';
import { fetchHistory, addHistoryEntry, updateHistoryNote, deleteHistoryEntry, deleteAllHistory, type ParaphraseEntry, isParaphraseHistoryTableMissing, PARAPHRASE_HISTORY_SQL } from '../../lib/paraphraseHistory.ts';
import { supabase } from '../../lib/supabaseClient.ts';

export default function ParaphrasePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<StyleProfile | null>(null);
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [busy, setBusy] = useState(false);
  const [useModel, setUseModel] = useState(true);
  const [usedModel, setUsedModel] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diffTokens, setDiffTokens] = useState<{ value: string; changed: boolean }[]>([]);
  const [diffStats, setDiffStats] = useState<{ changed: number; total: number }>({ changed: 0, total: 0 });
  const [actions, setActions] = useState<{ code: string; meta?: any }[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [debug, setDebug] = useState(false);
  const [history, setHistory] = useState<ParaphraseEntry[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Check authentication first
    (async () => {
      if (supabase) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push('/auth/sign-in');
          return;
        }
        setUserId(user.id);
        setAuthChecked(true);
        
        // Load user's history
        const remote = await fetchHistory();
        setHistory(remote);
      } else {
        // No supabase - redirect to sign in
        router.push('/auth/sign-in');
        return;
      }
    })();
    
    // Prefer active multi-profile if exists, else fallback to legacy single
    const activeId = getActiveProfileId();
    const profiles = listProfiles();
    if (activeId) {
      const found = profiles.find(p => p.id === activeId) || null;
      if (found) { setProfile(found); return; }
    }
    const legacy = loadProfile();
    if (legacy) setProfile(legacy);
  }, [router]);

  // When userId becomes available, attempt to hydrate a remote style profile if none locally
  useEffect(() => {
    (async () => {
      if (!userId) return;
      const localProfiles = listProfiles();
      if (!profile && localProfiles.length === 0) {
        try {
          // Load all remote profiles
          const remoteProfiles = await loadProfilesRemote(userId);
          if (remoteProfiles.length) {
            remoteProfiles.forEach(r => upsertProfileLocal(r));
            // choose most recently updated as active
            const sorted = [...remoteProfiles].sort((a,b)=>b.updatedAt - a.updatedAt);
            setProfile(sorted[0]);
          } else {
            // No remote profiles but maybe we have local (rare), push them
            if (localProfiles.length) await syncLocalProfilesToRemote(userId);
          }
        } catch {/* ignore */}
      }
      // Always ensure history is loaded after a fresh login (in case initial mount happened pre-auth)
      if (history.length === 0) {
        try { const fresh = await fetchHistory(); if (fresh.length) setHistory(fresh); } catch {/* ignore */}
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function handleParaphrase() {
    setBusy(true); setError(null); setUsedModel(false);
    try {
      // Analyze sample style if available
      let enhancedProfile = profile;
      if (profile && profile.sampleExcerpt) {
        const styleAnalysis = analyzeSampleStyle(profile.sampleExcerpt);
        enhancedProfile = { ...profile, styleAnalysis };
      }
      
      const payload = { text: input, useModel, profile: enhancedProfile, debug };
      const res = await fetch('/api/paraphrase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const err = await res.json().catch(()=>({}));
        throw new Error(err.error || 'API error');
      }
      const data = await res.json();
  setOutput(data.result || '');
  setActions(data.actions || []);
  setMetrics(data.metrics || null);
  setUsedModel(!!data.usedModel);
  // Append to history
      if (userId) {
        const optimistic: ParaphraseEntry = { id: crypto.randomUUID(), userId, input, output: data.result || '', note: '', usedModel: !!data.usedModel, createdAt: new Date().toISOString(), pending: true };
        setHistory(h => [optimistic, ...h].slice(0,50));
        // async persist
        addHistoryEntry({ userId, input, output: data.result || '', note: '', usedModel: !!data.usedModel })
          .then(saved => {
            if (saved) setHistory(h => h.map(e => e.id === optimistic.id ? saved : e));
          });
      } else {
        setHistory(h => [{ id: crypto.randomUUID(), input, output: data.result || '', note: '', usedModel: !!data.usedModel, createdAt: new Date().toISOString(), localOnly: true }, ...h].slice(0,50));
      }
    } catch (e: any) {
      // Fallback to local heuristic
      const fallback = paraphraseWithProfile(input, profile || undefined);
      setOutput(fallback);
      setError(e.message || 'Failed to use model, showed heuristic result.');
      if (userId) {
        const optimistic: ParaphraseEntry = { id: crypto.randomUUID(), userId, input, output: fallback, note: '', usedModel: false, createdAt: new Date().toISOString(), pending: true };
        setHistory(h => [optimistic, ...h].slice(0,50));
        addHistoryEntry({ userId, input, output: fallback, note: '', usedModel: false })
          .then(saved => { if (saved) setHistory(h => h.map(e => e.id === optimistic.id ? saved : e)); });
      } else {
        setHistory(h => [{ id: crypto.randomUUID(), input, output: fallback, note: '', usedModel: false, createdAt: new Date().toISOString(), localOnly: true }, ...h].slice(0,50));
      }
    } finally { setBusy(false); }
  }

  async function handleDeleteHistoryEntry(id: string) {
    if (!userId) return; // Only for authenticated users
    // Optimistically remove from UI
    setHistory(h => h.filter(item => item.id !== id));
    // Delete from database
    const success = await deleteHistoryEntry(id);
    if (!success) {
      // If delete failed, reload history to restore the item
      try {
        const fresh = await fetchHistory();
        setHistory(fresh);
      } catch {/* ignore */}
    }
  }

  async function handleDeleteAllHistory() {
    if (!userId || !confirm('Are you sure you want to delete all history? This cannot be undone.')) return;
    // Optimistically clear UI
    setHistory([]);
    // Delete from database
    const success = await deleteAllHistory();
    if (!success) {
      // If delete failed, reload history to restore
      try {
        const fresh = await fetchHistory();
        setHistory(fresh);
      } catch {/* ignore */}
    }
  }

  async function handleCopyResult() {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      // Reset feedback after 2 seconds
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = output;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  useEffect(() => {
    if (!output || !input) { setDiffTokens([]); setDiffStats({ changed: 0, total: 0 }); return; }
    const diff = wordDiff(input, output);
    setDiffTokens(diff.tokens);
    setDiffStats({ changed: diff.changed, total: diff.total });
  }, [output, input]);

  return (
  <div className="grid gap-10 lg:grid-cols-5">
      <div className="lg:col-span-3 space-y-6">
        <div className="glass-panel p-5 space-y-4">
          <h1 className="text-2xl font-semibold">Paraphrase</h1>
          {isParaphraseHistoryTableMissing() && (
            <div className="rounded border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300 space-y-2">
              <p className="font-semibold">History table not found in Supabase.</p>
              <p>Run the following SQL in your Supabase project (SQL editor) to create it:</p>
              <details className="select-text">
                <summary className="cursor-pointer underline">Show SQL</summary>
                <pre className="mt-2 whitespace-pre-wrap text-[10px] leading-snug max-h-56 overflow-auto">{PARAPHRASE_HISTORY_SQL}</pre>
              </details>
            </div>
          )}
          {!profile && <p className="text-xs text-amber-400">No style profile found. Create one for better alignment.</p>}
          <textarea value={input} onChange={e => setInput(e.target.value)} placeholder="Paste text to paraphrase..." rows={10} className="w-full rounded-lg bg-slate-800/60 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          <div className="flex flex-wrap gap-4 items-center">
            <button onClick={handleParaphrase} disabled={!input.trim() || busy} className="px-5 py-2 rounded-lg bg-brand-500 hover:bg-brand-400 text-slate-900 font-semibold disabled:opacity-40 transition min-w-[140px]">{busy ? 'Processing…' : 'Paraphrase'}</button>
            <button onClick={() => { setInput(''); setOutput(''); setError(null); setUsedModel(false); }} className="px-5 py-2 rounded-lg border border-white/10 hover:border-brand-400/60 text-slate-200 text-sm">Reset</button>
            <label className="flex items-center gap-2 text-xs text-slate-300 select-none">
              <input type="checkbox" className="accent-brand-500" checked={useModel} onChange={e=>setUseModel(e.target.checked)} />
              Use model (Groq)
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-500 select-none">
              <input type="checkbox" className="accent-brand-500" checked={debug} onChange={e=>setDebug(e.target.checked)} />
              Debug
            </label>
          </div>
        </div>
        {(error || output) && (
          <div className="glass-panel p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-brand-300 flex items-center gap-2">
                Result 
                {usedModel && <span className="text-[10px] px-2 py-0.5 rounded bg-brand-500/20 text-brand-300 border border-brand-500/30">Model</span>} 
                {!usedModel && output && <span className="text-[10px] px-2 py-0.5 rounded bg-slate-500/20 text-slate-300 border border-white/10">Heuristic</span>}
              </h2>
              {output && (
                <button 
                  onClick={handleCopyResult}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    copied 
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                      : 'bg-brand-500/20 hover:bg-brand-500/30 text-brand-400 border border-brand-500/30 hover:border-brand-400/50'
                  }`}
                  title="Copy result to clipboard"
                >
                  {copied ? '✓ Copied!' : '📋 Copy'}
                </button>
              )}
            </div>
            {error && <p className="text-xs text-amber-400">{error}</p>}
            {output && <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-200">{output}</p>}
            {actions.length > 0 && debug && (
              <div className="mt-4 border-t border-white/5 pt-3 space-y-2">
                <div className="text-[10px] uppercase tracking-wide text-slate-500">Style Rule Actions</div>
                <ul className="flex flex-wrap gap-1 text-[10px]">
                  {actions.map((a,i)=>(
                    <li key={i} className="px-2 py-0.5 rounded bg-slate-700/50 border border-white/10 text-slate-300" title={a.meta?JSON.stringify(a.meta):''}>{a.code}</li>
                  ))}
                </ul>
              </div>
            )}
            {metrics && debug && (
              <div className="mt-4 border-t border-white/5 pt-3 grid gap-1 text-[10px] text-slate-500">
                <div>Sentences: {metrics.sentenceCount}</div>
                <div>Avg sentence length: {metrics.avgLength?.toFixed?.(1)}</div>
                <div>Std dev: {metrics.stdDev?.toFixed?.(1)}</div>
                <div>Unique token ratio: {metrics.uniqueTokenRatio?.toFixed?.(2)}</div>
                <div>AI phrase hits: {metrics.aiPhraseHits}</div>
                <div>Repeated starts ratio: {metrics.repeatedStartsRatio?.toFixed?.(2)}</div>
              </div>
            )}
            <p className="text-[10px] text-slate-500">Review carefully; ensure meaning fidelity & cite sources. Disclose assistance.</p>
            {diffTokens.length > 0 && (
              <div className="mt-4 space-y-2">
                <div className="text-[10px] text-slate-500">Changed words: {diffStats.changed}/{diffStats.total} ({diffStats.total ? Math.round(diffStats.changed / diffStats.total * 100) : 0}%)</div>
                <div className="text-xs leading-relaxed flex flex-wrap gap-1">
                  {diffTokens.map((t, i) => (
                    <span key={i} className={t.changed ? 'bg-brand-500/25 text-brand-200 rounded px-1 py-0.5' : ''}>{t.value}</span>
                  ))}
                </div>
                <div className="text-[10px] text-slate-600">Highlighted = altered or new tokens (simple lexical diff).</div>
              </div>
            )}
          </div>
        )}
      </div>
      <aside className="lg:col-span-2 space-y-6">
        <div className="glass-panel p-5"><StyleProfileManager onSelect={p => setProfile(p)} /></div>
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
        {history.length > 0 && (
          <div className="glass-panel p-5 space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-brand-300 text-sm">History</h2>
              {userId && (
                <button 
                  onClick={handleDeleteAllHistory}
                  className="text-[10px] px-2 py-1 rounded bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 transition-colors"
                  title="Delete all history"
                >
                  Clear All
                </button>
              )}
            </div>
            <p className="text-[10px] text-slate-500">{userId ? 'Synced to account' : 'Local only (sign in to sync)'} · Showing {history.length}</p>
            <ul className="space-y-3 max-h-80 overflow-auto pr-1">
              {history.map(h => (
                <li key={h.id} className="border border-white/10 rounded-lg p-3 bg-slate-800/40 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] text-slate-500">{new Date(h.createdAt).toLocaleTimeString()} {h.usedModel && <span className="ml-1 text-brand-400">●</span>} {h.pending && <span className="ml-1 text-amber-400">…</span>}</span>
                    <div className="flex items-center gap-2">
                      <button onClick={() => { setInput(h.input); setOutput(h.output); }} className="text-[10px] underline text-brand-400 hover:text-brand-300 transition-colors">Load</button>
                      {userId && !h.localOnly && !h.pending && (
                        <button 
                          onClick={() => handleDeleteHistoryEntry(h.id)}
                          className="text-[10px] px-1 py-0.5 rounded bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 transition-colors"
                          title="Delete this entry"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="grid gap-1">
                    <div className="line-clamp-3 whitespace-pre-wrap text-slate-400">{h.input}</div>
                    <div className="line-clamp-3 whitespace-pre-wrap text-slate-200 border-l border-brand-500/40 pl-2">{h.output}</div>
                  </div>
                  <div className="space-y-1">
                    <textarea
                      placeholder="Add note..."
                      value={h.note}
                      onChange={e => {
                        const v = e.target.value; setHistory(list => list.map(item => item.id === h.id ? { ...item, note: v } : item));
                      }}
                      onBlur={e => { if (userId && !h.pending && !h.localOnly) updateHistoryNote(h.id, e.target.value); }}
                      rows={2}
                      className="w-full bg-slate-900/40 border border-white/10 rounded p-2 text-[11px] resize-none focus:outline-none focus:ring-1 focus:ring-brand-500"
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="glass-panel p-5 text-xs text-slate-400 space-y-2">
          <p>Prototype uses heuristic lexical & sentence-level rewrites. Swap in a secure API for production. Never misrepresent authorship.</p>
        </div>
      </aside>
  {busy && <FullScreenSpinner label="Generating paraphrase" />}
  {!authChecked && <FullScreenSpinner label="Checking authentication" />}
  </div>
  );
}

function pct(v: number) { return Math.round(v * 100) + '%'; }

// Simple word-level diff (not Levenshtein; token presence comparison)
function wordDiff(a: string, b: string) {
  const aTokens = a.split(/(\s+)/); // keep whitespace separators
  const bTokens = b.split(/(\s+)/);
  const aWords = new Set(a.toLowerCase().split(/\s+/).filter(Boolean));
  const tokens = bTokens.map(tok => {
    if (/^\s+$/.test(tok)) return { value: tok, changed: false };
    const changed = !aWords.has(tok.toLowerCase());
    return { value: tok, changed };
  });
  const total = tokens.filter(t => !/^\s+$/.test(t.value)).length;
  const changed = tokens.filter(t => t.changed).length;
  return { tokens, total, changed };
}
