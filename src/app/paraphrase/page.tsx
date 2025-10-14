"use client";
import { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { loadProfile, type StyleProfile, listProfiles, getActiveProfileId, setActiveProfileId, loadProfileRemote, upsertProfileLocal, loadProfilesRemote, syncLocalProfilesToRemote } from '../../lib/styleProfile.ts';
import { paraphraseWithProfile, analyzeSampleStyle } from '../../lib/paraphrase.ts';
import { FullScreenSpinner } from '../../components/FullScreenSpinner';
import { StyleProfileManager } from '../../components/StyleProfileManager';
import { fetchHistory, addHistoryEntry, updateHistoryNote, deleteHistoryEntry, deleteAllHistory, type ParaphraseEntry, isParaphraseHistoryTableMissing, PARAPHRASE_HISTORY_SQL } from '../../lib/paraphraseHistory.ts';
import { supabase } from '../../lib/supabaseClient.ts';
import AITransparencyPanel from '../../components/AITransparencyPanel';
import StyleComparisonPanel from '../../components/StyleComparisonPanel';
import StyleVerification from '../../components/StyleVerification';
import StyleOptionsHelp from '../../components/StyleOptionsHelp';
import AnalyticsConsent from '../../components/AnalyticsConsent';
import { type StyleTransformation } from '../../lib/styleComparison';
import { shouldCollectAnalytics, prepareAnalyticsData, submitAnalytics, calculateVerificationScore, getUserConsent } from '../../lib/analytics';

export default function ParaphrasePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<StyleProfile | null>(null);
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [busy, setBusy] = useState(false);
  const [usedModel, setUsedModel] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actions, setActions] = useState<{ code: string; meta?: any }[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [history, setHistory] = useState<ParaphraseEntry[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [styleTransformation, setStyleTransformation] = useState<StyleTransformation | null>(null);
  const [showStyleAnalysis, setShowStyleAnalysis] = useState(false);
  const [analyzingStyle, setAnalyzingStyle] = useState(false);
  const [verificationScore, setVerificationScore] = useState<number>(0);
  const [userConsent, setUserConsent] = useState<boolean>(false);
  const analyticsSubmittedRef = useRef<boolean>(false); // Use ref instead of state
  const resultsRef = useRef<HTMLDivElement>(null); // Ref for auto-scroll to results
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null); // Track expanded history item

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
      // If active ID is set but not found locally, wait for remote load
      return;
    }
    const legacy = loadProfile();
    if (legacy) setProfile(legacy);
  }, [router]);

  // Mount check for portal rendering
  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  // When userId becomes available, attempt to hydrate a remote style profile if none locally
  useEffect(() => {
    (async () => {
      if (!userId) return;
      const localProfiles = listProfiles();
      if (!profile) {
        try {
          // Load all remote profiles
          const remoteProfiles = await loadProfilesRemote(userId);
          if (remoteProfiles.length) {
            remoteProfiles.forEach(r => upsertProfileLocal(r));
            // choose active if exists, else most recently updated
            const activeId = getActiveProfileId();
            const activeProfile = activeId ? remoteProfiles.find(p => p.id === activeId) : null;
            const profileToSet = activeProfile || [...remoteProfiles].sort((a,b)=>b.updatedAt - a.updatedAt)[0];
            setProfile(profileToSet);
            if (profileToSet && !activeId) {
              setActiveProfileId(profileToSet.id);
            }
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
      // Load user consent for analytics
      if (userId) {
        getUserConsent(userId).then(consent => setUserConsent(consent));
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function handleParaphrase() {
    setBusy(true); setError(null); setUsedModel(false);
    analyticsSubmittedRef.current = false; // Reset analytics submission flag for new paraphrase
    try {
      // Analyze sample style if available
      let enhancedProfile = profile;
      if (profile && profile.sampleExcerpt) {
        const styleAnalysis = analyzeSampleStyle(profile.sampleExcerpt);
        enhancedProfile = { ...profile, styleAnalysis };
      }
      
      // Always use AI model - removed useModel and debug options
      const payload = { text: input, useModel: true, profile: enhancedProfile, debug: false };
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
    } finally { 
      setBusy(false);
      
      // Smooth scroll to results after paraphrase completes
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start'
        });
      }, 100);
    }
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

  async function handleStyleAnalysis() {
    if (!profile?.sampleExcerpt || !input || !output) {
      setError('Need user sample text, original input, and paraphrased output for style analysis');
      return;
    }

    setAnalyzingStyle(true);
    try {
      const response = await fetch('/api/style-comparison', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userSampleText: profile.sampleExcerpt,
          originalText: input,
          paraphrasedText: output
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Style analysis failed');
      }

      const data = await response.json();
      setStyleTransformation(data.transformation);
      setShowStyleAnalysis(true);
    } catch (err: any) {
      setError(err.message || 'Failed to analyze style transformation');
    } finally {
      setAnalyzingStyle(false);
    }
  }

  // Handle verification score update and analytics submission
  const handleVerificationScore = useCallback(async (score: number) => {
    console.log('handleVerificationScore called with score:', score);
    console.log('analyticsSubmittedRef.current:', analyticsSubmittedRef.current);
    
    setVerificationScore(score);
    
    // Guard against duplicate submissions using ref
    if (analyticsSubmittedRef.current) {
      console.log('⏭️ Analytics already submitted for this paraphrase, skipping...');
      return;
    }
    
    // Collect analytics if score is high enough and user is authenticated
    if (userId && profile && shouldCollectAnalytics(score)) {
      console.log('✅ Conditions met, submitting analytics...');
      
      // Mark as submitted immediately to prevent race conditions
      analyticsSubmittedRef.current = true;
      console.log('🔒 Set analyticsSubmittedRef.current = true');
      
      const analyticsData = prepareAnalyticsData(
        userId,
        profile,
        score,
        input.length,
        output.length,
        userConsent
      );
      
      // Submit analytics asynchronously (don't block UI)
      submitAnalytics(analyticsData).then(success => {
        if (success) {
          console.log('✅ Analytics submitted successfully');
        } else {
          console.log('⏭️ Analytics submission failed or was skipped (duplicate profile)');
        }
      }).catch(err => {
        console.error('❌ Error submitting analytics:', err);
      });
    } else {
      console.log('❌ Conditions not met for analytics submission');
      console.log('  userId:', !!userId);
      console.log('  profile:', !!profile);
      console.log('  shouldCollectAnalytics:', shouldCollectAnalytics(score));
    }
  }, [userId, profile, input, output, userConsent]);

  // Helper function for percentage display
  const pct = (v: number) => Math.round(v * 100) + '%';

  return (
    <div className="py-8">
      <div className="min-h-screen">
        {/* History Toggle Button */}
        {history.length > 0 && (
          <button
            onClick={() => setHistoryOpen(!historyOpen)}
            className={`fixed z-50 glass-panel p-3 text-brand-400 hover:text-brand-300 transition-all duration-300 ${
              historyOpen 
                ? 'top-4 right-4 bg-slate-800/80 hover:bg-slate-700/80' // When open, overlay style on sidebar
                : 'top-24 right-6 hover:bg-white/10' // When closed, normal style
            }`}
            title={historyOpen ? "Close History" : "Open History"}
          >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {historyOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            )}
          </svg>
        </button>
      )}

      {/* History Side Navigation */}
      {history.length > 0 && (
        <div className={`fixed top-0 right-0 h-full w-full sm:w-96 md:w-80 bg-slate-900/95 backdrop-blur-xl border-l border-white/10 transform transition-transform duration-300 ease-in-out z-40 ${
          historyOpen ? 'translate-x-0' : 'translate-x-full'
        }`}>
          <div className="p-6 pt-16 h-full flex flex-col">
            {/* Header with extra top padding to avoid close button overlap */}
            <div className="flex items-center justify-between mb-4 pt-2">
              <h2 className="font-semibold text-brand-300 text-lg">History</h2>
              {userId && (
                <button 
                  onClick={handleDeleteAllHistory}
                  className="text-xs px-3 py-1.5 rounded bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 transition-colors"
                  title="Delete all history"
                >
                  Clear All
                </button>
              )}
            </div>
            <p className="text-xs text-slate-500 mb-4">{userId ? 'Synced to account' : 'Local only (sign in to sync)'} · {history.length} entries</p>
            
            <div className="flex-1 overflow-auto pr-2">
              <ul className="space-y-3">
                {history.map(h => {
                  const isExpanded = expandedHistoryId === h.id;
                  return (
                    <li key={h.id} className="border border-white/10 rounded-lg bg-slate-800/40 overflow-hidden">
                      {/* Compact Header - Always Visible */}
                      <div className="p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <button
                            onClick={() => setExpandedHistoryId(isExpanded ? null : h.id)}
                            className="flex-1 text-left flex items-center gap-2 text-xs text-slate-500 hover:text-slate-300 transition-colors"
                          >
                            <svg 
                              className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} 
                              fill="none" 
                              stroke="currentColor" 
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                            <span>
                              {new Date(h.createdAt).toLocaleString()} 
                              {h.usedModel && <span className="ml-1 text-brand-400">●</span>} 
                              {h.pending && <span className="ml-1 text-amber-400">…</span>}
                            </span>
                          </button>
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => { 
                                setInput(h.input); 
                                setOutput(h.output); 
                                setHistoryOpen(false); // Close history when loading
                              }} 
                              className="text-xs px-2 py-1 rounded bg-brand-500/20 hover:bg-brand-500/30 text-brand-400 hover:text-brand-300 transition-colors"
                            >
                              Load
                            </button>
                            {userId && !h.localOnly && !h.pending && (
                              <button 
                                onClick={() => handleDeleteHistoryEntry(h.id)}
                                className="text-xs px-2 py-1 rounded bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 transition-colors"
                                title="Delete this entry"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        </div>
                        
                        {/* Compact Preview - One line each */}
                        {!isExpanded && (
                          <div className="text-xs text-slate-400 space-y-1 pl-6">
                            <div className="truncate">
                              <span className="text-slate-500">In:</span> {h.input}
                            </div>
                            <div className="truncate text-brand-300">
                              <span className="text-slate-500">Out:</span> {h.output}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Expanded Details - Only visible when expanded */}
                      {isExpanded && (
                        <div className="px-3 pb-3 space-y-3 border-t border-white/5">
                          <div className="grid gap-2 mt-3">
                            <div className="text-xs text-slate-400">
                              <div className="font-medium text-slate-300 mb-1">Input:</div>
                              <div className="whitespace-pre-wrap bg-slate-900/40 rounded p-2 max-h-32 overflow-auto">{h.input}</div>
                            </div>
                            <div className="text-xs text-slate-200">
                              <div className="font-medium text-brand-300 mb-1">Output:</div>
                              <div className="whitespace-pre-wrap bg-slate-900/40 rounded p-2 border-l-2 border-brand-500/40 max-h-32 overflow-auto">{h.output}</div>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <textarea
                              placeholder="Add note..."
                              value={h.note}
                              onChange={e => {
                                const v = e.target.value; 
                                setHistory(list => list.map(item => item.id === h.id ? { ...item, note: v } : item));
                              }}
                              onBlur={e => { 
                                if (userId && !h.pending && !h.localOnly) updateHistoryNote(h.id, e.target.value); 
                              }}
                              rows={2}
                              className="w-full bg-slate-900/60 border border-white/10 rounded p-2 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-brand-500 text-slate-200"
                            />
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Overlay */}
      {historyOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30"
          onClick={() => setHistoryOpen(false)}
        />
      )}

    <div className="grid gap-6 lg:gap-12 lg:grid-cols-5">
      <div className="lg:col-span-3 space-y-6 lg:space-y-8">
        <div className="glass-panel p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
          <div className="flex flex-col sm:flex-row items-start justify-between gap-3 sm:gap-4">
            <div className="space-y-2 sm:space-y-3 flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold">Paraphrase</h1>
              <p className="text-sm sm:text-base text-slate-300">Transform text to match your writing style</p>
            </div>
            {/* Analytics Consent Button - Top right corner */}
            {userId && <AnalyticsConsent userId={userId} onConsentChange={setUserConsent} />}
          </div>
          {isParaphraseHistoryTableMissing() && (
            <div className="rounded border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-300 space-y-2">
              <p className="font-semibold">History table not found in Supabase.</p>
              <p>Run the following SQL in your Supabase project (SQL editor) to create it:</p>
              <details className="select-text">
                <summary className="cursor-pointer underline">Show SQL</summary>
                <pre className="mt-2 whitespace-pre-wrap text-[10px] leading-snug max-h-56 overflow-auto">{PARAPHRASE_HISTORY_SQL}</pre>
              </details>
            </div>
          )}
          {!profile && <p className="text-sm text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded p-3">No style profile found. Create one for better alignment.</p>}
          <div className="space-y-4">
            <label className="text-sm font-medium">Input Text</label>
            <textarea 
              value={input} 
              onChange={e => setInput(e.target.value)} 
              placeholder="Paste text to paraphrase..." 
              rows={10} 
              className="w-full rounded-lg bg-slate-800/60 border border-white/10 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 leading-relaxed" 
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-center">
            <button 
              onClick={handleParaphrase} 
              disabled={!input.trim() || busy} 
              className="w-full sm:w-auto px-6 sm:px-8 py-3 rounded-lg bg-brand-500 hover:bg-brand-400 text-slate-900 font-semibold disabled:opacity-40 transition sm:min-w-[160px] text-center"
            >
              {busy ? 'Processing…' : 'Paraphrase'}
            </button>
            <button 
              onClick={() => { setInput(''); setOutput(''); setError(null); setUsedModel(false); }} 
              className="w-full sm:w-auto px-4 sm:px-6 py-3 rounded-lg border border-white/10 hover:border-brand-400/60 text-slate-200 text-sm transition text-center"
            >
              Reset
            </button>
          </div>
        </div>
        {(error || output) && (
          <div ref={resultsRef} className="glass-panel p-4 sm:p-5 space-y-3 scroll-mt-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <h2 className="font-semibold text-brand-300 flex items-center gap-2 text-sm sm:text-base">
                Result 
                {usedModel && <span className="text-[10px] px-2 py-0.5 rounded bg-brand-500/20 text-brand-300 border border-brand-500/30">Model</span>} 
                {!usedModel && output && <span className="text-[10px] px-2 py-0.5 rounded bg-slate-500/20 text-slate-300 border border-white/10">Heuristic</span>}
              </h2>
              {output && (
                <div className="flex gap-2 w-full sm:w-auto">
                  <button 
                    onClick={handleCopyResult}
                    className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      copied 
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                        : 'bg-brand-500/20 hover:bg-brand-500/30 text-brand-400 border border-brand-500/30 hover:border-brand-400/50'
                    }`}
                    title="Copy result to clipboard"
                  >
                    {copied ? '✓ Copied!' : '📋 Copy'}
                  </button>
                  {profile?.sampleExcerpt && input && (
                    <button 
                      onClick={handleStyleAnalysis}
                      disabled={analyzingStyle}
                      className="flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-medium transition-all bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 border border-purple-500/30 hover:border-purple-400/50 disabled:opacity-50 whitespace-nowrap"
                      title="Analyze style transformation"
                    >
                      {analyzingStyle ? '⏳ Analyzing...' : '📊 Analysis'}
                    </button>
                  )}
                </div>
              )}
            </div>
            {error && <p className="text-xs text-amber-400">{error}</p>}
            {output && <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-200">{output}</p>}
            <p className="text-[10px] text-slate-500">Review output carefully. Cite sources and disclose AI assistance.</p>
          </div>
        )}

        {/* Style Verification - Hidden (user doesn't need to see this) */}
        {/* Still calculates score in background for analytics */}
        {output && input && (
          <div style={{ display: 'none' }}>
            <StyleVerification 
              original={input}
              transformed={output}
              profile={profile}
              onScoreCalculated={handleVerificationScore}
            />
          </div>
        )}
      </div>
      
      {/* Style Transformation Analysis Modal */}
      {showStyleAnalysis && styleTransformation && isMounted && createPortal(
        <div 
          className="fixed inset-0 bg-slate-900/95 backdrop-blur-xl z-50 overflow-y-auto"
          onClick={() => setShowStyleAnalysis(false)}
        >
          <div className="min-h-screen flex items-center justify-center p-2 sm:p-4 md:p-6">
            <div 
              className="w-full max-w-[95vw] lg:max-w-6xl my-8"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="glass-panel p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4 sm:mb-6 sticky top-0 bg-slate-900/90 backdrop-blur-sm pb-4 border-b border-white/10 z-10">
                  <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-white">Style Transformation Analysis</h3>
                  <button 
                    onClick={() => setShowStyleAnalysis(false)}
                    className="px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium transition-colors flex-shrink-0"
                  >
                    Close ✕
                  </button>
                </div>
                <StyleComparisonPanel 
                  transformation={styleTransformation} 
                  originalText={input}
                  paraphrasedText={output}
                />
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
      
      <aside className="lg:col-span-2 space-y-4 order-first lg:order-last">
        <div className="glass-panel p-4">
          <h2 className="font-semibold text-brand-300 text-sm sm:text-base mb-2">Current Style Profile</h2>
          {profile ? (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-300">
                <div className="flex justify-between"><span className="text-slate-400">Tone:</span> <span className="text-white font-medium">{profile.tone}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Formality:</span> <span className="text-white font-medium">{pct(profile.formality)}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Pacing:</span> <span className="text-white font-medium">{pct(profile.pacing)}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Descriptiveness:</span> <span className="text-white font-medium">{pct(profile.descriptiveness)}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Directness:</span> <span className="text-white font-medium">{pct(profile.directness)}</span></div>
              </div>
              {profile.customLexicon.length > 0 && (
                <div className="pt-2 border-t border-white/10">
                  <div className="text-[10px] text-slate-400 mb-1">Keywords:</div>
                  <div className="flex flex-wrap gap-1">
                    {profile.customLexicon.map(word => (
                      <span key={word} className="px-1.5 py-0.5 bg-brand-500/20 text-brand-300 rounded text-[10px]">{word}</span>
                    ))}
                  </div>
                </div>
              )}
              {/* {profile.notes && (
                <div className="pt-2 border-t border-white/10">
                  <div className="text-[10px] text-slate-400 mb-1">Notes:</div>
                  <div className="text-xs text-slate-300 line-clamp-2">{profile.notes}</div>
                </div>
              )} */}
            </div>
          ) : <p className="text-xs text-slate-400">No profile loaded.</p>}
        </div>
        <div className="glass-panel p-4"><StyleProfileManager onSelect={p => setProfile(p)} /></div>
      </aside>
        </div>
        {busy && <FullScreenSpinner label="Generating paraphrase" />}
        {!authChecked && <FullScreenSpinner label="Checking authentication" />}
        
        {/* Style Options Help Tool */}
        <StyleOptionsHelp />
      </div>
    </div>
  );
}
