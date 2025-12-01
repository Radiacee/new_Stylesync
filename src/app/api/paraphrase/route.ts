import { NextRequest } from 'next/server';
import { paraphraseWithProfile } from '../../../lib/paraphrase.ts';
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
      output = await simpleStyleParaphrase(text, profile, stylePreset, styleInstructions);
      usedAIModel = true;
    } else {
      output = paraphraseWithProfile(text, profile);
    }

    return new Response(JSON.stringify({ result: output, usedModel: usedAIModel }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...formatRateLimitHeaders(rl) }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Bad Request' }), { status: 400 });
  }
}

// ============================================================================
// SIMPLE STYLE PARAPHRASE - Learn user's style structure, apply it cleanly
// ============================================================================

async function simpleStyleParaphrase(
  text: string, 
  profile: any, 
  stylePreset?: string, 
  styleInstructions?: string | null
): Promise<string> {
  const prompt = buildSimplePrompt(profile, stylePreset, styleInstructions);
  
  // Try Groq first, then Gemini
  try {
    return await callGroqAPI(text, prompt);
  } catch (e: any) {
    console.log('Groq failed, trying Gemini:', e?.message);
    try {
      return await callGeminiAPI(text, prompt);
    } catch (e2: any) {
      console.log('Gemini also failed:', e2?.message);
      return paraphraseWithProfile(text, profile);
    }
  }
}

function buildSimplePrompt(profile: any, stylePreset?: string, styleInstructions?: string | null): string {
  // If using a preset style (not original), prioritize preset instructions
  if (stylePreset && stylePreset !== 'original' && styleInstructions) {
    return `You are a writing style transformer. Rewrite text in a specific style.

## TARGET STYLE: ${stylePreset.toUpperCase()}
${styleInstructions}

## TASK
Rewrite the input text to match this style.

CRITICAL RULES:
1. Keep ALL facts and information exactly the same - change nothing about the meaning
2. Apply the style characteristics fully
3. Use proper grammar - no errors
4. Output ONLY the rewritten text - no explanations, notes, or commentary`;
  }

  if (!profile?.sampleExcerpt) {
    return `Rewrite the following text naturally while keeping all facts and meaning intact. Use proper grammar. Output only the rewritten text with no explanations.`;
  }

  // Get user's writing samples
  const userWriting = profile.sampleExcerpt.slice(0, 2000);
  const analysis = profile.styleAnalysis;

  let prompt = `You are a writing style matcher. Rewrite text to match a specific person's writing style.

## THE USER'S WRITING SAMPLES
Study how this person writes - their sentence structure, word choices, and flow:

"""
${userWriting}
"""

## KEY STYLE PATTERNS TO MATCH`;

  if (analysis) {
    // Contractions - most noticeable feature
    if (analysis.usesContractions === true) {
      prompt += `\n- USES contractions naturally (don't, it's, can't, won't, etc.)`;
    } else if (analysis.usesContractions === false) {
      prompt += `\n- Does NOT use contractions (writes "do not" not "don't", "it is" not "it's")`;
    }

    // Sentence length
    const avgWords = Math.round(analysis.avgSentenceLength / 5);
    if (avgWords > 22) {
      prompt += `\n- Writes LONG, flowing sentences (~${avgWords} words each)`;
    } else if (avgWords < 12) {
      prompt += `\n- Writes SHORT, punchy sentences (~${avgWords} words each)`;
    } else {
      prompt += `\n- Writes medium-length sentences (~${avgWords} words each)`;
    }

    // Voice/perspective
    if (analysis.personalVoice === 'first-person') {
      prompt += `\n- Uses first person perspective (I, we, my, our)`;
    } else if (analysis.personalVoice === 'second-person') {
      prompt += `\n- Addresses reader directly (you, your)`;
    } else {
      prompt += `\n- Uses third person / neutral voice`;
    }

    // Transitions they actually use
    if (analysis.preferredTransitions?.length > 0) {
      prompt += `\n- Uses these transitions: ${analysis.preferredTransitions.slice(0, 4).join(', ')}`;
    }
  }

  prompt += `

## TASK
Rewrite the input text to sound like this person wrote it.

CRITICAL RULES:
1. Keep ALL facts and information exactly the same - change nothing about the meaning
2. Match their sentence structure and length patterns
3. Match whether they use contractions or formal language
4. Match their perspective (first/second/third person)
5. Use proper grammar - no errors
6. Output ONLY the rewritten text - no explanations, notes, or commentary`;

  return prompt;
}

async function callGroqAPI(text: string, systemPrompt: string): Promise<string> {
  const GroqMod = await import('groq-sdk');
  const Groq = (GroqMod as any).default ?? (GroqMod as any).Groq;
  const client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  
  const completion = await client.chat.completions.create({
    model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    temperature: 0.7,
    max_tokens: Math.min(2500, Math.max(300, text.length * 2)),
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Rewrite this text to match the writing style shown above. Keep all information intact.\n\n${text}` }
    ]
  });
  
  const result = completion.choices?.[0]?.message?.content?.trim() || '';
  return cleanOutput(result) || text;
}

async function callGeminiAPI(text: string, systemPrompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('No Gemini API key');
  
  const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: `${systemPrompt}\n\nRewrite this text to match the writing style shown above. Keep all information intact.\n\n${text}` }]
      }],
      generationConfig: { 
        temperature: 0.7, 
        maxOutputTokens: Math.min(2500, Math.max(300, text.length * 2)) 
      }
    })
  });
  
  if (!response.ok) throw new Error(`Gemini error: ${response.status}`);
  
  const data = await response.json();
  const result = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
  return cleanOutput(result) || text;
}

function cleanOutput(text: string): string {
  if (!text) return text;
  
  let cleaned = text;
  
  // Remove common AI prefixes
  cleaned = cleaned.replace(/^(?:Here(?:'s| is)[^:]*:|Rewritten[^:]*:|Paraphrased[^:]*:|Sure[^:]*:)\s*/i, '');
  cleaned = cleaned.replace(/^(?:Of course[^:]*:|Certainly[^:]*:)\s*/i, '');
  
  // Remove trailing explanations
  cleaned = cleaned.replace(/\n\n(?:Note:|I (?:have |)(?:maintained|kept|preserved|matched)[^\n]*)/gi, '');
  cleaned = cleaned.replace(/\n\n(?:This (?:version|rewrite)[^\n]*)/gi, '');
  
  // Basic punctuation cleanup - gentle, don't break things
  cleaned = cleaned.replace(/\s+([.!?,])/g, '$1'); // Remove space before punctuation
  cleaned = cleaned.replace(/([.!?])([A-Z])/g, '$1 $2'); // Add space after sentence end
  cleaned = cleaned.replace(/\s{2,}/g, ' '); // Collapse multiple spaces
  
  return cleaned.trim();
}
