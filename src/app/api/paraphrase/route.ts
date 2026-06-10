import { NextRequest } from 'next/server';
import { rateLimit, formatRateLimitHeaders } from '../../../lib/rateLimit.ts';
import { z } from 'zod';
import { applyDeepStyleMatch, calculateLexicalDensity as calcLexicalDensity } from '../../../lib/deepStyleMatch';

const bodySchema = z.object({
  text: z.string().min(1).max(8000),
  useModel: z.boolean().optional(),
  profile: z.any().optional(),
  debug: z.boolean().optional(),
  paraphraseMode: z.enum(['style', 'robotics']).optional(),
  stylePreset: z.enum(['original', 'formal', 'casual', 'academic', 'professional', 'creative']).optional(),
  styleInstructions: z.string().nullable().optional()
});

// Verification types
interface VerificationResult {
  score: number;           // 0-100 accuracy score
  passed: boolean;         // true if score >= 85
  issues: VerificationIssue[];
  fixes: AutoFix[];
  styleBreakdown: {
    contractions: { match: boolean; score: number };
    sentenceLength: { match: boolean; score: number; diff: number };
    vocabulary: { match: boolean; score: number };
    transitions: { match: boolean; score: number };
    lexicalDensity: { match: boolean; score: number };
    sentenceVariety: { match: boolean; score: number };
    passiveVoice: { match: boolean; score: number };
    punctuation: { match: boolean; score: number };
    pronounUsage: { match: boolean; score: number };
    ngramSimilarity: { match: boolean; score: number };
  };
}

interface VerificationIssue {
  type: 'content_loss' | 'style_mismatch' | 'layout_broken' | 'meaning_changed';
  severity: 'low' | 'medium' | 'high';
  description: string;
}

interface AutoFix {
  type: 'contraction' | 'layout' | 'capitalization' | 'punctuation';
  original: string;
  fixed: string;
}

// ============================================================================
// STYLE MATCHING FUNCTIONS (Same logic as StyleProofPanel for consistency)
// ============================================================================

// Count contractions in text
function countContractions(text: string): number {
  const matches = text.match(/\b(don't|won't|can't|isn't|aren't|wasn't|weren't|haven't|hasn't|hadn't|I'm|you're|he's|she's|it's|we're|they're|I've|you've|we've|they've|I'll|you'll|we'll|they'll|I'd|you'd|he'd|she'd|we'd|they'd|couldn't|wouldn't|shouldn't|didn't|doesn't|that's|there's|here's|what's|let's)\b/gi) || [];
  return matches.length;
}

// Count expanded forms (formal) in text
function countExpanded(text: string): number {
  const matches = text.match(/\b(do not|will not|can not|cannot|is not|are not|was not|were not|have not|has not|had not|I am|you are|he is|she is|it is|we are|they are|I have|you have|we have|they have|I will|you will|we will|they will|could not|would not|should not|did not|does not)\b/gi) || [];
  return matches.length;
}

// Calculate average sentence length
function getAvgSentenceLength(text: string): number {
  const sentences = text.split(/[.!?]+/).filter((s: string) => s.trim().length > 5);
  if (sentences.length === 0) return 0;
  const wordCounts = sentences.map((s: string) => s.trim().split(/\s+/).length);
  return wordCounts.reduce((a: number, b: number) => a + b, 0) / wordCounts.length;
}

// Detect vocabulary complexity level
function getVocabularyLevel(text: string): 'simple' | 'moderate' | 'advanced' {
  const words = text.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
  if (words.length === 0) return 'moderate';
  
  const avgWordLength = words.reduce((sum: number, w: string) => sum + w.length, 0) / words.length;
  const longWords = words.filter((w: string) => w.length >= 8);
  const complexRatio = longWords.length / words.length;
  
  if (complexRatio > 0.2 || avgWordLength > 6) return 'advanced';
  if (complexRatio < 0.08 && avgWordLength < 5) return 'simple';
  return 'moderate';
}

// Count transition words
function countTransitions(text: string): number {
  const matches = text.match(/\b(However|Therefore|Moreover|Furthermore|Additionally|Consequently|Nevertheless|Thus|Hence|Meanwhile|In addition|On the other hand|As a result|For example|In contrast|Similarly|Also|Besides|Actually|Basically)\b/gi) || [];
  return matches.length;
}

// ============================================================================
// N-GRAM SIMILARITY — Cosine similarity on n-gram distributions
// ============================================================================

function calculateNgramSimilarity(text1: string, text2: string, n: number = 2): number {
  const getNgrams = (text: string, size: number): Map<string, number> => {
    const words = text.toLowerCase().replace(/[.,!?;:()\"\"\"'']/g, '').split(/\s+/).filter(w => w.length > 0);
    const ngrams = new Map<string, number>();
    for (let i = 0; i <= words.length - size; i++) {
      const ngram = words.slice(i, i + size).join(' ');
      ngrams.set(ngram, (ngrams.get(ngram) || 0) + 1);
    }
    return ngrams;
  };

  const ngrams1 = getNgrams(text1, n);
  const ngrams2 = getNgrams(text2, n);
  if (ngrams1.size === 0 || ngrams2.size === 0) return 0;

  let dotProduct = 0;
  let magnitude1 = 0;
  let magnitude2 = 0;
  const allNgrams = new Set([...ngrams1.keys(), ...ngrams2.keys()]);
  for (const ngram of allNgrams) {
    const v1 = ngrams1.get(ngram) || 0;
    const v2 = ngrams2.get(ngram) || 0;
    dotProduct += v1 * v2;
    magnitude1 += v1 * v1;
    magnitude2 += v2 * v2;
  }

  const magnitude = Math.sqrt(magnitude1) * Math.sqrt(magnitude2);
  return magnitude > 0 ? dotProduct / magnitude : 0;
}

// ============================================================================
// LEXICAL DENSITY — Content words vs function words ratio
// ============================================================================

function calculateLexicalDensity(text: string): number {
  const words = text.toLowerCase().match(/[a-z']{2,}/g) || [];
  if (words.length === 0) return 0;
  const functionWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
    'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
    'will', 'would', 'should', 'could', 'can', 'may', 'might', 'must', 'shall',
    'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
    'my', 'your', 'his', 'its', 'our', 'their', 'this', 'that', 'these', 'those',
    'as', 'if', 'when', 'where', 'why', 'how', 'which', 'who', 'whom', 'what',
    'am', 'from', 'up', 'out', 'so', 'than', 'then', 'there', 'about', 'over', 'under',
    'not', 'no', 'nor', 'very', 'just', 'only', 'also', 'even'
  ]);
  const contentWords = words.filter(w => !functionWords.has(w)).length;
  return Math.max(0, Math.min(1, contentWords / words.length));
}

// ============================================================================
// SENTENCE LENGTH STD DEV — Measures "burstiness" of sentence lengths
// ============================================================================

function calculateSentenceLengthStd(text: string): number {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 5);
  if (sentences.length < 2) return 0;
  const lengths = sentences.map(s => s.trim().split(/\s+/).length);
  const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const variance = lengths.reduce((sum, l) => sum + Math.pow(l - mean, 2), 0) / lengths.length;
  return Math.sqrt(variance);
}

// ============================================================================
// PASSIVE VOICE RATIO
// ============================================================================

function getPassiveVoiceRatio(text: string): number {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 5);
  if (sentences.length === 0) return 0;
  const passiveMatches = text.match(/\b(?:is|are|was|were|been|be|being)\s+(?:\w+ed|written|shown|seen|known|given|taken|made|done|found|said|told|thought|felt|become)\b/gi) || [];
  return passiveMatches.length / sentences.length;
}

// ============================================================================
// PUNCTUATION COMPARISON
// ============================================================================

function comparePunctuation(sampleText: string, output: string): number {
  const getSentenceCount = (t: string) => t.split(/[.!?]+/).filter(s => s.trim().length > 5).length || 1;

  const userSentences = getSentenceCount(sampleText);
  const outputSentences = getSentenceCount(output);

  // Comma density
  const userCommaRate = (sampleText.match(/,/g) || []).length / userSentences;
  const outputCommaRate = (output.match(/,/g) || []).length / outputSentences;
  const commaScore = Math.abs(userCommaRate - outputCommaRate) < 1 ? 100 : Math.abs(userCommaRate - outputCommaRate) < 2 ? 70 : 40;

  // Semicolon usage match
  const userSemicolons = (sampleText.match(/;/g) || []).length > 0;
  const outputSemicolons = (output.match(/;/g) || []).length > 0;
  const semiScore = userSemicolons === outputSemicolons ? 100 : 50;

  // Dash usage match
  const userDashes = (sampleText.match(/—|–|-{2}/g) || []).length > 0;
  const outputDashes = (output.match(/—|–|-{2}/g) || []).length > 0;
  const dashScore = userDashes === outputDashes ? 100 : 50;

  return Math.round(commaScore * 0.5 + semiScore * 0.25 + dashScore * 0.25);
}

// ============================================================================
// PRONOUN USAGE COMPARISON
// ============================================================================

function comparePronounUsage(sampleText: string, output: string): number {
  const getWordCount = (t: string) => (t.match(/\b[a-z]+\b/gi) || []).length || 1;

  // First person pronouns
  const fp = /\b(I|me|my|mine|we|us|our|ours|myself|ourselves)\b/g;
  const userFP = (sampleText.match(fp) || []).length / getWordCount(sampleText);
  const outputFP = (output.match(fp) || []).length / getWordCount(output);

  // Second person pronouns
  const sp = /\b(you|your|yours|yourself|yourselves)\b/gi;
  const userSP = (sampleText.match(sp) || []).length / getWordCount(sampleText);
  const outputSP = (output.match(sp) || []).length / getWordCount(output);

  // Compare ratios — both first and second person
  const fpDiff = Math.abs(userFP - outputFP);
  const spDiff = Math.abs(userSP - outputSP);

  const fpScore = fpDiff < 0.02 ? 100 : fpDiff < 0.05 ? 75 : fpDiff < 0.1 ? 50 : 25;
  const spScore = spDiff < 0.02 ? 100 : spDiff < 0.04 ? 75 : spDiff < 0.08 ? 50 : 25;

  return Math.round(fpScore * 0.6 + spScore * 0.4);
}

// ============================================================================
// SENTENCE RHYTHM DESCRIPTION — For enhanced prompting
// ============================================================================

function describeSentenceRhythm(userSample: string): string {
  const sentences = userSample.split(/[.!?]+/).filter(s => s.trim().length > 5);
  if (sentences.length < 3) return '';

  const lengths = sentences.map(s => s.trim().split(/\s+/).length);
  const categories = lengths.map(l => {
    if (l <= 8) return 'short';
    if (l <= 15) return 'medium';
    if (l <= 22) return 'long';
    return 'very-long';
  });

  const dist: Record<string, number> = {};
  categories.forEach(c => { dist[c] = (dist[c] || 0) + 1; });
  const total = categories.length;

  const parts: string[] = [];
  if (dist['short']) parts.push(`${Math.round((dist['short'] / total) * 100)}% short (≤8 words)`);
  if (dist['medium']) parts.push(`${Math.round((dist['medium'] / total) * 100)}% medium (9-15 words)`);
  if (dist['long']) parts.push(`${Math.round((dist['long'] / total) * 100)}% long (16-22 words)`);
  if (dist['very-long']) parts.push(`${Math.round((dist['very-long'] / total) * 100)}% very long (23+ words)`);

  let rhythmDesc = `Sentence length mix: ${parts.join(', ')}.`;

  // Check for consecutive same-length sentences
  let maxConsecutive = 1;
  let current = 1;
  for (let i = 1; i < categories.length; i++) {
    if (categories[i] === categories[i - 1]) {
      current++;
      maxConsecutive = Math.max(maxConsecutive, current);
    } else {
      current = 1;
    }
  }

  if (maxConsecutive <= 2) {
    rhythmDesc += ' They vary length frequently — rarely write 2+ sentences of the same length in a row.';
  }

  return rhythmDesc;
}

// ============================================================================
// FEW-SHOT STYLE EXAMPLES — Show the AI "before/after" in the user's style
// ============================================================================

function generateFewShotExamples(userSample: string, analysis: ReturnType<typeof analyzeStyle>): string {
  const sentences = userSample.split(/[.!?]+/).map(s => s.trim()).filter(s => {
    const wc = s.split(/\s+/).length;
    return wc >= 6 && wc <= 30;
  });
  if (sentences.length < 2) return '';

  // Pick 2-3 diverse, characteristic sentences
  const examples = sentences.slice(0, 3);

  let result = '\nSTYLE TRANSFORMATION EXAMPLES — This is how this person rewrites generic ideas:\n\n';

  for (const sentence of examples) {
    const generic = deStyleSentence(sentence, analysis);
    if (generic !== sentence && generic.length > 10) {
      result += `Generic: "${generic}"\n`;
      result += `Their style: "${sentence}"\n\n`;
    }
  }

  return result.trim() === 'STYLE TRANSFORMATION EXAMPLES — This is how this person rewrites generic ideas:' ? '' : result;
}

function deStyleSentence(sentence: string, analysis: ReturnType<typeof analyzeStyle>): string {
  let generic = sentence;

  // Invert contraction style to create contrast
  if (analysis.usesContractions) {
    generic = generic
      .replace(/\bdon't\b/gi, 'do not').replace(/\bcan't\b/gi, 'cannot')
      .replace(/\bwon't\b/gi, 'will not').replace(/\bisn't\b/gi, 'is not')
      .replace(/\baren't\b/gi, 'are not').replace(/\bit's\b/gi, 'it is')
      .replace(/\bthat's\b/gi, 'that is').replace(/\bI'm\b/g, 'I am')
      .replace(/\bI've\b/g, 'I have').replace(/\bthey're\b/gi, 'they are')
      .replace(/\bwe're\b/gi, 'we are').replace(/\byou're\b/gi, 'you are')
      .replace(/\bdidn't\b/gi, 'did not').replace(/\bdoesn't\b/gi, 'does not');
  } else {
    generic = generic
      .replace(/\bdo not\b/gi, "don't").replace(/\bcannot\b/gi, "can't")
      .replace(/\bwill not\b/gi, "won't").replace(/\bis not\b/gi, "isn't")
      .replace(/\bare not\b/gi, "aren't").replace(/\bit is\b/gi, "it's");
  }

  // Flatten casual/formal markers
  if (analysis.vocabularyLevel === 'simple') {
    generic = generic.replace(/\breally\b/gi, 'very').replace(/\bstuff\b/gi, 'things').replace(/\bkind of\b/gi, 'somewhat');
  } else if (analysis.vocabularyLevel === 'advanced') {
    generic = generic.replace(/\butilize\b/gi, 'use').replace(/\bfacilitate\b/gi, 'help').replace(/\bdemonstrate\b/gi, 'show');
  }

  return generic;
}

// ============================================================================
// EXPANDED STYLE MATCHING — 10 dimensions instead of 4
// ============================================================================

// Check style match using SAME logic as StyleProofPanel + 6 new dimensions
function checkStyleMatch(sampleText: string, output: string): {
  contractions: { match: boolean; score: number };
  sentenceLength: { match: boolean; score: number; diff: number };
  vocabulary: { match: boolean; score: number };
  transitions: { match: boolean; score: number };
  lexicalDensity: { match: boolean; score: number };
  sentenceVariety: { match: boolean; score: number };
  passiveVoice: { match: boolean; score: number };
  punctuation: { match: boolean; score: number };
  pronounUsage: { match: boolean; score: number };
  ngramSimilarity: { match: boolean; score: number };
  overallScore: number;
} {
  // 1. CONTRACTIONS
  const userContractions = countContractions(sampleText);
  const userExpanded = countExpanded(sampleText);
  const resultContractions = countContractions(output);
  const resultExpanded = countExpanded(output);
  const userUsesContractions = userContractions > userExpanded;
  const resultUsesContractions = resultContractions > resultExpanded;
  const contractionsMatch = userUsesContractions === resultUsesContractions;

  // 2. SENTENCE LENGTH
  const userAvg = getAvgSentenceLength(sampleText);
  const resultAvg = getAvgSentenceLength(output);
  const lengthDiff = Math.abs(userAvg - resultAvg);
  const sentenceLengthScore = lengthDiff < 3 ? 100 : lengthDiff < 5 ? 85 : lengthDiff < 8 ? 65 : lengthDiff < 12 ? 40 : 0;

  // 3. VOCABULARY
  const userVocab = getVocabularyLevel(sampleText);
  const resultVocab = getVocabularyLevel(output);
  const vocabMatch = userVocab === resultVocab;

  // 4. TRANSITIONS
  const userTransCount = countTransitions(sampleText);
  const resultTransCount = countTransitions(output);
  const userUsesTransitions = userTransCount >= 2;
  const resultUsesTransitions = resultTransCount >= 2;
  const transitionMatch = userUsesTransitions === resultUsesTransitions;

  // 5. LEXICAL DENSITY (NEW)
  const userDensity = calculateLexicalDensity(sampleText);
  const outputDensity = calculateLexicalDensity(output);
  const densityDiff = Math.abs(userDensity - outputDensity);
  const densityScore = densityDiff < 0.05 ? 100 : densityDiff < 0.1 ? 75 : densityDiff < 0.15 ? 50 : 25;

  // 6. SENTENCE LENGTH VARIETY / BURSTINESS (NEW)
  const userStd = calculateSentenceLengthStd(sampleText);
  const outputStd = calculateSentenceLengthStd(output);
  const stdDiff = Math.abs(userStd - outputStd);
  const varietyScore = stdDiff < 3 ? 100 : stdDiff < 5 ? 75 : stdDiff < 8 ? 50 : 25;

  // 7. PASSIVE VOICE RATIO (NEW)
  const userPassive = getPassiveVoiceRatio(sampleText);
  const outputPassive = getPassiveVoiceRatio(output);
  const passiveDiff = Math.abs(userPassive - outputPassive);
  const passiveScore = passiveDiff < 0.1 ? 100 : passiveDiff < 0.2 ? 75 : passiveDiff < 0.3 ? 50 : 25;

  // 8. PUNCTUATION PATTERNS (NEW)
  const punctScore = comparePunctuation(sampleText, output);

  // 9. PERSONAL PRONOUN USAGE (NEW)
  const pronounScore = comparePronounUsage(sampleText, output);

  // 10. N-GRAM SIMILARITY (NEW)
  const bigramSim = calculateNgramSimilarity(sampleText, output, 2);
  const trigramSim = calculateNgramSimilarity(sampleText, output, 3);
  const rawNgram = Math.round((bigramSim * 0.6 + trigramSim * 0.4) * 100);
  // N-gram similarity between different texts is typically low, so grade generously
  const ngramScore = rawNgram > 15 ? 100 : rawNgram > 10 ? 80 : rawNgram > 5 ? 60 : rawNgram > 2 ? 40 : 20;

  // WEIGHTED OVERALL SCORE — 10 dimensions
  const weights = {
    contractions: 15,
    sentenceLength: 12,
    vocabulary: 12,
    transitions: 8,
    lexicalDensity: 10,
    sentenceVariety: 10,
    passiveVoice: 8,
    punctuation: 10,
    pronounUsage: 7,
    ngramSimilarity: 8,
  };
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);

  const overallScore = Math.round(
    ((contractionsMatch ? 100 : 0) * weights.contractions +
    sentenceLengthScore * weights.sentenceLength +
    (vocabMatch ? 100 : 50) * weights.vocabulary +
    (transitionMatch ? 75 : 50) * weights.transitions +
    densityScore * weights.lexicalDensity +
    varietyScore * weights.sentenceVariety +
    passiveScore * weights.passiveVoice +
    punctScore * weights.punctuation +
    pronounScore * weights.pronounUsage +
    ngramScore * weights.ngramSimilarity) / totalWeight
  );

  return {
    contractions: { match: contractionsMatch, score: contractionsMatch ? 100 : 0 },
    sentenceLength: { match: lengthDiff < 5, score: sentenceLengthScore, diff: lengthDiff },
    vocabulary: { match: vocabMatch, score: vocabMatch ? 100 : 50 },
    transitions: { match: transitionMatch, score: transitionMatch ? 75 : 50 },
    lexicalDensity: { match: densityDiff < 0.1, score: densityScore },
    sentenceVariety: { match: stdDiff < 5, score: varietyScore },
    passiveVoice: { match: passiveDiff < 0.15, score: passiveScore },
    punctuation: { match: punctScore >= 70, score: punctScore },
    pronounUsage: { match: pronounScore >= 70, score: pronounScore },
    ngramSimilarity: { match: ngramScore >= 60, score: ngramScore },
    overallScore
  };
}

// Extract key terms from text (nouns, proper nouns, numbers, important words)
function extractKeyTerms(text: string): string[] {
  const words = text.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
  const numbers = text.match(/\b\d+(?:[.,]\d+)?%?\b/g) || [];
  const properNouns = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || [];
  
  // Filter out common stop words
  const stopWords = new Set([
    'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had',
    'her', 'was', 'one', 'our', 'out', 'has', 'have', 'been', 'were', 'they',
    'their', 'what', 'when', 'where', 'which', 'who', 'will', 'with', 'would',
    'this', 'that', 'from', 'about', 'into', 'through', 'during', 'before',
    'after', 'above', 'below', 'between', 'under', 'again', 'further', 'then',
    'once', 'here', 'there', 'when', 'where', 'why', 'how', 'each', 'few',
    'more', 'most', 'other', 'some', 'such', 'only', 'same', 'than', 'too',
    'very', 'just', 'also', 'being', 'because', 'while', 'although', 'though'
  ]);
  
  const significantWords = words.filter(w => !stopWords.has(w) && w.length > 3);
  
  // Get unique terms with frequency
  const wordFreq = new Map<string, number>();
  significantWords.forEach(w => wordFreq.set(w, (wordFreq.get(w) || 0) + 1));
  
  // Return most frequent words plus numbers and proper nouns
  const topWords = Array.from(wordFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([word]) => word);
  
  return [...new Set([...topWords, ...numbers, ...properNouns.map(n => n.toLowerCase())])];
}

// Extract critical data that must NEVER change (numbers, dates, names, percentages)
function extractCriticalData(text: string): { numbers: string[]; dates: string[]; properNouns: string[] } {
  // Numbers (including percentages, decimals, currency)
  const numbers = text.match(/\b\d+(?:[.,]\d+)?%?|\$\d+(?:[.,]\d+)?(?:\s*(?:million|billion|thousand))?/gi) || [];
  
  // Dates (various formats)
  const datePatterns = [
    /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/g, // 12/25/2024, 25-12-2024
    /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:,?\s+\d{4})?\b/gi,
    /\b\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)(?:\s+\d{4})?\b/gi,
    /\b\d{4}\b/g // Years
  ];
  const dates: string[] = [];
  for (const pattern of datePatterns) {
    const matches = text.match(pattern) || [];
    dates.push(...matches);
  }
  
  // Proper nouns (capitalized words that aren't sentence starters)
  const properNouns = text.match(/(?<=[.!?]\s+|^)[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*|(?<=\s)[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g) || [];
  
  return {
    numbers: [...new Set(numbers)],
    dates: [...new Set(dates)],
    properNouns: [...new Set(properNouns.filter(n => n.length > 2))]
  };
}

// Verify critical data is preserved
function checkCriticalDataPreservation(original: string, output: string): { preserved: boolean; missing: string[] } {
  const originalData = extractCriticalData(original);
  const outputText = output;
  const missing: string[] = [];
  
  // Check all numbers are preserved
  for (const num of originalData.numbers) {
    if (!outputText.includes(num)) {
      missing.push(`Number: ${num}`);
    }
  }
  
  // Check dates are preserved (case-insensitive for month names)
  for (const date of originalData.dates) {
    const datePattern = new RegExp(date.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    if (!datePattern.test(outputText)) {
      missing.push(`Date: ${date}`);
    }
  }
  
  // Check important proper nouns (at least 2 words or names of places/people)
  for (const noun of originalData.properNouns) {
    if (noun.split(/\s+/).length >= 2 || noun.length > 4) {
      if (!outputText.toLowerCase().includes(noun.toLowerCase())) {
        missing.push(`Name: ${noun}`);
      }
    }
  }
  
  return {
    preserved: missing.length === 0,
    missing: missing.slice(0, 5)
  };
}

// Check if important content is preserved
function checkContentPreservation(original: string, output: string): { score: number; missing: string[] } {
  const originalTerms = extractKeyTerms(original);
  const outputLower = output.toLowerCase();
  
  const missingTerms: string[] = [];
  let preserved = 0;
  
  for (const term of originalTerms) {
    // Check for exact match or close variations
    const termLower = term.toLowerCase();
    const variations = [
      termLower,
      termLower + 's',
      termLower + 'ed',
      termLower + 'ing',
      termLower.slice(0, -1), // remove last char (plural form check)
    ];
    
    if (variations.some(v => outputLower.includes(v))) {
      preserved++;
    } else {
      missingTerms.push(term);
    }
  }
  
  const score = originalTerms.length > 0 ? Math.round((preserved / originalTerms.length) * 100) : 100;
  return { score, missing: missingTerms.slice(0, 5) }; // Return top 5 missing terms
}

// Check if style rules are followed
function checkStyleCompliance(output: string, profile: any): { score: number; issues: string[] } {
  if (!profile) return { score: 100, issues: [] };
  
  const issues: string[] = [];
  let penalties = 0;
  
  // Get user's contraction preference from their writing
  const sampleText = profile.sampleExcerpts?.join(' ') || profile.sampleExcerpt || '';
  const contractionPattern = /\b(can't|won't|don't|isn't|aren't|wasn't|weren't|hasn't|haven't|hadn't|couldn't|wouldn't|shouldn't|didn't|doesn't|I'm|I've|I'll|I'd|you're|you've|you'll|you'd|we're|we've|we'll|we'd|they're|they've|they'll|they'd|he's|she's|it's|that's|there's|here's|what's|who's|let's)\b/gi;
  const userUsesContractions = (sampleText.match(contractionPattern) || []).length > 0;
  
  // Check if output follows user's contraction preference
  const outputContractions = (output.match(contractionPattern) || []).length;
  const outputWords = output.split(/\s+/).length;
  const contractionRate = outputContractions / outputWords;
  
  if (userUsesContractions && contractionRate < 0.01) {
    issues.push('Missing contractions (user prefers them)');
    penalties += 10;
  } else if (!userUsesContractions && contractionRate > 0.02) {
    issues.push('Using contractions (user avoids them)');
    penalties += 10;
  }
  
  // Check sentence length consistency
  const userSentences = sampleText.split(/[.!?]+/).filter((s: string) => s.trim().length > 0);
  const userAvgLength = userSentences.reduce((sum: number, s: string) => sum + s.split(/\s+/).length, 0) / (userSentences.length || 1);
  
  const outputSentences = output.split(/[.!?]+/).filter((s: string) => s.trim().length > 0);
  const outputAvgLength = outputSentences.reduce((sum: number, s: string) => sum + s.split(/\s+/).length, 0) / (outputSentences.length || 1);
  
  const lengthDiff = Math.abs(userAvgLength - outputAvgLength);
  if (lengthDiff > 10) {
    issues.push(`Sentence length differs significantly (${Math.round(outputAvgLength)} vs user's ${Math.round(userAvgLength)})`);
    penalties += 5;
  }
  
  return { score: Math.max(0, 100 - penalties), issues };
}

// Check if layout is preserved (line breaks, paragraphs)
function checkLayoutPreservation(original: string, output: string): { score: number; issues: string[] } {
  const issues: string[] = [];
  let penalties = 0;
  
  // Count paragraphs (double newlines)
  const originalParagraphs = (original.match(/\n\s*\n/g) || []).length + 1;
  const outputParagraphs = (output.match(/\n\s*\n/g) || []).length + 1;
  
  if (originalParagraphs > 1 && outputParagraphs === 1) {
    issues.push('Paragraph breaks were lost');
    penalties += 15;
  }
  
  // Count bullet points
  const originalBullets = (original.match(/^[\s]*[-•*]\s/gm) || []).length;
  const outputBullets = (output.match(/^[\s]*[-•*]\s/gm) || []).length;
  
  if (originalBullets > 0 && outputBullets === 0) {
    issues.push('Bullet points were lost');
    penalties += 10;
  }
  
  // Count numbered lists
  const originalNumbers = (original.match(/^\s*\d+[.)]\s/gm) || []).length;
  const outputNumbers = (output.match(/^\s*\d+[.)]\s/gm) || []).length;
  
  if (originalNumbers > 0 && outputNumbers === 0) {
    issues.push('Numbered list was lost');
    penalties += 10;
  }
  
  return { score: Math.max(0, 100 - penalties), issues };
}

// Main verification function - uses SAME logic as StyleProofPanel for consistency
function verifyOutput(original: string, output: string, profile: any): VerificationResult {
  const issues: VerificationIssue[] = [];
  const fixes: AutoFix[] = [];
  
  // Get user's sample text
  const sampleText = profile?.sampleExcerpts?.join(' ') || profile?.sampleExcerpt || '';
  
  // Default style breakdown
  let styleBreakdown: any = {
    contractions: { match: true, score: 100 },
    sentenceLength: { match: true, score: 100, diff: 0 },
    vocabulary: { match: true, score: 100 },
    transitions: { match: true, score: 75 },
    lexicalDensity: { match: true, score: 100 },
    sentenceVariety: { match: true, score: 100 },
    passiveVoice: { match: true, score: 100 },
    punctuation: { match: true, score: 100 },
    pronounUsage: { match: true, score: 100 },
    ngramSimilarity: { match: true, score: 100 }
  };
  
  let styleScore = 100;
  
  // Check style match if user has a profile
  if (sampleText.length > 50) {
    const styleMatch = checkStyleMatch(sampleText, output);
    styleBreakdown = styleMatch;
    styleScore = styleMatch.overallScore;
    
    // Add issues for style mismatches
    if (!styleMatch.contractions.match) {
      const userContractions = countContractions(sampleText);
      const userExpanded = countExpanded(sampleText);
      const userUsesContractions = userContractions > userExpanded;
      issues.push({
        type: 'style_mismatch',
        severity: 'medium',
        description: userUsesContractions 
          ? 'Output should use contractions (like your writing)'
          : 'Output should avoid contractions (like your writing)'
      });
      
      // Generate fixes for contractions
      if (userUsesContractions) {
        const expandedForms = output.match(/\b(cannot|will not|do not|does not|did not|is not|are not|was not|were not|have not|has not|had not)\b/gi) || [];
        for (const expanded of expandedForms) {
          const expandedLower = expanded.toLowerCase();
          const contractionMap: Record<string, string> = {
            'cannot': "can't", 'will not': "won't", 'do not': "don't",
            'does not': "doesn't", 'did not': "didn't", 'is not': "isn't",
            'are not': "aren't", 'was not': "wasn't", 'were not': "weren't",
            'have not': "haven't", 'has not': "hasn't", 'had not': "hadn't"
          };
          if (contractionMap[expandedLower]) {
            fixes.push({
              type: 'contraction',
              original: expanded,
              fixed: contractionMap[expandedLower]
            });
          }
        }
      }
    }
    
    if (!styleMatch.sentenceLength.match && styleMatch.sentenceLength.diff > 8) {
      issues.push({
        type: 'style_mismatch',
        severity: 'low',
        description: `Sentence length differs by ${Math.round(styleMatch.sentenceLength.diff)} words from your style`
      });
    }
    
    if (!styleMatch.vocabulary.match) {
      issues.push({
        type: 'style_mismatch',
        severity: 'low',
        description: 'Vocabulary complexity differs from your writing style'
      });
    }
  }
  
  // Check content preservation
  const contentCheck = checkContentPreservation(original, output);
  if (contentCheck.score < 80) {
    issues.push({
      type: 'content_loss',
      severity: contentCheck.score < 50 ? 'high' : 'medium',
      description: `Some key terms may be missing: ${contentCheck.missing.slice(0, 3).join(', ')}`
    });
  }
  
  // Check critical data (numbers, dates, names)
  const criticalCheck = checkCriticalDataPreservation(original, output);
  if (!criticalCheck.preserved) {
    issues.push({
      type: 'meaning_changed',
      severity: 'high',
      description: `Important data may have changed: ${criticalCheck.missing.slice(0, 2).join(', ')}`
    });
  }
  
  // Check layout preservation
  const layoutCheck = checkLayoutPreservation(original, output);
  if (layoutCheck.score < 100) {
    for (const issue of layoutCheck.issues) {
      issues.push({
        type: 'layout_broken',
        severity: 'medium',
        description: issue
      });
    }
  }
  
  // Calculate final score - style is 60% weight (matches StyleProofPanel importance)
  // Content is 25%, Layout is 15%
  const criticalPenalty = criticalCheck.preserved ? 0 : 20;
  const finalScore = Math.max(0, Math.round(
    (styleScore * 0.60) +
    (contentCheck.score * 0.25) +
    (layoutCheck.score * 0.15)
  ) - criticalPenalty);
  
  return {
    score: finalScore,
    passed: finalScore >= 70,
    issues,
    fixes,
    styleBreakdown
  };
}

// Apply automatic fixes to output
function applyAutomaticFixes(output: string, fixes: AutoFix[], original: string, profile: any): string {
  let fixed = output;
  
  // Apply contraction fixes
  for (const fix of fixes) {
    if (fix.type === 'contraction') {
      const regex = new RegExp(`\\b${fix.original}\\b`, 'gi');
      fixed = fixed.replace(regex, fix.fixed);
    }
  }
  
  // Restore layout if broken
  const originalParagraphs = original.split(/\n\s*\n/).length;
  const outputParagraphs = fixed.split(/\n\s*\n/).length;
  
  if (originalParagraphs > 1 && outputParagraphs === 1) {
    // Try to restore paragraph breaks based on sentence count
    const sentences = fixed.split(/(?<=[.!?])\s+/);
    const sentencesPerParagraph = Math.ceil(sentences.length / originalParagraphs);
    
    if (sentencesPerParagraph > 1) {
      const paragraphs: string[] = [];
      for (let i = 0; i < sentences.length; i += sentencesPerParagraph) {
        paragraphs.push(sentences.slice(i, i + sentencesPerParagraph).join(' '));
      }
      fixed = paragraphs.join('\n\n');
    }
  }
  
  return fixed;
}

export const runtime = 'nodejs';

function createNeutralVerification(): VerificationResult {
  return {
    score: 100,
    issues: [],
    fixes: [],
    passed: true,
    styleBreakdown: {
      contractions: { match: true, score: 100 },
      sentenceLength: { match: true, score: 100, diff: 0 },
      vocabulary: { match: true, score: 100 },
      transitions: { match: true, score: 75 },
      lexicalDensity: { match: true, score: 100 },
      sentenceVariety: { match: true, score: 100 },
      passiveVoice: { match: true, score: 100 },
      punctuation: { match: true, score: 100 },
      pronounUsage: { match: true, score: 100 },
      ngramSimilarity: { match: true, score: 100 }
    }
  };
}

function buildRoboticsFallback(text: string): string {
  const trimmed = text.trim();
  const hasCode = /(?:#include|void\s+setup|void\s+loop|digitalWrite|analogWrite|pinMode|def\s+\w+|import\s+\w+|class\s+\w+|=\s*[\w.]+\(|for\s*\(|while\s*\()/i.test(trimmed);

  return [
    'Paraphrased version',
    '',
    cleanText(trimmed),
    '',
    'Detailed robotics explanation',
    '',
    hasCode
      ? '- This appears to include robotics or programming code. Check each library, pin, sensor, motor, and control statement against your actual robot setup.'
      : '- This text appears to describe a robotics idea. Check the robot parts, input sensors, output actuators, and intended behavior.',
    '- The system could not reach an AI model, so this fallback preserves the original meaning without adding unsupported technical details.',
    '- For final work, verify hardware names, pin numbers, wiring, units, and safety limits before using the explanation.'
  ].join('\n');
}

function buildRoboticsPrompt(): string {
  return `You are a robotics paraphrasing and explanation assistant for a student project.

Your job is to rewrite the user's robotics-related text in clearer original wording, then explain the technical details so a robotics learner can understand them.

OUTPUT FORMAT:

Paraphrased version
[Rewrite the text in original wording. Keep the same meaning, facts, numbers, code identifiers, hardware names, pin numbers, units, and sequence.]

Detailed robotics explanation
[Explain every important detail in plain language.]

If the input contains code:
- Preserve code blocks exactly when quoting them for reference.
- Explain each library/import, variable, pin assignment, setup function, loop function, condition, sensor read, motor/servo action, delay/timing value, and control-flow statement.
- Explain what each part does in the robot, not just what it means in programming.
- Mention possible hardware involved, such as Arduino, Raspberry Pi, ESP32, sensors, motors, servos, drivers, relays, or power supply, only when the input supports it.
- Do not invent parts, wiring, pin numbers, calibration values, or results.

If the input is not code:
- Explain the robotics concept, the likely robot components involved, the inputs, the outputs, and the step-by-step process.
- Keep the explanation useful for someone who likes robotics and may need to defend the project.

Rules:
- Focus on robotics, electronics, programming logic, automation, sensors, actuators, and control systems.
- Keep the paraphrase academically acceptable and easy to understand.
- Do not answer with only a summary. The explanation must teach the details.
- Do not add citations or claims that are not in the input.
- Do not include generic AI disclaimers.
- Use clear headings and bullets when helpful.
- DO NOT act as a dictionary. DO NOT define or explain words even if the input is short. Just rewrite it.`;
}

// =============================================================================
// FACTUAL VERIFICATION
// =============================================================================

async function verifyFactualAccuracy(text: string): Promise<{ isTrue: boolean, reason: string }> {
  const prompt = `You are a strict fact-checking assistant. Evaluate the factual accuracy of the user's input text.
If it contains objectively false claims, respond with JSON {"isFactuallyAccurate": false, "reason": "<explanation of why it is false>"}.
If it is true, subjective, an opinion, or harmless, respond with {"isFactuallyAccurate": true, "reason": ""}.
Only output the JSON object. Do not add any other text or markdown formatting.`;

  try {
    const hasGroqKey = !!process.env.GROQ_API_KEY;
    const hasGeminiKey = !!process.env.GEMINI_API_KEY;
    let resultJsonStr = '';

    if (hasGroqKey) {
      resultJsonStr = await callGroqAPI(text, prompt, 0.1, false);
    } else if (hasGeminiKey) {
      resultJsonStr = await callGeminiAPI(text, prompt, 0.1, false);
    } else {
      return { isTrue: true, reason: '' };
    }

    resultJsonStr = resultJsonStr.replace(/```json\n?|```/gi, '').trim();
    const parsed = JSON.parse(resultJsonStr);
    
    if (parsed && typeof parsed.isFactuallyAccurate === 'boolean') {
      return {
        isTrue: parsed.isFactuallyAccurate,
        reason: parsed.reason || 'Text contains false information'
      };
    }
    return { isTrue: true, reason: '' };
  } catch (error) {
    console.error('Fact checking failed:', error);
    return { isTrue: true, reason: '' };
  }
}

// Generate style preset verification/proof explanation
async function generateStylePresetExplanation(
  originalText: string,
  paraphrasedText: string,
  stylePreset: string
): Promise<string> {
  const systemPrompt = `You are a style analysis assistant. The user requested to rewrite a text into the "${stylePreset}" writing style.
We have successfully generated the paraphrased version. Your job is to analyze both the original and rewritten text, and provide a concise, convincing "proof" or explanation (3-4 bullet points) demonstrating exactly why the output qualifies as "${stylePreset}".

Be specific. Quote 1 or 2 brief examples (words or phrases) from the original vs the paraphrased text to show the contrast and prove the style transfer was done correctly.

Focus on elements relevant to "${stylePreset}":
- If "creative": highlight vivid imagery, expressive adjectives, varied rhythm, or metaphorical/impactful phrasing.
- If "professional": highlight conciseness, directness, business-appropriate vocabulary, or action-oriented tone.
- If "academic": highlight objective tone, lack of personal pronouns, precise scholarly vocabulary, and formal structure.
- If "formal": highlight complete sentences, sophisticated syntax, and absence of informal contractions.
- If "casual": highlight conversational flow, contractions, friendly tone, and natural phrasing.

Format the output as a clean bulleted list. Do not include introductory or concluding remarks (like "Here is the analysis:"). Just output the bullet points.`;

  const userContent = `ORIGINAL TEXT:
"""
${originalText}
"""

PARAPHRASED TEXT:
"""
${paraphrasedText}
"""

Provide the style preset proof explanation:`;

  try {
    const hasGroqKey = !!process.env.GROQ_API_KEY;
    const hasGeminiKey = !!process.env.GEMINI_API_KEY;

    if (hasGroqKey) {
      const GroqMod = await import('groq-sdk');
      const Groq = (GroqMod as any).default ?? (GroqMod as any).Groq;
      const client = new Groq({ apiKey: process.env.GROQ_API_KEY });
      const completion = await client.chat.completions.create({
        model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
        temperature: 0.3,
        max_tokens: 1000,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent }
        ]
      });
      return completion.choices?.[0]?.message?.content?.trim() || '';
    } else if (hasGeminiKey) {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: `${systemPrompt}\n\n${userContent}` }]
          }],
          generationConfig: { 
            temperature: 0.3, 
            maxOutputTokens: 1000 
          }
        })
      });
      if (!response.ok) throw new Error(`Gemini error: ${response.status}`);
      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    }
    return '';
  } catch (error) {
    console.error('Failed to generate style explanation:', error);
    return '';
  }
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
    const rl = rateLimit(`paraphrase:${ip}`);
    if (rl.limited) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded. Try later.' }), { 
        status: 429, 
        headers: { 'Content-Type': 'application/json', ...formatRateLimitHeaders(rl) } 
      });
    }

    const json = await req.json();
    const { text, useModel, profile, stylePreset, styleInstructions, paraphraseMode = 'style' } = bodySchema.parse(json);
    const isRoboticsMode = paraphraseMode === 'robotics';

    const hasGroqKey = !!process.env.GROQ_API_KEY;
    const hasGeminiKey = !!process.env.GEMINI_API_KEY;
    const canUseAI = hasGroqKey || hasGeminiKey;
    
    let output: string;
    let usedAIModel = false;
    let verificationResult: VerificationResult;
    
    if (canUseAI && (useModel ?? true)) {
      // Run factual verification first
      const factCheck = await verifyFactualAccuracy(text);
      if (!factCheck.isTrue) {
        return new Response(JSON.stringify({ 
          error: 'FACT_CHECK_FAILED', 
          message: factCheck.reason 
        }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }

      // Use AI to paraphrase with the selected mode
      output = await paraphraseWithAI(
        text,
        isRoboticsMode ? null : profile,
        isRoboticsMode ? 'original' : stylePreset,
        isRoboticsMode ? null : styleInstructions,
        paraphraseMode
      );
      usedAIModel = true;
      
      // Verify output quality and fix issues
      verificationResult = isRoboticsMode ? createNeutralVerification() : verifyOutput(text, output, profile);
      
      // Apply automatic fixes if issues detected
      if (!isRoboticsMode && verificationResult.fixes.length > 0) {
        output = applyAutomaticFixes(output, verificationResult.fixes, text, profile);
        // Re-verify after fixes
        verificationResult = verifyOutput(text, output, profile);
      }
      
      // If quality is still below threshold, try with TARGETED correction prompt (up to 2 retries)
      if (!isRoboticsMode && verificationResult.score < 75 && profile?.sampleExcerpt) {
        console.log('Quality below 75 (' + verificationResult.score + '), retrying with targeted correction (attempt 1)...');
        const retryOutput = await retryWithCorrection(text, output, profile, verificationResult, stylePreset, styleInstructions);
        const retryVerification = verifyOutput(text, retryOutput, profile);
        
        // Use retry if it's better
        if (retryVerification.score > verificationResult.score) {
          output = retryOutput;
          verificationResult = retryVerification;
        }
        
        // Second retry if still below threshold
        if (verificationResult.score < 75) {
          console.log('Still below 75 (' + verificationResult.score + '), retrying (attempt 2)...');
          const retry2Output = await retryWithCorrection(text, output, profile, verificationResult, stylePreset, styleInstructions);
          const retry2Verification = verifyOutput(text, retry2Output, profile);
          
          if (retry2Verification.score > verificationResult.score) {
            output = retry2Output;
            verificationResult = retry2Verification;
          }
        }
      }
    } else {
      // Simple fallback - just return cleaned text
      output = isRoboticsMode ? buildRoboticsFallback(text) : cleanText(text);
      verificationResult = createNeutralVerification();
    }

    // Apply deep style matching from deepStyleMatch.ts (uses the dormant module)
    if (!isRoboticsMode && profile?.sampleExcerpt && profile.sampleExcerpt.length > 50) {
      try {
        output = applyDeepStyleMatch(output, profile);
      } catch (e) {
        // Non-critical — continue if deep match fails
        console.log('DeepStyleMatch skipped:', (e as any)?.message);
      }
    }

    // Apply user's style post-processing (strict contraction/expansion enforcement)
    if (!isRoboticsMode && (profile?.sampleExcerpt || profile?.sampleExcerpts?.length)) {
      output = applyUserStyle(output, profile);
      // Final verification after style application
      verificationResult = verifyOutput(text, output, profile);
    }

    // Calculate style match
    const styleMatch = isRoboticsMode
      ? { overallMatch: 100, details: ['Robotics explainer mode does not use a writing-style profile'] }
      : calculateStyleMatch(output, profile);

    // Calculate detailed metrics for the style lock panel
    const outputMetrics = calculateOutputMetrics(output, profile);

    // Generate explanation for preset style choices
    let presetExplanation = '';
    if (usedAIModel && !isRoboticsMode && stylePreset && stylePreset !== 'original') {
      presetExplanation = await generateStylePresetExplanation(text, output, stylePreset);
    }

    return new Response(JSON.stringify({ 
      result: output, 
      usedModel: usedAIModel,
      metrics: outputMetrics,
      actions: outputMetrics.actions,
      styleMatch,
      verification: verificationResult,
      paraphraseMode,
      presetExplanation
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...formatRateLimitHeaders(rl) }
    });
  } catch (err: any) {
    console.error('Paraphrase error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Bad Request' }), { status: 400 });
  }
}

// =============================================================================
// AI PARAPHRASE
// =============================================================================

async function paraphraseWithAI(
  text: string, 
  profile: any, 
  stylePreset?: string, 
  styleInstructions?: string | null,
  paraphraseMode: 'style' | 'robotics' = 'style'
): Promise<string> {
  const prompt = paraphraseMode === 'robotics'
    ? buildRoboticsPrompt()
    : buildPrompt(profile, stylePreset, styleInstructions);
  const temp = paraphraseMode === 'robotics'
    ? 0.3
    : profile?.sampleExcerpt ? 0.35 : 0.55; // Lower temp for exact style matching
  const shouldCleanOutput = paraphraseMode !== 'robotics';
  
  try {
    return await callGroqAPI(text, prompt, temp, shouldCleanOutput);
  } catch (e: any) {
    console.log('Groq failed, trying Gemini:', e?.message);
    try {
      return await callGeminiAPI(text, prompt, temp, shouldCleanOutput);
    } catch (e2: any) {
      console.log('Gemini also failed:', e2?.message);
      return paraphraseMode === 'robotics' ? buildRoboticsFallback(text) : cleanText(text);
    }
  }
}

// Retry with a targeted correction prompt that tells the AI specifically what went wrong
async function retryWithCorrection(
  originalText: string,
  previousOutput: string,
  profile: any,
  verification: VerificationResult,
  stylePreset?: string,
  styleInstructions?: string | null
): Promise<string> {
  const sampleText = profile.sampleExcerpts?.length 
    ? profile.sampleExcerpts.join('\n\n').slice(0, 2000)
    : (profile.sampleExcerpt || '').slice(0, 2000);
  
  const analysis = analyzeStyle(sampleText);
  
  // Build specific correction instructions based on what failed
  const corrections: string[] = [];
  
  if (!verification.styleBreakdown.contractions.match) {
    if (analysis.usesContractions) {
      corrections.push('You MUST use contractions (don\'t, it\'s, can\'t, won\'t, I\'m, they\'re). The previous attempt used expanded forms which is WRONG.');
    } else {
      corrections.push('You MUST NOT use contractions. Write "do not" instead of "don\'t", "it is" instead of "it\'s". The previous attempt used contractions which is WRONG.');
    }
  }
  
  if (!verification.styleBreakdown.sentenceLength.match) {
    corrections.push(`Your sentences are the WRONG length. Target ${Math.round(analysis.avgWordsPerSentence)} words per sentence. The previous attempt had sentences that were too ${verification.styleBreakdown.sentenceLength.diff > 0 ? 'long' : 'short'}.`);
  }
  
  if (!verification.styleBreakdown.vocabulary.match) {
    corrections.push(`Your vocabulary complexity is WRONG. This person uses ${analysis.vocabularyLevel} vocabulary. Match their word complexity level.`);
  }
  
  for (const issue of verification.issues) {
    if (issue.type === 'content_loss' && issue.severity !== 'low') {
      corrections.push(`CRITICAL: You lost important content. ${issue.description}. Preserve ALL original facts and information.`);
    }
    if (issue.type === 'meaning_changed') {
      corrections.push(`CRITICAL: ${issue.description}. Never change numbers, dates, or names.`);
    }
  }

  const correctionPrompt = `You are correcting a FAILED style rewrite. The previous attempt did not match the writer's style and sounded too much like AI.

HERE IS HOW THIS PERSON ACTUALLY WRITES:
---
${sampleText.slice(0, 1500)}
---

WHAT WENT WRONG (FIX THESE):
${corrections.map((c, i) => `${i + 1}. ${c}`).join('\n')}
${corrections.length + 1}. The output sounds like AI wrote it. Make it sound human — vary sentence openings, avoid formulaic transition chains, and write naturally.

PREVIOUS BAD ATTEMPT (for reference of what NOT to do):
---
${previousOutput.slice(0, 1000)}
---

Now rewrite the ORIGINAL TEXT below to sound EXACTLY like the person above. Fix every issue listed.
Do NOT use AI-sounding phrases like "It is important to note", "plays a crucial role", "In today's world", "serves as a", etc.
Do NOT use perfectly parallel sentence structures. Real people vary their writing.
${analysis.usesContractions ? 'CONTRACTIONS: ALWAYS USE (don\'t, it\'s, can\'t, won\'t)' : 'CONTRACTIONS: NEVER USE (do not, it is, cannot, will not)'}
SENTENCE LENGTH: Target ${Math.round(analysis.avgWordsPerSentence)} words per sentence
VOCABULARY: ${analysis.vocabularyLevel}
PRESERVE: All facts, data, numbers, names, and layout structure

OUTPUT: Only the rewritten text. No explanations.`;

  try {
    return await callGroqAPI(originalText, correctionPrompt, 0.35);
  } catch {
    try {
      return await callGeminiAPI(originalText, correctionPrompt, 0.35);
    } catch {
      return previousOutput; // Fall back to previous output
    }
  }
}

function buildPrompt(profile: any, stylePreset?: string, styleInstructions?: string | null): string {
  // Preset style (formal, casual, etc.)
  if (stylePreset && stylePreset !== 'original' && styleInstructions) {
    return `Transform this text into ${stylePreset} style as if YOU wrote it originally.

${styleInstructions}

RULES:
- Rewrite completely in your own words
- Keep all information and facts
- Use natural, precise wording. Do not swap words for awkward synonyms.
- Never write phrases like "significantly necessary", "significantly intended", or "significantly required".
- PRESERVE THE EXACT STRUCTURE: Keep all line breaks, paragraphs, and bullet points in the same positions
- Output ONLY the rewritten text. DO NOT act as a dictionary. DO NOT define or explain words even if the input is short.`;
  }

  // No user samples - simple paraphrase
  if (!profile?.sampleExcerpt) {
    return `Rewrite this text in your own words. Keep all the information but express it differently.

IMPORTANT: Preserve the exact layout - keep all line breaks, paragraphs, bullet points, and numbered lists in the same positions as the original.
Use natural, precise wording. Do not force awkward synonyms or phrases like "significantly necessary", "significantly intended", or "significantly required".

Output only the rewritten text. DO NOT act as a dictionary. DO NOT define or explain words even if the input is short.`;
  }

  // Get the user's sample(s)
  const allSamples = profile.sampleExcerpts?.length 
    ? profile.sampleExcerpts.join('\n\n')
    : profile.sampleExcerpt;
  const userSample = allSamples.slice(0, 4000);
  const analysis = analyzeStyle(userSample);
  
  // Extract unique words/phrases the user likes to use
  const userWords = extractUserVocabulary(userSample);
  
  // Extract example sentences from user's writing (for demonstration)
  const exampleSentences = extractExampleSentences(userSample, 6);
  
  // Extract paragraph structure patterns
  const paragraphs = userSample.split(/\n\s*\n/).filter((p: string) => p.trim().length > 0);
  const avgSentencesPerParagraph = paragraphs.length > 0
    ? Math.round(paragraphs.reduce((sum: number, p: string) => sum + p.split(/[.!?]+/).filter((s: string) => s.trim().length > 5).length, 0) / paragraphs.length)
    : 4;
  
  // Detect punctuation patterns
  const sentences = userSample.split(/[.!?]+/).filter((s: string) => s.trim().length > 5);
  const commaCount = (userSample.match(/,/g) || []).length;
  const commaPerSentence = sentences.length > 0 ? (commaCount / sentences.length).toFixed(1) : '1';
  const usesSemicolons = (userSample.match(/;/g) || []).length > 0;
  const usesDashes = (userSample.match(/—|–|-{2}/g) || []).length > 0;
  const usesColons = (userSample.match(/:/g) || []).length > 1;
  
  // Detect passive voice usage
  const passiveMatches = userSample.match(/\b(?:is|are|was|were|been|be|being)\s+(?:\w+ed|written|shown|seen|known|given|taken|made|done|found|said|told|thought|felt|become)\b/gi) || [];
  const passiveRatio = sentences.length > 0 ? passiveMatches.length / sentences.length : 0;
  
  // Detect sentence length variety
  const sentenceLengths = sentences.map((s: string) => s.trim().split(/\s+/).length);
  const shortSentences = sentenceLengths.filter((l: number) => l <= 8).length;
  const longSentences = sentenceLengths.filter((l: number) => l >= 20).length;
  const hasMixedLengths = shortSentences > 0 && longSentences > 0;
  
  // Extract 3-word phrases
  const threeWordPhrases = extractMultiWordPhrases(userSample, 3);

  // SENTENCE LENGTH - Critical for matching their voice
  const avgWords = Math.round(analysis.avgWordsPerSentence);
  const minWords = Math.max(5, avgWords - 5);
  const maxWords = avgWords + 5;

  // Detect human quirks from the sample
  const startsWithConjunction = sentences.filter((s: string) => /^\s*(And|But|So|Or|Yet)\b/i.test(s)).length;
  const conjunctionStartRate = sentences.length > 0 ? startsWithConjunction / sentences.length : 0;
  const usesParenthetical = (userSample.match(/\(.*?\)/g) || []).length > 0;
  const sentenceLengthsForBuckets = sentences.map((s: string) => s.trim().split(/\s+/).length);
  const veryShort = sentenceLengthsForBuckets.filter((l: number) => l <= 5).length;
  const hasFragments = veryShort > 0;

  // Build a natural, non-formulaic prompt
  let prompt = `You are cloning a person's writing voice. You will receive a sample they wrote, then text to rephrase. Your output must be indistinguishable from the sample — not polished, not improved, not "better." If they write messily, you write messily. If they ramble, you ramble. If they're blunt, you're blunt. Match them exactly.

READ THIS SAMPLE CAREFULLY — absorb the rhythm, the sentence lengths, the word choices, the way ideas connect (or don't):

"""
${userSample.slice(0, 2500)}
"""

Here is what defines this person's voice:

`;

  // Contractions
  if (analysis.usesContractions) {
    prompt += `- They use contractions naturally: "don't", "it's", "can't", "won't", "I'm", "they're". Always contract.\n`;
  } else {
    prompt += `- They write formally without contractions: "do not", "it is", "cannot", "will not". Never contract.\n`;
  }

  // Sentence length
  prompt += `- Their sentences average about ${avgWords} words. `;
  prompt += describeSentenceRhythm(userSample) + '\n';
  
  if (hasMixedLengths) {
    prompt += `They vary sentence length — some short and punchy, some long and flowing.\n`;
  } else if (avgWords < 12) {
    prompt += `Short and direct. Keep sentences under ${maxWords} words.\n`;
  } else if (avgWords > 22) {
    prompt += `They write long, developed sentences. Don't break them into short fragments.\n`;
  } else {
    prompt += `Medium length, nothing extreme.\n`;
  }

  // Voice
  if (analysis.usesFirstPerson) {
    prompt += `- They write in first person ("I", "my", "we").\n`;
  }

  // Formality
  if (analysis.formalityLevel === 'casual') {
    prompt += `- Their tone is casual and conversational.\n`;
  } else if (analysis.formalityLevel === 'formal') {
    prompt += `- Their tone is formal and academic.\n`;
  }

  // Vocabulary
  if (analysis.vocabularyLevel === 'advanced') {
    prompt += `- They use sophisticated vocabulary naturally.`;
    if (analysis.complexWords.length > 0) prompt += ` Words like: ${analysis.complexWords.slice(0, 6).join(', ')}.`;
    prompt += `\n`;
  } else if (analysis.vocabularyLevel === 'simple') {
    prompt += `- They use plain, everyday words. Nothing fancy.`;
    if (analysis.simpleWords.length > 0) prompt += ` Words like: ${analysis.simpleWords.slice(0, 6).join(', ')}.`;
    prompt += `\n`;
  }

  // Transitions
  if (analysis.transitions.length > 0) {
    prompt += `- They connect ideas with: ${analysis.transitions.join(', ')}.\n`;
  }

  // Signature words
  if (userWords.length > 0) {
    prompt += `- Words they use often: ${userWords.slice(0, 10).join(', ')}.\n`;
  }

  // Common phrases
  const allPhrases = [...analysis.commonPhrases.slice(0, 4), ...threeWordPhrases.slice(0, 3)];
  if (allPhrases.length > 0) {
    prompt += `- Phrases they repeat: "${allPhrases.join('", "')}".\n`;
  }

  // Sentence starters
  if (analysis.sentenceStarters.length > 0) {
    prompt += `- They often start sentences with: "${analysis.sentenceStarters.slice(0, 5).join('", "')}".\n`;
  }

  // Human quirks
  if (conjunctionStartRate > 0.05) {
    prompt += `- They sometimes start sentences with "And", "But", or "So".\n`;
  }
  if (hasFragments) {
    prompt += `- They occasionally use sentence fragments for effect.\n`;
  }
  if (usesParenthetical) {
    prompt += `- They use parenthetical asides (like this) sometimes.\n`;
  }

  // Punctuation
  if (usesSemicolons) prompt += `- They use semicolons.\n`;
  if (usesDashes) prompt += `- They use dashes for emphasis or asides.\n`;
  if (parseFloat(commaPerSentence) > 2) prompt += `- They use commas frequently (~${commaPerSentence} per sentence).\n`;

  // Passive voice
  if (passiveRatio > 0.2) {
    prompt += `- They use passive voice fairly often.\n`;
  } else if (passiveRatio < 0.05) {
    prompt += `- They strongly prefer active voice.\n`;
  }

  // Questions / exclamations
  if (analysis.questionFrequency > 0.15) prompt += `- They ask rhetorical questions.\n`;
  if (analysis.exclamationFrequency > 0.1) prompt += `- They use exclamation marks sometimes.\n`;

  // Paragraph structure
  if (paragraphs.length > 1) {
    prompt += `- Their paragraphs run about ${avgSentencesPerParagraph} sentences each.\n`;
  }

  // Example sentences
  if (exampleSentences.length > 0) {
    prompt += `\nHere are some of their actual sentences for reference:\n`;
    for (const s of exampleSentences) {
      prompt += `- "${s}"\n`;
    }
  }

  const fewShot = generateFewShotExamples(userSample, analysis);
  if (fewShot) {
    prompt += `\n${fewShot}\n`;
  }

  prompt += `
CRITICAL RULES:
1. Write EXACTLY like the person above. Copy their rhythm, their tone, their imperfections, and their exact level of polish. DO NOT make the text sound more professional or perfect than the sample.
2. ${analysis.usesContractions ? 'ALWAYS use contractions.' : 'NEVER use contractions.'}
3. Keep all facts, numbers, names, and meaning from the original text.
4. Keep the same paragraph structure and layout (line breaks, bullet points, numbered lists). If the original has "1." "2." "3." numbered items, keep them as numbered items in the same format.
5. DO NOT sound like an AI. This is the most important rule. Specifically:
   - BANNED phrases (never write these): "It is important to note", "It is worth mentioning", "In today's world", "In conclusion", "plays a crucial role", "serves as a", "aims to", "In the realm of", "shed light on", "in terms of", "a myriad of", "embark on", "navigating the", "holistic approach", "Moreover", "Furthermore", "Additionally", "Consequently", "It is evident that", "This highlights", "This underscores", "This demonstrates", "a testament to", "a triumvirate of", "a harmonious blend"
   - BANNED writing style: Do NOT write purple prose. Do NOT use ornate/flowery metaphors like "canvas waiting to be transformed", "magnificent symphony", "maestro of growth", "tapestry woven", "beacon of hope", "dance of", "symphony of", "mosaic of", "crucible of", "realm of", "cascade of". Write PLAINLY. If the original says "the body grows" do NOT change it to "the body orchestrates a magnificent symphony of growth". Keep it simple and direct.
   - BANNED structures: Do NOT start 2+ sentences in a row with "This [verb]s". Do NOT use "Not only... but also". Do NOT write 3+ sentences of similar length in a row.
   - REQUIRED: Vary sentence length naturally. Mix shorter sentences (6-10 words) with longer ones (15-25 words). But every sentence must be complete and make sense on its own.
   - REQUIRED: Use the SAME vocabulary complexity as the sample writer. If they use simple words, use simple words. Don't upgrade "food" to "nourishment" or "sleep" to "slumber" or "water" to "hydration" unless the sample writer does this.
   - REQUIRED: Preserve accuracy over novelty. Do not force awkward synonym swaps. Never write phrases like "significantly necessary", "significantly intended", or "significantly required".
   - REQUIRED: Don't connect every sentence smoothly. Real humans sometimes jump between ideas.
   - REQUIRED: When the original text has numbered lists (1, 2, 3), keep them as clean numbered lists. Don't merge list items into flowing prose.
   - REQUIRED: DO NOT FIX OR PERFECT THE WRITING. If the sample is messy, casual, grammatically imperfect, or informal, the output MUST be equally messy, casual, and imperfect. Do NOT polish the text.
   - ALLOWED: Start sentences with "And", "But", "So", "Or". Use sentence fragments. Use informal connectors. Have slightly uneven paragraph lengths.
6. Output ONLY the rewritten text. No commentary, no explanations, no notes.
7. DO NOT act as a dictionary or conversational assistant. DO NOT define words, answer questions, or provide explanations. If the input is a single word or short phrase, just return a restyled version of it (or the exact same word if it fits the style).`;

  return prompt;
}

// Extract multi-word phrases (3+ words) that appear multiple times
function extractMultiWordPhrases(sample: string, wordCount: number): string[] {
  const words = sample.toLowerCase().replace(/[.,!?;:()"""'']/g, '').split(/\s+/).filter(w => w.length > 0);
  const phraseMap = new Map<string, number>();
  
  for (let i = 0; i <= words.length - wordCount; i++) {
    const phrase = words.slice(i, i + wordCount).join(' ');
    if (phrase.length > 8) {
      phraseMap.set(phrase, (phraseMap.get(phrase) || 0) + 1);
    }
  }
  
  return Array.from(phraseMap.entries())
    .filter(([_, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([phrase]) => phrase);
}

// Extract good example sentences from user's writing - picks diverse, representative examples
function extractExampleSentences(sample: string, count: number): string[] {
  const sentences = sample.split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => {
      const words = s.split(/\s+/).length;
      return words >= 6 && words <= 35 && s.length > 15;
    });
  
  if (sentences.length === 0) return [];
  if (sentences.length <= count) return sentences;
  
  // Score sentences by how "characteristic" they are
  // Prefer sentences with contractions (if user uses them), transitions, varied lengths
  const allWords = sample.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
  const wordFreq = new Map<string, number>();
  allWords.forEach(w => wordFreq.set(w, (wordFreq.get(w) || 0) + 1));
  
  const scored = sentences.map(s => {
    let score = 0;
    const words = s.split(/\s+/);
    
    // Prefer sentences with user's frequent words
    const sWords = s.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
    for (const w of sWords) {
      if ((wordFreq.get(w) || 0) >= 2) score += 1;
    }
    
    // Prefer sentences with contractions (shows style)
    if (/\b\w+n't\b|\b\w+'re\b|\b\w+'s\b|\b\w+'ve\b|\bI'm\b/i.test(s)) score += 3;
    
    // Prefer sentences with transitions
    if (/\b(However|Moreover|Furthermore|Additionally|Therefore|Thus|Nevertheless|Meanwhile)\b/i.test(s)) score += 2;
    
    // Moderate length preferred (not too short, not too long)
    if (words.length >= 10 && words.length <= 25) score += 2;
    
    return { sentence: s, score, length: words.length };
  });
  
  // Sort by score
  scored.sort((a, b) => b.score - a.score);
  
  // Select diverse lengths from top scorers
  const selected: string[] = [];
  const usedLengthBuckets = new Set<string>();
  
  for (const item of scored) {
    if (selected.length >= count) break;
    
    // Bucket lengths: short (<10), medium (10-18), long (>18)
    const bucket = item.length < 10 ? 'short' : item.length <= 18 ? 'medium' : 'long';
    
    // Don't include sentences that are too similar to already selected ones
    const isDuplicate = selected.some(s => {
      const overlap = s.toLowerCase().split(/\s+/).filter(w => 
        item.sentence.toLowerCase().includes(w) && w.length > 3
      ).length;
      return overlap > 5;
    });
    
    if (!isDuplicate) {
      // Prefer diversity in sentence lengths
      if (!usedLengthBuckets.has(bucket) || selected.length < count - 1) {
        selected.push(item.sentence);
        usedLengthBuckets.add(bucket);
      }
    }
  }
  
  return selected;
}

// Extract vocabulary patterns from user's writing
function extractUserVocabulary(sample: string): string[] {
  const words = sample.toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
  const wordCount: Record<string, number> = {};
  
  // Count word frequency
  for (const word of words) {
    // Skip common words
    if (isCommonWord(word)) continue;
    wordCount[word] = (wordCount[word] || 0) + 1;
  }
  
  // Get words that appear multiple times (user's preferred words)
  return Object.entries(wordCount)
    .filter(([_, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([word]) => word);
}

function isCommonWord(word: string): boolean {
  const common = new Set([
    'the', 'and', 'that', 'have', 'for', 'not', 'with', 'you', 'this', 'but',
    'his', 'from', 'they', 'were', 'been', 'have', 'their', 'what', 'when',
    'will', 'more', 'would', 'there', 'than', 'about', 'into', 'them', 'could',
    'other', 'which', 'these', 'then', 'some', 'very', 'also', 'just', 'over',
    'such', 'only', 'your', 'come', 'make', 'like', 'being', 'many', 'those'
  ]);
  return common.has(word);
}

// =============================================================================
// API CALLS
// =============================================================================

async function callGroqAPI(text: string, systemPrompt: string, temperature: number = 0.55, cleanOutput = true): Promise<string> {
  const GroqMod = await import('groq-sdk');
  const Groq = (GroqMod as any).default ?? (GroqMod as any).Groq;
  const client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  
  const completion = await client.chat.completions.create({
    model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    temperature, // Lower for exact style copying
    max_tokens: Math.min(4000, Math.max(500, text.length * 2)),
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `INPUT TEXT TO REWRITE:\n\n${text}` }
    ]
  });
  
  const result = completion.choices?.[0]?.message?.content?.trim() || '';
  return cleanOutput ? cleanText(result) || text : result || text;
}

async function callGeminiAPI(text: string, systemPrompt: string, temperature: number = 0.55, cleanOutput = true): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('No Gemini API key');
  
  const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: `${systemPrompt}\n\nINPUT TEXT TO REWRITE:\n\n${text}` }]
      }],
      generationConfig: { 
        temperature, // Lower for exact style copying
        maxOutputTokens: Math.min(4000, Math.max(500, text.length * 2)) 
      }
    })
  });
  
  if (!response.ok) throw new Error(`Gemini error: ${response.status}`);
  
  const data = await response.json();
  const result = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
  return cleanOutput ? cleanText(result) || text : result || text;
}

// =============================================================================
// STYLE ANALYSIS & APPLICATION
// =============================================================================

interface DetailedStyleAnalysis {
  usesContractions: boolean;
  avgWordsPerSentence: number;
  transitions: string[];
  sentenceStarters: string[];
  commonPhrases: string[];
  formalityLevel: 'casual' | 'neutral' | 'formal';
  usesFirstPerson: boolean;
  questionFrequency: number;
  exclamationFrequency: number;
  vocabularyLevel: 'simple' | 'moderate' | 'advanced';
  avgWordLength: number;
  complexWords: string[];
  simpleWords: string[];
  // Enhanced analysis fields
  passiveVoiceRatio: number;
  commaPerSentence: number;
  usesSemicolons: boolean;
  usesDashes: boolean;
  sentenceLengthStd: number;
}

// Common simple words that most people use
const SIMPLE_WORDS = new Set([
  'good', 'bad', 'big', 'small', 'make', 'take', 'give', 'get', 'put', 'use',
  'say', 'tell', 'ask', 'work', 'seem', 'feel', 'try', 'leave', 'call', 'need',
  'want', 'look', 'thing', 'way', 'day', 'man', 'woman', 'child', 'world', 'life',
  'hand', 'part', 'place', 'case', 'week', 'point', 'fact', 'group', 'problem',
  'nice', 'great', 'important', 'different', 'same', 'able', 'last', 'long',
  'little', 'own', 'other', 'old', 'right', 'high', 'new', 'sure', 'kind',
  'really', 'very', 'just', 'also', 'well', 'back', 'much', 'even', 'most',
  'think', 'know', 'believe', 'understand', 'remember', 'imagine', 'realize'
]);

// Complex/sophisticated words that indicate advanced vocabulary
const COMPLEX_WORDS = new Set([
  'furthermore', 'consequently', 'nevertheless', 'notwithstanding', 'subsequently',
  'aforementioned', 'juxtaposition', 'paradigm', 'dichotomy', 'methodology',
  'comprehensive', 'substantive', 'quintessential', 'unprecedented', 'multifaceted',
  'intrinsic', 'extrinsic', 'inherent', 'pragmatic', 'empirical', 'theoretical',
  'epistemological', 'ontological', 'phenomenological', 'dialectical', 'heuristic',
  'efficacious', 'ubiquitous', 'salient', 'cogent', 'perspicacious', 'sagacious',
  'ameliorate', 'exacerbate', 'proliferate', 'disseminate', 'extrapolate',
  'articulate', 'synthesize', 'conceptualize', 'contextualize', 'operationalize',
  'facilitate', 'implement', 'leverage', 'optimize', 'utilize', 'demonstrate',
  'significant', 'substantial', 'fundamental', 'critical', 'essential', 'pivotal',
  'nuanced', 'sophisticated', 'elaborate', 'intricate', 'convoluted', 'ambiguous'
]);

function analyzeStyle(sample: string): DetailedStyleAnalysis {
  // Detect contractions
  const contractionPattern = /\b(don't|won't|can't|isn't|aren't|it's|that's|there's|I'm|you're|we're|they're|he's|she's|hasn't|haven't|couldn't|wouldn't|shouldn't)\b/gi;
  const expandedPattern = /\b(do not|will not|cannot|is not|are not|it is|that is|there is|I am|you are|we are|they are|he is|she is|has not|have not|could not|would not|should not)\b/gi;
  const contractions = (sample.match(contractionPattern) || []).length;
  const expanded = (sample.match(expandedPattern) || []).length;
  const usesContractions = contractions > expanded;

  // Calculate sentence length
  const sentences = sample.split(/[.!?]+/).filter(s => s.trim().length > 5);
  const avgWordsPerSentence = sentences.length > 0
    ? sentences.reduce((sum, s) => sum + s.trim().split(/\s+/).length, 0) / sentences.length
    : 15;

  // Detect transitions
  const allTransitions = ['However', 'Moreover', 'Additionally', 'Furthermore', 'Meanwhile', 'Instead', 'Thus', 'Therefore', 'Also', 'Besides', 'In fact', 'Actually', 'Basically', 'Honestly'];
  const transitions = allTransitions.filter(t => 
    new RegExp(`\\b${t}\\b`, 'i').test(sample)
  );

  // NEW: Extract sentence starters (first 2-3 words of each sentence)
  const sentenceStarters = sentences
    .map(s => s.trim().split(/\s+/).slice(0, 3).join(' '))
    .filter(s => s.length > 2)
    .slice(0, 5); // Top 5 starters

  // NEW: Find common phrases (2-3 word combinations that appear multiple times)
  const words = sample.toLowerCase().split(/\s+/);
  const phraseMap = new Map<string, number>();
  for (let i = 0; i < words.length - 1; i++) {
    const twoWord = `${words[i]} ${words[i+1]}`.replace(/[.,!?;:]/g, '');
    if (twoWord.length > 5) {
      phraseMap.set(twoWord, (phraseMap.get(twoWord) || 0) + 1);
    }
  }
  const commonPhrases = Array.from(phraseMap.entries())
    .filter(([_, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([phrase]) => phrase);

  // NEW: Determine formality level
  const casualMarkers = /\b(gonna|wanna|gotta|kinda|sorta|yeah|yep|nope|cool|awesome|stuff|things|like)\b/gi;
  const formalMarkers = /\b(therefore|consequently|furthermore|nevertheless|subsequently|thus|hence|regarding|pertaining|aforementioned)\b/gi;
  const casualCount = (sample.match(casualMarkers) || []).length;
  const formalCount = (sample.match(formalMarkers) || []).length;
  let formalityLevel: 'casual' | 'neutral' | 'formal' = 'neutral';
  if (casualCount > formalCount + 2 || usesContractions) formalityLevel = 'casual';
  if (formalCount > casualCount + 2 || !usesContractions) formalityLevel = 'formal';

  // NEW: Check first person usage
  const firstPersonPattern = /\b(I|me|my|mine|we|us|our|ours)\b/gi;
  const firstPersonCount = (sample.match(firstPersonPattern) || []).length;
  const usesFirstPerson = firstPersonCount > sentences.length * 0.3;

  // NEW: Question and exclamation frequency
  const questionCount = (sample.match(/\?/g) || []).length;
  const exclamationCount = (sample.match(/!/g) || []).length;
  const questionFrequency = sentences.length > 0 ? questionCount / sentences.length : 0;
  const exclamationFrequency = sentences.length > 0 ? exclamationCount / sentences.length : 0;

  // NEW: Vocabulary complexity analysis
  const allWords = sample.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
  const avgWordLength = allWords.length > 0 
    ? allWords.reduce((sum, w) => sum + w.length, 0) / allWords.length 
    : 5;
  
  // Find complex words the user actually uses
  const userComplexWords = allWords.filter(w => COMPLEX_WORDS.has(w) || w.length >= 10);
  const uniqueComplexWords = [...new Set(userComplexWords)].slice(0, 8);
  
  // Find simple/common words they prefer
  const userSimpleWords = allWords.filter(w => SIMPLE_WORDS.has(w));
  const simpleWordCounts: Record<string, number> = {};
  userSimpleWords.forEach(w => { simpleWordCounts[w] = (simpleWordCounts[w] || 0) + 1; });
  const topSimpleWords = Object.entries(simpleWordCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([word]) => word);

  // Determine vocabulary level
  const complexRatio = userComplexWords.length / Math.max(allWords.length, 1);
  const longWordRatio = allWords.filter(w => w.length >= 8).length / Math.max(allWords.length, 1);
  
  let vocabularyLevel: 'simple' | 'moderate' | 'advanced' = 'moderate';
  if (complexRatio > 0.08 || longWordRatio > 0.25 || avgWordLength > 6.5) {
    vocabularyLevel = 'advanced';
  } else if (complexRatio < 0.02 && longWordRatio < 0.1 && avgWordLength < 5) {
    vocabularyLevel = 'simple';
  }

  // Enhanced analysis fields
  const commaCount2 = (sample.match(/,/g) || []).length;
  const commaPerSentence2 = sentences.length > 0 ? commaCount2 / sentences.length : 1;
  const semicolonCount2 = (sample.match(/;/g) || []).length;
  const dashCount2 = (sample.match(/—|–|-{2}/g) || []).length;
  const passiveMatches2 = sample.match(/\b(?:is|are|was|were|been|be|being)\s+(?:\w+ed|written|shown|seen|known|given|taken|made|done|found|said|told|thought|felt|become)\b/gi) || [];
  const passiveVoiceRatio = sentences.length > 0 ? passiveMatches2.length / sentences.length : 0;
  const sentenceLengthsArr = sentences.map((s: string) => s.trim().split(/\s+/).length);
  const sentenceLengthStd = sentenceLengthsArr.length > 1
    ? Math.sqrt(sentenceLengthsArr.reduce((sum: number, len: number) => sum + Math.pow(len - avgWordsPerSentence, 2), 0) / sentenceLengthsArr.length)
    : 0;

  return { 
    usesContractions, 
    avgWordsPerSentence, 
    transitions,
    sentenceStarters,
    commonPhrases,
    formalityLevel,
    usesFirstPerson,
    questionFrequency,
    exclamationFrequency,
    vocabularyLevel,
    avgWordLength,
    complexWords: uniqueComplexWords,
    simpleWords: topSimpleWords,
    passiveVoiceRatio,
    commaPerSentence: commaPerSentence2,
    usesSemicolons: semicolonCount2 > 0,
    usesDashes: dashCount2 > 0,
    sentenceLengthStd,
  };
}

function applyUserStyle(text: string, profile: any): string {
  if (!profile?.sampleExcerpt && !profile?.sampleExcerpts?.length) return text;

  const sampleText = profile.sampleExcerpts?.length 
    ? profile.sampleExcerpts.join('\n\n')
    : profile.sampleExcerpt;
    
  const analysis = analyzeStyle(sampleText);
  let result = text;

  // Check current match state to decide if we need to intervene
  let currentMatch = checkStyleMatch(sampleText, result);

  // 0. STRIP AI-TELLTALE PHRASES — must happen first
  result = stripAIPatterns(result);

  // 1. CONTRACTIONS - Most important style marker
  // Apply this STRICTLY - the AI sometimes ignores the instruction
  if (!currentMatch.contractions.match) {
    if (analysis.usesContractions) {
      result = expandToContractions(result);
    } else {
      result = contractionsToExpanded(result);
    }
    // Re-check after mutation
    currentMatch = checkStyleMatch(sampleText, result);
  }

  // 2. SENTENCE LENGTH - Only break up extremely long sentences (40+ words) if it's off
  const userAvgLength = analysis.avgWordsPerSentence;
  if (!currentMatch.sentenceLength.match && userAvgLength < 15) {
    result = adjustSentenceLength(result, userAvgLength);
    currentMatch = checkStyleMatch(sampleText, result);
  }

  // 3. VOCABULARY MATCHING - Only replace words if vocabulary level doesn't match
  if (!currentMatch.vocabulary.match) {
    result = matchVocabularyLevel(result, analysis);
    currentMatch = checkStyleMatch(sampleText, result);
  }

  // 4. TRANSITION MATCHING - Only if transitions are lacking
  if (!currentMatch.transitions.match && analysis.transitions.length > 0) {
    result = matchTransitionStyle(result, analysis);
    currentMatch = checkStyleMatch(sampleText, result);
  }

  // 5. HUMANIZE — Only apply structural humanizations if the score isn't already stellar
  if (currentMatch.overallScore < 90) {
    result = humanizeOutput(result, sampleText, analysis);
  }

  // 6. QUALITY GATE — catch and repair any sentence fragments created by post-processing
  result = repairFragments(result);

  // 7. Clean up the text
  result = cleanText(result);

  return result;
}

// =============================================================================
// ORNATE LANGUAGE STRIPPING — Replace purple prose with plain language
// =============================================================================

function stripOrnateLanguage(text: string): string {
  let result = text;

  // Replace ornate metaphorical phrases with plain equivalents
  const ornateReplacements: [RegExp, string][] = [
    // "canvas/tapestry/mosaic waiting to be..." → remove the metaphor
    [/\ba (?:canvas|tapestry|mosaic|blank slate) (?:waiting |ready |poised )?to be (?:transformed|painted|woven|crafted|shaped)\b/gi, ''],
    // "orchestrates/conducts a magnificent/grand symphony/performance" → "manages/controls"
    [/\borchestrat(?:e|es|ed|ing) (?:a |the )?(?:magnificent |grand |beautiful |intricate |complex )?(?:symphony|performance|dance|ballet)\b/gi, 'manages'],
    [/\bconducts? (?:a |the |this )?(?:magnificent |grand )?(?:symphony|performance|orchestra)\b/gi, 'controls'],
    // "maestro/architect/beacon of X" → just "X controller" or remove
    [/\b(?:a |the )?(?:maestro|architect|beacon|cornerstone|pillar|bedrock|linchpin|catalyst|harbinger) of\b/gi, 'the main part of'],
    // "a magnificent/grand/majestic symphony/performance/dance" → just remove the ornate part
    [/\ba (?:magnificent|grand|majestic|breathtaking|awe-inspiring|extraordinary|remarkable) (?:symphony|performance|dance|tapestry|masterpiece|spectacle|display)\b/gi, 'a process'],
    // "masterpiece of X" → just "X"
    [/\b(?:a |the )?masterpiece of\b/gi, ''],
    // "realm of X" → "area of X" or just "X"
    [/\b(?:the |a )?realm of\b/gi, ''],
    // "triumvirate of" → "combination of"
    [/\b(?:a |the )?triumvirate of\b/gi, 'a combination of'],
    // "a harmonious blend of" → "a mix of"
    [/\b(?:a |the )?harmonious (?:blend|mix|combination|fusion) of\b/gi, 'a mix of'],
    // "tapestry woven from" → "process from"
    [/\b(?:a |the )?(?:dynamic,? )?(?:ever-changing )?tapestry,? (?:woven|crafted|spun) from\b/gi, 'a process that goes from'],
    // "unleash(es) a torrent/wave/flood of" → "causes many"
    [/\bunleash(?:es|ed|ing)? (?:a )?(?:torrent|wave|flood|cascade|barrage|deluge) of\b/gi, 'causes many'],
    // "maelstrom/whirlwind of transformation" → "time of big changes"
    [/\b(?:a |the )?(?:maelstrom|whirlwind|tempest|storm|crucible) of (?:transformation|change|changes)\b/gi, 'a time of big changes'],
    // "blossom(s) into" → "grow(s) into"
    [/\bblossom(?:s|ed|ing)? into\b/gi, 'grow into'],
    // "enchanted/fantastical/magical era/period" → "time/period"
    [/\b(?:enchanted|fantastical|magical|wondrous) (?:era|period|time|age|phase|chapter)\b/gi, 'period'],
    // "fleeting yet fantastical" → remove
    [/\bfleeting (?:yet|but) (?:fantastical|magical|momentous|wondrous)\b/gi, 'short but important'],
    // "stretch(es) towards the sky" → "grow(s)"
    [/\bstretch(?:es|ed|ing)? towards? the (?:sky|heavens|stars)\b/gi, 'grow'],
    // "absorb(s) knowledge like a sponge" → "learn(s) quickly"
    [/\babsorb(?:s|ed|ing)? (?:knowledge|information|wisdom) like a sponge\b/gi, 'learn quickly'],
    // "upward ascent" → "growth"
    [/\b(?:the body'?s |its )?upward ascent\b/gi, 'growth'],
    // "comes to a gentle halt" → "stops"
    [/\bcomes? to (?:a )?(?:gentle |gradual |natural )?(?:halt|stop|end|conclusion)\b/gi, 'stops'],
    // "giving way to a new era of" → "and then"
    [/\bgiving way to (?:a )?(?:new )?(?:era|chapter|phase|period) of\b/gi, 'and then there is'],
    // "ignites the engine of" → "drives"
    [/\bignit(?:e|es|ed|ing) the (?:engine|fire|flame|spark) of\b/gi, 'drives'],
    // "the foundation upon which X is built" → "what X needs"
    [/\bthe foundation (?:upon|on) which .+? is built\b/gi, 'the base for growth'],
    // "woven from the threads of X to Y" → "from X to Y"
    [/\bwoven from the threads of\b/gi, 'going from'],
    // "a grand, ceaseless dance" → remove
    [/\b(?:a |the )?(?:grand|magnificent|beautiful|eternal|never-ending),? (?:ceaseless |endless |eternal )?(?:dance|waltz|ballet|symphony)\b/gi, 'an ongoing process'],
    // "continually builds, adapts and transforms" → "keeps changing"
    [/\bcontinually (?:builds|grows|evolves),? (?:adapts|changes|shifts) and (?:transforms|develops|evolves)\b/gi, 'keeps growing and changing'],
    // "crystal clear" → "clean"
    [/\bcrystal clear\b/gi, 'clean'],
    // "robust, vibrant health" → "good health"
    [/\b(?:robust|vibrant|radiant),? (?:vibrant |radiant |robust )?health\b/gi, 'good health'],
    // "ample, restorative sleep" → "enough sleep"
    [/\b(?:ample|sufficient),? (?:restorative |rejuvenating |refreshing )?sleep\b/gi, 'enough sleep'],
    // "wholesome, nutritious food" → "healthy food"
    [/\b(?:wholesome|nourishing),? (?:nutritious |balanced )?(?:food|nourishment|sustenance)\b/gi, 'healthy food'],
    // "regular, invigorating exercise" → "regular exercise"
    [/\b(?:regular|consistent),? (?:invigorating |energizing |vigorous )?exercise\b/gi, 'regular exercise'],
    // "genetic blueprints" → "genes"
    [/\bgenetic blueprints?\b/gi, 'genes'],
    // "the fortification of" → "stronger"
    [/\bthe fortification of\b/gi, 'stronger'],
    // "the emergence of X in unexpected places" → "X growing in new places"
    [/\bthe emergence of (.+?) in unexpected places\b/gi, '$1 growing in new places'],
    // "the blossoming of" → "the development of"
    [/\bthe blossoming of\b/gi, 'the development of'],
    // "a shifting of the body's silhouette" → "body shape changes"
    [/\b(?:a )?shifting of the body'?s? silhouette\b/gi, 'body shape changes'],
    // "a deepening of the voice" → "voice getting deeper"
    [/\b(?:a )?deepening of the voice\b/gi, 'voice getting deeper'],
    // "a sudden, dramatic increase" → "a big increase"
    [/\b(?:a )?sudden,? (?:dramatic|remarkable|astonishing|extraordinary) increase\b/gi, 'a big increase'],
    // "nourishment" → "food" (when used as simple synonym)
    [/\bnourishment\b/gi, 'food'],
    // "slumber" → "sleep"
    [/\bslumber\b/gi, 'sleep'],
    // "hydration" → "water" (when used as simple synonym)
    [/\b(?:the essential elements of )?(?:food, )?hydration(?:, oxygen)?\b/gi, 'water'],
    // "with remarkable rapidity" → "fast"
    [/\bwith (?:remarkable|astonishing|extraordinary|incredible) (?:rapidity|speed|swiftness)\b/gi, 'fast'],
    // "steady, unwavering progress" → "steady progress"
    [/\bsteady,? (?:unwavering|relentless|consistent|determined) progress\b/gi, 'steady progress'],
    // "tiny titans" → remove totally silly metaphors
    [/\btiny titans\b/gi, 'bigger'],
    // "the catalysts of" → "what causes"
    [/\bthe catalysts? of\b/gi, 'what causes'],
    // "the conductors of" → "what controls"
    [/\bthe conductors? of\b/gi, 'what controls'],
  ];

  for (const [pattern, replacement] of ornateReplacements) {
    result = result.replace(pattern, replacement);
  }

  // Remove doubled-up adjectives AI loves: "magnificent, breathtaking", "dynamic, ever-changing"
  result = result.replace(/\b(magnificent|breathtaking|astonishing|extraordinary|remarkable|incredible|awe-inspiring|majestic|wondrous|fantastical|enchanting),?\s+(magnificent|breathtaking|astonishing|extraordinary|remarkable|incredible|awe-inspiring|majestic|wondrous|fantastical|enchanting)\b/gi, (_, _a, b) => b);

  return result;
}

// =============================================================================
// AI-PATTERN STRIPPING — Remove phrases that AI detectors flag
// =============================================================================

function stripAIPatterns(text: string): string {
  let result = text;

  // 1. Remove common AI filler phrases (case-insensitive, preserve surrounding text)
  const aiPhrases = [
    /\bIt is (?:important|worth|essential|crucial|noteworthy|interesting) to (?:note|mention|highlight|recognize|acknowledge|understand|remember|emphasize) that\s*/gi,
    /\bIt (?:should|must) be (?:noted|mentioned|emphasized|highlighted|recognized|acknowledged) that\s*/gi,
    /\bThis (?:is a testament to|serves as a? (?:reminder|testament|beacon|example))\s*/gi,
    /\bIn today'?s (?:world|society|age|era|landscape|day and age)\s*,?\s*/gi,
    /\bIn the realm of\s+/gi,
    /\bIn (?:terms of|light of|the context of)\s+/gi,
    /\bplays a (?:crucial|vital|pivotal|key|significant|important|critical|central) role\s*/gi,
    /\ba myriad of\s+/gi,
    /\bembark(?:s|ed|ing)? on (?:a |the )?(?:journey|quest|path|adventure|endeavor)\s*/gi,
    /\bnavigat(?:e|es|ed|ing) (?:the|this) (?:complex|intricate|challenging)\s*/gi,
    /\btap(?:s|ped|ping)? into (?:the|a)\s*/gi,
    /\b(?:a |the )?holistic (?:approach|perspective|view|understanding)\s*/gi,
    /\bshed(?:s|ding)? light on\s*/gi,
    /\bdelve(?:s|d)? (?:into|deeper)\s*/gi,
    /\bunderscore(?:s|d)? the (?:importance|significance|need|necessity)\s*/gi,
    /\bpave(?:s|d)? the way for\s*/gi,
    /\b(?:at|by) the end of the day\s*,?\s*/gi,
    /\bthe (?:bottom|top) line is\s*,?\s*/gi,
    /\bfirst and foremost\s*,?\s*/gi,
    /\blast but not least\s*,?\s*/gi,
    /\ball in all\s*,?\s*/gi,
    /\bin a nutshell\s*,?\s*/gi,
    /\bwithout a doubt\s*,?\s*/gi,
    /\bit goes without saying (?:that)?\s*/gi,
    // Additional AI patterns
    /\bIt is evident that\s*/gi,
    /\bIt is clear that\s*/gi,
    /\bIt is undeniable that\s*/gi,
    // Remove "Not only... but also" framing but KEEP the content
    // "Not only does X, but also Y" → "X and also Y"  
    /\bNot only (?:does |do |is |are |has |have |did |was |were )?/gi,
    /,?\s*\bbut also\b/gi,
    /\bIn (?:order|an effort|an attempt) to\s+/gi,
    /\bas (?:we|one) (?:can see|navigate|explore|delve|examine)\s*,?\s*/gi,
    /\bwhen it comes to\s+/gi,
    /\bin this (?:regard|context|article|essay|paper)\s*,?\s*/gi,
    /\b(?:the |a )?(?:wide|broad|vast|diverse) (?:range|array|spectrum) of\s+/gi,
    /\bon the other hand\s*,?\s*/gi,
    /\bhaving said that\s*,?\s*/gi,
    /\bthat being said\s*,?\s*/gi,
    /with that (?:being |)said\s*,?\s*/gi,
  ];

  for (const pattern of aiPhrases) {
    result = result.replace(pattern, '');
  }

  // 2. Remove AI-typical adverb hedging at start of sentences
  result = result.replace(/^(Certainly|Undoubtedly|Undeniably|Arguably|Notably|Interestingly|Importantly|Remarkably|Essentially|Fundamentally|Inevitably|Ultimately|Ironically|Surprisingly),?\s*/gim, '');

  // 3. Remove overly emphatic AI intensifiers in common combos  
  result = result.replace(/\b(truly|deeply|incredibly|remarkably|exceptionally|profoundly|significantly|overwhelmingly|undeniably|inherently) (important|significant|crucial|essential|vital|remarkable|transformative|impactful|valuable|meaningful)\b/gi, (_, _intensifier, adj) => adj);
  result = result.replace(/\b(significantly|substantially|considerably|remarkably|exceptionally) (necessary|required|needed|intended|designed|meant)\b/gi, (_, _intensifier, word) => word);
  result = result.replace(/,\s+(this|that|it|these|those)\s+(affects|impacts|influences|changes|helps|allows|means|shows|creates|causes)\b/gi, (_, subject, verb) => `. ${subject.charAt(0).toUpperCase() + subject.slice(1)} ${verb}`);

  // 4. Strip ornate/flowery AI metaphors — replace with plain language
  result = stripOrnateLanguage(result);

  // 4. Replace "This highlights/demonstrates/underscores" chains
  // (Only if there are 2+ such sentences — a single one is fine)
  const thisVerbCount = (result.match(/\bThis (?:highlights|demonstrates|underscores|illustrates|showcases|emphasizes|reveals)\b/gi) || []).length;
  if (thisVerbCount >= 2) {
    let replaced = 0;
    result = result.replace(/\bThis (highlights|demonstrates|underscores|illustrates|showcases|emphasizes|reveals)\b/gi, (match, verb) => {
      replaced++;
      if (replaced === 1) return match; // keep the first one
      // Replace subsequent ones
      const simpleReplacements: Record<string, string> = {
        'highlights': 'It shows',
        'demonstrates': 'We see',
        'underscores': 'The point is',
        'illustrates': 'You can see',
        'showcases': 'Here',
        'emphasizes': 'The key is',
        'reveals': 'What stands out is',
      };
      return simpleReplacements[verb.toLowerCase()] || 'It shows';
    });
  }

  // 5. Clean up any double spaces or leading spaces from removals
  result = result.replace(/  +/g, ' ');
  result = result.replace(/^ +/gm, '');
  // Fix sentences that now start with lowercase after removal
  result = result.replace(/(?<=[.!?]\s+)([a-z])/g, (_, c) => c.toUpperCase());
  // Fix sentences starting after newline with lowercase
  result = result.replace(/(?<=\n\s*)([a-z])/g, (_, c) => c.toUpperCase());
  // Fix empty sentences from over-removal
  result = result.replace(/\.\s*\./g, '.');
  result = result.replace(/^\s*\.\s*/gm, '');

  return result;
}

// =============================================================================
// HUMANIZATION — Break AI-like patterns and inject natural variation
// =============================================================================

function humanizeOutput(text: string, userSample: string, analysis: DetailedStyleAnalysis): string {
  let result = text;

  // 1. BREAK PARALLEL STRUCTURES
  // AI loves "X. Furthermore, Y. Moreover, Z. Additionally, W." — fix that
  result = breakParallelTransitions(result);

  // 2. VARY SENTENCE OPENINGS
  // If 3+ consecutive sentences start the same way, rewrite the middle one
  result = varySentenceOpenings(result);

  // 3. INJECT USER'S SENTENCE STARTERS if they're underrepresented
  result = injectUserStarters(result, analysis);

  // 4. MATCH COMMA DENSITY to user's style
  result = matchCommaDensity(result, analysis);

  // 5. ADD BURSTINESS — vary sentence lengths to match human patterns
  result = addBurstiness(result, analysis);

  // 6. REPLACE "This [verb]s" AI pattern — a dead giveaway
  result = breakThisVerbPattern(result);

  // 7. ADD HUMAN RHYTHM — occasional conjunctions at start, merge/split sentences
  result = addHumanRhythm(result, userSample, analysis);

  return result;
}

// Break chains of transition words that AI loves to produce
function breakParallelTransitions(text: string): string {
  const lines = text.split('\n');
  const result: string[] = [];

  for (const line of lines) {
    let processed = line;
    // Find sentences in this line
    const sentenceParts = processed.split(/(?<=[.!?])\s+/);
    
    if (sentenceParts.length < 3) {
      result.push(processed);
      continue;
    }

    // Check for chains: if 3+ consecutive sentences start with a transition
    const transitionPattern = /^(However|Moreover|Furthermore|Additionally|Consequently|Nevertheless|Thus|Hence|Meanwhile|Therefore|In addition|On the other hand|As a result|Similarly|Likewise),?\s/i;
    
    let chainCount = 0;
    for (let i = 0; i < sentenceParts.length; i++) {
      if (transitionPattern.test(sentenceParts[i])) {
        chainCount++;
        // If we've hit 2+ transitions in a row, remove the transition from the 2nd+ one
        if (chainCount >= 2) {
          sentenceParts[i] = sentenceParts[i].replace(transitionPattern, '');
          // Capitalize the first letter
          if (sentenceParts[i].length > 0) {
            sentenceParts[i] = sentenceParts[i].charAt(0).toUpperCase() + sentenceParts[i].slice(1);
          }
        }
      } else {
        chainCount = 0;
      }
    }

    result.push(sentenceParts.join(' '));
  }

  return result.join('\n');
}

// Prevent 3+ consecutive sentences starting with the same word/pattern
function varySentenceOpenings(text: string): string {
  const lines = text.split('\n');
  const result: string[] = [];

  for (const line of lines) {
    const sentences = line.split(/(?<=[.!?])\s+/);
    if (sentences.length < 3) {
      result.push(line);
      continue;
    }

    // Check each triplet of consecutive sentences
    for (let i = 1; i < sentences.length - 1; i++) {
      const prevStart = sentences[i - 1].trim().split(/\s+/)[0]?.toLowerCase();
      const currStart = sentences[i].trim().split(/\s+/)[0]?.toLowerCase();
      const nextStart = sentences[i + 1]?.trim().split(/\s+/)[0]?.toLowerCase();

      // If all three start the same, modify the middle one
      if (prevStart && currStart && prevStart === currStart && (nextStart === currStart || !nextStart)) {
        const s = sentences[i].trim();
        // Try to rephrase the opening by removing "The" or "This" and restructuring
        if (/^The\s/i.test(s)) {
          sentences[i] = s.replace(/^The\s+/i, 'That ');
        } else if (/^This\s/i.test(s)) {
          sentences[i] = s.replace(/^This\s+/i, 'Such a ');
        } else if (/^It\s/i.test(s)) {
          // Rewrite "It is/was" to a different opening
          sentences[i] = s.replace(/^It\s+(is|was)\s+/i, 'What we see is ');
        }
      }
    }

    result.push(sentences.join(' '));
  }

  return result.join('\n');
}

// Inject user's actual sentence starters if they're missing from the output
function injectUserStarters(text: string, analysis: DetailedStyleAnalysis): string {
  if (!analysis.sentenceStarters || analysis.sentenceStarters.length === 0) return text;
  
  // Check if any of the user's sentence starters appear in the output
  const outputLower = text.toLowerCase();
  const missingStarters = analysis.sentenceStarters.filter(s => 
    !outputLower.includes(s.toLowerCase())
  );
  
  // If most starters are already present, don't change anything
  if (missingStarters.length <= 1) return text;
  
  // Otherwise, try to replace some generic sentence openings with the user's starters
  let result = text;
  const genericStarters = [
    /^(The |This |It is |There is |There are )/im,
  ];
  
  let replacements = 0;
  const maxReplacements = Math.min(2, missingStarters.length);
  
  for (const generic of genericStarters) {
    if (replacements >= maxReplacements) break;
    const match = result.match(generic);
    if (match && match.index !== undefined && match.index > 0) {
      const starter = missingStarters[replacements];
      const capitalized = starter.charAt(0).toUpperCase() + starter.slice(1);
      // Only replace if it's mid-text (not first sentence)
      const before = result.slice(0, match.index);
      if (before.includes('.') || before.includes('!') || before.includes('?')) {
        result = result.slice(0, match.index) + capitalized + ' ' + result.slice(match.index + match[0].length);
        replacements++;
      }
    }
  }
  
  return result;
}

// Match comma density to user's writing style
function matchCommaDensity(text: string, analysis: DetailedStyleAnalysis): string {
  if (!analysis.commaPerSentence) return text;
  
  const userCommaRate = analysis.commaPerSentence;
  const sentences = text.split(/(?<=[.!?])\s+/);
  const outputCommas = (text.match(/,/g) || []).length;
  const outputCommaRate = sentences.length > 0 ? outputCommas / sentences.length : 0;
  
  // If output has significantly more commas than user (AI produces comma-heavy text)
  if (outputCommaRate > userCommaRate * 1.8 && userCommaRate < 2) {
    // Remove some commas before conjunctions (AI tends to always add "X, and Y")
    let result = text;
    let removed = 0;
    const target = Math.round((outputCommaRate - userCommaRate) * sentences.length * 0.5);
    
    // Remove commas before "and" / "or" (these are optional and AI over-uses them)
    result = result.replace(/,\s+(and|or)\s+/gi, (match, conj) => {
      if (removed < target) {
        removed++;
        return ` ${conj} `;
      }
      return match;
    });
    
    return result;
  }
  
  return text;
}

// Add burstiness — AI text has suspiciously even sentence lengths, humans don't
// CONSERVATIVE: only split 1 sentence per paragraph, only if truly uniform, and both halves must be complete
function addBurstiness(text: string, analysis: DetailedStyleAnalysis): string {
  const lines = text.split('\n');
  const result: string[] = [];

  for (const line of lines) {
    if (!line.trim()) { result.push(line); continue; }

    const sentences = line.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
    if (sentences.length < 5) { result.push(line); continue; }

    // Check if sentence lengths are too uniform (AI signature)
    const lengths = sentences.map(s => s.trim().split(/\s+/).length);
    const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const variance = lengths.reduce((sum, l) => sum + Math.pow(l - avg, 2), 0) / lengths.length;
    const stdDev = Math.sqrt(variance);
    const coeffOfVariation = avg > 0 ? stdDev / avg : 0;

    // Only intervene if sentences are extremely uniform (CV < 0.25)
    if (coeffOfVariation >= 0.25) { result.push(line); continue; }

    // Split at most ONE sentence per paragraph to avoid choppy output
    const modified = [...sentences];
    let didSplit = false;
    for (let i = 1; i < modified.length - 1; i++) {
      if (didSplit) break;
      const words = modified[i].trim().split(/\s+/);
      // Only split sentences that are 20+ words AND have a comma+conjunction mid-sentence
      if (words.length >= 20) {
        const conjCommaMatch = modified[i].match(/,\s*(and|but|so|yet)\s/i);
        if (conjCommaMatch && conjCommaMatch.index) {
          const splitAt = conjCommaMatch.index;
          const first = modified[i].slice(0, splitAt).trim();
          let second = modified[i].slice(splitAt + 1).trim();
          // Both halves must be at least 8 words to avoid fragments
          if (first.split(/\s+/).length >= 8 && second.split(/\s+/).length >= 8) {
            second = second.replace(/^\s*(and|but|so|yet)\s+/i, '');
            second = second.charAt(0).toUpperCase() + second.slice(1);
            if (!first.match(/[.!?]$/)) modified[i] = first + '.';
            if (!second.match(/[.!?]$/)) second += '.';
            modified.splice(i + 1, 0, second);
            didSplit = true;
          }
        }
      }
    }

    result.push(modified.join(' '));
  }

  return result.join('\n');
}

// Break the "This [verb]s" pattern that AI loves
function breakThisVerbPattern(text: string): string {
  let result = text;
  let count = 0;

  // Match "This [verb]s" at sentence boundaries
  const thisVerbPattern = /(?<=[.!?]\s+|^)(This (?:demonstrates|highlights|underscores|illustrates|showcases|emphasizes|reveals|suggests|indicates|reflects|represents|signifies|shows|proves|confirms|ensures|creates|provides|enables|allows|offers|establishes)\b)/gi;

  result = result.replace(thisVerbPattern, (match) => {
    count++;
    if (count % 2 === 0) return match;

    const alternatives = [
      match.replace(/^This /i, 'That '),
      match.replace(/^This /i, 'It '),
      match.replace(/^This (\w+s)\b/i, (_, verb) => {
        const swaps: Record<string, string> = {
          'demonstrates': 'You can see',
          'highlights': 'The point is',
          'underscores': 'What matters is',
          'illustrates': 'Look at how',
          'showcases': 'Here we see',
          'emphasizes': 'The key thing is',
          'reveals': 'What comes out is',
          'suggests': 'The idea is',
          'indicates': 'The sign is',
          'reflects': 'You see',
        };
        return swaps[verb.toLowerCase()] || match;
      }),
    ];
    return alternatives[count % alternatives.length];
  });

  return result;
}

// Add human rhythm — merge some short sentences, occasionally start with conjunctions
function addHumanRhythm(text: string, userSample: string, analysis: DetailedStyleAnalysis): string {
  let result = text;

  // 1. If user starts sentences with conjunctions, add some to output
  const userSentences = userSample.split(/[.!?]+/).filter(s => s.trim().length > 5);
  const conjStarts = userSentences.filter(s => /^\s*(And|But|So|Or|Yet)\b/i.test(s)).length;
  const conjRate = userSentences.length > 0 ? conjStarts / userSentences.length : 0;

  if (conjRate > 0.05) {
    const outputSentences = result.split(/(?<=[.!?])\s+/);
    if (outputSentences.length >= 5) {
      let added = 0;
      const targetAdds = Math.max(1, Math.floor(outputSentences.length * conjRate));

      for (let i = 2; i < outputSentences.length - 1; i += 3) {
        if (added >= targetAdds) break;
        const s = outputSentences[i].trim();
        if (!/^(And|But|So|Or|Yet|However|Moreover|Furthermore|Additionally)\b/i.test(s)) {
          const conj = added % 2 === 0 ? 'And ' : 'But ';
          outputSentences[i] = conj + s.charAt(0).toLowerCase() + s.slice(1);
          added++;
        }
      }
      result = outputSentences.join(' ');
    }
  }

  // 2. Merge pairs of very short consecutive sentences (< 7 words each)
  // using a comma or dash — humans naturally do this
  const sentences2 = result.split(/(?<=[.!?])\s+/);
  if (sentences2.length >= 4) {
    const merged: string[] = [];
    let i = 0;
    let mergeCount = 0;
    const maxMerges = Math.floor(sentences2.length / 5); // merge at most ~20%
    while (i < sentences2.length) {
      const curr = sentences2[i].trim();
      const next = i + 1 < sentences2.length ? sentences2[i + 1].trim() : null;

      if (next && mergeCount < maxMerges &&
          curr.split(/\s+/).length <= 7 && next.split(/\s+/).length <= 7) {
        const join = mergeCount % 2 === 0 ? ' — ' : ', ';
        const first = curr.replace(/[.!?]$/, '');
        const nextStripped = next.replace(/[.!?]$/, '');
        const second = nextStripped.charAt(0).toLowerCase() + nextStripped.slice(1);
        merged.push(first + join + second + '.');
        mergeCount++;
        i += 2;
      } else {
        merged.push(curr);
        i++;
      }
    }
    result = merged.join(' ');
  }

  return result;
}

// Match vocabulary complexity to user's level
function matchVocabularyLevel(text: string, analysis: DetailedStyleAnalysis): string {
  let result = text;
  
  if (analysis.vocabularyLevel === 'simple') {
    // Replace complex words with simpler alternatives
    const simplifications: Record<string, string> = {
      'utilize': 'use', 'implement': 'do', 'facilitate': 'help', 'demonstrate': 'show',
      'subsequently': 'then', 'consequently': 'so', 'furthermore': 'also', 'nevertheless': 'still',
      'approximately': 'about', 'numerous': 'many', 'sufficient': 'enough', 'commence': 'start',
      'terminate': 'end', 'endeavor': 'try', 'acquire': 'get', 'comprehend': 'understand',
      'substantial': 'large', 'diminish': 'reduce', 'indicate': 'show', 'regarding': 'about',
      'additional': 'more', 'preliminary': 'early', 'subsequent': 'later', 'prior': 'before',
      'adequate': 'enough', 'fundamental': 'basic', 'significant': 'important',
    };
    for (const [complex, simple] of Object.entries(simplifications)) {
      result = result.replace(new RegExp(`\\b${complex}\\b`, 'gi'), (match) => {
        return match[0] === match[0].toUpperCase() ? simple.charAt(0).toUpperCase() + simple.slice(1) : simple;
      });
    }
  } else if (analysis.vocabularyLevel === 'advanced') {
    // Replace overly simple words with more sophisticated alternatives (only some)
    const sophistications: Record<string, string> = {
      'help': 'facilitate', 'show': 'demonstrate', 'use': 'utilize', 'get': 'obtain',
      'start': 'initiate', 'end': 'conclude', 'try': 'endeavor',
    };
    // Only apply sparingly - target max 3 replacements to avoid over-correcting
    let replacements = 0;
    for (const [simple, advanced] of Object.entries(sophistications)) {
      if (replacements >= 3) break;
      const regex = new RegExp(`\\b${simple}\\b`, 'gi');
      const match = result.match(regex);
      if (match && match.length > 0) {
        // Only replace the first occurrence
        result = result.replace(regex, (m) => {
          if (replacements >= 3) return m;
          replacements++;
          return m[0] === m[0].toUpperCase() ? advanced.charAt(0).toUpperCase() + advanced.slice(1) : advanced;
        });
      }
    }
  }
  
  return result;
}

// Match transition word style to user's patterns
function matchTransitionStyle(text: string, analysis: DetailedStyleAnalysis): string {
  if (analysis.transitions.length === 0) return text;
  
  let result = text;
  
  // Replace generic transitions with user's preferred ones
  const genericTransitions = ['However', 'Moreover', 'Additionally', 'Furthermore', 'Meanwhile', 'Instead', 'Thus', 'Therefore', 'Also', 'Besides', 'In fact', 'Actually', 'Basically', 'Honestly', 'Consequently', 'Nevertheless', 'Hence'];
  
  const userTransitions = analysis.transitions;
  if (userTransitions.length === 0) return result;
  
  // Find transitions in the output that the user doesn't use
  for (const generic of genericTransitions) {
    if (userTransitions.some(t => t.toLowerCase() === generic.toLowerCase())) continue;
    
    // Replace with a random user-preferred transition
    const replacement = userTransitions[Math.floor(Math.random() * userTransitions.length)];
    const regex = new RegExp(`\\b${generic}\\b`, 'gi');
    result = result.replace(regex, (match) => {
      return match[0] === match[0].toUpperCase() 
        ? replacement.charAt(0).toUpperCase() + replacement.slice(1)
        : replacement.toLowerCase();
    });
  }
  
  return result;
}

// Break up sentences that are too long compared to user's style
function adjustSentenceLength(text: string, targetAvg: number): string {
  // Much more conservative: only split sentences that are VERY long (35+ words)
  // This prevents choppy, incomplete-feeling output
  const maxWords = Math.max(35, Math.round(targetAvg + 20));
  const lines = text.split('\n');
  
  return lines.map(line => {
    if (!line.trim()) return line;
    
    const sentences = line.split(/(?<=[.!?])\s+/);
    const adjustedSentences: string[] = [];
    
    for (const sentence of sentences) {
      const words = sentence.trim().split(/\s+/);
      
      if (words.length > maxWords) {
        const split = splitLongSentence(sentence, maxWords);
        adjustedSentences.push(...split);
      } else {
        adjustedSentences.push(sentence);
      }
    }
    
    return adjustedSentences.join(' ');
  }).join('\n');
}

// Split a long sentence at natural break points — ONLY at comma+conjunction or semicolons
// Never split at which/who/that (creates incomplete relative clauses)
function splitLongSentence(sentence: string, maxWords: number): string[] {
  const words = sentence.trim().split(/\s+/);
  if (words.length <= maxWords) return [sentence];
  
  // Only split at safe points: comma+conjunction or semicolons
  // Do NOT split at which/who/that — those create fragments
  const splitPatterns = [
    /,\s*(and|but|so|yet|or|however|therefore)\s/i,
    /;\s/,
  ];
  
  // Try each pattern
  for (const pattern of splitPatterns) {
    const match = sentence.match(pattern);
    if (match && match.index) {
      const splitPoint = match.index + (match[0].includes(',') || match[0].includes(';') ? 1 : 0);
      const firstPart = sentence.substring(0, splitPoint).trim();
      const secondPart = sentence.substring(splitPoint).trim();
      
      // Make sure both parts are reasonable length
      const firstWords = firstPart.split(/\s+/).length;
      const secondWords = secondPart.split(/\s+/).length;
      
      // Both halves must be substantial (8+ words) to avoid incomplete fragments
      if (firstWords >= 8 && secondWords >= 8) {
        // Clean up the first part - add period if it doesn't have one
        let first = firstPart;
        if (!first.match(/[.!?]$/)) {
          first = first.replace(/[,;]$/, '') + '.';
        }
        
        // Capitalize the second part — keep the conjunction so it reads naturally
        let second = secondPart.replace(/^[,;]\s*/, '');
        if (second.length > 0) {
          second = second.charAt(0).toUpperCase() + second.slice(1);
          // Add period if needed
          if (!second.match(/[.!?]$/)) {
            second = second + '.';
          }
        }
        
        // Recursively split if still too long
        const results: string[] = [];
        if (first.split(/\s+/).length > maxWords) {
          results.push(...splitLongSentence(first, maxWords));
        } else {
          results.push(first);
        }
        if (second.split(/\s+/).length > maxWords) {
          results.push(...splitLongSentence(second, maxWords));
        } else if (second.trim()) {
          results.push(second);
        }
        
        return results;
      }
    }
  }
  
  // If no good split point found, try splitting at halfway at a comma
  const commaPositions: number[] = [];
  let pos = 0;
  for (const word of words) {
    pos += word.length + 1;
    if (word.endsWith(',')) {
      commaPositions.push(pos);
    }
  }
  
  // Find comma closest to middle
  const midPoint = sentence.length / 2;
  let bestComma = -1;
  let bestDist = Infinity;
  for (const commaPos of commaPositions) {
    const dist = Math.abs(commaPos - midPoint);
    if (dist < bestDist) {
      bestDist = dist;
      bestComma = commaPos;
    }
  }
  
  if (bestComma > 0) {
    let first = sentence.substring(0, bestComma).trim();
    let second = sentence.substring(bestComma).trim();
    
    // Only split if both halves are substantial (8+ words)
    const firstLen = first.split(/\s+/).length;
    const secondLen = second.split(/\s+/).length;
    if (firstLen >= 8 && secondLen >= 8) {
      if (!first.match(/[.!?]$/)) {
        first = first.replace(/,$/, '') + '.';
      }
      if (second.length > 0) {
        second = second.charAt(0).toUpperCase() + second.slice(1);
        if (!second.match(/[.!?]$/)) {
          second = second + '.';
        }
      }
      
      return [first, second].filter(s => s.trim());
    }
  }
  
  // Last resort: return as-is rather than creating fragments
  return [sentence];
}

function expandToContractions(text: string): string {
  return text
    // Negatives
    .replace(/\bdo not\b/gi, "don't")
    .replace(/\bdoes not\b/gi, "doesn't")
    .replace(/\bdid not\b/gi, "didn't")
    .replace(/\bwill not\b/gi, "won't")
    .replace(/\bwould not\b/gi, "wouldn't")
    .replace(/\bcould not\b/gi, "couldn't")
    .replace(/\bshould not\b/gi, "shouldn't")
    .replace(/\bcannot\b/gi, "can't")
    .replace(/\bcan not\b/gi, "can't")
    .replace(/\bis not\b/gi, "isn't")
    .replace(/\bare not\b/gi, "aren't")
    .replace(/\bwas not\b/gi, "wasn't")
    .replace(/\bwere not\b/gi, "weren't")
    .replace(/\bhas not\b/gi, "hasn't")
    .replace(/\bhave not\b/gi, "haven't")
    .replace(/\bhad not\b/gi, "hadn't")
    .replace(/\bmust not\b/gi, "mustn't")
    .replace(/\bneed not\b/gi, "needn't")
    // Pronouns + be/have/will/would
    .replace(/\bit is\b/gi, "it's")
    .replace(/\bit has\b/gi, "it's")
    .replace(/\bit will\b/gi, "it'll")
    .replace(/\bthat is\b/gi, "that's")
    .replace(/\bthat has\b/gi, "that's")
    .replace(/\bthere is\b/gi, "there's")
    .replace(/\bthere has\b/gi, "there's")
    .replace(/\bhere is\b/gi, "here's")
    .replace(/\bwhat is\b/gi, "what's")
    .replace(/\bwho is\b/gi, "who's")
    .replace(/\bwhere is\b/gi, "where's")
    .replace(/\bhow is\b/gi, "how's")
    .replace(/\bI am\b/g, "I'm")
    .replace(/\bI have\b/g, "I've")
    .replace(/\bI will\b/g, "I'll")
    .replace(/\bI would\b/g, "I'd")
    .replace(/\bI had\b/g, "I'd")
    .replace(/\byou are\b/gi, "you're")
    .replace(/\byou have\b/gi, "you've")
    .replace(/\byou will\b/gi, "you'll")
    .replace(/\byou would\b/gi, "you'd")
    .replace(/\bwe are\b/gi, "we're")
    .replace(/\bwe have\b/gi, "we've")
    .replace(/\bwe will\b/gi, "we'll")
    .replace(/\bwe would\b/gi, "we'd")
    .replace(/\bthey are\b/gi, "they're")
    .replace(/\bthey have\b/gi, "they've")
    .replace(/\bthey will\b/gi, "they'll")
    .replace(/\bthey would\b/gi, "they'd")
    .replace(/\bhe is\b/gi, "he's")
    .replace(/\bhe has\b/gi, "he's")
    .replace(/\bhe will\b/gi, "he'll")
    .replace(/\bhe would\b/gi, "he'd")
    .replace(/\bshe is\b/gi, "she's")
    .replace(/\bshe has\b/gi, "she's")
    .replace(/\bshe will\b/gi, "she'll")
    .replace(/\bshe would\b/gi, "she'd")
    .replace(/\blet us\b/gi, "let's");
}

function contractionsToExpanded(text: string): string {
  // Use a function to preserve case
  const expandWithCase = (match: string, expanded: string): string => {
    if (match[0] === match[0].toUpperCase()) {
      return expanded.charAt(0).toUpperCase() + expanded.slice(1);
    }
    return expanded;
  };

  return text
    // Negatives
    .replace(/\bdon't\b/gi, m => expandWithCase(m, "do not"))
    .replace(/\bdoesn't\b/gi, m => expandWithCase(m, "does not"))
    .replace(/\bdidn't\b/gi, m => expandWithCase(m, "did not"))
    .replace(/\bwon't\b/gi, m => expandWithCase(m, "will not"))
    .replace(/\bwouldn't\b/gi, m => expandWithCase(m, "would not"))
    .replace(/\bcouldn't\b/gi, m => expandWithCase(m, "could not"))
    .replace(/\bshouldn't\b/gi, m => expandWithCase(m, "should not"))
    .replace(/\bcan't\b/gi, m => expandWithCase(m, "cannot"))
    .replace(/\bisn't\b/gi, m => expandWithCase(m, "is not"))
    .replace(/\baren't\b/gi, m => expandWithCase(m, "are not"))
    .replace(/\bwasn't\b/gi, m => expandWithCase(m, "was not"))
    .replace(/\bweren't\b/gi, m => expandWithCase(m, "were not"))
    .replace(/\bhasn't\b/gi, m => expandWithCase(m, "has not"))
    .replace(/\bhaven't\b/gi, m => expandWithCase(m, "have not"))
    .replace(/\bhadn't\b/gi, m => expandWithCase(m, "had not"))
    .replace(/\bmustn't\b/gi, m => expandWithCase(m, "must not"))
    .replace(/\bneedn't\b/gi, m => expandWithCase(m, "need not"))
    // Pronouns - these are trickier because 's can mean is/has
    .replace(/\bit's\b/gi, m => expandWithCase(m, "it is"))
    .replace(/\bthat's\b/gi, m => expandWithCase(m, "that is"))
    .replace(/\bthere's\b/gi, m => expandWithCase(m, "there is"))
    .replace(/\bhere's\b/gi, m => expandWithCase(m, "here is"))
    .replace(/\bwhat's\b/gi, m => expandWithCase(m, "what is"))
    .replace(/\bwho's\b/gi, m => expandWithCase(m, "who is"))
    .replace(/\bwhere's\b/gi, m => expandWithCase(m, "where is"))
    .replace(/\bhow's\b/gi, m => expandWithCase(m, "how is"))
    .replace(/\bit'll\b/gi, m => expandWithCase(m, "it will"))
    .replace(/\bI'm\b/g, "I am")
    .replace(/\bI've\b/g, "I have")
    .replace(/\bI'll\b/g, "I will")
    .replace(/\bI'd\b/g, "I would")
    .replace(/\byou're\b/gi, m => expandWithCase(m, "you are"))
    .replace(/\byou've\b/gi, m => expandWithCase(m, "you have"))
    .replace(/\byou'll\b/gi, m => expandWithCase(m, "you will"))
    .replace(/\byou'd\b/gi, m => expandWithCase(m, "you would"))
    .replace(/\bwe're\b/gi, m => expandWithCase(m, "we are"))
    .replace(/\bwe've\b/gi, m => expandWithCase(m, "we have"))
    .replace(/\bwe'll\b/gi, m => expandWithCase(m, "we will"))
    .replace(/\bwe'd\b/gi, m => expandWithCase(m, "we would"))
    .replace(/\bthey're\b/gi, m => expandWithCase(m, "they are"))
    .replace(/\bthey've\b/gi, m => expandWithCase(m, "they have"))
    .replace(/\bthey'll\b/gi, m => expandWithCase(m, "they will"))
    .replace(/\bthey'd\b/gi, m => expandWithCase(m, "they would"))
    .replace(/\bhe's\b/gi, m => expandWithCase(m, "he is"))
    .replace(/\bhe'll\b/gi, m => expandWithCase(m, "he will"))
    .replace(/\bhe'd\b/gi, m => expandWithCase(m, "he would"))
    .replace(/\bshe's\b/gi, m => expandWithCase(m, "she is"))
    .replace(/\bshe'll\b/gi, m => expandWithCase(m, "she will"))
    .replace(/\bshe'd\b/gi, m => expandWithCase(m, "she would"))
    .replace(/\blet's\b/gi, m => expandWithCase(m, "let us"));
}

function calculateStyleMatch(output: string, profile: any): { overallMatch: number; details: string[] } {
  if (!profile?.sampleExcerpt && !profile?.sampleExcerpts?.length) {
    return { overallMatch: 100, details: ['No style profile to compare'] };
  }

  const sampleText = profile.sampleExcerpts?.length 
    ? profile.sampleExcerpts.join('\n\n')
    : profile.sampleExcerpt;

  const userStyle = analyzeStyle(sampleText);
  const outputStyle = analyzeStyle(output);
  const details: string[] = [];
  let score = 0;

  // Check contraction match
  if (userStyle.usesContractions === outputStyle.usesContractions) {
    score += 50;
    details.push(`✓ Contraction style matches`);
  } else {
    details.push(`✗ Contraction style differs`);
  }

  // Check sentence length (within 30%)
  const lengthDiff = Math.abs(outputStyle.avgWordsPerSentence - userStyle.avgWordsPerSentence);
  if (lengthDiff < userStyle.avgWordsPerSentence * 0.3) {
    score += 50;
    details.push(`✓ Sentence length matches`);
  } else {
    details.push(`✗ Sentence length differs`);
  }

  return { overallMatch: score, details };
}

// =============================================================================
// QUALITY GATE — Repair fragment sentences created by post-processing
// =============================================================================

function repairFragments(text: string): string {
  const lines = text.split('\n');
  const result: string[] = [];

  for (const line of lines) {
    if (!line.trim()) { result.push(line); continue; }

    const sentences = line.split(/(?<=[.!?])\s+/);
    if (sentences.length < 2) { result.push(line); continue; }

    const repaired: string[] = [];
    for (let i = 0; i < sentences.length; i++) {
      const s = sentences[i].trim();
      if (!s) continue;

      const wordCount = s.split(/\s+/).length;

      // A sentence with fewer than 4 words is likely a fragment from over-splitting
      // Exception: it's fine if it's a question, exclamation, or starts with a conjunction
      const isIntentionallyShort = /^(And|But|So|Or|Yet|No|Yes|Sure|Right|Well|Okay|Oh|True)\b/i.test(s)
        || /[?!]$/.test(s)
        || /^\d/.test(s); // numbered items

      if (wordCount < 4 && !isIntentionallyShort && repaired.length > 0) {
        // Merge this fragment back into the previous sentence
        const prev = repaired[repaired.length - 1];
        const prevWithoutPeriod = prev.replace(/[.!?]$/, '');
        const fragContent = s.replace(/[.!?]$/, '');
        const fragLower = fragContent.charAt(0).toLowerCase() + fragContent.slice(1);
        repaired[repaired.length - 1] = prevWithoutPeriod + ', ' + fragLower + '.';
      } else if (wordCount < 4 && !isIntentionallyShort && repaired.length === 0 && i + 1 < sentences.length) {
        // First sentence is a fragment — merge it forward
        const next = sentences[i + 1].trim();
        const fragContent = s.replace(/[.!?]$/, '');
        const nextLower = next.charAt(0).toLowerCase() + next.slice(1);
        sentences[i + 1] = fragContent + ', ' + nextLower;
        // Skip this fragment, it's been merged into the next
        continue;
      } else {
        repaired.push(s);
      }
    }

    result.push(repaired.join(' '));
  }

  return result.join('\n');
}

// =============================================================================
// TEXT CLEANING
// =============================================================================

function cleanText(text: string): string {
  if (!text) return '';
  
  let result = text.trim();
  
  // Remove AI prefixes
  result = result.replace(/^(?:Here(?:'s| is)[^:]*:|Rewritten[^:]*:|Paraphrased[^:]*:|Sure[^:]*:)\s*/i, '');
  result = result.replace(/^(?:Of course[^:]*:|Certainly[^:]*:)\s*/i, '');
  
  // Remove trailing explanations
  result = result.replace(/\n\n(?:Note:|I (?:have |)(?:maintained|kept|preserved)[^\n]*)/gi, '');
  
  // Fix broken numbered list formatting: "1, the Baby Stage." → "1. Baby Stage"
  result = result.replace(/(\d+)\s*,\s*(?:the\s+)?(.)/g, (_, num, firstChar) => `${num}. ${firstChar.toUpperCase()}`);
  
  // Process line by line to preserve layout structure
  const lines = result.split('\n');
  const cleanedLines = lines.map(line => {
    let cleaned = line;
    if (!cleaned.trim()) return cleaned;

    // Fix punctuation within each line
    cleaned = cleaned.replace(/\s+([.!?,;:])/g, '$1');
    cleaned = cleaned.replace(/,\s*\./g, '.');
    cleaned = cleaned.replace(/\.\s*,/g, '.');
    cleaned = cleaned.replace(/,,+/g, ',');
    cleaned = cleaned.replace(/\.{2,}/g, '.');
    cleaned = cleaned.replace(/([.!?])([A-Za-z])/g, '$1 $2');
    // Remove orphan periods at start of line
    cleaned = cleaned.replace(/^\.\s*/g, '');
    // Remove space before period/comma at end
    cleaned = cleaned.replace(/\s+\.$/g, '.');
    // Collapse multiple spaces within line
    cleaned = cleaned.replace(/  +/g, ' ');

    // --- CAPITALIZATION ---
    // Capitalize the very first letter of the line
    cleaned = cleaned.replace(/^([a-z])/, (_, c) => c.toUpperCase());
    // Capitalize letter after sentence-ending punctuation + space
    cleaned = cleaned.replace(/([.!?])\s+([a-z])/g, (_, p, c) => `${p} ${c.toUpperCase()}`);
    // Fix "I" always capitalized when standalone word
    cleaned = cleaned.replace(/\bi\b(?=[^.''\u2019])/g, 'I');

    return cleaned.trim();
  });
  
  // Rejoin with preserved line breaks
  // Normalize multiple blank lines to max 2 (one empty line between paragraphs)
  result = cleanedLines.join('\n').replace(/\n{3,}/g, '\n\n');

  // Ensure every non-empty line that looks like a paragraph ends with punctuation
  result = result.replace(/^(.+[a-zA-Z,;])$/gm, (line) => {
    const trimmed = line.trim();
    // Skip bullet/list items and very short lines (headings etc.)
    if (/^[-•*]/.test(trimmed) || /^\d+[.)]:?/.test(trimmed)) return line;
    if (trimmed.split(/\s+/).length < 3) return line;
    if (!/[.!?]$/.test(trimmed)) return line + '.';
    return line;
  });
  
  return result.trim();
}

// =============================================================================
// OUTPUT METRICS - For Style Lock Panel
// =============================================================================

function calculateOutputMetrics(output: string, profile: any): {
  isHumanized: boolean;
  passes: number;
  sentenceCount: number;
  avgSentenceLength: number;
  uniqueTokenRatio: number;
  customLexiconPresent: number;
  actions: { code: string; meta?: any }[];
} {
  const sentences = output.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const words = output.toLowerCase().match(/\b[a-z]+\b/g) || [];
  const uniqueWords = new Set(words);
  
  // Count lexicon words present
  let lexiconHits = 0;
  if (profile?.customLexicon?.length) {
    for (const word of profile.customLexicon) {
      if (new RegExp(`\\b${word}\\b`, 'i').test(output)) {
        lexiconHits++;
      }
    }
  }

  // Generate actions based on what was applied
  const actions: { code: string; meta?: any }[] = [];
  
  const sampleText = profile?.sampleExcerpts?.length 
    ? profile.sampleExcerpts.join('\n\n')
    : profile?.sampleExcerpt;
    
  if (sampleText) {
    const userStyle = analyzeStyle(sampleText);
    
    // Check if contractions were applied/removed
    if (userStyle.usesContractions) {
      if (/\b(it's|don't|won't|can't|isn't|aren't)\b/i.test(output)) {
        actions.push({ code: 'applyContractions', meta: 'casual tone' });
      }
    } else {
      if (/\b(do not|does not|is not|are not|it is)\b/i.test(output)) {
        actions.push({ code: 'expandContractions', meta: 'formal tone' });
      }
    }
    
    // Check sentence length adjustment
    const avgWords = sentences.length > 0 
      ? sentences.reduce((sum, s) => sum + s.trim().split(/\s+/).length, 0) / sentences.length 
      : 0;
    
    if (Math.abs(avgWords - userStyle.avgWordsPerSentence) < 5) {
      actions.push({ code: 'matchSentenceLength', meta: { target: Math.round(userStyle.avgWordsPerSentence) } });
    }
    
    // Check transition words
    if (userStyle.transitions.length > 0) {
      const hasTransitions = userStyle.transitions.some(t => 
        new RegExp(`\\b${t}\\b`, 'i').test(output)
      );
      if (hasTransitions) {
        actions.push({ code: 'addTransitions', meta: userStyle.transitions.slice(0, 2).join(', ') });
      }
    }
  }

  return {
    isHumanized: true,
    passes: 1,
    sentenceCount: sentences.length,
    avgSentenceLength: sentences.length > 0 
      ? sentences.reduce((sum, s) => sum + s.trim().split(/\s+/).length, 0) / sentences.length * 6 // Multiply by ~6 for char approximation
      : 0,
    uniqueTokenRatio: words.length > 0 ? uniqueWords.size / words.length : 0,
    customLexiconPresent: lexiconHits,
    actions
  };
}
