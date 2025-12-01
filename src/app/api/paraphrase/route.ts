import { NextRequest } from 'next/server';
import { rateLimit, formatRateLimitHeaders } from '../../../lib/rateLimit.ts';
import { z } from 'zod';

const bodySchema = z.object({
  text: z.string().min(1).max(8000),
  useModel: z.boolean().optional(),
  profile: z.any().optional(),
  debug: z.boolean().optional(),
  stylePreset: z.enum(['original', 'formal', 'casual', 'academic', 'professional', 'creative']).optional(),
  styleInstructions: z.string().nullable().optional()
});

export const runtime = 'nodejs';

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
    const { text, useModel, profile, stylePreset, styleInstructions } = bodySchema.parse(json);

    const hasGroqKey = !!process.env.GROQ_API_KEY;
    const hasGeminiKey = !!process.env.GEMINI_API_KEY;
    const canUseAI = hasGroqKey || hasGeminiKey;
    
    let output: string;
    let usedAIModel = false;
    
    if (canUseAI && (useModel ?? true)) {
      // Use AI to paraphrase with user's style
      output = await paraphraseWithAI(text, profile, stylePreset, styleInstructions);
      usedAIModel = true;
    } else {
      // Simple fallback - just return cleaned text
      output = cleanText(text);
    }

    // Apply user's style post-processing
    if (profile?.sampleExcerpt) {
      output = applyUserStyle(output, profile);
    }

    // Calculate style match
    const styleMatch = calculateStyleMatch(output, profile);

    // Calculate detailed metrics for the style lock panel
    const outputMetrics = calculateOutputMetrics(output, profile);

    return new Response(JSON.stringify({ 
      result: output, 
      usedModel: usedAIModel,
      metrics: outputMetrics,
      actions: outputMetrics.actions,
      styleMatch
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
  styleInstructions?: string | null
): Promise<string> {
  const prompt = buildPrompt(profile, stylePreset, styleInstructions);
  
  try {
    return await callGroqAPI(text, prompt);
  } catch (e: any) {
    console.log('Groq failed, trying Gemini:', e?.message);
    try {
      return await callGeminiAPI(text, prompt);
    } catch (e2: any) {
      console.log('Gemini also failed:', e2?.message);
      return cleanText(text);
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
- Output ONLY the rewritten text`;
  }

  // No user samples - simple paraphrase
  if (!profile?.sampleExcerpt) {
    return `Rewrite this text in your own words. Keep all the information but express it differently. Output only the rewritten text.`;
  }

  // Build prompt based on user's writing style
  const userSample = profile.sampleExcerpt.slice(0, 2000);
  const analysis = analyzeStyle(userSample);
  
  // Extract unique words/phrases the user likes to use
  const userWords = extractUserVocabulary(userSample);

  // DON'T include the full sample - only the extracted style rules
  // This prevents the AI from copying content from the sample
  let prompt = `You are a writing style transformer. Your job is to rewrite text using a specific person's writing STYLE - NOT their content.

=== STYLE PROFILE (learned from their writing) ===`;

  // Formality level - sets overall tone
  if (analysis.formalityLevel === 'casual') {
    prompt += `
🎯 TONE: Casual, conversational, friendly`;
  } else if (analysis.formalityLevel === 'formal') {
    prompt += `
🎯 TONE: Formal, professional, polished`;
  } else {
    prompt += `
🎯 TONE: Balanced, neutral`;
  }

  // Contractions - very important style marker
  if (analysis.usesContractions) {
    prompt += `
✓ CONTRACTIONS: YES - always use "it's", "don't", "can't", "won't", "I'm", "they're"`;
  } else {
    prompt += `
✗ CONTRACTIONS: NO - always use "it is", "do not", "cannot", "will not", "I am"`;
  }

  // First person usage
  if (analysis.usesFirstPerson) {
    prompt += `
✓ FIRST PERSON: They use "I", "my", "we" frequently`;
  } else {
    prompt += `
✗ FIRST PERSON: They rarely use "I" or "we"`;
  }

  // Sentence structure
  if (analysis.avgWordsPerSentence > 22) {
    prompt += `
📏 SENTENCES: Long and complex (${Math.round(analysis.avgWordsPerSentence)} words avg)`;
  } else if (analysis.avgWordsPerSentence < 12) {
    prompt += `
📏 SENTENCES: Short and punchy (${Math.round(analysis.avgWordsPerSentence)} words avg)`;
  } else {
    prompt += `
📏 SENTENCES: Medium length (${Math.round(analysis.avgWordsPerSentence)} words avg)`;
  }

  // Questions and exclamations
  if (analysis.questionFrequency > 0.2) {
    prompt += `
❓ They often ask questions`;
  }
  if (analysis.exclamationFrequency > 0.15) {
    prompt += `
❗ They use exclamation marks for emphasis`;
  }

  // VOCABULARY COMPLEXITY - Critical for matching their voice
  if (analysis.vocabularyLevel === 'advanced') {
    prompt += `
🎓 VOCABULARY: ADVANCED/SOPHISTICATED
   - They use complex, academic words
   - Average word length: ${analysis.avgWordLength.toFixed(1)} characters
   - USE sophisticated vocabulary like: ${analysis.complexWords.length > 0 ? analysis.complexWords.join(', ') : 'elaborate, comprehensive, significant'}
   - Don't oversimplify - match their intellectual tone`;
  } else if (analysis.vocabularyLevel === 'simple') {
    prompt += `
📝 VOCABULARY: SIMPLE/EVERYDAY
   - They use common, easy-to-understand words
   - Average word length: ${analysis.avgWordLength.toFixed(1)} characters  
   - PREFER simple words like: ${analysis.simpleWords.length > 0 ? analysis.simpleWords.join(', ') : 'good, make, thing, way'}
   - AVOID complex/academic words - keep it accessible`;
  } else {
    prompt += `
📚 VOCABULARY: MODERATE/BALANCED
   - They mix common and moderately complex words
   - Average word length: ${analysis.avgWordLength.toFixed(1)} characters`;
    if (analysis.complexWords.length > 0) {
      prompt += `
   - Complex words they use: ${analysis.complexWords.join(', ')}`;
    }
    if (analysis.simpleWords.length > 0) {
      prompt += `
   - Simple words they prefer: ${analysis.simpleWords.join(', ')}`;
    }
  }

  // Transitions they use
  if (analysis.transitions.length > 0) {
    prompt += `
🔗 TRANSITIONS: ${analysis.transitions.join(', ')}`;
  }

  // Sentence starters they use
  if (analysis.sentenceStarters.length > 0) {
    prompt += `
📝 HOW THEY START SENTENCES: "${analysis.sentenceStarters.join('", "')}"`;
  }

  // Common phrases
  if (analysis.commonPhrases.length > 0) {
    prompt += `
💬 PHRASES THEY USE: "${analysis.commonPhrases.join('", "')}"`;
  }

  // Words they like to use
  if (userWords.length > 0) {
    prompt += `
📖 THEIR FAVORITE WORDS: ${userWords.slice(0, 12).join(', ')}`;
  }

  prompt += `

=== YOUR TASK ===
Rewrite the INPUT TEXT using the style rules above.

⚠️ CRITICAL - DO NOT:
- Add any new information not in the input
- Copy phrases or sentences from any other source
- Include content from anywhere except the input text

✅ YOU MUST:
1. Keep 100% of the facts and information from the INPUT TEXT
2. Apply the style rules: contractions=${analysis.usesContractions ? 'YES' : 'NO'}, vocabulary=${analysis.vocabularyLevel}, sentence length≈${Math.round(analysis.avgWordsPerSentence)} words
3. Use their preferred words and phrases where they fit naturally
4. Output ONLY the rewritten text - nothing else`;

  return prompt;
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

async function callGroqAPI(text: string, systemPrompt: string): Promise<string> {
  const GroqMod = await import('groq-sdk');
  const Groq = (GroqMod as any).default ?? (GroqMod as any).Groq;
  const client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  
  const completion = await client.chat.completions.create({
    model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    temperature: 0.8,
    max_tokens: Math.min(3000, Math.max(500, text.length * 2)),
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Rewrite this in that person's voice:\n\n${text}` }
    ]
  });
  
  const result = completion.choices?.[0]?.message?.content?.trim() || '';
  return cleanText(result) || text;
}

async function callGeminiAPI(text: string, systemPrompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('No Gemini API key');
  
  const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: `${systemPrompt}\n\nRewrite this in that person's voice:\n\n${text}` }]
      }],
      generationConfig: { 
        temperature: 0.8,
        maxOutputTokens: Math.min(3000, Math.max(500, text.length * 2)) 
      }
    })
  });
  
  if (!response.ok) throw new Error(`Gemini error: ${response.status}`);
  
  const data = await response.json();
  const result = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
  return cleanText(result) || text;
}

// =============================================================================
// STYLE ANALYSIS & APPLICATION
// =============================================================================

interface DetailedStyleAnalysis {
  usesContractions: boolean;
  avgWordsPerSentence: number;
  transitions: string[];
  // New detailed analysis
  sentenceStarters: string[];
  commonPhrases: string[];
  formalityLevel: 'casual' | 'neutral' | 'formal';
  usesFirstPerson: boolean;
  questionFrequency: number;
  exclamationFrequency: number;
  // Vocabulary complexity
  vocabularyLevel: 'simple' | 'moderate' | 'advanced';
  avgWordLength: number;
  complexWords: string[];
  simpleWords: string[];
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
    simpleWords: topSimpleWords
  };
}

function applyUserStyle(text: string, profile: any): string {
  if (!profile?.sampleExcerpt) return text;

  const analysis = analyzeStyle(profile.sampleExcerpt);
  let result = text;

  // Apply contraction preference
  if (analysis.usesContractions) {
    result = expandToContractions(result);
  } else {
    result = contractionsToExpanded(result);
  }

  return cleanText(result);
}

function expandToContractions(text: string): string {
  return text
    .replace(/\bdo not\b/gi, "don't")
    .replace(/\bdoes not\b/gi, "doesn't")
    .replace(/\bdid not\b/gi, "didn't")
    .replace(/\bwill not\b/gi, "won't")
    .replace(/\bwould not\b/gi, "wouldn't")
    .replace(/\bcould not\b/gi, "couldn't")
    .replace(/\bshould not\b/gi, "shouldn't")
    .replace(/\bcannot\b/gi, "can't")
    .replace(/\bis not\b/gi, "isn't")
    .replace(/\bare not\b/gi, "aren't")
    .replace(/\bwas not\b/gi, "wasn't")
    .replace(/\bwere not\b/gi, "weren't")
    .replace(/\bhas not\b/gi, "hasn't")
    .replace(/\bhave not\b/gi, "haven't")
    .replace(/\bhad not\b/gi, "hadn't")
    .replace(/\bit is\b/gi, "it's")
    .replace(/\bthat is\b/gi, "that's")
    .replace(/\bthere is\b/gi, "there's")
    .replace(/\bI am\b/g, "I'm")
    .replace(/\byou are\b/gi, "you're")
    .replace(/\bwe are\b/gi, "we're")
    .replace(/\bthey are\b/gi, "they're");
}

function contractionsToExpanded(text: string): string {
  return text
    .replace(/\bdon't\b/gi, "do not")
    .replace(/\bdoesn't\b/gi, "does not")
    .replace(/\bdidn't\b/gi, "did not")
    .replace(/\bwon't\b/gi, "will not")
    .replace(/\bwouldn't\b/gi, "would not")
    .replace(/\bcouldn't\b/gi, "could not")
    .replace(/\bshouldn't\b/gi, "should not")
    .replace(/\bcan't\b/gi, "cannot")
    .replace(/\bisn't\b/gi, "is not")
    .replace(/\baren't\b/gi, "are not")
    .replace(/\bwasn't\b/gi, "was not")
    .replace(/\bweren't\b/gi, "were not")
    .replace(/\bhasn't\b/gi, "has not")
    .replace(/\bhaven't\b/gi, "have not")
    .replace(/\bhadn't\b/gi, "had not")
    .replace(/\bit's\b/gi, "it is")
    .replace(/\bthat's\b/gi, "that is")
    .replace(/\bthere's\b/gi, "there is")
    .replace(/\bI'm\b/g, "I am")
    .replace(/\byou're\b/gi, "you are")
    .replace(/\bwe're\b/gi, "we are")
    .replace(/\bthey're\b/gi, "they are");
}

function calculateStyleMatch(output: string, profile: any): { overallMatch: number; details: string[] } {
  if (!profile?.sampleExcerpt) {
    return { overallMatch: 100, details: ['No style profile to compare'] };
  }

  const userStyle = analyzeStyle(profile.sampleExcerpt);
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
  
  // Fix punctuation
  result = result.replace(/\s+([.!?,;:])/g, '$1');
  result = result.replace(/,\s*\./g, '.');
  result = result.replace(/\.\s*,/g, '.');
  result = result.replace(/,,+/g, ',');
  result = result.replace(/\.\.+/g, '.');
  result = result.replace(/([.!?])([A-Za-z])/g, '$1 $2');
  result = result.replace(/\s{2,}/g, ' ');
  
  // Ensure proper ending
  if (result && !/[.!?]$/.test(result)) {
    result += '.';
  }
  
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
  
  if (profile?.sampleExcerpt) {
    const userStyle = analyzeStyle(profile.sampleExcerpt);
    
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
