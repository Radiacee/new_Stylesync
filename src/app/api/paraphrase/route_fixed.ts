import { NextRequest } from 'next/server';
import { paraphraseWithProfile, humanizeText, verifyAndFinalize, finalizeOutput } from '../../../lib/paraphrase.ts';
import { STYLE_RULE_PROMPT } from '../../../lib/styleRules.ts';
import { rateLimit, formatRateLimitHeaders } from '../../../lib/rateLimit.ts';
import { z } from 'zod';

const bodySchema = z.object({
  text: z.string().min(1).max(8000),
  useModel: z.boolean().optional(),
  profile: z.any().optional(),
  debug: z.boolean().optional(),
  preserveFormatting: z.boolean().optional()
});

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    // Rate limit by IP (replace with user ID after auth integration)
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
    const rl = rateLimit(`paraphrase:${ip}`);
    if (rl.limited) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded. Try later.' }), { status: 429, headers: { 'Content-Type': 'application/json', ...formatRateLimitHeaders(rl) } });
    }

    const json = await req.json();
    const { text, useModel, profile, debug, preserveFormatting } = bodySchema.parse(json);
    let output: string;

    // Simple API key auth for production usage gating (add per-user auth separately)
    const apiKeyHeader = req.headers.get('x-api-key');
    const serverApiKey = process.env.STYLESYNC_API_KEY;
    const authorized = !!(serverApiKey && apiKeyHeader && apiKeyHeader === serverApiKey);
    
    // Allow AI model in development mode or when properly authorized
    // For production deployment, allow model if GROQ key exists (remove STYLESYNC_API_KEY requirement temporarily)
    const isDevelopment = process.env.NODE_ENV !== 'production';
    const hasGroqKey = !!process.env.GROQ_API_KEY;
    
    console.log('=== AUTHORIZATION DEBUG ===');
    console.log('Environment:', process.env.NODE_ENV);
    console.log('Is development:', isDevelopment);
    console.log('Has server API key:', !!serverApiKey);
    console.log('Has client API key header:', !!apiKeyHeader);
    console.log('Keys match:', authorized);
    console.log('Has GROQ key:', hasGroqKey);

    // Allow model usage if: development mode OR production with GROQ key available
    const allowModel = (isDevelopment || hasGroqKey) && hasGroqKey;
    console.log('allowModel result:', allowModel);
    console.log('useModel from request:', useModel);
    
    let usedAIModel = false;
    if (allowModel && (useModel ?? true)) {
      console.log('=== USING AI MODEL ===');
      output = await modelParaphraseGroq(text, profile, preserveFormatting);
      usedAIModel = true;
    } else {
      console.log('=== USING FALLBACK ===', 'allowModel:', allowModel, 'useModel:', useModel);
      output = paraphraseWithProfile(text, profile, { preserveFormatting });
    }

  // Verification & iterative humanization (returns metrics).
  const lexiconOptions = { includeLexiconNotes: !usedAIModel };
  console.log('Passing lexicon options:', lexiconOptions);
  const { output: finalOut, metrics } = verifyAndFinalize(output, profile, 2, lexiconOptions);
  console.log('Before finalizeOutput, usedAIModel:', usedAIModel);
  const fin = finalizeOutput(finalOut, profile, lexiconOptions) as any;
  const resultText = typeof fin === 'string' ? fin : fin.text;
  
  // COMPREHENSIVE CLEANUP PIPELINE - Remove lexicon notes and validate structure
  let cleanedResultText = finalLexiconCleanup(resultText);
  cleanedResultText = validateAndFixSentenceStructure(cleanedResultText);
  
  // Final repetition check and cleanup
  cleanedResultText = finalRepetitionCleanup(cleanedResultText);
  
  const allowDebug = debug && (authorized || process.env.NODE_ENV !== 'production');
  const actions = allowDebug ? (typeof fin === 'string' ? [] : fin.actions) : [];
  const payload: any = { result: cleanedResultText, usedModel: !!allowModel };
  if (allowDebug) payload.metrics = metrics;
  if (allowDebug && actions.length) payload.actions = actions;
  return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...formatRateLimitHeaders(rl) }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Bad Request' }), { status: 400 });
  }
}

async function modelParaphraseGroq(text: string, profile: any, preserveFormatting: boolean = false) {
  try {
    const GroqMod = await import('groq-sdk');
    const Groq = (GroqMod as any).default ?? (GroqMod as any).Groq;
    const client = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const model = process.env.GROQ_MODEL || 'llama3-70b-8192';
    const temperature = Number(process.env.GROQ_TEMPERATURE || 0.3); // Lower temperature for more focused output
    const system = buildSystemPrompt(profile);
  const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: `Please paraphrase the following text while maintaining its exact meaning and factual content:\n\n${text}` }
      ],
      temperature,
      max_tokens: 4000,
      top_p: 1,
      stream: false,
    });
    
    const result = completion?.choices?.[0]?.message?.content?.trim();
    if (!result) {
      throw new Error('No response from Groq API');
    }
    
    console.log('RAW GROQ RESPONSE:', JSON.stringify(result));
    
    // Enhanced AI output sanitization
    const sanitized = sanitizeModelOutput(result);
    console.log('SANITIZED GROQ RESPONSE:', JSON.stringify(sanitized));
    
    // Apply additional cleanup for comma patterns
    const commaFixed = cleanupCommaPatterns(sanitized);
    console.log('COMMA-FIXED RESPONSE:', JSON.stringify(commaFixed));
    
    return commaFixed;
  } catch (error) {
    console.error('Error with Groq API:', error);
    throw new Error(`AI model error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function cleanupCommaPatterns(text: string): string {
  if (!text) return text;

  let cleaned = text;
  console.log('COMMA CLEANUP - Before:', JSON.stringify(cleaned));

  // Fix excessive comma patterns like ",,," which appear when lexicon words are missing
  cleaned = cleaned.replace(/,\s*,\s*,+/g, ','); // ",  , ," or ", ,," -> ","
  cleaned = cleaned.replace(/,\s*,\s*/g, ',');    // ", ," -> ","
  cleaned = cleaned.replace(/,{2,}/g, ',');       // ",," -> ","

  // Fix the specific patterns we're seeing: "data , uncovering insights , , that"
  cleaned = cleaned.replace(/(\w+)\s*,\s*,\s*,\s*(\w+)/g, '$1, $2');  // "word , , , word" -> "word, word"
  cleaned = cleaned.replace(/(\w+)\s*,\s*,\s*(\w+)/g, '$1, $2');      // "word , , word" -> "word, word"

  // Handle patterns where comma appears before conjunctions/words
  cleaned = cleaned.replace(/,\s*,\s*,\s*(that|which|who|when|where|how|why)\b/gi, ', $1');
  cleaned = cleaned.replace(/,\s*,\s*(that|which|who|when|where|how|why)\b/gi, ', $1');

  // Fix patterns around conjunctions
  cleaned = cleaned.replace(/\b(and|but|or|so|yet|for)\s*,\s*,\s*,/gi, '$1');
  cleaned = cleaned.replace(/\b(and|but|or|so|yet|for)\s*,\s*,/gi, '$1');

  // Handle patterns at sentence boundaries
  cleaned = cleaned.replace(/,\s*,\s*,\s*([.!?])/g, '$1');  // ", , ." -> "."
  cleaned = cleaned.replace(/,\s*,\s*([.!?])/g, '$1');      // ", ." -> "."

  // Clean up any remaining double commas that might have been created
  cleaned = cleaned.replace(/,\s*,/g, ',');

  // Fix spacing around commas (normalize)
  cleaned = cleaned.replace(/\s*,\s*/g, ', ');

  // Remove trailing comma patterns and fix sentence endings
  cleaned = cleaned.replace(/,\s*,\s*,?\s*$/g, '');
  cleaned = cleaned.replace(/,\s*$/g, '');

  // Handle edge cases with specific problematic patterns
  cleaned = cleaned.replace(/\b(process|inform|spark|ensure|produce|create|develop)\s+,\s*,\s*/gi, '$1 ');
  cleaned = cleaned.replace(/\b(data|insights|decisions|art|music|literature|innovation|technology)\s*,\s*,\s*/gi, '$1 ');

  console.log('COMMA CLEANUP - After:', JSON.stringify(cleaned));
  return cleaned.trim();
}

function buildSystemPrompt(profile: any): string {
  const base = STYLE_RULE_PROMPT + '\n\nCRITICAL: Preserve the exact meaning and all factual content. No fabrication of facts. Focus on sentence construction patterns rather than specific vocabulary. Maintain natural language flow and readability above all else.';
  if (!profile) return base;

  let stylePrompt = base + `\nProfile cues: Tone=${profile.tone}; Formality=${profile.formality}; Pacing=${profile.pacing}; Descriptiveness=${profile.descriptiveness}; Directness=${profile.directness}`;

  // Add detailed sample style analysis if available
  if (profile.sampleExcerpt && profile.styleAnalysis) {
    const analysis = profile.styleAnalysis;
    console.log('Style Analysis received:', JSON.stringify(analysis, null, 2));
    
    stylePrompt += '\n\nWRITING STYLE PATTERNS TO MIMIC:';
    stylePrompt += `\n- Sentence length: Average ${Math.round(analysis.avgSentenceLength)} words (±${Math.round(analysis.sentenceLengthStd)})`;
    stylePrompt += `\n- Word complexity: Average word length ${Math.round(analysis.avgWordLength)} chars, vocabulary complexity ${(analysis.vocabularyComplexity * 100).toFixed(1)}%`;
    
    if (analysis.usesContractions) {
      stylePrompt += '\n- Uses contractions (don\'t, it\'s, etc.)';
    } else {
      stylePrompt += '\n- Avoids contractions (formal writing)';
    }
    
    if (analysis.preferredTransitions && analysis.preferredTransitions.length > 0) {
      stylePrompt += `\n- Preferred transitions: ${analysis.preferredTransitions.slice(0, 3).join(', ')}`;
    }
    
    if (analysis.questionRatio > 0.1) {
      stylePrompt += `\n- Uses questions frequently (${(analysis.questionRatio * 100).toFixed(1)}% of sentences)`;
    }
    
    if (analysis.exclamatoryRatio > 0.1) {
      stylePrompt += `\n- Uses exclamations frequently (${(analysis.exclamatoryRatio * 100).toFixed(1)}% of sentences)`;
    }
    
    if (analysis.commonStarters && analysis.commonStarters.length > 0) {
      stylePrompt += `\n- Common sentence starters: ${analysis.commonStarters.slice(0, 3).join(', ')}`;
    }
    
    stylePrompt += `\n- Personal voice: ${analysis.personalVoice} perspective`;
    stylePrompt += `\n- Tone tendency: ${analysis.toneBalance}`;
    
    if (analysis.conjunctionDensity > 1) {
      stylePrompt += '\n- Uses many connecting words (and, but, because, etc.)';
    }
    
    if (analysis.adjectiveDensity > 0.1) {
      stylePrompt += `\n- Descriptive writing style (${(analysis.adjectiveDensity * 100).toFixed(1)}% descriptive words)`;
    } else {
      stylePrompt += '\n- Concise, minimal descriptive language';
    }

    // Add final instructions to prevent lexicon notes in output
    stylePrompt += '\n\nCRITICAL OUTPUT RULES:\n1. Output ONLY the paraphrased text. No notes, labels, explanations, or lists.\n2. Do NOT include phrases like "Lexicon notes:", "Words used:", "Vocabulary:", etc.\n3. Do NOT mention or list any vocabulary words used.\n4. NEVER insert vocabulary words where they break sentence structure or change meaning.\n5. Do NOT use excessive commas or placeholder punctuation - write naturally.\n6. The response must contain ONLY the clean paraphrased content - nothing else.\n7. Preserve all original facts, concepts, and meaning exactly.\n8. Use proper comma placement only where grammatically appropriate - avoid comma clusters like ",,," or unnecessary comma insertions.';
  }
  
  return stylePrompt;
}

function sanitizeModelOutput(s: string): string {
  if (!s) return s;
  
  console.log('BEFORE sanitization:', JSON.stringify(s.slice(0, 150), null, 2));
  console.log('BEFORE sanitization (end):', JSON.stringify(s.slice(-150)));
  
  // Remove leading common prefaces and prompt leakage
  s = s.replace(/^\s*(Here(?:'| i)s[^\n]*?:?\s*)/i, '');
  s = s.replace(/^\s*(Paraphrased (?:version|text)[:\-]?\s*)/i, '');
  s = s.replace(/^\s*(I(?:'ve| have)[^\n]*?:?\s*)/i, '');
  s = s.replace(/^\s*(A rewritten version of the text:\s*)/i, '');
  s = s.replace(/^\s*(Rewritten version:\s*)/i, '');
  s = s.replace(/^\s*(The rewritten text:\s*)/i, '');
  
  // Remove any system prompt leakage at the beginning
  s = s.replace(/^\s*(?:System|Assistant|User):\s*/i, '');
  s = s.replace(/^\s*(?:Paraphrase|Rewrite)[^\n]*?:\s*/i, '');
  
  // AGGRESSIVE: Remove problematic lexicon word insertions that break sentences
  s = s.replace(/\b(?:factually|especially|clearly|confidently|frequently)\s+(?:factually|especially|clearly|confidently|frequently)\b/gi, '');
  s = s.replace(/\b(?:in|at|of|to|with|by|for|from|into|onto|upon|during|before|after|through|across|around|between|among|within|without|beneath|beside|behind|beyond|above|below)\s+(?:factually|especially|clearly|confidently|frequently)\b/gi, '$1');
  s = s.replace(/\b(?:factually|especially|clearly|confidently|frequently)\s+(?:in|at|of|to|with|by|for|from|into|onto|upon|during|before|after|through|across|around|between|among|within|without|beneath|beside|behind|beyond|above|below)\b/gi, '$2');
  
  // Remove lexicon words that are inserted in grammatically wrong places
  s = s.replace(/\b(\w+)\s+(factually|especially|clearly|confidently|frequently)\s+(is|are|was|were|will|would|can|could|has|have|had|do|does|did)\b/gi, '$1 $3');
  s = s.replace(/\b(Artificial|Digital|Virtual|Social|Global|National|International|Local|Regional|Modern|Ancient|Current|Recent|Future|Past|Present)\s+(factually|especially|clearly|confidently|frequently)\s+(intelligence|media|reality|network|system|technology|development|advancement|progress|change)\b/gi, '$1 $3');
  
  // Remove trailing explanation sections
  const splitMarkers = /(\n\n(?:I['\s]?(?:ve| have) maintained|Tone:|Formality:|Pacing:|Descriptiveness:|Directness:|Note:|This maintains|The rewritten))/i;
  const m = s.split(splitMarkers);
  if (m.length > 1) {
    s = m[0].trim();
  }
  
  // Remove lexicon notes that might appear at the end
  s = s.replace(/\n\n?(?:Lexicon notes?:.*|Preferred (?:vocabulary|words?):.*|Custom lexicon:.*)$/gmi, '');
  s = s.replace(/\n\n?(?:Words? used:.*|Vocabulary applied:.*|Lexicon:.*|Custom words?:.*)$/gmi, '');
  
  // More aggressive lexicon note removal - handle various formats
  s = s.replace(/\s*Lexicon notes?:\s*[^\n]*$/gmi, '');
  s = s.replace(/\s*(?:Custom )?[Ll]exicon:\s*[^\n]*$/gmi, '');
  s = s.replace(/\s*(?:Preferred|Custom) (?:vocabulary|words?):\s*[^\n]*$/gmi, '');
  
  // SUPER AGGRESSIVE: Remove the exact pattern we're seeing
  s = s.replace(/\s*\.?\s*Lexicon notes:\s*especially,\s*clearly,\s*confidently,\s*factually,\s*frequently\s*$/gi, '');
  s = s.replace(/\s*especially,\s*clearly,\s*confidently,\s*factually,\s*frequently\s*$/gi, '');
  
  // Fix excessive comma patterns that appear when lexicon words are missing
  s = s.replace(/,\s*,\s*,/g, '');  // Remove triple commas
  s = s.replace(/,\s*,/g, ',');     // Fix double commas to single
  s = s.replace(/\s+,/g, ',');      // Fix space before comma
  s = s.replace(/,{2,}/g, ',');     // Multiple commas to single
  
  // Handle the specific problematic patterns we're seeing
  s = s.replace(/(\w+)\s*,\s*,\s*,\s*(that|which|who|when|where)/gi, '$1, $2');
  s = s.replace(/(\w+)\s*,\s*,\s*(that|which|who|when|where)/gi, '$1, $2');
  s = s.replace(/(\w+)\s*,\s*,\s*(inform|spark|ensure|produce|create)/gi, '$1 $2');
  
  // Remove comma patterns that appear when words are missing
  s = s.replace(/(\w+),\s*,\s*,\s*(\w+)/g, '$1, $2');
  s = s.replace(/(\w+)\s+,\s*,\s*,/g, '$1');
  s = s.replace(/,\s*,\s*,\s*([.!?])/g, '$1');
  
  // Clean up comma patterns around specific words that commonly get mangled
  s = s.replace(/\b(uncovering|producing|creating|ensuring|developing)\s+(insights|art|music|innovation)\s*,\s*,\s*/gi, '$1 $2 ');
  s = s.replace(/\b(process|analyze|examine|evaluate)\s+(data|information|content)\s*,\s*,\s*/gi, '$1 $2 ');
  
  // Remove specific lexicon word patterns (not any random word lists)
  const lexiconWords = ['especially', 'clearly', 'confidently', 'factually', 'frequently'];
  const lexiconPattern = lexiconWords.join('|');
  
  // Only remove word lists if they contain lexicon words
  s = s.replace(new RegExp(`\\s+(?:${lexiconPattern})(?:,\\s*(?:${lexiconPattern}|\\w+)){2,}\\s*$`, 'gi'), '');
  
  // Strip trailing explanation that starts with bullets or dashes
  s = s.replace(/\n\n(?:[-*•]\s.*)+$/gms, '');
  s = s.replace(/\n\n(?:Note:|This|The above).*$/gms, '');
  
  // Remove any standalone lexicon mentions anywhere in the text
  s = s.replace(/\b(?:Lexicon|Custom lexicon|Preferred vocabulary):\s*[^\n]*(?:\n|$)/gi, '');
  
  // Final cleanup - remove any remaining lexicon word combinations at the end
  s = s.replace(new RegExp(`\\s+(?:${lexiconPattern})(?:\\s*,\\s*(?:${lexiconPattern}))*\\s*$`, 'gi'), '');
  
  // Remove specific pattern "clearly, confidently. frequently." and variations
  s = s.replace(/\s*clearly,\s*confidently\.?\s*frequently\.?\s*$/gi, '');
  s = s.replace(/\s*,?\s*clearly,\s*confidently\.?\s*frequently\.?\s*$/gi, '');
  
  // Remove any trailing fragment with these specific lexicon words only
  s = s.replace(new RegExp(`\\s*(?:${lexiconPattern})(?:\\s*,\\s*(?:${lexiconPattern}))*\\.?\\s*$`, 'gi'), '');
  
  // Remove repetitive word patterns (basic detection)
  s = s.replace(/\b(\w+)(\s+\1){2,}\b/gi, '$1');
  
  // Remove incomplete sentences at the end
  const sentences = s.split(/(?<=[.!?])\s+/);
  if (sentences.length > 1) {
    const lastSentence = sentences[sentences.length - 1];
    if (!/[.!?]$/.test(lastSentence.trim()) && lastSentence.trim().length < 20) {
      sentences.pop();
      s = sentences.join(' ');
    }
  }
  
  const finalResult = s.trim();
  console.log('AFTER sanitization:', JSON.stringify(finalResult.slice(-100)));
  
  return finalResult;
}

// Placeholder functions for the cleanup pipeline - these would be imported from the lib files
function finalLexiconCleanup(text: string): string {
  return text; // This would contain the actual cleanup logic
}

function validateAndFixSentenceStructure(text: string): string {
  return text; // This would contain the actual validation logic
}

function finalRepetitionCleanup(text: string): string {
  return text; // This would contain the actual repetition cleanup logic
}
