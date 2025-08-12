export interface StyleProfile {
  id: string;
  createdAt: number;
  updatedAt: number;
  tone: string; // freeform descriptor
  formality: number; // 0-1
  pacing: number; // 0-1
  descriptiveness: number; // 0-1
  directness: number; // 0-1
  sampleExcerpt: string;
  customLexicon: string[];
  notes: string;
}

const KEY = 'stylesync.profile.v1';

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
