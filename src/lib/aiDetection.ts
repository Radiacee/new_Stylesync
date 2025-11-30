/**
 * AI Content Detection - Real heuristic-based detection
 * Analyzes text patterns commonly found in AI-generated content
 */

export interface AIDetectionResult {
  aiScore: number;           // 0-1, where 1 = definitely AI
  humanScore: number;        // 0-1, where 1 = definitely human
  confidence: number;        // How confident we are in the result
  verdict: 'human' | 'likely-human' | 'mixed' | 'likely-ai' | 'ai';
  signals: AISignal[];       // Individual detection signals
  breakdown: {
    vocabulary: number;      // AI vocabulary score
    structure: number;       // Sentence structure uniformity
    patterns: number;        // Common AI patterns
    naturalness: number;     // Human naturalness markers
  };
}

export interface AISignal {
  type: 'ai' | 'human';
  category: string;
  description: string;
  weight: number;
}

// Common AI vocabulary and phrases
const AI_VOCABULARY = [
  // Overused AI words
  'delve', 'utilize', 'leverage', 'facilitate', 'paramount', 'multifaceted',
  'comprehensive', 'robust', 'seamless', 'cutting-edge', 'innovative',
  'streamline', 'synergy', 'optimize', 'holistic', 'dynamic',
  'pivotal', 'crucial', 'essential', 'significant', 'substantial',
  'endeavor', 'embark', 'foster', 'enhance', 'bolster',
  'meticulous', 'intricate', 'nuanced', 'profound', 'compelling'
];

const AI_PHRASES = [
  /\bit('s| is) (important|worth|essential|crucial) to (note|mention|understand|recognize)/gi,
  /\bin today('s| 's) (world|age|era|society|landscape)/gi,
  /\b(let('s| us)|allow me to) (delve|dive|explore|examine)/gi,
  /\bwhen it comes to\b/gi,
  /\bat the end of the day\b/gi,
  /\bin (conclusion|summary|essence)\b/gi,
  /\bplays a (crucial|vital|key|important|significant|pivotal) role\b/gi,
  /\b(game-?changer|paradigm shift)\b/gi,
  /\btake .{1,30} to the next level\b/gi,
  /\b(navigat(e|ing)|embark(ing)? on) (this|the|a) journey\b/gi,
  /\bunlock(ing)? (the|your|its) (full )?potential\b/gi,
  /\b(first and foremost|last but not least)\b/gi,
  /\bIt('s| is) no secret that\b/gi,
  /\bIn (light|view) of (this|the|these)\b/gi,
  /\bAs (we|I) (delve|dive|explore)\b/gi,
  /\bmoreover|furthermore|additionally|consequently\b/gi,
  /\bnevertheless|nonetheless|hence|thus\b/gi,
];

const AI_TRANSITION_STARTERS = [
  'Moreover', 'Furthermore', 'Additionally', 'Consequently',
  'Nevertheless', 'Nonetheless', 'Hence', 'Thus', 'Therefore',
  'Subsequently', 'Accordingly', 'In conclusion', 'To summarize',
  'In essence', 'Ultimately', 'Notably', 'Significantly'
];

// Human writing markers
const HUMAN_MARKERS = {
  contractions: /\b(don't|won't|can't|isn't|aren't|wasn't|weren't|haven't|hasn't|hadn't|I'm|you're|he's|she's|it's|we're|they're|I've|you've|we've|they've|I'll|you'll|we'll|they'll|I'd|you'd|he'd|she'd|we'd|they'd|couldn't|wouldn't|shouldn't|didn't|doesn't|ain't|let's|that's|there's|here's|what's|who's|how's|where's|when's|why's)\b/gi,
  personalPronouns: /\b(I|me|my|mine|myself|we|us|our|ours|ourselves)\b/g,
  informalWords: /\b(yeah|yep|nope|gonna|wanna|gotta|kinda|sorta|lots|tons|stuff|things|ok|okay|cool|nice|pretty|really|very|just|actually|basically|literally|honestly|seriously|totally|super|awesome|great|amazing|terrible|horrible|crazy|weird|funny|silly|dumb|smart)\b/gi,
  fillerPhrases: /\b(you know|I mean|like|sort of|kind of|I think|I guess|I feel|to be honest|honestly|actually|basically)\b/gi,
  questions: /\?/g,
  exclamations: /!/g,
};

/**
 * Detect AI-generated content using multiple heuristics
 */
export function detectAIContent(text: string): AIDetectionResult {
  if (!text || text.trim().length < 50) {
    return {
      aiScore: 0.5,
      humanScore: 0.5,
      confidence: 0,
      verdict: 'mixed',
      signals: [],
      breakdown: { vocabulary: 0.5, structure: 0.5, patterns: 0.5, naturalness: 0.5 }
    };
  }

  const signals: AISignal[] = [];
  const words = text.toLowerCase().split(/\s+/);
  const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 0);
  const wordCount = words.length;
  const sentenceCount = sentences.length;

  // ========== AI VOCABULARY ANALYSIS ==========
  let aiVocabCount = 0;
  for (const word of AI_VOCABULARY) {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    const matches = text.match(regex);
    if (matches) {
      aiVocabCount += matches.length;
      if (matches.length >= 2) {
        signals.push({
          type: 'ai',
          category: 'Vocabulary',
          description: `Uses "${word}" ${matches.length} times (common AI word)`,
          weight: 0.15
        });
      }
    }
  }
  const vocabScore = Math.min(1, aiVocabCount / (wordCount * 0.02));

  // ========== AI PHRASE PATTERNS ==========
  let aiPhraseCount = 0;
  for (const pattern of AI_PHRASES) {
    const matches = text.match(pattern);
    if (matches) {
      aiPhraseCount += matches.length;
      signals.push({
        type: 'ai',
        category: 'Phrases',
        description: `Contains AI-typical phrase: "${matches[0]}"`,
        weight: 0.2
      });
    }
  }
  const patternScore = Math.min(1, aiPhraseCount / (sentenceCount * 0.15));

  // ========== SENTENCE STRUCTURE UNIFORMITY ==========
  const sentenceLengths = sentences.map(s => s.split(/\s+/).length);
  const avgLength = sentenceLengths.reduce((a, b) => a + b, 0) / sentenceLengths.length;
  const variance = sentenceLengths.reduce((sum, len) => sum + Math.pow(len - avgLength, 2), 0) / sentenceLengths.length;
  const stdDev = Math.sqrt(variance);
  
  // Low variance = more AI-like (AI tends to write uniform sentence lengths)
  let structureScore = 0;
  if (sentenceCount >= 3) {
    if (stdDev < 3) {
      structureScore = 0.8;
      signals.push({
        type: 'ai',
        category: 'Structure',
        description: `Very uniform sentence lengths (std dev: ${stdDev.toFixed(1)}) - typical of AI`,
        weight: 0.25
      });
    } else if (stdDev < 5) {
      structureScore = 0.5;
    } else if (stdDev > 8) {
      structureScore = 0.2;
      signals.push({
        type: 'human',
        category: 'Structure',
        description: `Varied sentence lengths (std dev: ${stdDev.toFixed(1)}) - typical of human writing`,
        weight: 0.15
      });
    }
  }

  // ========== TRANSITION WORD ANALYSIS ==========
  let formalTransitionCount = 0;
  for (const transition of AI_TRANSITION_STARTERS) {
    const regex = new RegExp(`^${transition}\\b|[.!?]\\s*${transition}\\b`, 'gi');
    const matches = text.match(regex);
    if (matches) {
      formalTransitionCount += matches.length;
    }
  }
  const transitionRatio = formalTransitionCount / sentenceCount;
  if (transitionRatio > 0.25) {
    signals.push({
      type: 'ai',
      category: 'Transitions',
      description: `Heavy use of formal transitions (${Math.round(transitionRatio * 100)}% of sentences)`,
      weight: 0.2
    });
  }

  // ========== HUMAN NATURALNESS MARKERS ==========
  let naturalScore = 0;

  // Contractions
  const contractions = text.match(HUMAN_MARKERS.contractions) || [];
  const contractionRate = contractions.length / wordCount;
  if (contractionRate > 0.02) {
    naturalScore += 0.3;
    signals.push({
      type: 'human',
      category: 'Natural Speech',
      description: `Uses contractions naturally (${contractions.length} found)`,
      weight: 0.2
    });
  } else if (contractionRate === 0 && wordCount > 100) {
    signals.push({
      type: 'ai',
      category: 'Formality',
      description: 'No contractions used (uncommon in casual human writing)',
      weight: 0.15
    });
  }

  // Personal pronouns (especially first person)
  const personalPronouns = text.match(HUMAN_MARKERS.personalPronouns) || [];
  const pronounRate = personalPronouns.length / wordCount;
  if (pronounRate > 0.03) {
    naturalScore += 0.2;
    signals.push({
      type: 'human',
      category: 'Personal Voice',
      description: `Strong personal voice with first-person pronouns`,
      weight: 0.15
    });
  }

  // Informal words
  const informalWords = text.match(HUMAN_MARKERS.informalWords) || [];
  if (informalWords.length > wordCount * 0.01) {
    naturalScore += 0.2;
    signals.push({
      type: 'human',
      category: 'Informal Language',
      description: `Uses informal/casual words naturally`,
      weight: 0.1
    });
  }

  // Questions and exclamations (engagement markers)
  const questions = (text.match(HUMAN_MARKERS.questions) || []).length;
  const exclamations = (text.match(HUMAN_MARKERS.exclamations) || []).length;
  if (questions > 0 && questions / sentenceCount > 0.1) {
    naturalScore += 0.15;
  }
  if (exclamations > 0 && exclamations / sentenceCount < 0.3) {
    naturalScore += 0.1;
  }

  // ========== CALCULATE FINAL SCORES ==========
  const breakdown = {
    vocabulary: vocabScore,
    structure: structureScore,
    patterns: patternScore,
    naturalness: 1 - Math.min(1, naturalScore)
  };

  // Weighted combination
  const aiScore = Math.min(1, Math.max(0,
    (vocabScore * 0.25) +
    (structureScore * 0.2) +
    (patternScore * 0.3) +
    ((1 - naturalScore) * 0.25)
  ));

  const humanScore = 1 - aiScore;

  // Confidence based on text length and signal strength
  const signalStrength = signals.reduce((sum, s) => sum + s.weight, 0);
  const lengthFactor = Math.min(1, wordCount / 200);
  const confidence = Math.min(0.95, (lengthFactor * 0.5) + (Math.min(signalStrength, 1) * 0.5));

  // Determine verdict
  let verdict: AIDetectionResult['verdict'];
  if (humanScore >= 0.75) verdict = 'human';
  else if (humanScore >= 0.6) verdict = 'likely-human';
  else if (humanScore >= 0.4) verdict = 'mixed';
  else if (humanScore >= 0.25) verdict = 'likely-ai';
  else verdict = 'ai';

  return {
    aiScore,
    humanScore,
    confidence,
    verdict,
    signals: signals.slice(0, 8), // Top 8 signals
    breakdown
  };
}

/**
 * Compare AI detection between original and paraphrased text
 */
export function compareAIDetection(original: string, paraphrased: string): {
  original: AIDetectionResult;
  paraphrased: AIDetectionResult;
  improvement: number; // Positive = more human-like after paraphrase
  summary: string;
} {
  const originalResult = detectAIContent(original);
  const paraphrasedResult = detectAIContent(paraphrased);
  const improvement = paraphrasedResult.humanScore - originalResult.humanScore;

  let summary: string;
  if (improvement > 0.2) {
    summary = `Great improvement! The paraphrased text is significantly more human-like (+${Math.round(improvement * 100)}%)`;
  } else if (improvement > 0.1) {
    summary = `Good improvement. The text is noticeably more natural (+${Math.round(improvement * 100)}%)`;
  } else if (improvement > 0) {
    summary = `Slight improvement in human-likeness (+${Math.round(improvement * 100)}%)`;
  } else if (improvement > -0.1) {
    summary = `Similar AI detection scores. Consider adding more personal voice.`;
  } else {
    summary = `The paraphrased text may still contain AI patterns. Try adjusting your style profile.`;
  }

  return { original: originalResult, paraphrased: paraphrasedResult, improvement, summary };
}

/**
 * Get display color based on human score
 */
export function getScoreColor(humanScore: number): string {
  if (humanScore >= 0.75) return 'emerald';
  if (humanScore >= 0.6) return 'green';
  if (humanScore >= 0.45) return 'yellow';
  if (humanScore >= 0.3) return 'orange';
  return 'red';
}

/**
 * Get display label based on verdict
 */
export function getVerdictLabel(verdict: AIDetectionResult['verdict']): string {
  switch (verdict) {
    case 'human': return 'Appears Human Written';
    case 'likely-human': return 'Likely Human Written';
    case 'mixed': return 'Mixed Signals';
    case 'likely-ai': return 'Likely AI Generated';
    case 'ai': return 'Appears AI Generated';
  }
}
