"use client";
import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
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
  const [showTopStyles, setShowTopStyles] = useState(false); // Collapsible state for Top Performing Styles
  const [currentPage, setCurrentPage] = useState(1);
  const profilesPerPage = 3;
  const [editingProfile, setEditingProfile] = useState<StyleProfile | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [profileToDelete, setProfileToDelete] = useState<StyleProfile | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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

  function requestDeleteProfile(profile: StyleProfile) {
    setProfileToDelete(profile);
    setShowDeleteConfirm(true);
  }

  function confirmDelete() {
    if (profileToDelete) {
      remove(profileToDelete.id);
      setShowDeleteConfirm(false);
      setProfileToDelete(null);
    }
  }

  function cancelDelete() {
    setShowDeleteConfirm(false);
    setProfileToDelete(null);
  }

  function openEditModal(profile: StyleProfile) {
    setEditingProfile({ ...profile });
    setShowEditModal(true);
  }

  function updateEditingProfile<K extends keyof StyleProfile>(key: K, value: StyleProfile[K]) {
    if (editingProfile) {
      setEditingProfile({ ...editingProfile, [key]: value, updatedAt: Date.now() });
    }
  }

  function saveEditedProfile() {
    if (!editingProfile) return;
    
    upsertProfileLocal(editingProfile);
    refresh();
    queueAutoSync(editingProfile);
    setShowEditModal(false);
    setEditingProfile(null);
  }

  function cancelEdit() {
    setShowEditModal(false);
    setEditingProfile(null);
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
  
  // Helper function to check if a top style already exists in saved profiles
  function isStyleAlreadySaved(suggestion: any): boolean {
    return profiles.some(p => 
      p.tone === suggestion.styleOptions.tone &&
      Math.abs(p.formality - suggestion.styleOptions.formality) < 0.01 &&
      Math.abs(p.pacing - suggestion.styleOptions.pacing) < 0.01 &&
      Math.abs(p.descriptiveness - suggestion.styleOptions.descriptiveness) < 0.01 &&
      Math.abs(p.directness - suggestion.styleOptions.directness) < 0.01
    );
  }
  
  // Function to apply a top style to the current profile
  function applyTopStyle(suggestion: any) {
    // Check if this style already exists in saved profiles
    const existingProfile = profiles.find(p => 
      p.tone === suggestion.styleOptions.tone &&
      Math.abs(p.formality - suggestion.styleOptions.formality) < 0.01 &&
      Math.abs(p.pacing - suggestion.styleOptions.pacing) < 0.01 &&
      Math.abs(p.descriptiveness - suggestion.styleOptions.descriptiveness) < 0.01 &&
      Math.abs(p.directness - suggestion.styleOptions.directness) < 0.01
    );
    
    if (existingProfile) {
      // Style already exists - just activate it instead of creating a duplicate
      setActiveProfileId(existingProfile.id);
      refresh();
      alert(`This style already exists as "${existingProfile.name}". It has been activated for you.`);
      return;
    }
    
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
      
      {profiles.length > 0 && (
        <>
          <ul className="space-y-1">
            {profiles
              .slice((currentPage - 1) * profilesPerPage, currentPage * profilesPerPage)
              .map(p => {
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
                        <button onClick={() => openEditModal(p)} className="px-1 py-0.5 rounded bg-slate-700/40 hover:bg-blue-600/40" title="Edit Profile">⚙</button>
                        <button onClick={() => setEditingId(p.id)} className="px-1 py-0.5 rounded bg-slate-700/40 hover:bg-slate-600/50" title="Rename">✎</button>
                        <button onClick={() => requestDeleteProfile(p)} className="px-1 py-0.5 rounded bg-slate-700/40 hover:bg-red-600/40" title="Delete">✕</button>
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
          
          {/* Pagination Controls */}
          {profiles.length > profilesPerPage && (
            <div className="flex items-center justify-between pt-2 border-t border-white/5">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 rounded text-[11px] bg-slate-700/40 hover:bg-slate-600/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                ← Prev
              </button>
              
              <span className="text-[10px] text-slate-400">
                Page {currentPage} of {Math.ceil(profiles.length / profilesPerPage)} ({profiles.length} total)
              </span>
              
              <button
                onClick={() => setCurrentPage(Math.min(Math.ceil(profiles.length / profilesPerPage), currentPage + 1))}
                disabled={currentPage >= Math.ceil(profiles.length / profilesPerPage)}
                className="px-3 py-1 rounded text-[11px] bg-slate-700/40 hover:bg-slate-600/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
      
      <p className="text-[10px] text-slate-500">Double‑click a name to rename. Activate to use during paraphrasing.</p>
      
      {/* Top Performing Styles Section */}
      <div className="mt-6 pt-4 border-t border-white/10">
        <button
          onClick={() => setShowTopStyles(!showTopStyles)}
          className="w-full flex items-center justify-between mb-3 hover:bg-white/5 p-2 rounded transition-colors"
        >
          <div className="flex items-center gap-2">
            <svg 
              className={`w-4 h-4 text-brand-300 transition-transform ${showTopStyles ? 'rotate-90' : ''}`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <h3 className="font-semibold text-brand-300 text-sm">Top Performing Styles</h3>
            <span className="px-2 py-0.5 rounded text-[9px] bg-purple-500/20 text-purple-300 border border-purple-500/30">
              PREMIUM
            </span>
          </div>
          <span className="text-xs text-slate-500">
            {showTopStyles ? 'Hide' : 'Show'}
          </span>
        </button>
        
        {showTopStyles && (
          <>
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
                {/* Show only the last (lowest ranked) style */}
                <ul className="space-y-2">
                  {topStyles.slice(-1).map((suggestion) => {
                    const rank = topStyles.length; // Last position
                    return (
                      <li 
                        key={suggestion.id} 
                        className="group border border-purple-500/20 rounded-lg p-3 bg-gradient-to-br from-slate-800/60 to-slate-900/60 hover:border-purple-500/40 transition-all"
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-semibold text-white">
                                #{rank} Top Style
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
                          {(() => {
                            const alreadySaved = isStyleAlreadySaved(suggestion);
                            return (
                              <button
                                onClick={() => applyTopStyle(suggestion)}
                                disabled={!isAuthenticated || alreadySaved}
                                className={`px-3 py-1.5 rounded text-[10px] font-medium transition-all ${
                                  alreadySaved
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 cursor-not-allowed'
                                    : isAuthenticated
                                    ? 'bg-gradient-to-r from-brand-500 to-purple-500 hover:from-brand-400 hover:to-purple-400 text-white shadow-lg hover:shadow-brand-500/50'
                                    : 'bg-slate-600/30 text-slate-500 cursor-not-allowed'
                                }`}
                                title={
                                  alreadySaved 
                                    ? "This style is already in your saved styles" 
                                    : !isAuthenticated 
                                    ? "Sign in to use this style" 
                                    : "Add this style to your saved styles"
                                }
                              >
                                {alreadySaved ? '✓ Saved' : 'Use Style'}
                              </button>
                            );
                          })()}
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
                    );
                  })}
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
          </>
        )}
      </div>
      
      {/* Edit Profile Modal - Full Screen (Portal to document body) */}
      {showEditModal && editingProfile && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 bg-slate-950 z-[9999] overflow-y-auto">
          <div className="min-h-screen py-8">
            <div className="max-w-4xl mx-auto px-4">
              <div className="glass-panel p-8 space-y-8">
                {/* Header */}
                <div className="flex items-center justify-between pb-6 border-b border-white/10">
                  <div>
                    <h2 className="text-2xl font-bold text-white">Edit Style Profile</h2>
                    <p className="text-sm text-slate-400 mt-1">Modify your writing style parameters and settings</p>
                  </div>
                  <button 
                    onClick={cancelEdit}
                    className="text-slate-400 hover:text-white transition text-2xl px-3"
                    title="Close"
                  >
                    ✕
                  </button>
                </div>
                
                {/* Profile Name */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-slate-300 block">Profile Name *</label>
                  <input 
                    value={editingProfile.name || ''} 
                    onChange={e => updateEditingProfile('name', e.target.value)} 
                    className="w-full rounded-lg bg-slate-800/60 border border-white/10 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-brand-500" 
                    placeholder="e.g. Academic Concise, Professional Friendly" 
                  />
                </div>
                
                {/* Tone */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-slate-300 block">Overall Tone *</label>
                  <input 
                    value={editingProfile.tone} 
                    onChange={e => updateEditingProfile('tone', e.target.value)} 
                    className="w-full rounded-lg bg-slate-800/60 border border-white/10 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-brand-500" 
                    placeholder="e.g. balanced, encouraging, critical"
                  />
                </div>
                
                {/* Style Parameters */}
                <div className="space-y-6">
                  <div className="flex items-center gap-2 pb-2 border-b border-white/10">
                    <h3 className="text-lg font-semibold text-brand-300">Style Parameters</h3>
                    <span className="text-xs text-slate-500">(Adjust sliders to fine-tune your style)</span>
                  </div>
                  
                  <div className="grid gap-8 md:grid-cols-2">
                    {/* Formality */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm text-slate-400">
                        <span className="font-medium">Formality</span>
                        <span className="font-mono text-brand-400 font-semibold">{Math.round(editingProfile.formality * 100)}%</span>
                      </div>
                      <input 
                        type="range" 
                        min={0} 
                        max={1} 
                        step={0.01} 
                        value={editingProfile.formality} 
                        onChange={e => updateEditingProfile('formality', parseFloat(e.target.value))} 
                        className="w-full h-2 accent-brand-500 cursor-pointer" 
                      />
                      <div className="text-xs text-slate-500 flex justify-between">
                        <span>Casual</span>
                        <span>Academic</span>
                      </div>
                    </div>
                    
                    {/* Pacing */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm text-slate-400">
                        <span className="font-medium">Pacing</span>
                        <span className="font-mono text-brand-400 font-semibold">{Math.round(editingProfile.pacing * 100)}%</span>
                      </div>
                      <input 
                        type="range" 
                        min={0} 
                        max={1} 
                        step={0.01} 
                        value={editingProfile.pacing} 
                        onChange={e => updateEditingProfile('pacing', parseFloat(e.target.value))} 
                        className="w-full h-2 accent-brand-500 cursor-pointer" 
                      />
                      <div className="text-xs text-slate-500 flex justify-between">
                        <span>Measured</span>
                        <span>Rapid</span>
                      </div>
                    </div>
                    
                    {/* Descriptiveness */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm text-slate-400">
                        <span className="font-medium">Descriptiveness</span>
                        <span className="font-mono text-brand-400 font-semibold">{Math.round(editingProfile.descriptiveness * 100)}%</span>
                      </div>
                      <input 
                        type="range" 
                        min={0} 
                        max={1} 
                        step={0.01} 
                        value={editingProfile.descriptiveness} 
                        onChange={e => updateEditingProfile('descriptiveness', parseFloat(e.target.value))} 
                        className="w-full h-2 accent-brand-500 cursor-pointer" 
                      />
                      <div className="text-xs text-slate-500 flex justify-between">
                        <span>Minimal</span>
                        <span>Vivid</span>
                      </div>
                    </div>
                    
                    {/* Directness */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm text-slate-400">
                        <span className="font-medium">Directness</span>
                        <span className="font-mono text-brand-400 font-semibold">{Math.round(editingProfile.directness * 100)}%</span>
                      </div>
                      <input 
                        type="range" 
                        min={0} 
                        max={1} 
                        step={0.01} 
                        value={editingProfile.directness} 
                        onChange={e => updateEditingProfile('directness', parseFloat(e.target.value))} 
                        className="w-full h-2 accent-brand-500 cursor-pointer" 
                      />
                      <div className="text-xs text-slate-500 flex justify-between">
                        <span>Implicit</span>
                        <span>Straightforward</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Keywords */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-slate-300 block">Keywords (optional)</label>
                  <input 
                    value={editingProfile.customLexicon.join(', ')} 
                    onChange={e => updateEditingProfile('customLexicon', e.target.value.split(',').map(s => s.trim()).filter(Boolean))} 
                    className="w-full rounded-lg bg-slate-800/60 border border-white/10 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-brand-500" 
                    placeholder="e.g. innovative, strategic, efficient" 
                  />
                  <p className="text-xs text-slate-400">Separate keywords with commas. These words will be emphasized in your paraphrased text.</p>
                </div>
                
                {/* Sample Excerpt */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-slate-300 block">Sample Excerpt (optional)</label>
                  <textarea 
                    value={editingProfile.sampleExcerpt} 
                    onChange={e => updateEditingProfile('sampleExcerpt', e.target.value)} 
                    rows={6} 
                    className="w-full rounded-lg bg-slate-800/60 border border-white/10 px-4 py-3 text-base leading-relaxed focus:outline-none focus:ring-2 focus:ring-brand-500" 
                    placeholder="Paste a sample of your writing to reference your style..." 
                  />
                  <p className="text-xs text-slate-400">A sample of your writing helps maintain consistency with your natural style.</p>
                </div>
                
                {/* Notes */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-slate-300 block">Notes (optional)</label>
                  <textarea 
                    value={editingProfile.notes} 
                    onChange={e => updateEditingProfile('notes', e.target.value)} 
                    rows={3} 
                    className="w-full rounded-lg bg-slate-800/60 border border-white/10 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-brand-500" 
                    placeholder="e.g. Professional tone, avoid jargon, use active voice" 
                  />
                  <p className="text-xs text-slate-400">Additional guidelines or preferences for this style profile.</p>
                </div>
                
                {/* Action Buttons */}
                <div className="flex gap-4 pt-6 border-t border-white/10">
                  <button 
                    onClick={saveEditedProfile}
                    className="flex-1 px-6 py-3 rounded-lg bg-brand-500 hover:bg-brand-400 text-slate-900 font-bold text-base transition shadow-lg hover:shadow-brand-500/50"
                  >
                    💾 Save Changes
                  </button>
                  <button 
                    onClick={cancelEdit}
                    className="px-6 py-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-semibold text-base transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
      
      {/* Delete Confirmation Modal (Portal to document body) */}
      {showDeleteConfirm && profileToDelete && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-slate-900 rounded-xl border border-red-500/30 max-w-md w-full shadow-2xl">
            <div className="p-6 space-y-4">
              {/* Header */}
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl">⚠️</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-white">Delete Style Profile?</h3>
                  <p className="text-sm text-slate-400 mt-1">This action cannot be undone.</p>
                </div>
              </div>
              
              {/* Profile Info */}
              <div className="bg-slate-800/50 rounded-lg p-4 border border-white/5">
                <p className="text-sm text-slate-300 mb-2">
                  You are about to delete:
                </p>
                <p className="text-base font-semibold text-white">
                  {profileToDelete.name || 'Unnamed Profile'}
                </p>
                <div className="flex flex-wrap gap-2 mt-3 text-[10px] text-slate-400">
                  <span className="px-2 py-1 rounded bg-slate-700/40">Tone: {profileToDelete.tone}</span>
                  <span className="px-2 py-1 rounded bg-slate-700/40">F{Math.round(profileToDelete.formality*100)}</span>
                  <span className="px-2 py-1 rounded bg-slate-700/40">P{Math.round(profileToDelete.pacing*100)}</span>
                  <span className="px-2 py-1 rounded bg-slate-700/40">Dsc{Math.round(profileToDelete.descriptiveness*100)}</span>
                  <span className="px-2 py-1 rounded bg-slate-700/40">Dir{Math.round(profileToDelete.directness*100)}</span>
                </div>
              </div>
              
              {/* Warning Message */}
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                <p className="text-xs text-red-300">
                  ⚠️ This profile will be permanently removed from your account and cannot be recovered.
                </p>
              </div>
              
              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button 
                  onClick={cancelDelete}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-semibold transition"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmDelete}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold transition shadow-lg hover:shadow-red-500/50"
                >
                  Delete Profile
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
