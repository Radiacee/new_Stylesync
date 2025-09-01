import type { SampleStyle } from './paraphrase.ts';

export interface StyleProfile {
  id: string;
  createdAt: number;
  updatedAt: number;
  name?: string; // user-visible label
  tone: string; // freeform descriptor
  formality: number; // 0-1
  pacing: number; // 0-1
  descriptiveness: number; // 0-1
  directness: number; // 0-1
  sampleExcerpt: string;
  customLexicon: string[];
  notes: string;
  userId?: string;
  styleAnalysis?: SampleStyle; // computed analysis of sample excerpt for AI prompting
}

const KEY = 'stylesync.profile.v1';
const LIST_KEY = 'stylesync.profiles.v1';
const ACTIVE_KEY = 'stylesync.profiles.activeId';

export function saveProfile(profile: StyleProfile) {
  try { localStorage.setItem(KEY, JSON.stringify(profile)); } catch { /* ignore */ }
}

export function loadProfile(): StyleProfile | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StyleProfile;
  } catch { return null; }
}
export function clearProfile() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

export async function loadProfileRemote(userId: string): Promise<StyleProfile | null> {
  if (typeof window === 'undefined') return null;
  const { supabase } = await import('./supabaseClient.ts');
  if (!supabase) return null;
  // Use maybeSingle() so zero rows does NOT throw (avoids PGRST116 noise) while still returning a single object when present.
  const { data, error } = await (supabase as any)
    .from('style_profiles')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    if ((error as any).message?.includes("'name' column")) {
      // retry selecting explicit legacy columns
      const retry = await (supabase as any)
        .from('style_profiles')
        .select('id,user_id,tone,formality,pacing,descriptiveness,directness,sample_excerpt,custom_lexicon,notes,created_at,updated_at')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!retry.error) {
        const d = retry.data;
        if (!d) return null;
        return {
          id: d.id,
          createdAt: Date.parse(d.created_at),
          updatedAt: Date.parse(d.updated_at),
          name: 'Untitled', // legacy profiles don't have name field
          tone: d.tone,
          formality: d.formality,
          pacing: d.pacing,
          descriptiveness: d.descriptiveness,
          directness: d.directness,
          sampleExcerpt: d.sample_excerpt || '',
          customLexicon: d.custom_lexicon || [],
          notes: d.notes || '',
          userId: d.user_id
        };
      }
    }
    const code = (error as any).code;
    if (code === 'PGRST205' /* table missing */ || code === 'PGRST116' /* no rows for single */) return null;
    return null; // Silently ignore other errors for now (could log)
  }
  if (!data) return null;
  return {
    id: data.id,
    createdAt: Date.parse(data.created_at),
    updatedAt: Date.parse(data.updated_at),
    name: data.name,
    tone: data.tone,
    formality: data.formality,
    pacing: data.pacing,
    descriptiveness: data.descriptiveness,
    directness: data.directness,
    sampleExcerpt: data.sample_excerpt || '',
    customLexicon: data.custom_lexicon || [],
    notes: data.notes || '',
    userId: data.user_id
  };
}

// Load all profiles for a user (multi-profile support)
export async function loadProfilesRemote(userId: string): Promise<StyleProfile[]> {
  if (typeof window === 'undefined') return [];
  const { supabase } = await import('./supabaseClient.ts');
  if (!supabase) return [];
  let { data, error } = await (supabase as any)
    .from('style_profiles')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  if (error && (error as any).message?.includes("'name' column")) {
    // Fallback: legacy table without name column
    const retry = await (supabase as any)
      .from('style_profiles')
      .select('id,user_id,tone,formality,pacing,descriptiveness,directness,sample_excerpt,custom_lexicon,notes,created_at,updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });
    data = retry.data; error = retry.error;
  }
  if (error) return [];
  return (data||[]).map((d: any) => ({
    id: d.id,
    createdAt: Date.parse(d.created_at),
    updatedAt: Date.parse(d.updated_at),
    name: d.name,
    tone: d.tone,
    formality: d.formality,
    pacing: d.pacing,
    descriptiveness: d.descriptiveness,
    directness: d.directness,
    sampleExcerpt: d.sample_excerpt || '',
    customLexicon: d.custom_lexicon || [],
    notes: d.notes || '',
    userId: d.user_id
  }));
}

// Push all local profiles to remote (upsert) - best effort
export async function syncLocalProfilesToRemote(userId: string) {
  const local = listProfiles();
  if (!local.length) return;
  for (const p of local) {
    try { await saveProfileRemote({ ...p, userId }); } catch { /* ignore one-off errors */ }
  }
}

// --- Multi-profile local management ---

export function listProfiles(): StyleProfile[] {
  try {
    const raw = localStorage.getItem(LIST_KEY);
    if (!raw) {
      // Backwards compat: migrate single profile if exists
      const single = loadProfile();
      if (single) {
        single.name = single.name || 'Default';
        saveProfiles([single]);
        return [single];
      }
      return [];
    }
    const arr = JSON.parse(raw) as StyleProfile[];
    return arr;
  } catch { return []; }
}

export function saveProfiles(list: StyleProfile[]) {
  try { localStorage.setItem(LIST_KEY, JSON.stringify(list)); } catch { /* ignore */ }
}

export function getActiveProfileId(): string | null {
  try { return localStorage.getItem(ACTIVE_KEY); } catch { return null; }
}

export function setActiveProfileId(id: string) {
  try { localStorage.setItem(ACTIVE_KEY, id); } catch { /* ignore */ }
}

export function upsertProfileLocal(p: StyleProfile) {
  const list = listProfiles();
  const idx = list.findIndex(x => x.id === p.id);
  if (idx >= 0) list[idx] = p; else list.push(p);
  saveProfiles(list);
  // Don't set active ID here - let the caller do it if needed
}

export function deleteProfileLocal(id: string) {
  const list = listProfiles().filter(p => p.id !== id);
  saveProfiles(list);
  const active = getActiveProfileId();
  if (active === id) {
    if (list.length) setActiveProfileId(list[0].id); else try { localStorage.removeItem(ACTIVE_KEY); } catch {}
  }
}

export async function styleProfilesTableExists(): Promise<boolean> {
  const { supabase } = await import('./supabaseClient.ts');
  if (!supabase) return false;
  const { error } = await supabase.from('style_profiles').select('id').limit(1);
  if (!error) return true;
  if ((error as any).code === 'PGRST205') return false;
  return true; // Other errors treat as exists to avoid noisy UI.
}

export async function saveProfileRemote(profile: Omit<StyleProfile, 'id'> & { id?: string; userId: string }): Promise<string | null> {
  const { supabase } = await import('./supabaseClient.ts');
  if (!supabase) return null;
  // Ensure we are operating as the currently authenticated user to satisfy RLS policies.
  const { data: userData } = await (supabase as any).auth.getUser();
  const sessionUserId: string | undefined = userData?.user?.id;
  if (!sessionUserId) {
    throw new Error('Not authenticated');
  }
  // Force user_id to be the session user (ignore potentially stale profile.userId to pass RLS check)
  const idIsUUID = profile.id && /^[0-9a-fA-F-]{36}$/.test(profile.id);
  const payload: any = {
    user_id: sessionUserId,
    name: profile.name,
    tone: profile.tone,
    formality: profile.formality,
    pacing: profile.pacing,
    descriptiveness: profile.descriptiveness,
    directness: profile.directness,
    sample_excerpt: profile.sampleExcerpt,
    custom_lexicon: profile.customLexicon,
    notes: profile.notes
  };
  if (idIsUUID) payload.id = profile.id;
  payload.updated_at = new Date().toISOString();
  async function attempt(p: any): Promise<string | null> {
    if (idIsUUID) {
      const { data, error } = await (supabase as any).from('style_profiles').upsert(p, { onConflict: 'id' }).select('id').single();
      if (error) throw error;
      return data?.id ?? null;
    } else {
      const { data, error } = await (supabase as any).from('style_profiles').insert(p).select('id').single();
      if (error) throw error;
      return data?.id ?? null;
    }
  }
  try {
    return await attempt(payload);
  } catch (e: any) {
    if (e?.message?.includes("'name' column")) {
      // Retry without name for legacy schema
      const { name, ...rest } = payload;
      return await attempt(rest);
    }
    throw e;
  }
}

export const PROFILE_SQL = `create table if not exists public.style_profiles (
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
);`;

// Recommended RLS setup (run in Supabase SQL editor once):
// create extension if not exists pgcrypto; -- if gen_random_uuid absent
// alter table public.style_profiles enable row level security;
// create policy "Allow user select own" on public.style_profiles for select using (auth.uid() = user_id);
// create policy "Allow user insert own" on public.style_profiles for insert with check (auth.uid() = user_id);
// create policy "Allow user update own" on public.style_profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
// create policy "Allow user delete own" on public.style_profiles for delete using (auth.uid() = user_id);
export const PROFILE_RLS_SQL = `alter table public.style_profiles enable row level security;
create policy "Allow user select own" on public.style_profiles for select using (auth.uid() = user_id);
create policy "Allow user insert own" on public.style_profiles for insert with check (auth.uid() = user_id);
create policy "Allow user update own" on public.style_profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Allow user delete own" on public.style_profiles for delete using (auth.uid() = user_id);`;
