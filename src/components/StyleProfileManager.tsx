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

  async function pushRemote(id: string) {
    setBusy(true);
    try {
      const p = profiles.find(p => p.id === id);
      if (!p) return;
      if (supabase) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await saveProfileRemote({ ...p, userId: user.id });
        }
      }
    } finally { setBusy(false); }
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
      <ul className="space-y-1">
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
              <div className="flex gap-2">
                <button onClick={() => pushRemote(p.id)} disabled={busy} className="text-[10px] mt-1 px-2 py-0.5 rounded bg-slate-600/40 hover:bg-slate-500/40 disabled:opacity-40">Sync</button>
              </div>
            </li>
          );
        })}
      </ul>
      {busy && <p className="text-[10px] text-slate-500">Syncing…</p>}
      <p className="text-[10px] text-slate-500">Double‑click a name to rename. Activate to use during paraphrasing.</p>
    </div>
  );
}
