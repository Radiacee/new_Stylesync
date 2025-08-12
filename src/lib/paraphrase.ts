import type { StyleProfile } from './styleProfile.ts';

// Simple synonym map (demo only)
const SYNONYMS: Record<string, string[]> = {
  important: ['crucial', 'vital', 'key'],
  fast: ['swift', 'quick'],
  slow: ['unhurried', 'gradual'],
  improve: ['enhance', 'refine', 'strengthen'],
  clear: ['lucid', 'plain', 'transparent'],
  many: ['numerous', 'several', 'countless'],
};

export function paraphraseWithProfile(text: string, profile?: StyleProfile): string {
  if (!text.trim()) return '';

  // Basic sentence split
  const sentences = text.split(/(?<=[.!?])\s+/);
  const adjusted = sentences.map(s => rewriteSentence(s, profile));
  let result = adjusted.join(' ');

  if (profile) {
    // Adjust descriptiveness by optionally adding/removing adjectives (very naive)
    if (profile.descriptiveness > 0.7) {
      result = result.replace(/\b(idea|concept|plan)\b/gi, m => 'distinct ' + m);
    } else if (profile.descriptiveness < 0.3) {
      result = result.replace(/\b(distinct|vivid|rich)\s+(idea|concept|plan)\b/gi, '$2');
    }

    // Directness: shorten or slightly expand sentences
    if (profile.directness > 0.7) {
      result = result.replace(/\b(in order to)\b/gi, 'to');
      result = result.replace(/\b(it is|there is|there are)\b/gi, '');
    } else if (profile.directness < 0.3) {
      result = result.replace(/\b(to)\b/gi, 'in order to');
    }

    // Lexicon injection (ensure words appear at least once)
    if (profile.customLexicon?.length) {
      const missing = profile.customLexicon.filter(w => !new RegExp(`\\b${escapeReg(w)}\\b`, 'i').test(result));
      if (missing.length) {
        result += '\n\nLexicon notes: ' + missing.slice(0, 5).join(', ');
      }
    }
  }

  return result.trim();
}

function rewriteSentence(sentence: string, profile?: StyleProfile): string {
  let s = sentence;
  // Replace synonyms respecting formality (simple heuristic: higher formality -> pick later synonym)
  s = s.replace(/\b([a-zA-Z]+)\b/g, (match) => {
    const key = match.toLowerCase();
    const syns = SYNONYMS[key];
    if (!syns) return match;
    if (!profile) return capitalizeIf(match, syns[0]);
    const idx = Math.min(syns.length - 1, Math.floor(profile.formality * syns.length));
    return preserveCase(match, syns[idx]);
  });

  // Pacing: shorter sentences for higher pacing, else expand slightly
  if (profile) {
    if (profile.pacing > 0.7 && s.length > 120) {
      s = s.replace(/,\s+which/gi, '. Which');
    } else if (profile.pacing < 0.3 && s.length < 80) {
      s = s.replace(/\.$/, ', which in turn');
    }
  }
  return s;
}

function preserveCase(original: string, replacement: string) {
  if (original === original.toUpperCase()) return replacement.toUpperCase();
  if (original[0] === original[0].toUpperCase()) return replacement.charAt(0).toUpperCase() + replacement.slice(1);
  return replacement;
}

function capitalizeIf(original: string, word: string) {
  if (original[0] === original[0].toUpperCase()) return word.charAt(0).toUpperCase() + word.slice(1);
  return word;
}

function escapeReg(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
