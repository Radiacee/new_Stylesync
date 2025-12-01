// Writing Suggestions - Analyze user's writing and provide improvement tips

export interface WritingSuggestion {
  category: 'grammar' | 'clarity' | 'style' | 'vocabulary' | 'structure' | 'engagement';
  severity: 'info' | 'warning' | 'improvement';
  title: string;
  description: string;
  example?: {
    before: string;
    after: string;
  };
}

export interface WritingAnalysis {
  overallScore: number; // 0-100
  suggestions: WritingSuggestion[];
  strengths: string[];
  metrics: {
    avgSentenceLength: number;
    vocabularyDiversity: number;
    passiveVoiceRatio: number;
    readabilityGrade: number;
    adverbOveruse: boolean;
    repetitionIssues: string[];
  };
}

/**
 * Analyze text and provide writing improvement suggestions
 */
export function analyzeWriting(text: string): WritingAnalysis {
  const suggestions: WritingSuggestion[] = [];
  const strengths: string[] = [];
  
  // Calculate metrics
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const uniqueWords = new Set(words.map(w => w.toLowerCase().replace(/[^a-z]/g, '')));
  
  const avgSentenceLength = words.length / Math.max(sentences.length, 1);
  const vocabularyDiversity = uniqueWords.size / Math.max(words.length, 1);
  const passiveVoiceRatio = calculatePassiveVoiceRatio(text);
  const readabilityGrade = calculateReadabilityGrade(text);
  const adverbOveruse = checkAdverbOveruse(text);
  const repetitionIssues = findRepetitions(text);
  
  // Sentence length analysis
  if (avgSentenceLength > 25) {
    suggestions.push({
      category: 'clarity',
      severity: 'warning',
      title: 'Long sentences detected',
      description: `Your average sentence is ${Math.round(avgSentenceLength)} words. Consider breaking up longer sentences for better readability.`,
      example: {
        before: 'The implementation of the new system which was developed over several months and involved multiple teams working together has finally been completed.',
        after: 'The new system has finally been completed. Multiple teams worked together over several months to develop it.'
      }
    });
  } else if (avgSentenceLength < 8) {
    suggestions.push({
      category: 'style',
      severity: 'info',
      title: 'Very short sentences',
      description: 'Your sentences are quite short. While this creates punchy prose, consider varying sentence length for better flow.',
    });
  } else {
    strengths.push('Good sentence length variation');
  }
  
  // Vocabulary diversity
  if (vocabularyDiversity < 0.4) {
    suggestions.push({
      category: 'vocabulary',
      severity: 'improvement',
      title: 'Limited vocabulary variety',
      description: 'Consider using more varied word choices to make your writing more engaging. A thesaurus can help find alternatives.',
    });
  } else if (vocabularyDiversity > 0.7) {
    strengths.push('Rich and varied vocabulary');
  }
  
  // Passive voice
  if (passiveVoiceRatio > 0.3) {
    suggestions.push({
      category: 'style',
      severity: 'warning',
      title: 'High passive voice usage',
      description: `About ${Math.round(passiveVoiceRatio * 100)}% of your sentences use passive voice. Active voice often makes writing more direct and engaging.`,
      example: {
        before: 'The report was written by the team.',
        after: 'The team wrote the report.'
      }
    });
  } else if (passiveVoiceRatio < 0.15) {
    strengths.push('Good use of active voice');
  }
  
  // Adverb overuse
  if (adverbOveruse) {
    suggestions.push({
      category: 'style',
      severity: 'improvement',
      title: 'Consider reducing adverbs',
      description: 'Many "-ly" adverbs can weaken your writing. Try using stronger verbs instead.',
      example: {
        before: 'She quickly ran very fast to the store.',
        after: 'She sprinted to the store.'
      }
    });
  }
  
  // Repetition issues
  if (repetitionIssues.length > 0) {
    suggestions.push({
      category: 'vocabulary',
      severity: 'warning',
      title: 'Word repetition detected',
      description: `The following words appear frequently: ${repetitionIssues.slice(0, 3).join(', ')}. Consider using synonyms.`,
    });
  }
  
  // Check for weak phrases
  const weakPhrases = findWeakPhrases(text);
  if (weakPhrases.length > 0) {
    suggestions.push({
      category: 'clarity',
      severity: 'improvement',
      title: 'Weak phrases detected',
      description: 'Some phrases could be stronger or more concise.',
      example: weakPhrases[0]
    });
  }
  
  // Check for filler words
  const fillerWords = findFillerWords(text);
  if (fillerWords.length > 3) {
    suggestions.push({
      category: 'clarity',
      severity: 'info',
      title: 'Filler words detected',
      description: `Words like "${fillerWords.slice(0, 3).join('", "')}" can often be removed to make your writing more concise.`,
    });
  }
  
  // Readability
  if (readabilityGrade > 14) {
    suggestions.push({
      category: 'clarity',
      severity: 'info',
      title: 'Complex reading level',
      description: `Your text requires a college-level reading ability (grade ${Math.round(readabilityGrade)}). Consider simplifying for broader audiences.`,
    });
  } else if (readabilityGrade >= 8 && readabilityGrade <= 12) {
    strengths.push('Appropriate reading level for general audience');
  }
  
  // Check for engaging opening
  if (sentences.length > 0 && !hasEngagingOpening(sentences[0])) {
    suggestions.push({
      category: 'engagement',
      severity: 'info',
      title: 'Consider a stronger opening',
      description: 'Starting with a question, statistic, or bold statement can capture reader attention.',
    });
  }
  
  // Paragraph structure
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  if (paragraphs.length === 1 && words.length > 150) {
    suggestions.push({
      category: 'structure',
      severity: 'warning',
      title: 'Consider adding paragraph breaks',
      description: 'Long blocks of text can be hard to read. Break your content into paragraphs of 3-5 sentences each.',
    });
  }
  
  // Calculate overall score
  let score = 70; // Base score
  score += strengths.length * 5;
  score -= suggestions.filter(s => s.severity === 'warning').length * 8;
  score -= suggestions.filter(s => s.severity === 'improvement').length * 4;
  score -= suggestions.filter(s => s.severity === 'info').length * 2;
  score = Math.max(20, Math.min(100, score));
  
  return {
    overallScore: Math.round(score),
    suggestions,
    strengths,
    metrics: {
      avgSentenceLength: Math.round(avgSentenceLength * 10) / 10,
      vocabularyDiversity: Math.round(vocabularyDiversity * 100) / 100,
      passiveVoiceRatio: Math.round(passiveVoiceRatio * 100) / 100,
      readabilityGrade: Math.round(readabilityGrade * 10) / 10,
      adverbOveruse,
      repetitionIssues
    }
  };
}

// Helper functions
function calculatePassiveVoiceRatio(text: string): number {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const passivePattern = /\b(is|are|was|were|be|been|being)\s+(\w+ed|done|made|taken|given|shown|found|known|seen|told|written|built|bought|brought|caught|chosen|drawn|driven|eaten|fallen|felt|forgotten|gotten|gone|grown|heard|held|hidden|hit|hurt|kept|known|left|lent|let|lost|made|meant|met|paid|put|read|ridden|risen|run|said|sat|seen|sent|set|shown|shut|sung|sat|slept|spoken|spent|stood|stolen|struck|swum|taken|taught|thought|thrown|told|understood|woken|won|worn|written)\b/gi;
  
  let passiveCount = 0;
  sentences.forEach(s => {
    if (passivePattern.test(s)) passiveCount++;
  });
  
  return passiveCount / Math.max(sentences.length, 1);
}

function calculateReadabilityGrade(text: string): number {
  // Flesch-Kincaid Grade Level
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const syllables = words.reduce((sum, word) => sum + countSyllables(word), 0);
  
  if (sentences.length === 0 || words.length === 0) return 8;
  
  const avgWordsPerSentence = words.length / sentences.length;
  const avgSyllablesPerWord = syllables / words.length;
  
  const grade = 0.39 * avgWordsPerSentence + 11.8 * avgSyllablesPerWord - 15.59;
  return Math.max(1, Math.min(18, grade));
}

function countSyllables(word: string): number {
  word = word.toLowerCase().replace(/[^a-z]/g, '');
  if (word.length <= 2) return 1;
  
  // Count vowel groups
  const vowelGroups = word.match(/[aeiouy]+/g);
  let count = vowelGroups ? vowelGroups.length : 1;
  
  // Adjust for silent e
  if (word.endsWith('e')) count--;
  
  // Adjust for -le endings
  if (word.endsWith('le') && word.length > 2 && !/[aeiouy]/.test(word[word.length - 3])) count++;
  
  return Math.max(1, count);
}

function checkAdverbOveruse(text: string): boolean {
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const lyAdverbs = words.filter(w => /ly$/i.test(w) && w.length > 4);
  return lyAdverbs.length / words.length > 0.03; // More than 3% adverbs
}

function findRepetitions(text: string): string[] {
  const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 4);
  const wordCounts: Record<string, number> = {};
  
  words.forEach(word => {
    const clean = word.replace(/[^a-z]/g, '');
    if (clean.length > 4 && !isCommonWord(clean)) {
      wordCounts[clean] = (wordCounts[clean] || 0) + 1;
    }
  });
  
  return Object.entries(wordCounts)
    .filter(([_, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])
    .map(([word, count]) => `${word} (${count}x)`);
}

function isCommonWord(word: string): boolean {
  const common = new Set(['their', 'there', 'would', 'could', 'should', 'which', 'about', 'these', 'those', 'being', 'other', 'after', 'before', 'between', 'through', 'during', 'without', 'another', 'because', 'however', 'therefore', 'although']);
  return common.has(word);
}

function findWeakPhrases(text: string): { before: string; after: string }[] {
  const weakPhrases: Record<string, string> = {
    'in order to': 'to',
    'due to the fact that': 'because',
    'at this point in time': 'now',
    'in the event that': 'if',
    'for the purpose of': 'to',
    'in spite of the fact that': 'although',
    'it is important to note that': '',
    'it should be noted that': '',
    'the fact that': 'that',
    'in my opinion': '',
    'i think that': '',
    'i believe that': '',
    'very unique': 'unique',
    'completely unique': 'unique',
    'very important': 'crucial/vital',
    'really great': 'excellent',
    'pretty much': 'essentially',
    'sort of': '',
    'kind of': ''
  };
  
  const found: { before: string; after: string }[] = [];
  const lowerText = text.toLowerCase();
  
  Object.entries(weakPhrases).forEach(([weak, strong]) => {
    if (lowerText.includes(weak)) {
      found.push({
        before: weak,
        after: strong || '(can be removed)'
      });
    }
  });
  
  return found;
}

function findFillerWords(text: string): string[] {
  const fillers = ['just', 'really', 'very', 'actually', 'basically', 'literally', 'simply', 'quite', 'rather', 'somewhat'];
  const words = text.toLowerCase().split(/\s+/);
  
  return fillers.filter(filler => {
    const count = words.filter(w => w.replace(/[^a-z]/g, '') === filler).length;
    return count >= 2;
  });
}

function hasEngagingOpening(sentence: string): boolean {
  const engaging = [
    /^(?:have you|did you|do you|what if|imagine|consider)/i,
    /^\d+%?/,
    /^["']/,
    /^(?:surprisingly|interestingly|remarkably|incredibly)/i,
    /\?$/
  ];
  
  return engaging.some(pattern => pattern.test(sentence.trim()));
}

/**
 * Get quick tips based on writing style
 */
export function getQuickTips(styleType: 'academic' | 'casual' | 'professional' | 'creative'): string[] {
  const tips: Record<string, string[]> = {
    academic: [
      'Use formal language and avoid contractions',
      'Support claims with evidence and citations',
      'Define technical terms when first introduced',
      'Maintain objective, third-person perspective',
      'Use transition words to connect ideas'
    ],
    casual: [
      "It's okay to use contractions and informal language",
      'Write as if you\'re talking to a friend',
      'Use questions to engage readers',
      'Share personal anecdotes when relevant',
      'Keep paragraphs short and scannable'
    ],
    professional: [
      'Be concise and get to the point quickly',
      'Use bullet points for lists',
      'Avoid jargon unless necessary',
      'Include clear calls to action',
      'Proofread carefully for errors'
    ],
    creative: [
      'Show, don\'t tell - use vivid descriptions',
      'Vary sentence rhythm for impact',
      'Use sensory details to immerse readers',
      'Experiment with metaphors and similes',
      'Let your unique voice shine through'
    ]
  };
  
  return tips[styleType] || tips.professional;
}
