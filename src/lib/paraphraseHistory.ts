import { supabase } from './supabaseClient.ts';

export interface ParaphraseEntry {
  id: string; // uuid from db or local temp id
  userId?: string;
  input: string;
  output: string;
  note: string;
  usedModel: boolean;
  createdAt: string; // ISO
  pending?: boolean; // not yet persisted
  localOnly?: boolean; // for unsigned users
}

export const PARAPHRASE_HISTORY_SQL = `create table if not exists public.paraphrase_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  input_text text not null,
  output_text text not null,
  note text default '',
  used_model boolean default false,
  created_at timestamptz default now()
);
-- Index for fast recent fetch
create index if not exists paraphrase_history_user_created_idx on public.paraphrase_history(user_id, created_at desc);
-- RLS
alter table public.paraphrase_history enable row level security;
create policy if not exists "paraphrase_history_select" on public.paraphrase_history for select using (auth.uid() = user_id);
create policy if not exists "paraphrase_history_insert" on public.paraphrase_history for insert with check (auth.uid() = user_id);
create policy if not exists "paraphrase_history_update" on public.paraphrase_history for update using (auth.uid() = user_id);
create policy if not exists "paraphrase_history_delete" on public.paraphrase_history for delete using (auth.uid() = user_id);`;

export async function fetchHistory(limit = 50): Promise<ParaphraseEntry[]> {
  if (!supabase) return [];
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from('paraphrase_history')
    .select('id,input_text,output_text,note,used_model,created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    const code = (error as any).code;
    if (code === 'PGRST205') {
      paraphraseHistoryTableMissing = true;
      return [];
    }
    console.warn('fetchHistory error', error);
    return [];
  }
  return (data||[]).map(r => ({
    id: r.id,
    userId: user.id,
    input: r.input_text,
    output: r.output_text,
    note: r.note || '',
    usedModel: !!r.used_model,
    createdAt: r.created_at
  }));
}

export async function addHistoryEntry(entry: Omit<ParaphraseEntry,'id'|'createdAt'|'pending'|'localOnly'>): Promise<ParaphraseEntry | null> {
  if (!supabase) return null;
  if (!entry.userId) return null;
  const { data, error } = await supabase
    .from('paraphrase_history')
    .insert({
      user_id: entry.userId,
      input_text: entry.input,
      output_text: entry.output,
      note: entry.note || '',
      used_model: entry.usedModel
    })
    .select('id,created_at')
    .single();
  if (error) {
    const code = (error as any).code;
    if (code === 'PGRST205') { paraphraseHistoryTableMissing = true; return null; }
    console.warn('addHistoryEntry error', error); return null; }
  return {
    id: data.id,
    userId: entry.userId,
    input: entry.input,
    output: entry.output,
    note: entry.note || '',
    usedModel: entry.usedModel,
    createdAt: data.created_at
  };
}

export async function updateHistoryNote(id: string, note: string) {
  if (!supabase) return false;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { error } = await supabase
    .from('paraphrase_history')
    .update({ note })
    .eq('id', id)
    .eq('user_id', user.id);
  if (error) { console.warn('updateHistoryNote error', error); return false; }
  return true;
}

export async function deleteHistoryEntry(id: string): Promise<boolean> {
  if (!supabase) return false;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { error } = await supabase
    .from('paraphrase_history')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);
  if (error) { 
    console.warn('deleteHistoryEntry error', error); 
    return false; 
  }
  return true;
}

export async function deleteAllHistory(): Promise<boolean> {
  if (!supabase) return false;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { error } = await supabase
    .from('paraphrase_history')
    .delete()
    .eq('user_id', user.id);
  if (error) { 
    console.warn('deleteAllHistory error', error); 
    return false; 
  }
  return true;
}

// Optional local storage caching key (future use). Provide clear helper.
const LOCAL_HISTORY_KEY = 'stylesync.paraphrase.history.v1';
export function clearLocalParaphraseHistory() {
  try { localStorage.removeItem(LOCAL_HISTORY_KEY); } catch {}
}

// --- Table existence flag & helper ---
let paraphraseHistoryTableMissing = false;
export function isParaphraseHistoryTableMissing() { return paraphraseHistoryTableMissing; }
