/**
 * SIMPLE STYLE PARAPHRASE MODULE
 * 
 * Goal: Apply user's writing style to paraphrased text
 * 
 * How it works:
 * 1. Analyze user's writing samples to extract style patterns
 * 2. When paraphrasing, apply those patterns to the output
 * 
 * Key style elements we match:
 * - Contractions (it's vs it is)
 * - Sentence length (short/medium/long)
 * - Transition words (However, Moreover, etc.)
 * - Voice/perspective (first/second/third person)
 */

import type { StyleProfile } from './styleProfile.ts';

// =============================================================================
// TYPES
// =============================================================================

export interface SampleStyle {
  avgSentenceLength: number;
  usesContractions: boolean;
  preferredTransitions: string[];
  transitionStartRatio: number;
  personalVoice: 'first-person' | 'second-person' | 'third-person';
  // Additional metrics for analysis
  sentenceLengthStd?: number;
  highFrequencyWords?: string[];
  commaPerSentence?: number;
  semicolonRatio?: number;
  topAdverbs?: string[];
  avgWordLength?: number;
  vocabularyComplexity?: number;
  questionRatio?: number;
  exclamatoryRatio?: number;
  commonStarters?: string[];
  conjunctionDensity?: number;
  adjectiveDensity?: number;
  toneBalance?: { positive: number; negative: number; neutral: number };
}

export interface StyleMatchReport {
  overallMatch: number;
  contractionMatch: boolean;
  sentenceLengthMatch: boolean;
  transitionMatch: boolean;
  details: string[];
}

// =============================================================================
// MAIN FUNCTIONS
// =============================================================================

/**
 * Paraphrase text while applying user's writing style
 */
export function paraphraseWithProfile(
  text: string,
  profile?: StyleProfile,
  options: { includeLexiconNotes?: boolean } = {}
): string {
  if (!text.trim()) return '';

  let result = text.trim();

  // Get user's style from their writing samples
  const userStyle = profile ? analyzeProfileStyle(profile) : null;

  if (userStyle) {
    // Apply style transformations
    result = applyContractionStyle(result, userStyle.usesContractions);
    result = applyTransitionStyle(result, userStyle);
  }

  // Basic cleanup
  result = cleanText(result);

  // Add lexicon notes if requested
  if (options.includeLexiconNotes && profile?.customLexicon?.length) {
    const missing = profile.customLexicon.filter(
      w => !new RegExp(`\\b${w}\\b`, 'i').test(result)
    );
    if (missing.length) {
      result += `\n\nLexicon notes: ${missing.slice(0, 5).join(', ')}`;
    }
  }

  return result;
}

/**
 * Analyze writing sample to extract style patterns
 */
export function analyzeSampleStyle(sample: string): SampleStyle {
  if (!sample.trim()) {
    return getDefaultStyle();
  }

  const sentences = sample.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const words = sample.split(/\s+/).filter(w => w.length > 0);

  // Calculate average sentence length
  const avgSentenceLength = sentences.length > 0
    ? sentences.reduce((sum, s) => sum + s.trim().split(/\s+/).length, 0) / sentences.length
    : 15;

  // Detect contraction usage
  const contractionPattern = /\b(don't|won't|can't|isn't|aren't|wasn't|weren't|hasn't|haven't|hadn't|couldn't|wouldn't|shouldn't|it's|that's|there's|here's|what's|who's|let's|I'm|you're|we're|they're|he's|she's)\b/gi;
  const contractionCount = (sample.match(contractionPattern) || []).length;
  const expandedPattern = /\b(do not|will not|cannot|is not|are not|was not|were not|has not|have not|had not|could not|would not|should not|it is|that is|there is|here is|what is|who is|let us|I am|you are|we are|they are|he is|she is)\b/gi;
  const expandedCount = (sample.match(expandedPattern) || []).length;
  const usesContractions = contractionCount > expandedCount;

  // Detect preferred transitions
  const transitionWords = ['However', 'Moreover', 'Additionally', 'Furthermore', 'Meanwhile', 'Instead', 'Still', 'Thus', 'Therefore', 'Consequently', 'Nevertheless', 'Otherwise', 'Similarly', 'Likewise'];
  const transitionCounts: Record<string, number> = {};
  
  for (const transition of transitionWords) {
    const regex = new RegExp(`\\b${transition}\\b`, 'gi');
    const count = (sample.match(regex) || []).length;
    if (count > 0) {
      transitionCounts[transition] = count;
    }
  }
  
  const preferredTransitions = Object.entries(transitionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);

  // Calculate transition start ratio
  const sentencesStartingWithTransition = sentences.filter(s => {
    const trimmed = s.trim();
    return transitionWords.some(t => 
      trimmed.toLowerCase().startsWith(t.toLowerCase())
    );
  }).length;
  const transitionStartRatio = sentences.length > 0
    ? sentencesStartingWithTransition / sentences.length
    : 0;

  // Detect voice/perspective
  const firstPersonPattern = /\b(I|me|my|mine|we|us|our|ours)\b/gi;
  const secondPersonPattern = /\b(you|your|yours)\b/gi;
  const firstPersonCount = (sample.match(firstPersonPattern) || []).length;
  const secondPersonCount = (sample.match(secondPersonPattern) || []).length;
  
  let personalVoice: 'first-person' | 'second-person' | 'third-person' = 'third-person';
  if (firstPersonCount > secondPersonCount && firstPersonCount > words.length * 0.02) {
    personalVoice = 'first-person';
  } else if (secondPersonCount > firstPersonCount && secondPersonCount > words.length * 0.02) {
    personalVoice = 'second-person';
  }

  return {
    avgSentenceLength,
    usesContractions,
    preferredTransitions,
    transitionStartRatio,
    personalVoice,
  };
}

/**
 * Verify and finalize paraphrased output
 */
export function verifyAndFinalize(
  raw: string,
  profile?: StyleProfile,
  maxPasses = 2,
  options: { includeLexiconNotes?: boolean } = {}
): { output: string; metrics: any; actions: any[] } {
  let output = raw.trim();

  // Apply user's style if profile exists
  const userStyle = profile ? analyzeProfileStyle(profile) : null;
  
  if (userStyle) {
    output = applyContractionStyle(output, userStyle.usesContractions);
  }

  // Clean the output
  output = cleanText(output);

  // Add lexicon notes if requested
  if (options.includeLexiconNotes && profile?.customLexicon?.length) {
    const missing = profile.customLexicon.filter(
      w => !new RegExp(`\\b${w}\\b`, 'i').test(output)
    );
    if (missing.length && !output.includes('Lexicon notes:')) {
      output += `\n\nLexicon notes: ${missing.slice(0, 5).join(', ')}`;
    }
  }

  return {
    output,
    metrics: { isHumanized: true, passes: 1 },
    actions: []
  };
}

/**
 * Verify how well output matches user's style
 */
export function verifyStyleMatch(output: string, profile?: StyleProfile): StyleMatchReport {
  if (!profile?.sampleExcerpt) {
    return {
      overallMatch: 100,
      contractionMatch: true,
      sentenceLengthMatch: true,
      transitionMatch: true,
      details: ['No style profile to match against']
    };
  }

  const userStyle = analyzeProfileStyle(profile);
  const outputStyle = analyzeSampleStyle(output);
  const details: string[] = [];
  let matchScore = 0;
  let totalChecks = 0;

  // Check contraction match
  totalChecks++;
  const contractionMatch = userStyle.usesContractions === outputStyle.usesContractions;
  if (contractionMatch) {
    matchScore++;
    details.push(`✓ Contraction style matches (${userStyle.usesContractions ? 'uses contractions' : 'formal language'})`);
  } else {
    details.push(`✗ Contraction mismatch - user ${userStyle.usesContractions ? 'uses' : 'avoids'} contractions`);
  }

  // Check sentence length (within 30% tolerance)
  totalChecks++;
  const lengthDiff = Math.abs(outputStyle.avgSentenceLength - userStyle.avgSentenceLength);
  const lengthTolerance = userStyle.avgSentenceLength * 0.3;
  const sentenceLengthMatch = lengthDiff <= lengthTolerance;
  if (sentenceLengthMatch) {
    matchScore++;
    details.push(`✓ Sentence length matches (~${Math.round(userStyle.avgSentenceLength)} words)`);
  } else {
    details.push(`✗ Sentence length differs - user avg: ${Math.round(userStyle.avgSentenceLength)}, output: ${Math.round(outputStyle.avgSentenceLength)}`);
  }

  // Check transition usage
  totalChecks++;
  const hasUserTransitions = userStyle.preferredTransitions.some(t =>
    new RegExp(`\\b${t}\\b`, 'i').test(output)
  );
  const transitionMatch = userStyle.preferredTransitions.length === 0 || hasUserTransitions;
  if (transitionMatch) {
    matchScore++;
    details.push(`✓ Transition words match user's style`);
  } else {
    details.push(`✗ Missing user's preferred transitions: ${userStyle.preferredTransitions.slice(0, 3).join(', ')}`);
  }

  const overallMatch = Math.round((matchScore / totalChecks) * 100);

  return {
    overallMatch,
    contractionMatch,
    sentenceLengthMatch,
    transitionMatch,
    details
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get style analysis from profile
 */
function analyzeProfileStyle(profile: StyleProfile): SampleStyle {
  if (profile.styleAnalysis) {
    return profile.styleAnalysis;
  }
  
  const sampleText = profile.sampleExcerpts?.join('\n\n') || profile.sampleExcerpt || '';
  if (!sampleText.trim()) {
    return getDefaultStyle();
  }
  
  return analyzeSampleStyle(sampleText);
}

/**
 * Default style when no samples available
 */
function getDefaultStyle(): SampleStyle {
  return {
    avgSentenceLength: 15,
    usesContractions: true,
    preferredTransitions: [],
    transitionStartRatio: 0,
    personalVoice: 'third-person',
  };
}

/**
 * Apply contraction style (expand or contract)
 */
function applyContractionStyle(text: string, useContractions: boolean): string {
  const pairs = [
    { expanded: /\bI am\b/g, contracted: "I'm" },
    { expanded: /\bI will\b/g, contracted: "I'll" },
    { expanded: /\bI have\b/g, contracted: "I've" },
    { expanded: /\bI would\b/g, contracted: "I'd" },
    { expanded: /\byou are\b/gi, contracted: "you're" },
    { expanded: /\byou will\b/gi, contracted: "you'll" },
    { expanded: /\byou have\b/gi, contracted: "you've" },
    { expanded: /\byou would\b/gi, contracted: "you'd" },
    { expanded: /\bwe are\b/gi, contracted: "we're" },
    { expanded: /\bwe will\b/gi, contracted: "we'll" },
    { expanded: /\bwe have\b/gi, contracted: "we've" },
    { expanded: /\bwe would\b/gi, contracted: "we'd" },
    { expanded: /\bthey are\b/gi, contracted: "they're" },
    { expanded: /\bthey will\b/gi, contracted: "they'll" },
    { expanded: /\bthey have\b/gi, contracted: "they've" },
    { expanded: /\bthey would\b/gi, contracted: "they'd" },
    { expanded: /\bhe is\b/gi, contracted: "he's" },
    { expanded: /\bhe will\b/gi, contracted: "he'll" },
    { expanded: /\bhe has\b/gi, contracted: "he's" },
    { expanded: /\bhe would\b/gi, contracted: "he'd" },
    { expanded: /\bshe is\b/gi, contracted: "she's" },
    { expanded: /\bshe will\b/gi, contracted: "she'll" },
    { expanded: /\bshe has\b/gi, contracted: "she's" },
    { expanded: /\bshe would\b/gi, contracted: "she'd" },
    { expanded: /\bit is\b/gi, contracted: "it's" },
    { expanded: /\bit will\b/gi, contracted: "it'll" },
    { expanded: /\bit has\b/gi, contracted: "it's" },
    { expanded: /\bit would\b/gi, contracted: "it'd" },
    { expanded: /\bthat is\b/gi, contracted: "that's" },
    { expanded: /\bthat will\b/gi, contracted: "that'll" },
    { expanded: /\bthat has\b/gi, contracted: "that's" },
    { expanded: /\bthat would\b/gi, contracted: "that'd" },
    { expanded: /\bthere is\b/gi, contracted: "there's" },
    { expanded: /\bthere will\b/gi, contracted: "there'll" },
    { expanded: /\bthere has\b/gi, contracted: "there's" },
    { expanded: /\bthere would\b/gi, contracted: "there'd" },
    { expanded: /\bwhat is\b/gi, contracted: "what's" },
    { expanded: /\bwho is\b/gi, contracted: "who's" },
    { expanded: /\bwhere is\b/gi, contracted: "where's" },
    { expanded: /\bhow is\b/gi, contracted: "how's" },
    { expanded: /\bdo not\b/gi, contracted: "don't" },
    { expanded: /\bdoes not\b/gi, contracted: "doesn't" },
    { expanded: /\bdid not\b/gi, contracted: "didn't" },
    { expanded: /\bwill not\b/gi, contracted: "won't" },
    { expanded: /\bwould not\b/gi, contracted: "wouldn't" },
    { expanded: /\bcould not\b/gi, contracted: "couldn't" },
    { expanded: /\bshould not\b/gi, contracted: "shouldn't" },
    { expanded: /\bcannot\b/gi, contracted: "can't" },
    { expanded: /\bcan not\b/gi, contracted: "can't" },
    { expanded: /\bis not\b/gi, contracted: "isn't" },
    { expanded: /\bare not\b/gi, contracted: "aren't" },
    { expanded: /\bwas not\b/gi, contracted: "wasn't" },
    { expanded: /\bwere not\b/gi, contracted: "weren't" },
    { expanded: /\bhas not\b/gi, contracted: "hasn't" },
    { expanded: /\bhave not\b/gi, contracted: "haven't" },
    { expanded: /\bhad not\b/gi, contracted: "hadn't" },
    { expanded: /\blet us\b/gi, contracted: "let's" },
  ];

  let result = text;

  if (useContractions) {
    // Convert to contractions
    for (const { expanded, contracted } of pairs) {
      result = result.replace(expanded, (match) => {
        // Preserve case of first letter
        if (match[0] === match[0].toUpperCase()) {
          return contracted.charAt(0).toUpperCase() + contracted.slice(1);
        }
        return contracted;
      });
    }
  } else {
    // Expand contractions
    const contractionToExpanded: Record<string, string> = {
      "i'm": "I am", "i'll": "I will", "i've": "I have", "i'd": "I would",
      "you're": "you are", "you'll": "you will", "you've": "you have", "you'd": "you would",
      "we're": "we are", "we'll": "we will", "we've": "we have", "we'd": "we would",
      "they're": "they are", "they'll": "they will", "they've": "they have", "they'd": "they would",
      "he's": "he is", "he'll": "he will", "he'd": "he would",
      "she's": "she is", "she'll": "she will", "she'd": "she would",
      "it's": "it is", "it'll": "it will", "it'd": "it would",
      "that's": "that is", "that'll": "that will", "that'd": "that would",
      "there's": "there is", "there'll": "there will", "there'd": "there would",
      "what's": "what is", "who's": "who is", "where's": "where is", "how's": "how is",
      "don't": "do not", "doesn't": "does not", "didn't": "did not",
      "won't": "will not", "wouldn't": "would not", "couldn't": "could not", "shouldn't": "should not",
      "can't": "cannot", "isn't": "is not", "aren't": "are not",
      "wasn't": "was not", "weren't": "were not",
      "hasn't": "has not", "haven't": "have not", "hadn't": "had not",
      "let's": "let us",
    };

    for (const [contraction, expanded] of Object.entries(contractionToExpanded)) {
      const regex = new RegExp(`\\b${contraction}\\b`, 'gi');
      result = result.replace(regex, (match) => {
        if (match[0] === match[0].toUpperCase()) {
          return expanded.charAt(0).toUpperCase() + expanded.slice(1);
        }
        return expanded;
      });
    }
  }

  return result;
}

/**
 * Apply transition style based on user's patterns
 */
function applyTransitionStyle(text: string, userStyle: SampleStyle): string {
  // Only add transitions if user frequently uses them
  if (userStyle.transitionStartRatio < 0.2 || userStyle.preferredTransitions.length === 0) {
    return text;
  }

  const sentences = text.split(/(?<=[.!?])\s+/).filter(s => s.trim());
  if (sentences.length < 2) return text;

  // Calculate how many sentences should start with transitions
  const targetTransitions = Math.ceil(sentences.length * userStyle.transitionStartRatio);
  let addedTransitions = 0;

  // Check how many already have transitions
  const transitionPattern = /^(However|Moreover|Additionally|Furthermore|Meanwhile|Instead|Still|Thus|Therefore|Consequently|Nevertheless|Otherwise|Similarly|Likewise),?\s/i;
  
  for (let i = 0; i < sentences.length && addedTransitions < targetTransitions; i++) {
    if (transitionPattern.test(sentences[i])) {
      addedTransitions++;
      continue;
    }

    // Add a transition to this sentence
    if (addedTransitions < targetTransitions && i > 0) {
      const transition = userStyle.preferredTransitions[addedTransitions % userStyle.preferredTransitions.length];
      const sentenceStart = sentences[i].charAt(0).toLowerCase() + sentences[i].slice(1);
      sentences[i] = `${transition}, ${sentenceStart}`;
      addedTransitions++;
    }
  }

  return sentences.join(' ');
}

/**
 * Clean text - fix punctuation issues
 */
function cleanText(text: string): string {
  let result = text.trim();

  // Fix spacing around punctuation
  result = result.replace(/\s+([.!?,;:])/g, '$1');  // Remove space before punctuation
  result = result.replace(/([.!?])([A-Za-z])/g, '$1 $2');  // Add space after sentence end

  // Fix double punctuation
  result = result.replace(/,\s*\./g, '.');  // comma before period
  result = result.replace(/\.\s*,/g, '.');  // period before comma
  result = result.replace(/,,+/g, ',');  // multiple commas
  result = result.replace(/\.\.+/g, '.');  // multiple periods (not ellipsis handling)
  result = result.replace(/\s{2,}/g, ' ');  // multiple spaces

  // Ensure proper ending
  if (result && !/[.!?]$/.test(result)) {
    result += '.';
  }

  // Capitalize first letter
  if (result) {
    result = result.charAt(0).toUpperCase() + result.slice(1);
  }

  return result;
}
