"use client";
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  listProfiles,
  upsertProfileLocal,
  deleteProfileLocal,
  getActiveProfileId,
  setActiveProfileId,
  type StyleProfile,
  saveProfileRemote,
  loadProfilesRemote,
  syncLocalProfilesToRemote
} from '../lib/styleProfile.ts';
import { supabase } from '../lib/supabaseClient.ts';

function newBlankProfile(): StyleProfile {
  const now = Date.now();
  return {
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
}

export interface StyleProfileManagerProps {
  onSelect?: (p: StyleProfile | null) => void;
}

export function StyleProfileManager({ onSelect }: StyleProfileManagerProps) {
  const [profiles, setProfiles] = useState<StyleProfile[]>([]);
  const [activeId, setActive] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [topStyles, setTopStyles] = useState<any[]>([]);
  const [loadingTopStyles, setLoadingTopStyles] = useState(false);

  useEffect(() => { refresh(); }, []);
  
  // Check authentication
  useEffect(() => {
    (async () => {
      if (supabase) {
        const { data: { user } } = await supabase.auth.getUser();
        setIsAuthenticated(!!user);
      }
    })();
  }, []);
  
  // Load top-performing styles from all users
  useEffect(() => {
    (async () => {
      setLoadingTopStyles(true);
      try {
        const response = await fetch('/api/analytics/suggestions?limit=5');
        if (response.ok) {
          const data = await response.json();
          setTopStyles(data.suggestions || []);
        }
      } catch (error) {
        console.error('Failed to load top styles:', error);
      } finally {
        setLoadingTopStyles(false);
      }
    })();
  }, []);
  
  // Remote hydration / sync
  useEffect(() => {
    (async () => {
      if (!supabase) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const remote = await loadProfilesRemote(user.id);
      const local = listProfiles();
      if (remote.length && local.length === 0) {
        remote.forEach(r => upsertProfileLocal(r));
        refresh();
      } else if (local.length && !remote.length) {
        await syncLocalProfilesToRemote(user.id); // push local to remote first time
      } else if (remote.length) {
        // Merge by id, remote wins on newer updatedAt
        const merged: Record<string, StyleProfile> = {};
        [...local, ...remote].forEach(p => {
          const existing = merged[p.id];
            if (!existing || p.updatedAt > existing.updatedAt) merged[p.id] = p;
        });
        const mergedList = Object.values(merged).sort((a,b)=>b.updatedAt - a.updatedAt);
        // Persist merged locally
        mergedList.forEach(m => upsertProfileLocal(m));
        refresh();
      }
    })();
  }, []);

  function refresh() {
    const list = listProfiles();
    let active = getActiveProfileId();
    // If active is not in the list, set to the first profile
    if (active && !list.find(p => p.id === active)) {
      active = list.length > 0 ? list[0].id : null;
      if (active) setActiveProfileId(active);
    }
    setProfiles(list);
    setActive(active);
    if (onSelect) {
      const found = list.find(p => p.id === active) || null;
      onSelect(found);
    }
  }

  const router = useRouter();
  function createProfile() {
    router.push('/style/onboarding?new=1');
  }

  function setActiveProfile(id: string) {
    setActiveProfileId(id);
    refresh();
  }

  function rename(id: string, name: string) {
    const list = [...profiles];
    const idx = list.findIndex(p => p.id === id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], name, updatedAt: Date.now() };
      upsertProfileLocal(list[idx]);
      setProfiles(list);
      queueAutoSync(list[idx]);
    }
  }

  async function remove(id: string) {
    // Delete locally first for snappy UI
    deleteProfileLocal(id);
    refresh();
    // Try remote delete so it doesn't rehydrate next session
    try {
      if (supabase) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from('style_profiles').delete().eq('id', id).eq('user_id', user.id);
        }
      }
    } catch (e) {
      console.warn('Remote delete failed (style profile)', e);
    }
  }

  // --- Auto sync logic (debounced) ---
  const syncTimer = useRef<any>(null);
  function queueAutoSync(profile: StyleProfile) {
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(async () => {
      try {
        if (!supabase) return;
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        await saveProfileRemote({ ...profile, userId: user.id });
      } catch (e) { console.warn('Auto sync failed', e); }
    }, 500);
  }
  
  // Function to apply a top style to the current profile
  function applyTopStyle(suggestion: any) {
    const newProfile: StyleProfile = {
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      name: `Top Style (${suggestion.verificationScore}% match)`,
      tone: suggestion.styleOptions.tone,
      formality: suggestion.styleOptions.formality,
      pacing: suggestion.styleOptions.pacing,
      descriptiveness: suggestion.styleOptions.descriptiveness,
      directness: suggestion.styleOptions.directness,
      customLexicon: suggestion.styleOptions.customLexicon || [],
      sampleExcerpt: suggestion.sampleExcerpt || '',
      notes: `Imported from top-performing styles. Average score: ${suggestion.averageScore}%`
    };
    
    upsertProfileLocal(newProfile);
    setActiveProfileId(newProfile.id);
    refresh();
    queueAutoSync(newProfile);
  }

  return (
    <div className="space-y-3 text-xs">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-brand-300 text-sm">Saved Styles</h3>
        <button 
          onClick={isAuthenticated ? createProfile : () => window.location.href = "/auth/sign-in"}
          disabled={!isAuthenticated}
          className={`px-2 py-1 rounded text-[11px] transition-colors ${
            isAuthenticated 
              ? 'bg-brand-500/20 hover:bg-brand-500/30 text-brand-200' 
              : 'bg-slate-600/30 text-slate-400 cursor-not-allowed'
          }`}
          title={!isAuthenticated ? "Please sign in to create styles" : "Create new style profile"}
        >
          New
        </button>
      </div>
      {profiles.length === 0 && <p className="text-slate-500">No styles yet.</p>}
      <ul className={`space-y-1 ${profiles.length > 4 ? 'max-h-80 overflow-y-auto pr-2' : ''}`}>
        {profiles.map(p => {
          const active = p.id === activeId;
          const isEditing = p.id === editingId;
          return (
            <li key={p.id} className={`group border border-white/5 rounded p-2 bg-slate-800/40 flex flex-col gap-1 ${active ? 'ring-1 ring-brand-500/50' : ''}`}>
              <div className="flex items-center gap-2">
                <button onClick={() => setActiveProfile(p.id)} className={`w-2.5 h-2.5 rounded-full border ${active ? 'bg-brand-500 border-brand-400' : 'border-slate-500 group-hover:border-brand-400'} shrink-0`} aria-label="Activate" />
                {isEditing ? (
                  <input autoFocus value={p.name || ''} onChange={e => rename(p.id, e.target.value)} onBlur={() => setEditingId(null)} className="bg-slate-900/60 border border-white/10 rounded px-2 py-1 text-[11px] w-32" />
                ) : (
                  <span className="font-medium text-slate-200 cursor-text" onDoubleClick={() => setEditingId(p.id)}>{p.name || 'Unnamed'}</span>
                )}
                <div className="ml-auto flex gap-1 opacity-70 group-hover:opacity-100 transition">
                  <button onClick={() => setEditingId(p.id)} className="px-1 py-0.5 rounded bg-slate-700/40 hover:bg-slate-600/50" title="Rename">✎</button>
                  <button onClick={() => remove(p.id)} className="px-1 py-0.5 rounded bg-slate-700/40 hover:bg-red-600/40" title="Delete">✕</button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-[10px] text-slate-400">
                <span>F{Math.round(p.formality*100)}</span>
                <span>P{Math.round(p.pacing*100)}</span>
                <span>Dsc{Math.round(p.descriptiveness*100)}</span>
                <span>Dir{Math.round(p.directness*100)}</span>
                {p.customLexicon.length > 0 && <span>Lex:{p.customLexicon.length}</span>}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-[10px] text-slate-500">Double‑click a name to rename. Activate to use during paraphrasing.</p>
      
      {/* Top Performing Styles Section */}
      <div className="mt-6 pt-4 border-t border-white/10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-brand-300 text-sm">Top Performing Styles</h3>
            <span className="px-2 py-0.5 rounded text-[9px] bg-purple-500/20 text-purple-300 border border-purple-500/30">
              PREMIUM
            </span>
          </div>
        </div>
        
        <div className="p-3 rounded-lg bg-gradient-to-r from-purple-500/10 to-brand-500/10 border border-purple-500/20 mb-3">
          <p className="text-[10px] text-slate-300 leading-relaxed">
            🎯 <strong>Premium Feature Preview:</strong> See styles with the highest success rates from our community. 
            Try them now for free - premium launching soon!
          </p>
        </div>
        
        {loadingTopStyles ? (
          <div className="text-center py-4 text-slate-500 text-xs">Loading top styles...</div>
        ) : topStyles.length === 0 ? (
          <div className="text-center py-4 text-slate-500 text-xs">
            No top styles available yet. Be the first to contribute by using StyleSync with high verification scores!
          </div>
        ) : (
          <div className="space-y-2">
            {/* Show only the first (top) style */}
            <ul className="space-y-2">
              {topStyles.slice(0, 1).map((suggestion, index) => (
                <li 
                  key={suggestion.id} 
                  className="group border border-purple-500/20 rounded-lg p-3 bg-gradient-to-br from-slate-800/60 to-slate-900/60 hover:border-purple-500/40 transition-all"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-white">
                          #{index + 1} Top Style
                        </span>
                        <div className="flex items-center gap-1">
                          <div className="w-12 bg-slate-700 rounded-full h-1.5">
                            <div 
                              className="h-1.5 rounded-full bg-gradient-to-r from-brand-500 to-purple-500"
                              style={{ width: `${suggestion.verificationScore}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-bold text-brand-300">
                            {suggestion.verificationScore}%
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5 text-[9px] text-slate-400 mb-2">
                        <span className="px-1.5 py-0.5 rounded bg-slate-700/40">Tone: {suggestion.styleOptions.tone}</span>
                        <span className="px-1.5 py-0.5 rounded bg-slate-700/40">F{Math.round(suggestion.styleOptions.formality*100)}</span>
                        <span className="px-1.5 py-0.5 rounded bg-slate-700/40">P{Math.round(suggestion.styleOptions.pacing*100)}</span>
                        <span className="px-1.5 py-0.5 rounded bg-slate-700/40">Dsc{Math.round(suggestion.styleOptions.descriptiveness*100)}</span>
                        <span className="px-1.5 py-0.5 rounded bg-slate-700/40">Dir{Math.round(suggestion.styleOptions.directness*100)}</span>
                      </div>
                      <div className="text-[9px] text-slate-500">
                        Used successfully {suggestion.usageCount}x · Avg score: {suggestion.averageScore}%
                      </div>
                    </div>
                    <button
                      onClick={() => applyTopStyle(suggestion)}
                      disabled={!isAuthenticated}
                      className={`px-3 py-1.5 rounded text-[10px] font-medium transition-all ${
                        isAuthenticated
                          ? 'bg-gradient-to-r from-brand-500 to-purple-500 hover:from-brand-400 hover:to-purple-400 text-white shadow-lg hover:shadow-brand-500/50'
                          : 'bg-slate-600/30 text-slate-500 cursor-not-allowed'
                      }`}
                      title={!isAuthenticated ? "Sign in to use this style" : "Add this style to your saved styles"}
                    >
                      Use Style
                    </button>
                  </div>
                  {suggestion.sampleExcerpt && (
                    <details className="mt-2">
                      <summary className="text-[9px] text-brand-400 cursor-pointer hover:text-brand-300">
                        View sample excerpt →
                      </summary>
                      <div className="mt-2 p-2 rounded bg-slate-900/60 text-[9px] text-slate-300 leading-relaxed border-l-2 border-brand-500/40">
                        {suggestion.sampleExcerpt.substring(0, 200)}
                        {suggestion.sampleExcerpt.length > 200 && '...'}
                      </div>
                    </details>
                  )}
                </li>
              ))}
            </ul>
            
            {/* Locked Premium Styles */}
            {topStyles.length > 1 && (
              <div className="relative rounded-lg border border-purple-500/30 overflow-hidden bg-slate-800/40 min-h-[255px] flex items-center justify-center">
                {/* Premium Lock Overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-slate-900/95 via-purple-900/30 to-slate-900/95 z-10 flex items-center justify-center">
                  <div className="text-center space-y-4 p-6 max-w-xs">
                    <div className="text-4xl">🔒</div>
                    <div>
                      <div className="text-base font-bold text-white mb-2">
                        {topStyles.length - 1} More Top Style{topStyles.length - 1 > 1 ? 's' : ''} Available
                      </div>
                      <div className="text-xs text-slate-300 leading-relaxed">
                        Unlock premium to access all top-performing styles from our community
                      </div>
                    </div>
                    <button
                      className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-brand-600 hover:from-purple-500 hover:to-brand-500 text-white font-semibold text-sm transition-all shadow-lg hover:shadow-xl hover:scale-105"
                      onClick={() => {
                        // Placeholder for future subscription functionality
                        alert('Premium subscriptions coming soon! 🚀');
                      }}
                    >
                      Subscribe to Premium
                    </button>
                    <div className="text-[10px] text-slate-400">
                      Get access to all top styles, priority support, and more
                    </div>
                  </div>
                </div>
                
                {/* Subtle background pattern */}
                <div className="absolute inset-0 opacity-5">
                  <div className="grid grid-cols-3 gap-2 p-3">
                    {[...Array(6)].map((_, i) => (
                      <div key={i} className="h-16 rounded bg-purple-500/20 border border-purple-500/30" />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
