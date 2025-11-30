import { NextRequest } from 'next/server';
import { paraphraseWithProfile } from '../../../lib/paraphrase.ts';
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
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
    const rl = rateLimit(`paraphrase:${ip}`);
    if (rl.limited) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded. Try later.' }), { 
        status: 429, 
        headers: { 'Content-Type': 'application/json', ...formatRateLimitHeaders(rl) } 
      });
    }

    const json = await req.json();
    const { text, useModel, profile } = bodySchema.parse(json);

    const hasGroqKey = !!process.env.GROQ_API_KEY;
    const hasGeminiKey = !!process.env.GEMINI_API_KEY;
    const canUseAI = hasGroqKey || hasGeminiKey;
    
    let output: string;
    let usedAIModel = false;
    
    if (canUseAI && (useModel ?? true)) {
      output = await simpleStyleParaphrase(text, profile);
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

async function intelligentParaphrase(text: string, profile: any): Promise<string> {
  console.log('=== INTELLIGENT PARAPHRASE PIPELINE ===');
  
  // Stage 1: AI generation with optimized focused prompt (300-500 tokens max)
  console.log('Stage 1: AI Generation with Focused Prompt');
  const optimizedPrompt = buildFocusedPrompt(profile);
  let output = await modelParaphraseGroqWithPrompt(text, optimizedPrompt);
  
  // Stage 2: Verification Check (Enforcement removed to improve natural flow)
  console.log('Stage 2: Verification Check');
  const verification = calculateStyleMatchScore(output, profile);
  console.log('Initial verification score:', verification.score);
  
  // Stage 3: Iterate if score is too low (one refinement pass)
  if (verification.score < 0.70 && profile?.styleAnalysis) { // Lowered threshold slightly to allow for natural variation
    console.log('Stage 3: Refinement Pass (score below 70%)');
    console.log('Identified gaps:', verification.gaps);
    output = await refineWithFeedback(output, profile, verification.gaps);
    
    const finalVerification = calculateStyleMatchScore(output, profile);
    console.log('Final verification score:', finalVerification.score);
  }
  
  console.log('=== PIPELINE COMPLETE ===');
  return output;
}

function buildFocusedPrompt(profile: any): string {
  const base = STYLE_RULE_PROMPT + '\n\n🎯 YOUR GOAL: Transform the sentence structure to match the user\'s writing style from their essay samples.\n\n🚨 ABSOLUTE RULES (NEVER VIOLATE):\n1. Keep 100% of the content - no summarizing, no omitting\n2. ONLY change HOW sentences are structured, not WHAT they say\n3. Match the user\'s writing style completely (including their perspective, vocabulary, and patterns)\n4. Think: "How would this user write this same information?"';
  if (!profile) return base;
  
  let stylePrompt = base + `\n\n📝 USER'S WRITING STYLE (from their essay samples):`;
  
  // FORMALITY
  const formalityPercent = Math.round(profile.formality * 100);
  stylePrompt += `\n\n⚠️ FORMALITY LEVEL: ${formalityPercent}% ${formalityPercent >= 80 ? '(HIGHLY FORMAL - STRICT)' : formalityPercent >= 60 ? '(FORMAL)' : formalityPercent >= 40 ? '(NEUTRAL)' : '(CASUAL)'}`;
  
  if (formalityPercent >= 80) {
    stylePrompt += '\n  ✓ NO contractions (do not, cannot, will not)';
    stylePrompt += '\n  ✓ NO informal words (stuff, things, get, got, lots)';
    stylePrompt += '\n  ✓ USE formal vocabulary (utilize, demonstrate, establish)';
    stylePrompt += '\n  ✓ USE formal transitions (Moreover, Furthermore, Consequently)';
    stylePrompt += '\n  ✓ Match the user\'s essay perspective style';
  } else if (formalityPercent >= 60) {
    stylePrompt += '\n  ✓ Minimal contractions';
    stylePrompt += '\n  ✓ Professional vocabulary';
    stylePrompt += '\n  ✓ Match the user\'s essay style';
  } else if (formalityPercent <= 40) {
    stylePrompt += '\n  ✓ Use contractions naturally';
    stylePrompt += '\n  ✓ Conversational vocabulary';
    stylePrompt += '\n  ✓ Match the user\'s personal voice from essays';
  }
  
  stylePrompt += `\n- Tone: ${profile.tone}`;
  stylePrompt += `\n- Pacing: ${Math.round(profile.pacing * 100)}%`;
  stylePrompt += `\n- Descriptiveness: ${Math.round(profile.descriptiveness * 100)}%`;
  stylePrompt += `\n- Directness: ${Math.round(profile.directness * 100)}%`;
  
  // TONE - Explicit emotional character
  const tone = profile.tone || 'Neutral';
  stylePrompt += `\n\n📝 TONE: ${tone}`;
  const toneLower = tone.toLowerCase();
  if (toneLower.includes('professional') || toneLower.includes('formal')) {
    stylePrompt += '\n  → Objective, businesslike, serious, authoritative';
  } else if (toneLower.includes('friendly') || toneLower.includes('casual')) {
    stylePrompt += '\n  → Warm, approachable, conversational, personable';
  } else if (toneLower.includes('enthusiastic') || toneLower.includes('energetic')) {
    stylePrompt += '\n  → Positive, excited, dynamic, motivating';
  } else if (toneLower.includes('academic') || toneLower.includes('scholarly')) {
    stylePrompt += '\n  → Analytical, research-oriented, evidence-based, precise';
  } else if (toneLower.includes('persuasive') || toneLower.includes('convincing')) {
    stylePrompt += '\n  → Compelling, argumentative, confident, assertive';
  } else if (toneLower.includes('informative') || toneLower.includes('educational')) {
    stylePrompt += '\n  → Clear, explanatory, instructive, straightforward';
  } else if (toneLower.includes('empathetic') || toneLower.includes('compassionate')) {
    stylePrompt += '\n  → Understanding, supportive, considerate, caring';
  } else {
    stylePrompt += '\n  → Maintain this exact emotional character throughout';
  }
  
  // PACING - Sentence rhythm and flow
  const pacingPercent = Math.round(profile.pacing * 100);
  stylePrompt += `\n\n⏱️ PACING: ${pacingPercent}%`;
  if (pacingPercent >= 75) {
    stylePrompt += ' (FAST)';
    stylePrompt += '\n  → Short, punchy sentences (avg 8-12 words)';
    stylePrompt += '\n  → Quick transitions, minimal elaboration';
    stylePrompt += '\n  → Dense information delivery';
    stylePrompt += '\n  → Active voice, direct statements';
  } else if (pacingPercent >= 50) {
    stylePrompt += ' (MODERATE)';
    stylePrompt += '\n  → Balanced sentence lengths (avg 12-18 words)';
    stylePrompt += '\n  → Steady flow with natural pauses';
    stylePrompt += '\n  → Mix of simple and compound sentences';
  } else {
    stylePrompt += ' (SLOW/DELIBERATE)';
    stylePrompt += '\n  → Longer, flowing sentences (avg 18-25+ words)';
    stylePrompt += '\n  → Elaborate explanations and context';
    stylePrompt += '\n  → Multiple clauses, thoughtful pacing';
    stylePrompt += '\n  → Time for ideas to breathe';
  }
  
  // DESCRIPTIVENESS - Level of detail and imagery
  const descriptPercent = Math.round(profile.descriptiveness * 100);
  stylePrompt += `\n\n🎨 DESCRIPTIVENESS: ${descriptPercent}%`;
  if (descriptPercent >= 75) {
    stylePrompt += ' (HIGHLY DESCRIPTIVE)';
    stylePrompt += '\n  → Rich adjectives and adverbs (8%+ adjective density)';
    stylePrompt += '\n  → Vivid imagery and sensory details';
    stylePrompt += '\n  → Paint pictures with words';
    stylePrompt += '\n  → Elaborate on context and nuance';
  } else if (descriptPercent >= 50) {
    stylePrompt += ' (MODERATELY DESCRIPTIVE)';
    stylePrompt += '\n  → Selective use of descriptors (4-6% adjective density)';
    stylePrompt += '\n  → Balance clarity with detail';
    stylePrompt += '\n  → Describe when it adds value';
  } else {
    stylePrompt += ' (MINIMAL/SPARSE)';
    stylePrompt += '\n  → Very few adjectives/adverbs (< 3% density)';
    stylePrompt += '\n  → Stick to facts and core information';
    stylePrompt += '\n  → No flowery language or embellishment';
    stylePrompt += '\n  → Lean, efficient prose';
  }
  
  // DIRECTNESS - How straightforward vs elaborate
  const directPercent = Math.round(profile.directness * 100);
  stylePrompt += `\n\n🎯 DIRECTNESS: ${directPercent}%`;
  if (directPercent >= 75) {
    stylePrompt += ' (VERY DIRECT)';
    stylePrompt += '\n  → State main points immediately';
    stylePrompt += '\n  → No preambles or hedging';
    stylePrompt += '\n  → Simple declarative sentences';
    stylePrompt += '\n  → Get straight to the point';
  } else if (directPercent >= 50) {
    stylePrompt += ' (BALANCED)';
    stylePrompt += '\n  → Mix of direct and contextual statements';
    stylePrompt += '\n  → Brief setup before main points';
    stylePrompt += '\n  → Some supporting details';
  } else {
    stylePrompt += ' (INDIRECT/NUANCED)';
    stylePrompt += '\n  → Build up to main points gradually';
    stylePrompt += '\n  → Provide context and background first';
    stylePrompt += '\n  → Use hedging and qualifiers (may, might, could)';
    stylePrompt += '\n  → Diplomatic, roundabout phrasing';
  }

  // NEW: Advanced Style Metrics (Step 2)
  if (profile.styleAnalysis) {
    const analysis = profile.styleAnalysis;
    
    // Lexical Density
    if (analysis.lexicalDensity !== undefined) {
      const densityPercent = Math.round(analysis.lexicalDensity * 100);
      stylePrompt += `\n\n📊 LEXICAL DENSITY: ${densityPercent}%`;
      if (densityPercent >= 60) {
        stylePrompt += ' (HIGH - content-rich, formal)';
        stylePrompt += '\n  → Use more nouns, verbs, adjectives; fewer function words';
        stylePrompt += '\n  → Dense, information-packed writing';
      } else if (densityPercent >= 40) {
        stylePrompt += ' (MODERATE)';
        stylePrompt += '\n  → Balance content words with connectors';
        stylePrompt += '\n  → Natural mix of information and flow words';
      } else {
        stylePrompt += ' (LOW - conversational, flowing)';
        stylePrompt += '\n  → More function words and connectors';
        stylePrompt += '\n  → Lighter, more accessible writing';
      }
    }
    
    // Sentence Length Variety
    if (analysis.sentenceLengthVariety !== undefined) {
      const varietyScore = Math.round(analysis.sentenceLengthVariety);
      stylePrompt += `\n\n🔀 SENTENCE LENGTH VARIETY: ${varietyScore} (std deviation)`;
      if (varietyScore > 12) {
        stylePrompt += ' (HIGH - mixes long and short)';
        stylePrompt += '\n  → Alternate between short punchy sentences and longer flowing ones';
        stylePrompt += '\n  → Creates dynamic rhythm and keeps reader engaged';
      } else if (varietyScore > 6) {
        stylePrompt += ' (MODERATE)';
        stylePrompt += '\n  → Vary sentence lengths naturally';
      } else {
        stylePrompt += ' (LOW - consistent lengths)';
        stylePrompt += '\n  → Keep sentences roughly uniform in length';
        stylePrompt += '\n  → Steady, predictable rhythm';
      }
    }
    
    // Paragraph Length Variety
    if (analysis.paragraphLengthVariety !== undefined) {
      const paraVarietyScore = Math.round(analysis.paragraphLengthVariety);
      stylePrompt += `\n\n📄 PARAGRAPH VARIETY: ${paraVarietyScore} (std deviation)`;
      if (paraVarietyScore > 8) {
        stylePrompt += ' (HIGH - varied paragraph lengths)';
        stylePrompt += '\n  → Mix short punchy paragraphs with longer detailed ones';
        stylePrompt += '\n  → Emphasizes key points with short paras';
      } else if (paraVarietyScore > 3) {
        stylePrompt += ' (MODERATE)';
        stylePrompt += '\n  → Vary paragraph lengths naturally';
      } else {
        stylePrompt += ' (LOW - uniform paragraph lengths)';
        stylePrompt += '\n  → Keep paragraphs roughly the same size';
      }
    }
  }
  
  // NEW: Add direct style examples (Few-Shot Prompting)
  if (profile.sampleExcerpt) {
    stylePrompt += '\n\n=== 🌟 STYLE EXAMPLES (MIMIC THIS VOICE) ===';
    stylePrompt += '\nHere are actual excerpts from the user\'s writing. Your goal is to write EXACTLY as if you are this person.';
    stylePrompt += '\nPay close attention to:';
    stylePrompt += '\n1. How they start sentences';
    stylePrompt += '\n2. Their vocabulary choices (simple vs complex)';
    stylePrompt += '\n3. How they connect ideas';
    stylePrompt += '\n\nUSER EXCERPTS:';
    stylePrompt += `\n"""\n${profile.sampleExcerpt.slice(0, 1000)}${profile.sampleExcerpt.length > 1000 ? '...' : ''}\n"""`;
  }

  // Add ONLY the most distinctive style features (top 5-8)
  if (profile.sampleExcerpt && profile.styleAnalysis) {
    const analysis = profile.styleAnalysis;
    const distinctiveFeatures = identifyDistinctiveFeatures(analysis);
    
    stylePrompt += '\n\n=== KEY STYLE PATTERNS ===';
    distinctiveFeatures.slice(0, 5).forEach((feature, idx) => { // Reduced to top 5 to prevent over-constraining
      stylePrompt += `\n${idx + 1}. ${feature.description}`;
    });
  }
  
  stylePrompt += '\n\n=== OUTPUT REQUIREMENTS ===';
  stylePrompt += '\n• Output ONLY the paraphrased text';
  stylePrompt += '\n• Preserve ALL factual content exactly';
  stylePrompt += '\n• Preserve the original person perspective (narrative POV) and grammatical subject relationships';
  stylePrompt += '\n• Keep named entities, numbers, and dates unchanged';
  stylePrompt += '\n• Do not convert statements to imperatives or instructions unless the original is imperative';
  stylePrompt += `\n• MUST match ${formalityPercent}% formality (contractions, vocabulary, voice)`;
  stylePrompt += `\n• MUST match ${pacingPercent}% pacing (sentence length and rhythm)`;
  stylePrompt += `\n• MUST match ${descriptPercent}% descriptiveness (adjective/adverb density)`;
  stylePrompt += `\n• MUST match ${directPercent}% directness (how straightforward vs elaborate)`;
  stylePrompt += `\n• MUST maintain "${tone}" tone consistently`;
  stylePrompt += '\n• Match the style patterns from sample above';
  stylePrompt += '\n• Use natural, human-like language';
  stylePrompt += '\n• Avoid repetition and filler phrases';
  
  return stylePrompt;
}

function identifyDistinctiveFeatures(analysis: any): Array<{priority: number, description: string}> {
  const features = [];
  
  // 1. Sentence length (compare to typical 15-25 word range)
  const avgWords = analysis.avgSentenceLength / 5; // rough char to word
  if (avgWords > 30) {
    features.push({
      priority: Math.abs(avgWords - 20),
      description: `Very long sentences (avg ${Math.round(avgWords)} words) - match this complexity`
    });
  } else if (avgWords < 12) {
    features.push({
      priority: Math.abs(avgWords - 20),
      description: `Very short sentences (avg ${Math.round(avgWords)} words) - keep it concise`
    });
  }
  
  // 2. Sentence length variation
  if (analysis.sentenceLengthStd) {
    if (analysis.sentenceLengthStd > 40) {
      features.push({
        priority: 7,
        description: `High sentence length variation (std: ${analysis.sentenceLengthStd.toFixed(0)}) - mix short and long sentences`
      });
    } else if (analysis.sentenceLengthStd < 15) {
      features.push({
        priority: 7,
        description: `Consistent sentence lengths (std: ${analysis.sentenceLengthStd.toFixed(0)}) - keep uniform`
      });
    }
  }
  
  // 3. Contractions (distinctive if strongly used or avoided)
  if (analysis.usesContractions === false) {
    features.push({
      priority: 9,
      description: "Never uses contractions (formal: do not, it is, we are)"
    });
  } else if (analysis.contractionRatio && analysis.contractionRatio > 0.5) {
    features.push({
      priority: 8,
      description: "Frequent contractions (casual: don't, it's, we're)"
    });
  }
  
  // 4. Preferred transitions - use their actual transitions
  if (analysis.preferredTransitions && analysis.preferredTransitions.length > 0) {
    features.push({
      priority: 8,
      description: `Prefers transitions: ${analysis.preferredTransitions.join(', ')}`
    });
  }
  
  // 5. Complex sentence structure
  if (analysis.constructionPatterns?.subordinateClauseRatio > 0.4) {
    features.push({
      priority: 10,
      description: `Complex sentences with subordinate clauses (${(analysis.constructionPatterns.subordinateClauseRatio * 100).toFixed(0)}%) - use "because", "although", "when"`
    });
  } else if (analysis.avgClausesPerSentence && analysis.avgClausesPerSentence < 1.5) {
    features.push({
      priority: 9,
      description: `Simple, direct sentences (${analysis.avgClausesPerSentence.toFixed(1)} clauses avg) - avoid complexity`
    });
  }
  
  // 6. Coordinate clauses (and, but, or)
  if (analysis.constructionPatterns?.coordinateClauseRatio > 0.3) {
    features.push({
      priority: 7,
      description: `Frequent coordinate clauses (${(analysis.constructionPatterns.coordinateClauseRatio * 100).toFixed(0)}%) - connect ideas with "and", "but"`
    });
  }
  
  // 7. Parenthetical expressions
  if (analysis.constructionPatterns?.parentheticalRatio > 0.2) {
    features.push({
      priority: 6,
      description: `Uses parenthetical expressions (${(analysis.constructionPatterns.parentheticalRatio * 100).toFixed(0)}%) - add asides`
    });
  }
  
  // 8. Front-loaded dependent clauses
  if (analysis.constructionPatterns?.frontLoadedDependentRatio > 0.3) {
    features.push({
      priority: 7,
      description: `Often starts sentences with dependent clauses (${(analysis.constructionPatterns.frontLoadedDependentRatio * 100).toFixed(0)}%) - "When..., ", "If..., "`
    });
  }
  
  // 9. Comma usage patterns
  if (analysis.commaPerSentence > 2.5) {
    features.push({
      priority: 7,
      description: `Heavy comma usage (${analysis.commaPerSentence.toFixed(1)} per sentence) for pacing`
    });
  } else if (analysis.commaPerSentence < 0.5) {
    features.push({
      priority: 7,
      description: `Minimal commas (${analysis.commaPerSentence.toFixed(1)} per sentence) - direct flow`
    });
  }
  
  // 10. Semicolon usage
  if (analysis.semicolonRatio > 0.1) {
    features.push({
      priority: 6,
      description: `Uses semicolons (${(analysis.semicolonRatio * 100).toFixed(1)}%) - connect related thoughts`
    });
  }
  
  // 11. Dash usage (em-dash)
  if (analysis.punctuationPatterns?.dashUsage > 0.1) {
    features.push({
      priority: 6,
      description: `Uses dashes (${(analysis.punctuationPatterns.dashUsage * 100).toFixed(1)}%) for emphasis or asides`
    });
  }
  
  // 12. Colon usage
  if (analysis.punctuationPatterns?.colonUsage > 0.05) {
    features.push({
      priority: 5,
      description: `Uses colons (${(analysis.punctuationPatterns.colonUsage * 100).toFixed(1)}%) to introduce lists/explanations`
    });
  }
  
  // 13. Question usage
  if (analysis.questionRatio > 0.15) {
    features.push({
      priority: 8,
      description: `Frequently uses questions (${(analysis.questionRatio * 100).toFixed(0)}%) - rhetorical style`
    });
  }
  
  // 14. Exclamatory sentences
  if (analysis.exclamatoryRatio > 0.1) {
    features.push({
      priority: 7,
      description: `Uses exclamation marks (${(analysis.exclamatoryRatio * 100).toFixed(0)}%) for emphasis`
    });
  }
  
  // 15. Vocabulary complexity
  if (analysis.vocabularyComplexity > 0.25) {
    features.push({
      priority: 6,
      description: `Sophisticated vocabulary (${(analysis.vocabularyComplexity * 100).toFixed(0)}% complex words)`
    });
  } else if (analysis.vocabularyComplexity < 0.05) {
    features.push({
      priority: 6,
      description: `Simple, accessible vocabulary (${(analysis.vocabularyComplexity * 100).toFixed(0)}% complex words)`
    });
  }
  
  // 16. Word length
  if (analysis.avgWordLength > 6) {
    features.push({
      priority: 5,
      description: `Long words (avg ${analysis.avgWordLength.toFixed(1)} chars) - sophisticated vocabulary`
    });
  } else if (analysis.avgWordLength < 4.5) {
    features.push({
      priority: 5,
      description: `Short words (avg ${analysis.avgWordLength.toFixed(1)} chars) - simple, clear language`
    });
  }
  
  // 17. Conjunction density
  if (analysis.conjunctionDensity > 0.06) {
    features.push({
      priority: 6,
      description: `High conjunction use (${(analysis.conjunctionDensity * 100).toFixed(1)}%) - connected, flowing sentences`
    });
  } else if (analysis.conjunctionDensity < 0.02) {
    features.push({
      priority: 6,
      description: `Low conjunction use (${(analysis.conjunctionDensity * 100).toFixed(1)}%) - short, separated ideas`
    });
  }
  
  // Voice/perspective - REMOVED (causes issues with paraphrasing flexibility)
  // The system should not force a specific perspective from the essays
  
  // 19. Transition sentence starters
  if (analysis.transitionStartRatio && analysis.transitionStartRatio > 0.25) {
    features.push({
      priority: 7,
      description: `Often starts sentences with transitions (${(analysis.transitionStartRatio * 100).toFixed(0)}%)`
    });
  }
  
  // 20. Common sentence starters (if distinctive)
  if (analysis.commonStarters && analysis.commonStarters.length > 0) {
    features.push({
      priority: 5,
      description: `Common sentence starters: ${analysis.commonStarters.slice(0, 3).join(', ')}`
    });
  }
  
  // 21. Descriptiveness (adjectives)
  if (analysis.adjectiveDensity > 0.08) {
    features.push({
      priority: 5,
      description: `Descriptive style (${(analysis.adjectiveDensity * 100).toFixed(1)}% adjectives) - use vivid descriptions`
    });
  } else if (analysis.adjectiveDensity < 0.03) {
    features.push({
      priority: 5,
      description: `Minimal description (${(analysis.adjectiveDensity * 100).toFixed(1)}% adjectives) - stay concise`
    });
  }
  
  // 22. Adverb patterns (top adverbs from analysis)
  if (analysis.topAdverbs && analysis.topAdverbs.length > 0) {
    features.push({
      priority: 4,
      description: `Favored adverbs: ${analysis.topAdverbs.slice(0, 3).join(', ')}`
    });
  }
  
  // 23. Modifier placement patterns
  if (analysis.modifierPatterns) {
    if (analysis.modifierPatterns.frontLoadedAdverbs > 0.3) {
      features.push({
        priority: 5,
        description: `Often starts with adverbs (${(analysis.modifierPatterns.frontLoadedAdverbs * 100).toFixed(0)}%)`
      });
    }
    if (analysis.modifierPatterns.endSentenceAdverbs > 0.3) {
      features.push({
        priority: 5,
        description: `Often ends with adverbs (${(analysis.modifierPatterns.endSentenceAdverbs * 100).toFixed(0)}%)`
      });
    }
  }
  
  // 24. Parallel structure
  if (analysis.parallelStructureRatio > 0.2) {
    features.push({
      priority: 6,
      description: `Uses parallel structure (${(analysis.parallelStructureRatio * 100).toFixed(0)}%) - repeat patterns for emphasis`
    });
  }
  
  // 25. Tone balance
  if (analysis.toneBalance) {
    features.push({
      priority: 7,
      description: `Tone: ${analysis.toneBalance}`
    });
  }
  
  // 26. High-frequency words (their characteristic vocabulary)
  if (analysis.highFrequencyWords && analysis.highFrequencyWords.length > 0) {
    features.push({
      priority: 4,
      description: `Characteristic words: ${analysis.highFrequencyWords.slice(0, 5).join(', ')}`
    });
  }
  
  // Sort by priority (most distinctive first)
  return features.sort((a, b) => b.priority - a.priority);
}

function calculateFormalityScore(text: string): number {
  // Calculate formality based on multiple indicators
  let formalityScore = 0.5; // Start at neutral
  let indicators = 0;
  
  const words = text.toLowerCase().split(/\s+/);
  const sentences = text.split(/[.!?]+/).filter(s => s.trim());
  
  // 1. Contractions (very strong indicator)
  const contractions = text.match(/\b(?:don't|doesn't|didn't|can't|couldn't|won't|wouldn't|isn't|aren't|wasn't|weren't|haven't|hasn't|hadn't|I'm|you're|he's|she's|it's|we're|they're|I've|you've|we've|they've|I'll|you'll|we'll|they'll|I'd|you'd|he'd|she'd|we'd|they'd)\b/gi);
  const contractionRatio = contractions ? contractions.length / sentences.length : 0;
  if (contractionRatio > 0.3) {
    formalityScore -= 0.25; // Very informal
  } else if (contractionRatio > 0.1) {
    formalityScore -= 0.15; // Somewhat informal
  } else if (contractionRatio === 0) {
    formalityScore += 0.2; // Formal (no contractions)
  }
  indicators++;
  
  // 2. Complex vocabulary (3+ syllables, academic words)
  const complexWords = words.filter(w => 
    w.length > 8 || 
    /^(therefore|however|moreover|furthermore|consequently|nevertheless|additionally|specifically|particularly|significantly|comprehensive|implementation|optimization|substantial|appropriate|demonstrate|establish|maintain|facilitate)$/i.test(w)
  ).length;
  const complexRatio = complexWords / words.length;
  if (complexRatio > 0.15) {
    formalityScore += 0.15; // Very formal vocabulary
  } else if (complexRatio < 0.05) {
    formalityScore -= 0.1; // Simple vocabulary
  }
  indicators++;
  
  // 3. Passive voice (formal indicator)
  const passiveMatches = text.match(/\b(?:is|are|was|were|be|been|being)\s+(?:\w+ed|shown|given|made|done|taken|written|found)\b/gi);
  const passiveRatio = passiveMatches ? passiveMatches.length / sentences.length : 0;
  if (passiveRatio > 0.3) {
    formalityScore += 0.1; // Formal passive voice
  }
  indicators++;
  
  // 4. Personal pronouns (informal indicator)
  const personalPronouns = text.match(/\b(?:I|me|my|mine|we|us|our|ours|you|your|yours)\b/gi);
  const pronounRatio = personalPronouns ? personalPronouns.length / words.length : 0;
  if (pronounRatio > 0.05) {
    formalityScore -= 0.15; // Very informal (personal)
  } else if (pronounRatio < 0.01) {
    formalityScore += 0.1; // Formal (impersonal)
  }
  indicators++;
  
  // 5. Sentence starters (formal: Moreover, Furthermore, etc.)
  const formalStarters = sentences.filter(s => 
    /^\s*(?:Moreover|Furthermore|Additionally|Consequently|Nevertheless|However|Therefore|Thus|Hence|Subsequently|Accordingly)/i.test(s)
  ).length;
  const formalStarterRatio = formalStarters / sentences.length;
  if (formalStarterRatio > 0.2) {
    formalityScore += 0.15; // Very formal transitions
  }
  indicators++;
  
  // 6. Colloquialisms and informal words
  const informalWords = words.filter(w => 
    /^(yeah|yep|nope|gonna|wanna|gotta|kinda|sorta|lots|tons|stuff|things|ok|okay|cool|nice|pretty|really|very|just|actually|basically)$/i.test(w)
  ).length;
  const informalRatio = informalWords / words.length;
  if (informalRatio > 0.03) {
    formalityScore -= 0.2; // Very informal language
  }
  indicators++;
  
  // Normalize to 0-1 range
  return Math.max(0, Math.min(1, formalityScore));
}

function groupLexiconByCategory(lexicon: string[]): any {
  return {
    transitions: lexicon.filter(w => /^(however|therefore|moreover|furthermore|additionally|consequently|meanwhile|nevertheless|thus|hence)$/i.test(w)),
    descriptors: lexicon.filter(w => /^(especially|clearly|confidently|factually|frequently|remarkably|notably|significantly)$/i.test(w)),
    other: lexicon.filter(w => !/(however|therefore|especially|clearly)/i.test(w))
  };
}

function enforceStylePatterns(text: string, analysis: any, profile?: any): string {
  let enforced = text;
  
  console.log('Enforcing style patterns...');
  
  // 1. CRITICAL: Enforce formality level (highest priority for your use case)
  // PRIORITY: Use profile.formality setting FIRST, fall back to analysis.formalityScore
  let targetFormality: number | undefined = undefined;
  
  if (profile?.formality !== undefined) {
    // Use the user's explicit profile setting (this takes priority!)
    targetFormality = profile.formality;
    console.log(`Using PROFILE formality setting: ${(profile.formality * 100).toFixed(0)}%`);
  } else if (analysis.formalityScore !== undefined) {
    // Fall back to analyzed formality from sample excerpt
    targetFormality = analysis.formalityScore;
    console.log(`Using ANALYSIS formality (no profile setting): ${(analysis.formalityScore * 100).toFixed(0)}%`);
  }
  
  if (targetFormality !== undefined) {
    const currentFormality = calculateFormalityScore(enforced);
    
    console.log(`Formality: current=${(currentFormality * 100).toFixed(0)}%, target=${(targetFormality * 100).toFixed(0)}%`);
    
    // If significantly different, apply corrections
    if (Math.abs(currentFormality - targetFormality) > 0.2) {
      enforced = adjustFormality(enforced, targetFormality, currentFormality);
    }
  }
  
  // 2. Enforce contraction usage
  if (analysis.usesContractions === false) {
    // Expand all contractions for formal style
    enforced = expandContractions(enforced);
  } else if (analysis.contractionRatio && analysis.contractionRatio > 0.3) {
    // Add contractions for casual style (if not already present)
    enforced = addContractionsIfNeeded(enforced, analysis.contractionRatio);
  }
  
  // 3. Enforce preferred transitions (use their actual transitions)
  if (analysis.preferredTransitions && analysis.preferredTransitions.length > 0 && analysis.transitionStartRatio > 0.2) {
    enforced = addPreferredTransitions(enforced, analysis.preferredTransitions, analysis.transitionStartRatio);
  }
  
  // 4. Enforce high-frequency vocabulary (inject their characteristic words)
  if (analysis.highFrequencyWords && analysis.highFrequencyWords.length > 0) {
    enforced = injectCharacteristicVocabulary(enforced, analysis.highFrequencyWords);
  }
  
  // 5. Enforce sentence length distribution (if significantly different)
  if (analysis.avgSentenceLength) {
    enforced = adjustSentenceLengths(enforced, analysis.avgSentenceLength);
  }
  
  // 6. Enforce punctuation patterns
  if (analysis.commaPerSentence) {
    enforced = adjustCommaDensity(enforced, analysis.commaPerSentence);
  }
  
  // 7. Enforce question usage if distinctive
  if (analysis.questionRatio && analysis.questionRatio > 0.15) {
    // Already handled by AI, just log
    const currentQuestions = (enforced.match(/\?/g) || []).length;
    const sentences = enforced.split(/[.!?]+/).filter(s => s.trim());
    console.log(`Question ratio: current=${(currentQuestions/sentences.length).toFixed(2)}, target=${analysis.questionRatio.toFixed(2)}`);
  }
  
  // === PROFILE-LEVEL ENFORCEMENT (overrides from user settings) ===
  if (profile) {
    // 8. Enforce PACING from profile settings
    if (profile.pacing !== undefined) {
      enforced = enforcePacing(enforced, profile.pacing);
    }
    
    // 9. Enforce DESCRIPTIVENESS from profile settings
    if (profile.descriptiveness !== undefined) {
      enforced = enforceDescriptiveness(enforced, profile.descriptiveness);
    }
    
    // 10. Enforce DIRECTNESS from profile settings
    if (profile.directness !== undefined) {
      enforced = enforceDirectness(enforced, profile.directness);
    }
  }
  
  return enforced;
}

function addPreferredTransitions(text: string, preferredTransitions: string[], targetRatio: number): string {
  const sentences = text.split(/(?<=[.!?])\s+/).filter(s => s.trim());
  if (sentences.length < 2) return text;
  
  // Count current transitions
  const currentTransitions = sentences.filter(s => 
    /^\s*(?:However|Moreover|Furthermore|Additionally|Meanwhile|Nevertheless|Therefore|Thus)\b/i.test(s)
  ).length;
  const currentRatio = currentTransitions / sentences.length;
  
  // If we need more transitions
  if (currentRatio < targetRatio - 0.1) {
    const needed = Math.ceil((targetRatio - currentRatio) * sentences.length);
    let added = 0;
    
    for (let i = 1; i < sentences.length && added < needed; i++) {
      // Skip if already has transition
      if (/^\s*(?:However|Moreover|Furthermore|Additionally|Meanwhile|Nevertheless|Therefore|Thus|But|And|So)\b/i.test(sentences[i])) {
        continue;
      }
      
      // Add one of their preferred transitions
      const transition = preferredTransitions[added % preferredTransitions.length];
      sentences[i] = `${transition} ${sentences[i].charAt(0).toLowerCase()}${sentences[i].slice(1)}`;
      added++;
    }
    
    return sentences.join(' ');
  }
  
  return text;
}

function injectCharacteristicVocabulary(text: string, characteristicWords: string[]): string {
  // This is subtle - we don't force words, but we can make simple replacements
  // where synonyms exist in their vocabulary
  let adjusted = text;
  
  // Simple synonym mapping - only if their word is distinctive
  const synonymMap: Record<string, string[]> = {
    'use': ['utilize', 'employ', 'apply'],
    'help': ['assist', 'aid', 'support'],
    'show': ['demonstrate', 'illustrate', 'display'],
    'make': ['create', 'produce', 'generate'],
    'get': ['obtain', 'acquire', 'receive'],
    'important': ['significant', 'crucial', 'vital', 'essential'],
    'big': ['large', 'substantial', 'considerable'],
    'small': ['minimal', 'minor', 'slight']
  };
  
  // If their characteristic word is a more sophisticated variant, use it
  for (const [simple, variants] of Object.entries(synonymMap)) {
    for (const variant of variants) {
      if (characteristicWords.includes(variant)) {
        // They use the sophisticated variant - replace simple with it occasionally
        const regex = new RegExp(`\\b${simple}\\b`, 'gi');
        const matches = adjusted.match(regex);
        if (matches && matches.length > 0) {
          // Replace ~30% of occurrences
          let count = 0;
          adjusted = adjusted.replace(regex, (match) => {
            count++;
            return (count % 3 === 0) ? variant : match;
          });
        }
        break;
      }
    }
  }
  
  return adjusted;
}

function enforcePacing(text: string, pacingLevel: number): string {
  // Pacing: 0 = slow/deliberate, 1 = fast/punchy
  const sentences = text.split(/(?<=[.!?])\s+/).filter(s => s.trim());
  const avgWords = sentences.reduce((sum, s) => sum + s.split(/\s+/).length, 0) / sentences.length;
  
  console.log(`Pacing enforcement: target=${(pacingLevel * 100).toFixed(0)}%, current avg=${avgWords.toFixed(1)} words/sentence`);
  
  // Determine target based on pacing level
  let targetAvg = 0;
  if (pacingLevel >= 0.75) {
    targetAvg = 10; // Fast pacing: 8-12 words
  } else if (pacingLevel >= 0.5) {
    targetAvg = 15; // Moderate: 12-18 words
  } else {
    targetAvg = 22; // Slow: 18-25+ words
  }
  
  // If current average is significantly off, log it
  if (Math.abs(avgWords - targetAvg) > 5) {
    console.log(`⚠️ Pacing mismatch: ${avgWords.toFixed(1)} words vs target ${targetAvg} words`);
    // Note: Full sentence splitting/merging would be complex and risky
    // For now, we rely on the AI prompt to handle this
  }
  
  return text;
}

function enforceDescriptiveness(text: string, descriptivenessLevel: number): string {
  // Descriptiveness: 0 = minimal, 1 = highly descriptive
  const words = text.split(/\s+/);
  const adjectives = text.match(/\b(?:good|great|beautiful|important|significant|large|small|new|old|high|low|strong|weak|clear|specific|particular|special|certain|natural|major|minor|significant|substantial|considerable|remarkable|notable|excellent|outstanding|effective|efficient|powerful|comprehensive|extensive|detailed|complex|simple|easy|difficult|hard|soft|bright|dark|light|heavy|quick|slow|fast|careful|serious|real|true|false|possible|impossible|likely|unlikely|common|rare|unique|unusual|normal|strange|familiar|foreign|local|national|global|public|private|personal|professional|academic|technical|practical|theoretical)\b/gi);
  const adjectiveDensity = adjectives ? adjectives.length / words.length : 0;
  
  console.log(`Descriptiveness enforcement: target=${(descriptivenessLevel * 100).toFixed(0)}%, current=${(adjectiveDensity * 100).toFixed(1)}% adjective density`);
  
  let targetDensity = 0;
  if (descriptivenessLevel >= 0.75) {
    targetDensity = 0.08; // Highly descriptive: 8%+
  } else if (descriptivenessLevel >= 0.5) {
    targetDensity = 0.05; // Moderate: 4-6%
  } else {
    targetDensity = 0.02; // Minimal: < 3%
  }
  
  if (Math.abs(adjectiveDensity - targetDensity) > 0.03) {
    console.log(`⚠️ Descriptiveness mismatch: ${(adjectiveDensity * 100).toFixed(1)}% vs target ${(targetDensity * 100).toFixed(1)}%`);
    // Note: Adding/removing adjectives programmatically is risky
    // We rely on the AI prompt for this
  }
  
  return text;
}

function enforceDirectness(text: string, directnessLevel: number): string {
  // Directness: 0 = indirect/nuanced, 1 = very direct
  const sentences = text.split(/(?<=[.!?])\s+/).filter(s => s.trim());
  
  // Count hedging words (indirect indicators)
  const hedgingWords = text.match(/\b(?:may|might|could|would|should|possibly|probably|perhaps|maybe|somewhat|rather|quite|relatively|fairly|generally|usually|typically|often|sometimes|occasionally)\b/gi);
  const hedgingRatio = hedgingWords ? hedgingWords.length / sentences.length : 0;
  
  // Count imperative/declarative starts (direct indicators)
  const directStarts = sentences.filter(s => 
    /^\s*(?:[A-Z][a-z]+\s+is|[A-Z][a-z]+\s+are|This\s+is|That\s+is|These\s+are|Those\s+are|You\s+must|You\s+should|Do\s+not|Never|Always)\b/i.test(s)
  ).length;
  const directRatio = directStarts / sentences.length;
  
  console.log(`Directness enforcement: target=${(directnessLevel * 100).toFixed(0)}%, hedging=${hedgingRatio.toFixed(2)}, direct starts=${directRatio.toFixed(2)}`);
  
  if (directnessLevel >= 0.75) {
    // Very direct: should have minimal hedging
    if (hedgingRatio > 0.1) {
      console.log(`⚠️ Too much hedging for high directness: ${hedgingRatio.toFixed(2)}`);
    }
  } else if (directnessLevel <= 0.25) {
    // Indirect: should have more hedging
    if (hedgingRatio < 0.1) {
      console.log(`⚠️ Too little hedging for low directness: ${hedgingRatio.toFixed(2)}`);
    }
  }
  
  return text;
}

function adjustFormality(text: string, targetFormality: number, currentFormality: number): string {
  let adjusted = text;
  
  console.log(`Adjusting formality from ${(currentFormality * 100).toFixed(0)}% to ${(targetFormality * 100).toFixed(0)}%`);
  
  if (targetFormality > currentFormality) {
    // INCREASE FORMALITY
    
    // 1. Remove all contractions
    adjusted = expandContractions(adjusted);
    
    // 2. Replace informal words with formal equivalents
    const informalToFormal: Record<string, string> = {
      "gonna": "going to",
      "wanna": "want to",
      "gotta": "must",
      "kinda": "somewhat",
      "sorta": "somewhat",
      "lots of": "numerous",
      "a lot of": "many",
      "tons of": "numerous",
      "stuff": "items",
      "things": "matters",
      "ok": "acceptable",
      "okay": "acceptable",
      "big": "substantial",
      "small": "minimal",
      "get": "obtain",
      "got": "obtained",
      "make": "create",
      "do": "perform",
      "show": "demonstrate",
      "use": "utilize",
      "help": "assist",
      "need": "require",
      "want": "desire",
      "start": "commence",
      "end": "conclude",
      "buy": "purchase",
      "sell": "distribute",
      "keep": "maintain",
      "think": "consider",
      "find out": "determine",
      "talk about": "discuss",
      "look at": "examine",
      "point out": "indicate",
      "bring up": "introduce",
      "come up with": "develop",
      "figure out": "ascertain",
      "deal with": "address",
      "go over": "review",
      "look into": "investigate",
      "really": "",
      "very": "",
      "pretty": "",
      "quite": "",
      "just": "",
      "actually": "",
      "basically": "",
      "literally": ""
    };
    
    for (const [informal, formal] of Object.entries(informalToFormal)) {
      const regex = new RegExp(`\\b${informal}\\b`, 'gi');
      adjusted = adjusted.replace(regex, formal);
    }
    
  // 3. DO NOT change person perspective (no pronoun-to-impersonal conversions)
  // Keep first/second/third person as in the original to preserve meaning and POV.
    
    // 4. Add formal transition words if missing
    const sentences = adjusted.split(/(?<=[.!?])\s+/);
    if (sentences.length > 1) {
      const formalTransitions = ['Moreover', 'Furthermore', 'Additionally', 'Consequently', 'Nevertheless', 'However'];
      // Add transitions to some sentences without them
      for (let i = 1; i < sentences.length; i++) {
        if (i % 3 === 0 && !/^(Moreover|Furthermore|Additionally|Consequently|Nevertheless|However|Therefore|Thus)/i.test(sentences[i])) {
          const transition = formalTransitions[i % formalTransitions.length];
          sentences[i] = `${transition}, ${sentences[i].charAt(0).toLowerCase()}${sentences[i].slice(1)}`;
        }
      }
      adjusted = sentences.join(' ');
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
