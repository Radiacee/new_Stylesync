// Build a simple frequency map from user sample writing.
export function buildFrequencyMap(text: string): Record<string, number> {
  const freq: Record<string, number> = {};
  if (!text) return freq;
  const tokens = text.toLowerCase().split(/[^a-zA-Z']+/).filter(Boolean);
  for (const t of tokens) freq[t] = (freq[t] || 0) + 1;
  return freq;
}

// Score a candidate synonym list against frequency map; prefer words the user already uses.
export function pickPreferred(list: string[], freq: Record<string, number>): string | null {
  if (!list.length) return null;
  let best = list[0];
  let bestScore = -1;
  for (const w of list) {
    const score = freq[w.toLowerCase()] || 0;
    if (score > bestScore) { best = w; bestScore = score; }
  }
  return bestScore > 0 ? best : null;
}
