import { describe, it, expect } from 'vitest';
import { paraphraseWithProfile, analyzeSampleStyle } from '../paraphrase.ts';
import type { StyleProfile } from '../styleProfile.ts';

const baseProfile: StyleProfile = {
  id: 't', createdAt: Date.now(), updatedAt: Date.now(),
  tone: 'balanced', formality: 0.8, pacing: 0.5, descriptiveness: 0.5, directness: 0.5,
  sampleExcerpt: '', customLexicon: ['nuance'], notes: ''
};

describe('paraphraseWithProfile', () => {
  it('returns empty string for empty input', () => {
    expect(paraphraseWithProfile('', baseProfile)).toBe('');
  });

  it('applies contraction style based on sample', () => {
    // When sample uses contractions, output should use contractions
    const informalSample = "It's great. That's nice. We're happy.";
    const text = 'It is important to improve.';
    const out = paraphraseWithProfile(text, { ...baseProfile, sampleExcerpt: informalSample });
    expect(out).toMatch(/it's/i); // Should have contractions
  });

  it('injects lexicon notes if custom words missing and option enabled', () => {
    const text = 'A clear plan.';
    const out = paraphraseWithProfile(text, baseProfile, { includeLexiconNotes: true });
    expect(out).toMatch(/lexicon notes:/i);
  });

  it('respects contraction usage in sample (disables if sample formal)', () => {
    const formalSample = 'It is a process. It is important. It is required.';
    const informalSample = "It's a process. It's important. It's required.";
    const formalProfile = { ...baseProfile, sampleExcerpt: formalSample };
    const informalProfile = { ...baseProfile, sampleExcerpt: informalSample };
  const text = 'It is necessary and it is needed.';
    const outFormal = paraphraseWithProfile(text, formalProfile);
    let informalSaw = false;
    const contractionRegex = /(it's|don't|can't|that's|there's)/i;
    for (let i=0;i<12;i++) {
      const out = paraphraseWithProfile(text, informalProfile);
      if (contractionRegex.test(out)) { informalSaw = true; break; }
    }
    expect(outFormal).not.toMatch(/it's/i); // retained formal style
    expect(informalSaw).toBe(true); // adopted contractions at least once
  });

  it('injects preferred transitions from sample style occasionally', () => {
    const sample = 'However, this is one. However, this is two. However, this is three.';
    const profile = { ...baseProfile, sampleExcerpt: sample };
    const text = 'This is a test sentence. This is another sentence.';
    // Run multiple times to increase chance of insertion due to stochastic nature
    let saw = false;
    for (let i=0;i<10;i++) {
      const out = paraphraseWithProfile(text, profile);
      if (/However,?\s+this is (a test|another)/i.test(out)) { saw = true; break; }
    }
    expect(saw).toBe(true);
  });
});
