import re

# We will reconstruct page.tsx
# First, the correct top part with our edits

top_part = """\
"use client";
import { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Copy, Check, AlertTriangle, Star, X, Trash2 } from 'lucide-react';
import { loadProfile, type StyleProfile, listProfiles, getActiveProfileId, setActiveProfileId, loadProfileRemote, upsertProfileLocal, loadProfilesRemote, syncLocalProfilesToRemote } from '../../lib/styleProfile.ts';
import { paraphraseWithProfile, analyzeSampleStyle } from '../../lib/paraphrase.ts';
import { FullScreenSpinner } from '../../components/FullScreenSpinner';
import { StyleProfileManager } from '../../components/StyleProfileManager';
import { fetchHistory, addHistoryEntry, updateHistoryNote, deleteHistoryEntry, deleteAllHistory, type ParaphraseEntry, isParaphraseHistoryTableMissing, PARAPHRASE_HISTORY_SQL } from '../../lib/paraphraseHistory.ts';
import { supabase } from '../../lib/supabaseClient.ts';
import StyleComparisonPanel from '../../components/StyleComparisonPanel';
import StyleVerification from '../../components/StyleVerification';
import StyleOptionsHelp from '../../components/StyleOptionsHelp';
import AnalyticsConsent from '../../components/AnalyticsConsent';
import StyleProofPanel from '../../components/StyleProofPanel';
import StyleSelector, { type StylePreset, getStyleInstructions } from '../../components/StyleSelector';
import WritingSuggestionsPanel from '../../components/WritingSuggestionsPanel';
import QualitySuggestions from '../../components/QualitySuggestions';
import ReportButton from '../../components/ReportButton';
import ABTestingPanel from '../../components/ABTestingPanel';
import { type StyleTransformation } from '../../lib/styleComparison';
import { shouldCollectAnalytics, prepareAnalyticsData, submitAnalytics, getUserConsent } from '../../lib/analytics';
import { moderateContent, type ModerationResult } from '../../lib/contentModeration';

function combineProfileSamples(profile: StyleProfile | null): string {
  if (!profile) return '';
  if (profile.sampleExcerpts?.length) {
    return profile.sampleExcerpts.map(s => s.trim()).filter(Boolean).join('\\n\\n');
  }
  return profile.sampleExcerpt?.trim() || '';
}

function ensureProfileHasAnalysis(profile: StyleProfile): StyleProfile {
  const combinedSample = combineProfileSamples(profile);
  if (!combinedSample) return profile;
  const needsSampleSync = profile.sampleExcerpt !== combinedSample;
  // Re-analyze if missing, out of sync, or incomplete (missing new computed fields)
  const isIncomplete = profile.styleAnalysis && (
    profile.styleAnalysis.avgWordLength === undefined ||
    profile.styleAnalysis.vocabularyComplexity === undefined ||
    profile.styleAnalysis.topAdverbs === undefined
  );
  const needsAnalysis = !profile.styleAnalysis || needsSampleSync || isIncomplete;
  if (!needsSampleSync && !needsAnalysis) return profile;
  const styleAnalysis = analyzeSampleStyle(combinedSample);
  return {
    ...profile,
    sampleExcerpt: combinedSample,
    sampleExcerpts: profile.sampleExcerpts?.length ? profile.sampleExcerpts : [combinedSample],
    styleAnalysis
  };
}

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
  const [verification, setVerification] = useState<{ score: number; passed: boolean; issues: { type: string; severity: string; description: string }[] } | null>(null);
  const [userConsent, setUserConsent] = useState<boolean>(false);
  const analyticsSubmittedRef = useRef<boolean>(false); // Use ref instead of state
  const resultsRef = useRef<HTMLDivElement>(null); // Ref for auto-scroll to results
  const suggestionsRef = useRef<HTMLDivElement>(null); // Ref for auto-scroll to suggestions
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null); // Track expanded history item
  const [selectedStyle, setSelectedStyle] = useState<StylePreset>('original'); // Style selection
  const [paraphraseMode, setParaphraseMode] = useState<'style' | 'robotics'>('style'); // System mode toggle
  const [moderationResult, setModerationResult] = useState<ModerationResult | null>(null); // Content moderation
  const [showSuggestions, setShowSuggestions] = useState(false); // Writing suggestions toggle
  const [styleMatch, setStyleMatch] = useState<{ overallMatch: number; issues: string[] } | null>(null); // Style match report
  const [rating, setRating] = useState<number | null>(null); // User rating feedback
  const [additionalExcerpts, setAdditionalExcerpts] = useState<string[]>([]); // Multiple excerpts for style training
  const [excerptInput, setExcerptInput] = useState(''); // Current excerpt being added

  const hasUserEssay = input.trim().length > 0;
  const hasStyleDiagnostics = Boolean(metrics) || actions.length > 0;

  const styleMetricData = metrics ? [
    { label: 'Sentences', value: metrics.sentenceCount ?? '—' },
    { label: 'Avg sentence length', value: metrics.avgSentenceLength ? `${Math.max(1, Math.round(metrics.avgSentenceLength / 6))} words` : '—' },
    { label: 'Unique vocab', value: typeof metrics.uniqueTokenRatio === 'number' ? `${Math.round(metrics.uniqueTokenRatio * 100)}%` : '—' },
    { label: 'Lexicon hits', value: metrics.customLexiconPresent ?? 0 },
  ] : [];

  const describeAction = (action: { code: string; meta?: any }) => {
    switch (action.code) {
      case 'removeOpener':
        return 'Removed AI-sounding preface';
      case 'replaceEmDash':
        return 'Split em dash sentences to match your pacing';
      case 'replaceSemicolon':
        return 'Converted semicolons into shorter sentences';
      case 'stripBullets':
        return 'Flattened bullet formatting into prose';
      case 'removeBanned':
        return action.meta ? `Softened "${action.meta}" so it reads naturally` : 'Softened robotic filler phrase';
      case 'splitLongSentence':
        return action.meta?.length ? `Split a ${action.meta.length}-word sentence to mirror your rhythm` : 'Split an overly long sentence';
      case 'collapsePeriods':
        return 'Cleaned extra punctuation';
      case 'applyContractions':
        return `Applied contractions for ${action.meta || 'casual'} tone`;
      case 'expandContractions':
        return `Expanded contractions for ${action.meta || 'formal'} tone`;
      case 'matchSentenceLength':
        return action.meta?.target ? `Matched sentence length (~${action.meta.target} words)` : 'Matched your sentence rhythm';
      case 'addTransitions':
        return action.meta ? `Used transitions like "${action.meta}"` : 'Added transition words';
      default:
        return `Applied style rule: ${action.code}`;
    }
  };

  // Ensure loaded profile always includes full analysis + merged samples
  useEffect(() => {
    if (!profile) return;
    const prepared = ensureProfileHasAnalysis(profile);
    if (prepared !== profile) {
      setProfile(prepared);
    }
  }, [profile]);

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
    setModerationResult(null); // Reset moderation
    setStyleMatch(null); // Reset style match
    setVerification(null); // Reset verification
    analyticsSubmittedRef.current = false; // Reset analytics submission flag for new paraphrase
    
    // Content moderation check
    const moderation = moderateContent(input);
    setModerationResult(moderation);
    if (!moderation.isClean) {
      const issues = moderation.flaggedWords.map(w => w.word).slice(0, 3).join(', ');
      setError(`Content contains inappropriate words (${issues}). Please revise your input.`);
      setBusy(false);
      return;
    }
    
    let preparedProfile = profile ? ensureProfileHasAnalysis(profile) : null;
    
    // Enhance profile with additional excerpts if provided
    if (preparedProfile && additionalExcerpts.length > 0) {
      const allExcerpts = [
        ...(preparedProfile.sampleExcerpts || [preparedProfile.sampleExcerpt]),
        ...additionalExcerpts
      ].filter(Boolean);
      const combinedExcerpt = allExcerpts.join('\\n\\n');
      preparedProfile = {
        ...preparedProfile,
        sampleExcerpt: combinedExcerpt,
        sampleExcerpts: allExcerpts,
        styleAnalysis: analyzeSampleStyle(combinedExcerpt)
      };
    }
    
    if (preparedProfile && preparedProfile !== profile) {
      setProfile(preparedProfile);
    }
    try {
      // Get style instructions based on selected style
      const styleInstructions = selectedStyle !== 'original' ? getStyleInstructions(selectedStyle) : null;
      
      // Always use AI model - removed useModel and debug options
      const payload = { 
        text: input, 
        useModel: true, 
        profile: preparedProfile, 
        debug: false,
        stylePreset: selectedStyle,
        styleInstructions,
        paraphraseMode
      };
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
      setStyleMatch(data.styleMatch || null);
      setVerification(data.verification || null);
  
      // Automatically run style analysis after getting output
      if (preparedProfile?.sampleExcerpt && input && data.result) {
        setTimeout(() => {
          runStyleAnalysisInBackground(input, data.result || '', preparedProfile);
        }, 500);
      }
  
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
      const fallback = paraphraseWithProfile(input, preparedProfile || undefined);
      setOutput(fallback);
      setError(e.message || 'Failed to use model, showed heuristic result.');
      setActions([]);
      setMetrics(null);
      setStyleTransformation(null);
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
    // Close the history panel since there's nothing to show
    setHistoryOpen(false);
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

  // Run style analysis in background automatically
  async function runStyleAnalysisInBackground(inputText: string, outputText: string, userProfile: StyleProfile) {
    if (!userProfile?.sampleExcerpt) return;
    
    try {
      const response = await fetch('/api/style-comparison', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userSampleText: userProfile.sampleExcerpt,
          originalText: inputText,
          paraphrasedText: outputText
        })
      });

      if (response.ok) {
        const data = await response.json();
        setStyleTransformation(data.transformation);
      }
    } catch (err) {
      // Silently fail - user can manually trigger analysis if needed
      console.error('Background style analysis failed:', err);
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
                                <Trash2 className="w-3.5 h-3.5" />
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
            {/* Analytics Consent - Top right */}
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
          
          {/* System Mode Toggle */}
          <div className="flex items-center gap-4 bg-slate-800/50 p-1.5 rounded-lg border border-white/10 inline-flex">
            <button
              onClick={() => setParaphraseMode('style')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                paraphraseMode === 'style'
                  ? 'bg-brand-500 text-slate-900 shadow-lg'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <span className="text-lg">✍️</span> StyleSync
            </button>
            <button
              onClick={() => setParaphraseMode('robotics')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                paraphraseMode === 'robotics'
                  ? 'bg-blue-500 text-white shadow-lg'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <span className="text-lg">🤖</span> Robotics
            </button>
          </div>

          {paraphraseMode === 'style' && !profile && <p className="text-sm text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded p-3">No style profile found. Create one for better alignment.</p>}
          
          {/* Style Selection - only in style mode */}
          {paraphraseMode === 'style' && (
            <StyleSelector 
              selectedStyle={selectedStyle}
              onStyleChange={setSelectedStyle}
              disabled={busy}
            />
          )}
          
          <div className="space-y-4">
            <label className="text-sm font-medium">Input Text</label>
            <textarea 
              value={input} 
              onChange={e => setInput(e.target.value)} 
              placeholder={paraphraseMode === 'robotics' ? "Paste robotics text or code to paraphrase and explain..." : "Paste text to paraphrase..."} 
              rows={10} 
              className="w-full rounded-lg bg-slate-800/60 border border-white/10 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 leading-relaxed" 
            />
          </div>

          {/* Multiple Excerpts for Better Style Recognition - only in style mode */}
          {paraphraseMode === 'style' && (
            <div className="space-y-3 rounded-lg border border-white/10 bg-slate-800/30 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">Additional Style Samples</h3>
                  <p className="text-xs text-slate-400 mt-1">Add more of your writing for better style recognition and model training (optional)</p>
                </div>
              </div>
              
              {additionalExcerpts.length > 0 && (
                <div className="space-y-2">
                  {additionalExcerpts.map((excerpt, idx) => (
                    <div key={idx} className="flex gap-2 items-start bg-slate-900/40 rounded p-2">
                      <div className="flex-1 text-xs text-slate-300 line-clamp-2">{excerpt}</div>
                      <button
                        onClick={() => setAdditionalExcerpts(excerpts => excerpts.filter((_, i) => i !== idx))}
                        className="flex-shrink-0 px-2 py-1 text-xs bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <textarea
                value={excerptInput}
                onChange={e => setExcerptInput(e.target.value)}
                placeholder="Paste another writing sample..."
                rows={4}
                className="w-full rounded-lg bg-slate-900/60 border border-white/10 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500 leading-relaxed text-slate-200"
              />
              
              <button
                onClick={() => {
                  if (excerptInput.trim()) {
                    setAdditionalExcerpts(prev => [...prev, excerptInput.trim()]);
                    setExcerptInput('');
                  }
                }}
                disabled={!excerptInput.trim()}
                className="w-full px-3 py-2 rounded-lg text-xs font-medium bg-brand-500/20 hover:bg-brand-500/30 text-brand-300 border border-brand-500/30 disabled:opacity-40 transition-colors"
              >
                + Add Excerpt ({additionalExcerpts.length} added)
              </button>
            </div>
          )}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-center">
            <button 
              onClick={handleParaphrase} 
              disabled={!input.trim() || busy} 
"""

import os

broken_path = r'c:\Users\MSI\Documents\GitHub\new_Stylesync\src\app\paraphrase\page.tsx'

with open(broken_path, 'r', encoding='utf-8') as f:
    broken_content = f.read()

# We need to extract lines 74 to end from broken_content
# Line 74 starts with: '              className="w-full sm:w-auto px-6 sm:px-8 py-3 rounded-lg bg-brand-500'
lines = broken_content.splitlines()

# find index
start_idx = -1
for i, line in enumerate(lines):
    if 'className="w-full sm:w-auto px-6 sm:px-8 py-3 rounded-lg bg-brand-500 hover:bg-brand-400' in line:
        start_idx = i
        break

if start_idx != -1:
    bottom_part = '\\n'.join(lines[start_idx:])
    
    with open(broken_path, 'w', encoding='utf-8') as f:
        f.write(top_part + bottom_part + '\\n')
    print("File successfully restored!")
else:
    print("Could not find the hook line.")

