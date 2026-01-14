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

// Check style match using SAME logic as StyleProofPanel
function checkStyleMatch(sampleText: string, output: string): {
  contractions: { match: boolean; score: number };
  sentenceLength: { match: boolean; score: number; diff: number };
  vocabulary: { match: boolean; score: number };
  transitions: { match: boolean; score: number };
  overallScore: number;
} {
  // 1. CONTRACTIONS (same as StyleProofPanel)
  const userContractions = countContractions(sampleText);
  const userExpanded = countExpanded(sampleText);
  const resultContractions = countContractions(output);
  const resultExpanded = countExpanded(output);
  
  const userUsesContractions = userContractions > userExpanded;
  const resultUsesContractions = resultContractions > resultExpanded;
  const contractionsMatch = userUsesContractions === resultUsesContractions;
  
  // 2. SENTENCE LENGTH (same as StyleProofPanel)
  const userAvg = getAvgSentenceLength(sampleText);
  const resultAvg = getAvgSentenceLength(output);
  const lengthDiff = Math.abs(userAvg - resultAvg);
  const sentenceLengthScore = lengthDiff < 5 ? 100 : lengthDiff < 8 ? 75 : lengthDiff < 12 ? 50 : 0;
  
  // 3. VOCABULARY (same as StyleProofPanel)
  const userVocab = getVocabularyLevel(sampleText);
  const resultVocab = getVocabularyLevel(output);
  const vocabMatch = userVocab === resultVocab;
  
  // 4. TRANSITIONS (same as StyleProofPanel)
  const userTransitions = countTransitions(sampleText);
  const resultTransitions = countTransitions(output);
  const userUsesTransitions = userTransitions >= 2;
  const resultUsesTransitions = resultTransitions >= 2;
  const transitionMatch = userUsesTransitions === resultUsesTransitions;
  
  // Calculate overall score (same weights as StyleProofPanel)
  const scores = [
    contractionsMatch ? 100 : 0,
    sentenceLengthScore,
    vocabMatch ? 100 : 50,
    transitionMatch ? 75 : 50
  ];
  const overallScore = Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length);
  
  return {
    contractions: { match: contractionsMatch, score: contractionsMatch ? 100 : 0 },
    sentenceLength: { match: lengthDiff < 8, score: sentenceLengthScore, diff: lengthDiff },
    vocabulary: { match: vocabMatch, score: vocabMatch ? 100 : 50 },
    transitions: { match: transitionMatch, score: transitionMatch ? 75 : 50 },
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
  let styleBreakdown = {
    contractions: { match: true, score: 100 },
    sentenceLength: { match: true, score: 100, diff: 0 },
    vocabulary: { match: true, score: 100 },
    transitions: { match: true, score: 75 }
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
    let verificationResult: VerificationResult;
    
    if (canUseAI && (useModel ?? true)) {
      // Use AI to paraphrase with user's style
      output = await paraphraseWithAI(text, profile, stylePreset, styleInstructions);
      usedAIModel = true;
      
      // Verify output quality and fix issues
      verificationResult = verifyOutput(text, output, profile);
      
      // Apply automatic fixes if issues detected
      if (verificationResult.fixes.length > 0) {
        output = applyAutomaticFixes(output, verificationResult.fixes, text, profile);
        // Re-verify after fixes
        verificationResult = verifyOutput(text, output, profile);
      }
      
      // If quality is still too low (score < 60), try once more with stricter prompt
      if (verificationResult.score < 60) {
        console.log('Quality too low, retrying with stricter prompt...');
        const retryOutput = await paraphraseWithAI(text, profile, stylePreset, styleInstructions);
        const retryVerification = verifyOutput(text, retryOutput, profile);
        
        // Use retry if it's better
        if (retryVerification.score > verificationResult.score) {
          output = retryOutput;
          verificationResult = retryVerification;
        }
      }
    } else {
      // Simple fallback - just return cleaned text
      output = cleanText(text);
      verificationResult = { 
        score: 100, 
        issues: [], 
        fixes: [], 
        passed: true,
        styleBreakdown: {
          contractions: { match: true, score: 100 },
          sentenceLength: { match: true, score: 100, diff: 0 },
          vocabulary: { match: true, score: 100 },
          transitions: { match: true, score: 75 }
        }
      };
    }

    // Apply user's style post-processing (strict contraction/expansion enforcement)
    if (profile?.sampleExcerpt || profile?.sampleExcerpts?.length) {
      output = applyUserStyle(output, profile);
      // Final verification after style application
      verificationResult = verifyOutput(text, output, profile);
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
      styleMatch,
      verification: verificationResult
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
- PRESERVE THE EXACT STRUCTURE: Keep all line breaks, paragraphs, and bullet points in the same positions
- Output ONLY the rewritten text`;
  }

  // No user samples - simple paraphrase
  if (!profile?.sampleExcerpt) {
    return `Rewrite this text in your own words. Keep all the information but express it differently.

IMPORTANT: Preserve the exact layout - keep all line breaks, paragraphs, bullet points, and numbered lists in the same positions as the original.

Output only the rewritten text.`;
  }

  // Get the user's sample(s)
  const allSamples = profile.sampleExcerpts?.length 
    ? profile.sampleExcerpts.join('\n\n')
    : profile.sampleExcerpt;
  const userSample = allSamples.slice(0, 3000);
  const analysis = analyzeStyle(userSample);
  
  // Extract unique words/phrases the user likes to use
  const userWords = extractUserVocabulary(userSample);
  
  // Extract example sentences from user's writing (for demonstration)
  const exampleSentences = extractExampleSentences(userSample, 4);

  // Build a precise, example-driven prompt
  let prompt = `You are an expert ghostwriter. Your task is to rewrite text EXACTLY as a specific person would write it.

═══════════════════════════════════════════
WRITING STYLE DNA (COPY THIS PRECISELY)
═══════════════════════════════════════════`;

  // Show REAL examples from their writing
  if (exampleSentences.length > 0) {
    prompt += `

📝 EXAMPLES FROM THEIR ACTUAL WRITING:
${exampleSentences.map((s, i) => `${i + 1}. "${s}"`).join('\n')}

Study these examples. Notice their word choices, rhythm, and structure. Your output should read like these.`;
  }

  // CONTRACTIONS - Most important style marker
  prompt += `

═══════════════════════════════════════════
MANDATORY STYLE RULES (FOLLOW EXACTLY)
═══════════════════════════════════════════`;

  if (analysis.usesContractions) {
    prompt += `

✓ CONTRACTIONS: ALWAYS USE
   - Write "it's" NOT "it is"
   - Write "don't" NOT "do not"  
   - Write "can't" NOT "cannot"
   - Write "won't" NOT "will not"
   - Write "I'm" NOT "I am"
   - Write "they're" NOT "they are"
   - Write "you're" NOT "you are"
   This person ALWAYS uses contractions. This is non-negotiable.`;
  } else {
    prompt += `

✗ CONTRACTIONS: NEVER USE
   - Write "it is" NOT "it's"
   - Write "do not" NOT "don't"
   - Write "cannot" NOT "can't"
   - Write "will not" NOT "won't"
   - Write "I am" NOT "I'm"
   - Write "they are" NOT "they're"
   - Write "you are" NOT "you're"
   This person NEVER uses contractions. This is non-negotiable.`;
  }

  // SENTENCE LENGTH - Critical for matching their voice
  const avgWords = Math.round(analysis.avgWordsPerSentence);
  const minWords = Math.max(5, avgWords - 5);
  const maxWords = avgWords + 5;
  
  if (avgWords > 22) {
    prompt += `

📏 SENTENCE LENGTH: LONG (Target: ${avgWords} words per sentence)
   - Write flowing, complex sentences (${minWords}-${maxWords} words each)
   - Use commas to connect related ideas
   - Their sentences develop ideas fully
   ⚠️ HARD LIMIT: Each sentence should be ${minWords}-${maxWords} words`;
  } else if (avgWords < 12) {
    prompt += `

📏 SENTENCE LENGTH: SHORT (Target: ${avgWords} words per sentence)
   ⚠️ CRITICAL: Keep EVERY sentence under ${maxWords} words!
   - One clear idea per sentence
   - Use periods frequently to break up thoughts
   - If a sentence gets long, SPLIT IT into two
   - Their writing is direct and punchy
   ⚠️ HARD LIMIT: NO sentence over ${maxWords} words!`;
  } else {
    prompt += `

📏 SENTENCE LENGTH: MEDIUM (Target: ${avgWords} words per sentence)
   - Aim for ${minWords}-${maxWords} words per sentence
   - Mix of sentence lengths, but stay close to ${avgWords} average
   ⚠️ AVOID sentences longer than ${maxWords + 5} words`;
  }

  // VOCABULARY - Match their word complexity
  if (analysis.vocabularyLevel === 'advanced') {
    prompt += `

🎓 VOCABULARY: SOPHISTICATED
   - Use complex, precise words
   - Don't oversimplify - they're intellectual`;
    if (analysis.complexWords.length > 0) {
      prompt += `
   - Words they use: ${analysis.complexWords.slice(0, 6).join(', ')}`;
    }
  } else if (analysis.vocabularyLevel === 'simple') {
    prompt += `

📝 VOCABULARY: SIMPLE & CLEAR
   - Use everyday, common words
   - Avoid jargon or complex terms`;
    if (analysis.simpleWords.length > 0) {
      prompt += `
   - Words they prefer: ${analysis.simpleWords.slice(0, 6).join(', ')}`;
    }
  } else {
    prompt += `

📚 VOCABULARY: BALANCED
   - Mix of common and moderately complex words`;
  }

  // TRANSITIONS they use
  if (analysis.transitions.length > 0) {
    prompt += `

🔗 TRANSITIONS THEY USE: ${analysis.transitions.join(', ')}
   - Incorporate these to connect ideas`;
  }

  // Their signature words
  if (userWords.length > 0) {
    prompt += `

⭐ THEIR SIGNATURE WORDS (use where natural):
   ${userWords.slice(0, 10).join(', ')}`;
  }

  // Common phrases they use
  if (analysis.commonPhrases.length > 0) {
    prompt += `

💬 PHRASES THEY USE:
   "${analysis.commonPhrases.slice(0, 4).join('", "')}"`;
  }

  // Questions/exclamations
  if (analysis.questionFrequency > 0.15) {
    prompt += `

❓ They often use rhetorical questions`;
  }
  if (analysis.exclamationFrequency > 0.1) {
    prompt += `

❗ They use exclamation marks for emphasis`;
  }

  prompt += `

═══════════════════════════════════════════
YOUR TASK
═══════════════════════════════════════════

Rewrite the INPUT TEXT so it sounds EXACTLY like this person wrote it.

ABSOLUTE REQUIREMENTS:
1. ${analysis.usesContractions ? 'USE contractions (don\'t, it\'s, can\'t, won\'t)' : 'NEVER use contractions (write "do not", "it is", "cannot")'}
2. SENTENCE LENGTH: Target ${avgWords} words per sentence (range: ${minWords}-${maxWords}). ${avgWords < 15 ? 'BREAK LONG SENTENCES into shorter ones!' : ''}
3. Keep 100% of the original facts and meaning
4. Sound natural - like they actually wrote it
5. PRESERVE LAYOUT: Keep all line breaks, paragraphs, bullet points, and numbered lists in the EXACT same positions

OUTPUT: Only the rewritten text. No explanations, no notes.`;

  return prompt;
}

// Extract good example sentences from user's writing
function extractExampleSentences(sample: string, count: number): string[] {
  const sentences = sample.split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => {
      const words = s.split(/\s+/).length;
      return words >= 8 && words <= 30 && s.length > 20;
    });
  
  // Get diverse examples
  const selected: string[] = [];
  const step = Math.max(1, Math.floor(sentences.length / count));
  
  for (let i = 0; i < sentences.length && selected.length < count; i += step) {
    const sentence = sentences[i];
    // Don't include sentences that are too similar to already selected ones
    const isDuplicate = selected.some(s => 
      s.toLowerCase().slice(0, 20) === sentence.toLowerCase().slice(0, 20)
    );
    if (!isDuplicate) {
      selected.push(sentence);
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

async function callGroqAPI(text: string, systemPrompt: string): Promise<string> {
  const GroqMod = await import('groq-sdk');
  const Groq = (GroqMod as any).default ?? (GroqMod as any).Groq;
  const client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  
  const completion = await client.chat.completions.create({
    model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    temperature: 0.5, // Lower temperature for more consistent style matching
    max_tokens: Math.min(4000, Math.max(500, text.length * 2)),
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `INPUT TEXT TO REWRITE:\n\n${text}` }
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
        parts: [{ text: `${systemPrompt}\n\nINPUT TEXT TO REWRITE:\n\n${text}` }]
      }],
      generationConfig: { 
        temperature: 0.5, // Lower temperature for more consistent style matching
        maxOutputTokens: Math.min(4000, Math.max(500, text.length * 2)) 
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
  if (!profile?.sampleExcerpt && !profile?.sampleExcerpts?.length) return text;

  const sampleText = profile.sampleExcerpts?.length 
    ? profile.sampleExcerpts.join('\n\n')
    : profile.sampleExcerpt;
    
  const analysis = analyzeStyle(sampleText);
  let result = text;

  // 1. CONTRACTIONS - Most important style marker
  // Apply this STRICTLY - the AI sometimes ignores the instruction
  if (analysis.usesContractions) {
    result = expandToContractions(result);
  } else {
    result = contractionsToExpanded(result);
  }

  // 2. SENTENCE LENGTH - Break up long sentences if user prefers short ones
  const userAvgLength = analysis.avgWordsPerSentence;
  if (userAvgLength < 15) {
    result = adjustSentenceLength(result, userAvgLength);
  }

  // 3. Clean up the text
  result = cleanText(result);

  return result;
}

// Break up sentences that are too long compared to user's style
function adjustSentenceLength(text: string, targetAvg: number): string {
  const maxWords = Math.round(targetAvg + 8); // Allow some flexibility
  const lines = text.split('\n');
  
  return lines.map(line => {
    if (!line.trim()) return line;
    
    // Split into sentences
    const sentences = line.split(/(?<=[.!?])\s+/);
    const adjustedSentences: string[] = [];
    
    for (const sentence of sentences) {
      const words = sentence.trim().split(/\s+/);
      
      if (words.length > maxWords) {
        // Try to split the sentence at natural break points
        const split = splitLongSentence(sentence, maxWords);
        adjustedSentences.push(...split);
      } else {
        adjustedSentences.push(sentence);
      }
    }
    
    return adjustedSentences.join(' ');
  }).join('\n');
}

// Split a long sentence at natural break points
function splitLongSentence(sentence: string, maxWords: number): string[] {
  const words = sentence.trim().split(/\s+/);
  if (words.length <= maxWords) return [sentence];
  
  // Look for natural split points: conjunctions, commas + conjunctions
  const splitPatterns = [
    /,\s*(and|but|so|yet|or|however|therefore|moreover|furthermore|additionally|meanwhile|consequently)\s/i,
    /;\s/,
    /,\s*(which|who|that)\s/i,
    /\s(and|but|so|yet)\s/i,
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
      
      if (firstWords >= 5 && secondWords >= 5) {
        // Clean up the first part - add period if it doesn't have one
        let first = firstPart;
        if (!first.match(/[.!?]$/)) {
          first = first.replace(/[,;]$/, '') + '.';
        }
        
        // Capitalize the second part
        let second = secondPart.replace(/^[,;]\s*/, '');
        if (second.length > 0) {
          // Remove leading conjunction if present at start (it's now a new sentence)
          second = second.replace(/^(and|but|so|yet|or)\s+/i, '');
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
  
  // Last resort: return as-is
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
  
  // Process line by line to preserve layout structure
  const lines = result.split('\n');
  const cleanedLines = lines.map(line => {
    let cleaned = line;
    // Fix punctuation within each line
    cleaned = cleaned.replace(/\s+([.!?,;:])/g, '$1');
    cleaned = cleaned.replace(/,\s*\./g, '.');
    cleaned = cleaned.replace(/\.\s*,/g, '.');
    cleaned = cleaned.replace(/,,+/g, ',');
    cleaned = cleaned.replace(/\.\.+/g, '.');
    cleaned = cleaned.replace(/([.!?])([A-Za-z])/g, '$1 $2');
    // Collapse multiple spaces within line (but not newlines)
    cleaned = cleaned.replace(/  +/g, ' ');
    return cleaned.trim();
  });
  
  // Rejoin with preserved line breaks
  // Normalize multiple blank lines to max 2 (one empty line between paragraphs)
  result = cleanedLines.join('\n').replace(/\n{3,}/g, '\n\n');
  
  // Only add period if the last non-empty line doesn't end with punctuation
  const lastLine = cleanedLines.filter(l => l.trim()).pop() || '';
  if (lastLine && !/[.!?]$/.test(lastLine.trim())) {
    // Find and fix the last line
    result = result.replace(/(\S)(\s*)$/, '$1.$2');
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
