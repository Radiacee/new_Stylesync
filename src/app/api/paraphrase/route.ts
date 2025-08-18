import { NextRequest } from 'next/server';
import { paraphraseWithProfile, humanizeText, verifyAndFinalize, finalizeOutput } from '../../../lib/paraphrase.ts';
import { STYLE_RULE_PROMPT } from '../../../lib/styleRules.ts';
import { rateLimit, formatRateLimitHeaders } from '../../../lib/rateLimit.ts';
import { z } from 'zod';

const bodySchema = z.object({
  text: z.string().min(1).max(8000),
  useModel: z.boolean().optional(),
  profile: z.any().optional(),
  debug: z.boolean().optional()
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
    const { text, useModel, profile, debug } = bodySchema.parse(json);
    let output: string;

    // Simple API key auth for production usage gating (add per-user auth separately)
    const apiKeyHeader = req.headers.get('x-api-key');
    const serverApiKey = process.env.STYLESYNC_API_KEY;
    const authorized = !!(serverApiKey && apiKeyHeader && apiKeyHeader === serverApiKey);
    
    // Allow AI model in development mode or when properly authorized
    const isDevelopment = process.env.NODE_ENV !== 'production';
    
    console.log('=== AUTHORIZATION DEBUG ===');
    console.log('Environment:', process.env.NODE_ENV);
    console.log('Is development:', isDevelopment);
    console.log('Has server API key:', !!serverApiKey);
    console.log('Has client API key header:', !!apiKeyHeader);
    console.log('Keys match:', authorized);
    console.log('Has GROQ key:', !!process.env.GROQ_API_KEY);

    const allowModel = (isDevelopment || authorized) && process.env.GROQ_API_KEY;
    console.log('allowModel result:', allowModel);
    console.log('useModel from request:', useModel);
    
    let usedAIModel = false;
    if (allowModel && (useModel ?? true)) {
      console.log('=== USING AI MODEL ===');
      output = await modelParaphraseGroq(text, profile);
      usedAIModel = true;
    } else {
      console.log('=== USING FALLBACK ===', 'allowModel:', allowModel, 'useModel:', useModel);
      output = paraphraseWithProfile(text, profile);
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

async function modelParaphraseGroq(text: string, profile: any) {
  try {
    const GroqMod = await import('groq-sdk');
    const Groq = (GroqMod as any).default ?? (GroqMod as any).Groq;
    const client = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const model = process.env.GROQ_MODEL || 'llama3-70b-8192';
    const temperature = Number(process.env.GROQ_TEMPERATURE || 0.3); // Lower temperature for more focused output
    const system = buildSystemPrompt(profile);
  const completion = await client.chat.completions.create({
      model,
      temperature,
      max_tokens: Math.min(2000, Math.max(100, text.length * 2)), // Prevent excessive length
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: `Paraphrase the text below maintaining the EXACT same meaning. Focus on mimicking the user's sentence construction patterns, clause usage, and punctuation habits. Pay attention to how sentences are built: their complexity, conjunction usage, modifier placement, and overall flow. 

CRITICAL: The meaning must stay identical. Do not add, remove, or change any facts, concepts, or ideas. Only change the wording and sentence structure while preserving all original information.

Output ONLY the rewritten text itself with no preface, explanation, notes, or commentary.

Text:
${text}` }
      ]
    });
  const raw = completion.choices?.[0]?.message?.content?.trim() || '';
  console.log('AI raw response:', JSON.stringify(raw.slice(-100)));
  let cleaned = humanizeText(sanitizeModelOutput(raw));
  
  // Clean up excessive comma patterns that appear when lexicon is empty
  cleaned = cleanupCommaPatterns(cleaned);
  
  console.log('Final cleaned result:', JSON.stringify(cleaned.slice(-100)));
  
  // If AI provided content, use it; otherwise fallback without lexicon notes
  if (cleaned && cleaned.length > 10) {
    return cleaned;
  } else {
    console.log('AI response was empty/short, using fallback');
    return paraphraseWithProfile(text, profile, { includeLexiconNotes: false });
  }
  } catch (e: any) {
    console.log('AI request failed, using fallback:', e?.message || e);
    return paraphraseWithProfile(text, profile, { includeLexiconNotes: false });
  }
}

function cleanupCommaPatterns(text: string): string {
  if (!text) return text;
  
  let cleaned = text;
  console.log('COMMA CLEANUP - Before:', JSON.stringify(cleaned));
  
  // Fix excessive comma patterns like ",,," which appear when lexicon words are missing
  // Handle all variations of comma spacing patterns
  
  // 1. Multiple commas with any spacing - most comprehensive first
  cleaned = cleaned.replace(/,\s*,\s*,+/g, ','); // ",  , ," or ", ,," -> ","
  cleaned = cleaned.replace(/,\s*,\s*/g, ',');    // ", ," -> ","
  cleaned = cleaned.replace(/,{2,}/g, ',');       // ",," -> ","
  
  // 2. Fix the specific patterns we're seeing: "data , uncovering insights , , that"
  cleaned = cleaned.replace(/(\w+)\s*,\s*,\s*,\s*(\w+)/g, '$1, $2');  // "word , , , word" -> "word, word"
  cleaned = cleaned.replace(/(\w+)\s*,\s*,\s*(\w+)/g, '$1, $2');      // "word , , word" -> "word, word"
  
  // 3. Handle patterns where comma appears before conjunctions/words
  cleaned = cleaned.replace(/,\s*,\s*,\s*(that|which|who|when|where|how|why)\b/gi, ', $1');
  cleaned = cleaned.replace(/,\s*,\s*(that|which|who|when|where|how|why)\b/gi, ', $1');
  
  // 4. Fix patterns around conjunctions
  cleaned = cleaned.replace(/\b(and|but|or|so|yet|for)\s*,\s*,\s*,/gi, '$1');
  cleaned = cleaned.replace(/\b(and|but|or|so|yet|for)\s*,\s*,/gi, '$1');
  
  // 5. Handle patterns at sentence boundaries
  cleaned = cleaned.replace(/,\s*,\s*,\s*([.!?])/g, '$1');  // ", , ." -> "."
  cleaned = cleaned.replace(/,\s*,\s*([.!?])/g, '$1');      // ", ." -> "."
  
  // 6. Clean up any remaining double commas that might have been created
  cleaned = cleaned.replace(/,\s*,/g, ',');
  
  // 7. Fix spacing around commas (normalize)
  cleaned = cleaned.replace(/\s*,\s*/g, ', ');
  
  // 8. Remove trailing comma patterns and fix sentence endings
  cleaned = cleaned.replace(/,\s*,\s*,?\s*$/g, '');
  cleaned = cleaned.replace(/,\s*$/g, '');
  
  // 9. Handle edge cases with specific problematic patterns
  cleaned = cleaned.replace(/\b(process|inform|spark|ensure|produce|create|develop)\s+,\s*,\s*/gi, '$1 ');
  cleaned = cleaned.replace(/\b(data|insights|decisions|art|music|literature|innovation|technology)\s*,\s*,\s*/gi, '$1 ');
  
  console.log('COMMA CLEANUP - After:', JSON.stringify(cleaned));
  return cleaned.trim();
}

function buildSystemPrompt(profile: any): string {
  const base = STYLE_RULE_PROMPT + '\n\nCRITICAL: Preserve the exact meaning and all factual content. No fabrication of facts. Focus on sentence construction patterns rather than specific vocabulary. Maintain natural language flow and readability above all else.';
  if (!profile) return base;
  
  let stylePrompt = base + `\nProfile cues: Tone=${profile.tone}; Formality=${profile.formality}; Pacing=${profile.pacing}; Descriptiveness=${profile.descriptiveness}; Directness=${profile.directness}`;
  
  // Add custom lexicon as optional vocabulary hints (with strong warnings)
  if (profile.customLexicon && profile.customLexicon.length > 0) {
    stylePrompt += `\n\nVOCABULARY SUGGESTIONS (USE SPARINGLY): The user occasionally prefers these words: ${profile.customLexicon.join(', ')}. These are OPTIONAL suggestions - only use them if they naturally replace existing words and maintain identical meaning. NEVER insert them where they don't belong or change the meaning. If they don't fit naturally, ignore them completely. Clear, accurate writing is always more important than using any specific vocabulary.`;
  } else {
    // When no custom lexicon, be explicit about not adding unnecessary words or commas
    stylePrompt += `\n\nNO CUSTOM VOCABULARY: Write naturally without trying to insert specific vocabulary words. Do not use placeholder commas or awkward insertions. Focus purely on clear, natural language that matches the user's sentence construction patterns.`;
  }
  
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
    
    // REMOVED: Don't mention specific adverbs in the prompt as they get injected
    
    // SENTENCE CONSTRUCTION PATTERNS
    if (analysis.constructionPatterns) {
      stylePrompt += '\n\nSENTENCE CONSTRUCTION STYLE:';
      
      if (analysis.constructionPatterns.subordinateClauseRatio > 0.3) {
        stylePrompt += `\n- Frequently uses subordinate clauses (${(analysis.constructionPatterns.subordinateClauseRatio * 100).toFixed(0)}% of sentences) with words like "because", "although", "when"`;
      }
      
      if (analysis.constructionPatterns.coordinateClauseRatio > 0.3) {
        stylePrompt += `\n- Often connects ideas with coordinating conjunctions (${(analysis.constructionPatterns.coordinateClauseRatio * 100).toFixed(0)}% of sentences) using "and", "but", "or"`;
      }
      
      if (analysis.constructionPatterns.parentheticalRatio > 0.2) {
        stylePrompt += `\n- Uses parenthetical elements and asides (${(analysis.constructionPatterns.parentheticalRatio * 100).toFixed(0)}% of sentences)`;
      }
      
      if (analysis.constructionPatterns.frontLoadedDependentRatio > 0.2) {
        stylePrompt += `\n- Often starts sentences with dependent clauses (${(analysis.constructionPatterns.frontLoadedDependentRatio * 100).toFixed(0)}% of sentences)`;
      }
      
      if (analysis.avgClausesPerSentence > 2) {
        stylePrompt += `\n- Complex sentence structure averaging ${analysis.avgClausesPerSentence.toFixed(1)} clauses per sentence`;
      }
      
      if (analysis.parallelStructureRatio > 0.1) {
        stylePrompt += `\n- Uses parallel structure patterns (${(analysis.parallelStructureRatio * 100).toFixed(0)}% of sentences) like "X, Y, and Z"`;
      }
    }
    
    // PUNCTUATION AND MODIFIER PATTERNS
    if (analysis.punctuationPatterns) {
      if (analysis.punctuationPatterns.dashUsage > 0) {
        stylePrompt += `\n- Uses dashes for emphasis or breaks (${analysis.punctuationPatterns.dashUsage} times)`;
      }
      if (analysis.punctuationPatterns.colonUsage > 0) {
        stylePrompt += `\n- Uses colons for explanations (${analysis.punctuationPatterns.colonUsage} times)`;
      }
    }
    
    if (analysis.modifierPatterns) {
      if (analysis.modifierPatterns.frontLoadedAdverbs > 0.1) {
        stylePrompt += `\n- Often starts sentences with adverbs (${(analysis.modifierPatterns.frontLoadedAdverbs * 100).toFixed(0)}% of sentences)`;
      }
      if (analysis.modifierPatterns.midSentenceAdverbs > 0.1) {
        stylePrompt += `\n- Places adverbs mid-sentence for flow (${(analysis.modifierPatterns.midSentenceAdverbs * 100).toFixed(0)}% of sentences)`;
      }
    }
    
    stylePrompt += '\n\nMATCH THESE PATTERNS: Replicate the sentence construction style, clause patterns, punctuation habits, and modifier placement shown above. Focus on HOW sentences are built, not just word choice.';
  }
  
  // Add final instructions to prevent lexicon notes in output
  stylePrompt += '\n\nCRITICAL OUTPUT RULES:\n1. Output ONLY the paraphrased text. No notes, labels, explanations, or lists.\n2. Do NOT include phrases like "Lexicon notes:", "Words used:", "Vocabulary:", etc.\n3. Do NOT mention or list any vocabulary words used.\n4. NEVER insert vocabulary words where they break sentence structure or change meaning.\n5. Do NOT use excessive commas or placeholder punctuation - write naturally.\n6. The response must contain ONLY the clean paraphrased content - nothing else.\n7. Preserve all original facts, concepts, and meaning exactly.\n8. Use proper comma placement only where grammatically appropriate - avoid comma clusters like ",,," or unnecessary comma insertions.';
  
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
  // These are appearing as insertions like "factually especially" or "in especially"
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

function finalLexiconCleanup(text: string): string {
  if (!text) return text;
  
  let cleaned = text;
  console.log('FINAL CLEANUP - Before:', JSON.stringify(cleaned.slice(-100)));
  
  // SURGICAL APPROACH: Only remove specific lexicon patterns, preserve legitimate text
  
  // 1. Remove exact lexicon note patterns (most specific first)
  cleaned = cleaned.replace(/\s+especially,\s*clearly\.\s*confidently\s*$/gi, '');
  cleaned = cleaned.replace(/\s+especially,\s*clearly,?\s*confidently\s*$/gi, '');
  cleaned = cleaned.replace(/\s*\.?\s*Lexicon notes?:\s*[^\n]*$/gi, '');
  
  // 2. Remove complete lexicon word sequences only at the very end
  cleaned = cleaned.replace(/\s*especially,?\s*clearly,?\s*confidently,?\s*factually,?\s*frequently\.?\s*$/gi, '');
  cleaned = cleaned.replace(/\s*clearly,?\s*confidently\.?\s*frequently\.?\s*$/gi, '');
  cleaned = cleaned.replace(/\s*confidently\.?\s*frequently\.?\s*$/gi, '');
  
  // 3. Remove only specific lexicon words when they appear as trailing fragments
  // But only if they're clearly lexicon notes (with specific punctuation patterns)
  const lexiconWords = ['especially', 'clearly', 'confidently', 'factually', 'frequently'];
  for (const word of lexiconWords) {
    // Only remove if it's clearly a trailing fragment with comma/period patterns
    cleaned = cleaned.replace(new RegExp(`\\s*,\\s*${word}\\s*\\.?\\s*$`, 'gi'), '');
    cleaned = cleaned.replace(new RegExp(`\\s*\\.\\s*${word}\\s*$`, 'gi'), '');
  }
  
  // 4. Remove sequences of exactly these lexicon words (not any random words)
  const lexiconPattern = `\\b(?:${lexiconWords.join('|')})\\b`;
  cleaned = cleaned.replace(new RegExp(`\\s*,?\\s*${lexiconPattern}(?:\\s*[,.]\\s*${lexiconPattern})*\\s*\\.?\\s*$`, 'gi'), '');
  
  // 5. Clean up trailing punctuation only if it looks malformed
  cleaned = cleaned.replace(/\s*[,]+\s*$/, ''); // Remove trailing commas
  cleaned = cleaned.replace(/\s*\.{2,}\s*$/, '.'); // Fix multiple periods to single period
  cleaned = cleaned.trim();
  
  // 6. Ensure proper sentence ending (but don't force it if text ends with other punctuation)
  if (cleaned && !/[.!?]$/.test(cleaned)) {
    cleaned += '.';
  }
  
  console.log('FINAL CLEANUP - After:', JSON.stringify(cleaned.slice(-100)));
  
  return cleaned;
}

function validateAndFixSentenceStructure(text: string): string {
  if (!text) return text;
  
  console.log('SENTENCE VALIDATION - Before:', JSON.stringify(text.slice(0, 150)));
  console.log('SENTENCE VALIDATION - Before (end):', JSON.stringify(text.slice(-150)));
  
  let fixed = text.trim();
  
  // 1. Remove any leading orphaned words or fragments that don't start a proper sentence
  // Check if text starts with orphaned words
  const firstSentenceMatch = fixed.match(/^([^.!?]*?)([A-Z][^.!?]*[.!?])/);
  if (firstSentenceMatch) {
    const leadingFragment = firstSentenceMatch[1].trim();
    if (leadingFragment && leadingFragment.split(/\s+/).length < 4 && !/^[A-Z]/.test(leadingFragment)) {
      // If there's a leading fragment that's short and doesn't start with capital, remove it
      console.log('REMOVING LEADING FRAGMENT:', JSON.stringify(leadingFragment));
      fixed = fixed.replace(/^[^.!?]*?([A-Z][^.!?]*[.!?])/, '$1');
    }
  }
  
  // 2. Fix basic sentence structure issues
  const sentences = fixed.split(/(?<=[.!?])\s+/);
  const validSentences = [];
  
  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    const trimmed = sentence.trim();
    if (!trimmed) continue;
    
    // Enhanced sentence validation with improved verb detection
    const wordCount = trimmed.split(/\s+/).length;
    const startsWithCapital = /^[A-Z]/.test(trimmed);
    const endsWithPunctuation = /[.!?]$/.test(trimmed);
    
    // Improved verb detection - more comprehensive patterns
    const hasVerb = /\b(?:is|are|was|were|will|would|can|could|has|have|had|do|does|did|become|becomes|became|get|gets|got|make|makes|made|take|takes|took|give|gives|gave|show|shows|showed|find|finds|found|think|thinks|thought|know|knows|knew|see|sees|saw|come|comes|came|go|goes|went|work|works|worked|use|uses|used|help|helps|helped|need|needs|needed|want|wants|wanted|try|tries|tried|look|looks|looked|feel|feels|felt|seem|seems|seemed|appear|appears|appeared|include|includes|included|provide|provides|provided|allow|allows|allowed|require|requires|required|create|creates|created|offer|offers|offered|change|changes|changed|move|moves|moved|turn|turns|turned|keep|keeps|kept|hold|holds|held|bring|brings|brought|build|builds|built|run|runs|ran|play|plays|played|live|lives|lived|remain|remains|remained|continue|continues|continued|start|starts|started|stop|stops|stopped|end|ends|ended|begin|begins|began|follow|follows|followed|lead|leads|led|understand|understands|understood|learn|learns|learned|teach|teaches|taught|remember|remembers|remembered|forget|forgets|forgot|decide|decides|decided|choose|chooses|chose|win|wins|won|lose|loses|lost|rising|falling|hanging|blending|casting|formed|erased|buried|told|swept|spread|drifting|floating|pouring|coloring|washed|transforming|providing|tailored|broaden|optimizing|detect|enabling|designed|trained|generate|predicting|lacks|sounding|stands|means|mistakes|hallucinate|understands|predicts|drives|expand|limited|presentations|adaptive|customized|raising|displacement|unfolded|clung|imbuing|assuming|continue|indefinitely|assumed|melody|slice)\b/i.test(trimmed);
    
    // More lenient validation - focus on obvious fragments only
    const isValidSentence = 
      wordCount >= 3 && 
      startsWithCapital && 
      endsWithPunctuation && 
      (hasVerb || 
       /^(?:Yes|No|Exactly|Indeed|Absolutely|Certainly|Perhaps|Maybe|However|Therefore|Moreover|Furthermore|Additionally|Meanwhile|Nevertheless|Thus|Hence|Consequently|Finally|Initially)\b/i.test(trimmed) ||
       wordCount >= 8) && // Longer sentences are more likely to be valid even without detected verbs
      !isLikelyFragment(trimmed) &&
      !isOrphanedWord(trimmed);
    
    // Additional check for sentences that don't start properly
    const hasProperBeginning = 
      /^[A-Z][a-z]/.test(trimmed) || // Starts with capital letter followed by lowercase
      /^[A-Z][A-Z]+/.test(trimmed.split(' ')[0]) || // Acronym
      /^(?:I|A|An|The|This|That|These|Those|He|She|It|We|They|You|My|Your|His|Her|Its|Our|Their|Some|All|Many|Most|Few|Several|Each|Every|Both|Either|Neither|One|Two|Three|Four|Five|First|Second|Third|Last|Next|Previous|Another|Other|Such|Same|Different|New|Old|Good|Bad|Better|Best|Worse|Worst|Big|Small|Large|Little|Long|Short|High|Low|Fast|Slow|Hot|Cold|Warm|Cool|Light|Dark|Bright|Heavy|Easy|Hard|Simple|Complex|Important|Special|General|Specific|Public|Private|National|International|Global|Local|Regional|Common|Rare|Recent|Modern|Ancient|Future|Past|Present|Current|Main|Primary|Secondary|Basic|Advanced|Complete|Partial|Full|Empty|Open|Closed|Free|Busy|Available|Ready|Early|Late|Soon|Never|Always|Often|Sometimes|Usually|Rarely|Seldom|Frequently|Occasionally|Immediately|Quickly|Slowly|Carefully|Clearly|Obviously|Certainly|Probably|Possibly|Maybe|Perhaps|However|Therefore|Thus|Hence|Meanwhile|Moreover|Furthermore|Additionally|Also|Besides|Instead|Otherwise|Nevertheless|Nonetheless|Still|Yet|But|And|Or|So|For|Nor|Because|Since|Although|Though|While|When|Where|What|Who|Which|How|Why|If|Unless|Until|Before|After|During|Between|Among|Above|Below|Over|Under|Through|Across|Around|Beyond|Within|Without|Inside|Outside|Beside|Behind|Ahead|Forward|Backward|Toward|Away|Up|Down|In|On|At|By|To|From|With|Without|Against|About|Around|Near|Far|Here|There|Where|Everywhere|Anywhere|Somewhere|Nowhere|Today|Tomorrow|Yesterday|Now|Then|Later|Earlier|Recently|Finally|Eventually|Initially|Originally|Previously|Afterwards|Subsequently|Consequently|Accordingly|Similarly|Likewise|Conversely|Alternatively|Surprisingly|Fortunately|Unfortunately|Interestingly|Notably|Particularly|Especially|Generally|Specifically|Actually|Really|Truly|Indeed|Certainly|Obviously|Clearly|Apparently|Seemingly|Presumably|Supposedly|Allegedly|Reportedly|Undoubtedly|Definitely|Probably|Possibly|Maybe|Perhaps|Roughly|Approximately|Exactly|Precisely|Nearly|Almost|Barely|Hardly|Scarcely|Quite|Rather|Very|Extremely|Incredibly|Remarkably|Exceptionally|Particularly|Especially|Surprisingly|Amazingly|Absolutely|Completely|Entirely|Fully|Totally|Perfectly|Exactly|Precisely|Strictly|Purely|Simply|Merely|Only|Just|Even|Still|Already|Yet|Again|Once|Twice|Thrice|Never|Always|Forever|Constantly|Continuously|Regularly|Frequently|Often|Sometimes|Occasionally|Rarely|Seldom|Hardly|Never|Already|Still|Yet|Soon|Later|Earlier|Before|After|During|While|Meanwhile|Simultaneously|Concurrently|Immediately|Instantly|Suddenly|Gradually|Slowly|Quickly|Rapidly|Swiftly|Speedily|Fast|Faster|Fastest|Slow|Slower|Slowest)\b/i.test(trimmed);
    
    if (isValidSentence && hasProperBeginning) {
      validSentences.push(trimmed);
    } else {
      console.log('REMOVED INVALID SENTENCE:', JSON.stringify(trimmed), {
        wordCount,
        startsWithCapital,
        endsWithPunctuation,
        hasVerb,
        hasProperBeginning
      });
    }
  }
  
  // 3. Rejoin valid sentences
  fixed = validSentences.join(' ');
  
  // 4. Fix sentence beginnings and capitalization
  fixed = fixSentenceBeginnings(fixed);
  
  // 3. Fix common grammatical issues
  // Remove double spaces
  fixed = fixed.replace(/\s+/g, ' ');
  
  // Fix spacing around punctuation
  fixed = fixed.replace(/\s+([.!?])/g, '$1');
  fixed = fixed.replace(/([.!?])\s*([A-Z])/g, '$1 $2');
  
  // Remove orphaned punctuation
  fixed = fixed.replace(/\s+[.!?]\s*$/g, '');
  
  // Ensure proper sentence ending
  if (fixed && !/[.!?]$/.test(fixed)) {
    fixed += '.';
  }
  
  console.log('SENTENCE VALIDATION - After:', JSON.stringify(fixed.slice(-150)));
  
  return fixed.trim();
}

function isLikelyFragment(text: string): boolean {
  // Check if text looks like a word fragment or incomplete thought
  const trimmed = text.trim();
  
  // Very short fragments
  if (trimmed.length < 3) return true;
  
  // Just punctuation
  if (/^[^\w]*$/.test(trimmed)) return true;
  
  // Just a single word with punctuation
  if (/^\w+[.!?]*$/.test(trimmed)) return true;
  
  // Looks like trailing word list fragments
  if (/^(?:especially|clearly|confidently|factually|frequently)(?:\s*,\s*(?:especially|clearly|confidently|factually|frequently))*[.!?]*$/i.test(trimmed)) return true;
  
  return false;
}

function isOrphanedWord(text: string): boolean {
  // Check if text is just orphaned words that don't form a complete sentence
  const trimmed = text.trim();
  
  // Single word followed by punctuation
  if (/^\w+[.!?]?$/.test(trimmed)) return true;
  
  // Two words that don't form a meaningful start
  const words = trimmed.split(/\s+/);
  if (words.length === 2) {
    const [first, second] = words;
    // Check if it's not a proper sentence beginning
    if (!/^(?:I|You|He|She|It|We|They|The|This|That|These|Those|A|An|My|Your|His|Her|Its|Our|Their|Some|All|Many|Most|Few)\b/i.test(first)) {
      return true;
    }
  }
  
  // Check for random word combinations that don't make sense at sentence start
  const firstWord = words[0]?.toLowerCase();
  const secondWord = words[1]?.toLowerCase();
  
  // Common orphaned patterns
  const orphanedPatterns = [
    // Prepositions at start without proper context
    /^(?:of|in|on|at|by|for|with|from|to|into|onto|upon|under|over|through|across|around|between|among|during|before|after|above|below|beside|behind|beyond|within|without)\s/i,
    // Conjunctions at start (unless starting dependent clause)
    /^(?:and|but|or|nor|yet|so)\s/i,
    // Articles alone or with single modifier
    /^(?:a|an|the)\s+\w+[.!?]?$/i,
  ];
  
  return orphanedPatterns.some(pattern => pattern.test(trimmed));
}

function fixSentenceBeginnings(text: string): string {
  if (!text) return text;
  
  // Split into sentences and fix each one
  const sentences = text.split(/(?<=[.!?])\s+/);
  const fixedSentences = sentences.map(sentence => {
    let fixed = sentence.trim();
    if (!fixed) return fixed;
    
    // Ensure first character is capitalized
    fixed = fixed.charAt(0).toUpperCase() + fixed.slice(1);
    
    // Fix common sentence beginning issues
    // Remove redundant "the the" or similar repetitions at start
    fixed = fixed.replace(/^(The|A|An|This|That|These|Those)\s+\1\s+/i, '$1 ');
    
    // Fix sentences starting with lowercase conjunctions that should be capitalized
    fixed = fixed.replace(/^(and|but|or|so|yet|for)\s+/i, (match, conj) => {
      return conj.charAt(0).toUpperCase() + conj.slice(1).toLowerCase() + ' ';
    });
    
    return fixed;
  });
  
  return fixedSentences.join(' ');
}
