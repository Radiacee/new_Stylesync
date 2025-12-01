// Content Moderation - Filter vulgar words, racism, and inappropriate content
// Also provides context checking for paraphrased content

// Vulgar and offensive word list (partial - add more as needed)
const VULGAR_WORDS = new Set([
  // Profanity
  'fuck', 'fucking', 'fucked', 'fucker', 'fucks', 'motherfucker', 'motherfucking',
  'shit', 'shitting', 'shitty', 'bullshit', 'horseshit',
  'ass', 'asshole', 'dumbass', 'jackass', 'badass',
  'bitch', 'bitches', 'bitchy', 'bitching',
  'damn', 'damned', 'goddamn', 'goddamned',
  'hell', 'crap', 'crappy', 'piss', 'pissed',
  'dick', 'dicks', 'dickhead', 'cock', 'cocks',
  'pussy', 'cunt', 'twat', 'whore', 'slut',
  'bastard', 'bastards',
  // Mild
  'stupid', 'idiot', 'idiotic', 'moron', 'moronic', 'dumb', 'retard', 'retarded'
]);

// Racist and discriminatory terms
const RACIST_TERMS = new Set([
  // Racial slurs (censored representations for detection)
  'nigger', 'nigga', 'negro', 'colored',
  'chink', 'gook', 'jap', 'slope',
  'spic', 'wetback', 'beaner', 'gringo',
  'cracker', 'honky', 'whitey', 'redneck',
  'kike', 'yid', 'hymie',
  'raghead', 'sandnigger', 'towelhead', 'camel jockey',
  'paki', 'curry muncher',
  'redskin', 'injun', 'squaw',
  // Discriminatory terms
  'faggot', 'fag', 'dyke', 'queer', 'homo', 'tranny'
]);

// Hate speech patterns
const HATE_PATTERNS = [
  /\b(kill|murder|exterminate|eliminate)\s+(all\s+)?(jews?|blacks?|whites?|asians?|muslims?|christians?|gays?|lesbians?|trans)/gi,
  /\b(all\s+)?(jews?|blacks?|whites?|asians?|muslims?)\s+(should|must|need to)\s+(die|be killed|be eliminated)/gi,
  /\b(white|black|asian)\s+power\b/gi,
  /\brace\s+war\b/gi,
  /\bethnic\s+cleansing\b/gi,
  /\bfinal\s+solution\b/gi,
  /\bgas\s+the\b/gi
];

// Violence patterns
const VIOLENCE_PATTERNS = [
  /\b(how to|ways to)\s+(kill|murder|harm|hurt|attack)\b/gi,
  /\b(bomb|shoot up|massacre|slaughter)\s+(school|church|mosque|synagogue|office)/gi,
  /\b(make|build|create)\s+(a\s+)?(bomb|weapon|explosive)/gi
];

export interface ModerationResult {
  isClean: boolean;
  flaggedWords: FlaggedWord[];
  hateSpeechDetected: boolean;
  violenceDetected: boolean;
  overallSeverity: 'none' | 'mild' | 'moderate' | 'severe';
  suggestions: string[];
}

export interface FlaggedWord {
  word: string;
  category: 'vulgar' | 'racist' | 'hate_speech' | 'violence';
  severity: 'mild' | 'moderate' | 'severe';
  position: number;
  context: string; // surrounding text for review
}

/**
 * Check text for inappropriate content
 */
export function moderateContent(text: string): ModerationResult {
  const flaggedWords: FlaggedWord[] = [];
  let hateSpeechDetected = false;
  let violenceDetected = false;
  
  const lowerText = text.toLowerCase();
  const words = lowerText.split(/\s+/);
  
  // Check for vulgar words
  words.forEach((word, index) => {
    const cleanWord = word.replace(/[^a-z]/g, '');
    
    if (VULGAR_WORDS.has(cleanWord)) {
      const position = text.toLowerCase().indexOf(cleanWord);
      flaggedWords.push({
        word: cleanWord,
        category: 'vulgar',
        severity: getSeverity(cleanWord, 'vulgar'),
        position,
        context: getContext(text, position, cleanWord.length)
      });
    }
    
    if (RACIST_TERMS.has(cleanWord)) {
      const position = text.toLowerCase().indexOf(cleanWord);
      flaggedWords.push({
        word: cleanWord,
        category: 'racist',
        severity: 'severe',
        position,
        context: getContext(text, position, cleanWord.length)
      });
    }
  });
  
  // Check for hate speech patterns
  HATE_PATTERNS.forEach(pattern => {
    const match = text.match(pattern);
    if (match) {
      hateSpeechDetected = true;
      flaggedWords.push({
        word: match[0],
        category: 'hate_speech',
        severity: 'severe',
        position: text.indexOf(match[0]),
        context: getContext(text, text.indexOf(match[0]), match[0].length)
      });
    }
  });
  
  // Check for violence patterns
  VIOLENCE_PATTERNS.forEach(pattern => {
    const match = text.match(pattern);
    if (match) {
      violenceDetected = true;
      flaggedWords.push({
        word: match[0],
        category: 'violence',
        severity: 'severe',
        position: text.indexOf(match[0]),
        context: getContext(text, text.indexOf(match[0]), match[0].length)
      });
    }
  });
  
  // Calculate overall severity
  let overallSeverity: 'none' | 'mild' | 'moderate' | 'severe' = 'none';
  if (flaggedWords.length > 0) {
    if (flaggedWords.some(f => f.severity === 'severe') || hateSpeechDetected || violenceDetected) {
      overallSeverity = 'severe';
    } else if (flaggedWords.some(f => f.severity === 'moderate')) {
      overallSeverity = 'moderate';
    } else {
      overallSeverity = 'mild';
    }
  }
  
  // Generate suggestions
  const suggestions = generateModerationSuggestions(flaggedWords, hateSpeechDetected, violenceDetected);
  
  return {
    isClean: flaggedWords.length === 0,
    flaggedWords,
    hateSpeechDetected,
    violenceDetected,
    overallSeverity,
    suggestions
  };
}

/**
 * Clean text by replacing inappropriate words with asterisks
 */
export function cleanText(text: string): string {
  let cleaned = text;
  
  // Replace vulgar words
  VULGAR_WORDS.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    cleaned = cleaned.replace(regex, '*'.repeat(word.length));
  });
  
  // Replace racist terms
  RACIST_TERMS.forEach(term => {
    const regex = new RegExp(`\\b${term}\\b`, 'gi');
    cleaned = cleaned.replace(regex, '*'.repeat(term.length));
  });
  
  return cleaned;
}

/**
 * Context checking - verify the paraphrased text maintains the same meaning
 */
export interface ContextCheckResult {
  isContextPreserved: boolean;
  meaningScore: number; // 0-100
  issues: ContextIssue[];
}

export interface ContextIssue {
  type: 'missing_info' | 'added_info' | 'changed_meaning' | 'tone_shift';
  description: string;
}

export function checkContext(original: string, paraphrased: string): ContextCheckResult {
  const issues: ContextIssue[] = [];
  
  // Extract key entities and numbers from original
  const originalNumbers = extractNumbers(original);
  const paraphrasedNumbers = extractNumbers(paraphrased);
  
  // Check if numbers are preserved
  originalNumbers.forEach(num => {
    if (!paraphrasedNumbers.includes(num)) {
      issues.push({
        type: 'missing_info',
        description: `Number "${num}" from original text is missing`
      });
    }
  });
  
  // Check if new numbers were added
  paraphrasedNumbers.forEach(num => {
    if (!originalNumbers.includes(num)) {
      issues.push({
        type: 'added_info',
        description: `Number "${num}" was added but not in original`
      });
    }
  });
  
  // Check for proper nouns (names, places)
  const originalProperNouns = extractProperNouns(original);
  const paraphrasedProperNouns = extractProperNouns(paraphrased);
  
  originalProperNouns.forEach(noun => {
    if (!paraphrasedProperNouns.some(p => p.toLowerCase() === noun.toLowerCase())) {
      issues.push({
        type: 'missing_info',
        description: `Proper noun "${noun}" from original is missing`
      });
    }
  });
  
  // Check length difference (significant change might indicate info loss)
  const lengthRatio = paraphrased.length / original.length;
  if (lengthRatio < 0.5) {
    issues.push({
      type: 'missing_info',
      description: 'Paraphrased text is significantly shorter - may be missing content'
    });
  } else if (lengthRatio > 2) {
    issues.push({
      type: 'added_info',
      description: 'Paraphrased text is significantly longer - may have added content'
    });
  }
  
  // Calculate meaning score
  const meaningScore = calculateMeaningScore(original, paraphrased, issues);
  
  return {
    isContextPreserved: issues.length === 0 && meaningScore >= 80,
    meaningScore,
    issues
  };
}

// Helper functions
function getSeverity(word: string, category: string): 'mild' | 'moderate' | 'severe' {
  const mildWords = ['damn', 'hell', 'crap', 'stupid', 'idiot', 'dumb'];
  const moderateWords = ['shit', 'ass', 'bitch', 'bastard', 'piss'];
  
  if (category === 'racist') return 'severe';
  if (mildWords.includes(word)) return 'mild';
  if (moderateWords.includes(word)) return 'moderate';
  return 'severe';
}

function getContext(text: string, position: number, wordLength: number): string {
  const start = Math.max(0, position - 30);
  const end = Math.min(text.length, position + wordLength + 30);
  let context = text.slice(start, end);
  if (start > 0) context = '...' + context;
  if (end < text.length) context = context + '...';
  return context;
}

function generateModerationSuggestions(
  flaggedWords: FlaggedWord[],
  hateSpeech: boolean,
  violence: boolean
): string[] {
  const suggestions: string[] = [];
  
  if (hateSpeech) {
    suggestions.push('Remove hate speech content - this violates community guidelines');
  }
  
  if (violence) {
    suggestions.push('Remove violent content - this may violate terms of service');
  }
  
  const vulgarCount = flaggedWords.filter(f => f.category === 'vulgar').length;
  if (vulgarCount > 0) {
    suggestions.push(`Consider removing ${vulgarCount} vulgar word(s) for professional content`);
  }
  
  const racistCount = flaggedWords.filter(f => f.category === 'racist').length;
  if (racistCount > 0) {
    suggestions.push('Racist terms detected - these must be removed');
  }
  
  if (suggestions.length === 0) {
    suggestions.push('Content appears appropriate');
  }
  
  return suggestions;
}

function extractNumbers(text: string): string[] {
  const matches = text.match(/\b\d+(?:\.\d+)?%?|\b(?:one|two|three|four|five|six|seven|eight|nine|ten|hundred|thousand|million|billion)\b/gi);
  return matches ? [...new Set(matches)] : [];
}

function extractProperNouns(text: string): string[] {
  // Simple heuristic: capitalized words not at sentence start
  const sentences = text.split(/[.!?]+/);
  const properNouns: string[] = [];
  
  sentences.forEach(sentence => {
    const words = sentence.trim().split(/\s+/);
    words.slice(1).forEach(word => {
      if (/^[A-Z][a-z]+$/.test(word) && word.length > 2) {
        properNouns.push(word);
      }
    });
  });
  
  return [...new Set(properNouns)];
}

function calculateMeaningScore(original: string, paraphrased: string, issues: ContextIssue[]): number {
  let score = 100;
  
  // Deduct for each issue
  issues.forEach(issue => {
    switch (issue.type) {
      case 'missing_info': score -= 15; break;
      case 'added_info': score -= 10; break;
      case 'changed_meaning': score -= 20; break;
      case 'tone_shift': score -= 5; break;
    }
  });
  
  // Bonus for similar length
  const lengthRatio = paraphrased.length / original.length;
  if (lengthRatio >= 0.8 && lengthRatio <= 1.2) {
    score += 5;
  }
  
  return Math.max(0, Math.min(100, score));
}

// Predefined writing style templates
export interface WritingStylePreset {
  id: string;
  name: string;
  description: string;
  settings: {
    formality: number;
    pacing: number;
    descriptiveness: number;
    directness: number;
    usesContractions: boolean;
    tone: string;
  };
  examples: string[];
}

export const WRITING_STYLE_PRESETS: WritingStylePreset[] = [
  {
    id: 'academic',
    name: 'Academic',
    description: 'Formal, structured writing for scholarly papers and research',
    settings: {
      formality: 0.9,
      pacing: 0.3,
      descriptiveness: 0.7,
      directness: 0.6,
      usesContractions: false,
      tone: 'formal'
    },
    examples: [
      'The research demonstrates significant correlation between variables.',
      'Furthermore, the evidence suggests that implementation requires careful consideration.',
      'This study examines the multifaceted implications of the phenomenon.'
    ]
  },
  {
    id: 'casual',
    name: 'Casual',
    description: 'Friendly, conversational tone for blogs and informal writing',
    settings: {
      formality: 0.2,
      pacing: 0.7,
      descriptiveness: 0.5,
      directness: 0.8,
      usesContractions: true,
      tone: 'friendly'
    },
    examples: [
      "It's pretty cool how this works, right?",
      "Here's the thing - you don't need to overthink it.",
      "Let me break it down for you in simple terms."
    ]
  },
  {
    id: 'professional',
    name: 'Professional',
    description: 'Business-appropriate tone for emails and reports',
    settings: {
      formality: 0.7,
      pacing: 0.5,
      descriptiveness: 0.4,
      directness: 0.7,
      usesContractions: false,
      tone: 'balanced'
    },
    examples: [
      'I am writing to follow up on our previous discussion.',
      'The project timeline has been updated accordingly.',
      'Please review the attached documents at your earliest convenience.'
    ]
  },
  {
    id: 'creative',
    name: 'Creative',
    description: 'Expressive, vivid language for storytelling and creative writing',
    settings: {
      formality: 0.4,
      pacing: 0.5,
      descriptiveness: 0.9,
      directness: 0.4,
      usesContractions: true,
      tone: 'expressive'
    },
    examples: [
      'The twilight sky painted itself in hues of amber and rose.',
      "She wasn't just walking; she was dancing with shadows.",
      'Every word carried the weight of unspoken stories.'
    ]
  },
  {
    id: 'journalistic',
    name: 'Journalistic',
    description: 'Clear, factual writing for news and articles',
    settings: {
      formality: 0.6,
      pacing: 0.6,
      descriptiveness: 0.5,
      directness: 0.9,
      usesContractions: false,
      tone: 'neutral'
    },
    examples: [
      'Officials announced the new policy on Tuesday.',
      'The incident occurred at approximately 3 PM local time.',
      'Sources familiar with the matter confirmed the development.'
    ]
  },
  {
    id: 'persuasive',
    name: 'Persuasive',
    description: 'Compelling, convincing writing for arguments and proposals',
    settings: {
      formality: 0.6,
      pacing: 0.6,
      descriptiveness: 0.6,
      directness: 0.8,
      usesContractions: true,
      tone: 'encouraging'
    },
    examples: [
      "Here's why this matters: you can't afford to ignore it.",
      'The evidence overwhelmingly supports this approach.',
      'Consider the possibilities if we take action now.'
    ]
  }
];

export function getPresetById(id: string): WritingStylePreset | undefined {
  return WRITING_STYLE_PRESETS.find(p => p.id === id);
}
