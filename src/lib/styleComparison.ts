import { analyzeSampleStyle, type SampleStyle } from './paraphrase';

export interface TextAnalysis {
  // Basic metrics
  wordCount: number;
  sentenceCount: number;
  avgSentenceLength: number;
  avgWordLength: number;
  
  // Vocabulary analysis
  vocabularyComplexity: number;
  uniqueWords: number;
  lexicalDiversity: number;
  
  // Structural analysis
  questionRatio: number;
  exclamatoryRatio: number;
  compoundSentenceRatio: number;
  
  // Style markers
  usesContractions: boolean;
  passiveVoiceRatio: number;
  adverbDensity: number;
  adjectiveDensity: number;
  
  // Punctuation patterns
  commaUsage: number;
  semicolonUsage: number;
  colonUsage: number;
  dashUsage: number;
  
  // Readability
  readabilityScore: number;
  formalityScore: number;
  
  // Transition and flow
  transitionWordCount: number;
  conjunctionDensity: number;
  
  // Personal voice
  firstPersonUsage: number;
  secondPersonUsage: number;
  thirdPersonUsage: number;
}

export interface StyleTransformation {
  userStyle: SampleStyle;
  originalAnalysis: TextAnalysis;
  paraphrasedAnalysis: TextAnalysis;
  transformationInsights: {
    sentenceStructure: string[];
    vocabularyChanges: string[];
    formalityShifts: string[];
    personalityAdjustments: string[];
    technicalModifications: string[];
    readabilityImprovements: string[];
  };
  alignmentScore: number; // How well the paraphrase matches user style (0-1)
  detailedComparison: ComparisonDetail[];
}

export interface ComparisonDetail {
  category: string;
  metric: string;
  userValue: string | number;
  originalValue: string | number;
  paraphrasedValue: string | number;
  changeDescription: string;
  alignment: 'excellent' | 'good' | 'fair' | 'poor';
  impact: 'major' | 'moderate' | 'minor';
}

export function analyzeText(text: string): TextAnalysis {
  if (!text.trim()) {
    return createEmptyAnalysis();
  }
  
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const words = text.toLowerCase().match(/\b[a-z]+\b/g) || [];
  const allWords = text.match(/\b\w+\b/g) || [];
  
  // Basic metrics
  const wordCount = allWords.length;
  const sentenceCount = sentences.length;
  const avgSentenceLength = sentenceCount > 0 ? wordCount / sentenceCount : 0;
  const avgWordLength = words.reduce((sum, word) => sum + word.length, 0) / words.length || 0;
  
  // Vocabulary analysis
  const uniqueWords = new Set(words).size;
  const lexicalDiversity = uniqueWords / wordCount || 0;
  const complexWords = words.filter(word => word.length > 7).length;
  const vocabularyComplexity = complexWords / wordCount || 0;
  
  // Structural analysis
  const questionSentences = sentences.filter(s => s.includes('?')).length;
  const exclamatorySentences = sentences.filter(s => s.includes('!')).length;
  const questionRatio = questionSentences / sentenceCount || 0;
  const exclamatoryRatio = exclamatorySentences / sentenceCount || 0;
  
  // Count compound sentences (containing and, but, or, so, yet)
  const compoundSentences = sentences.filter(s => 
    /\b(and|but|or|so|yet)\b/i.test(s) && s.split(/\b(and|but|or|so|yet)\b/i).length > 2
  ).length;
  const compoundSentenceRatio = compoundSentences / sentenceCount || 0;
  
  // Style markers
  const contractions = (text.match(/\b\w+'\w+\b/g) || []).length;
  const usesContractions = contractions > 0;
  
  // Passive voice detection (simplified)
  const passiveIndicators = text.match(/\b(was|were|is|are|been|being)\s+\w+ed\b/gi) || [];
  const passiveVoiceRatio = passiveIndicators.length / sentenceCount || 0;
  
  // Adverbs and adjectives
  const adverbs = (text.match(/\b\w+ly\b/g) || []).length;
  const adjectives = countAdjectives(text);
  const adverbDensity = adverbs / wordCount || 0;
  const adjectiveDensity = adjectives / wordCount || 0;
  
  // Punctuation patterns
  const commaUsage = (text.match(/,/g) || []).length / sentenceCount || 0;
  const semicolonUsage = (text.match(/;/g) || []).length;
  const colonUsage = (text.match(/:/g) || []).length;
  const dashUsage = (text.match(/—|--/g) || []).length;
  
  // Readability (simplified Flesch score approximation)
  const readabilityScore = calculateReadability(avgSentenceLength, avgWordLength);
  
  // Formality score
  const formalityScore = calculateFormality(text, usesContractions, vocabularyComplexity);
  
  // Transitions and conjunctions
  const transitionWords = (text.match(/\b(however|moreover|furthermore|additionally|meanwhile|therefore|consequently|nevertheless|nonetheless|thus|hence)\b/gi) || []).length;
  const transitionWordCount = transitionWords;
  const conjunctions = (text.match(/\b(and|but|or|so|yet|for|nor|because|although|while|since|if|unless|until|before|after|when|where|whereas)\b/gi) || []).length;
  const conjunctionDensity = conjunctions / sentenceCount || 0;
  
  // Personal voice
  const firstPerson = (text.match(/\b(i|me|my|mine|myself|we|us|our|ours|ourselves)\b/gi) || []).length;
  const secondPerson = (text.match(/\b(you|your|yours|yourself|yourselves)\b/gi) || []).length;
  const thirdPerson = (text.match(/\b(he|him|his|himself|she|her|hers|herself|they|them|their|theirs|themselves|it|its|itself)\b/gi) || []).length;
  
  const firstPersonUsage = firstPerson / wordCount || 0;
  const secondPersonUsage = secondPerson / wordCount || 0;
  const thirdPersonUsage = thirdPerson / wordCount || 0;
  
  return {
    wordCount,
    sentenceCount,
    avgSentenceLength,
    avgWordLength,
    vocabularyComplexity,
    uniqueWords,
    lexicalDiversity,
    questionRatio,
    exclamatoryRatio,
    compoundSentenceRatio,
    usesContractions,
    passiveVoiceRatio,
    adverbDensity,
    adjectiveDensity,
    commaUsage,
    semicolonUsage,
    colonUsage,
    dashUsage,
    readabilityScore,
    formalityScore,
    transitionWordCount,
    conjunctionDensity,
    firstPersonUsage,
    secondPersonUsage,
    thirdPersonUsage
  };
}

function countAdjectives(text: string): number {
  // Simple adjective detection using common patterns
  const adjectivePatterns = [
    /\b(good|bad|big|small|new|old|high|low|long|short|easy|hard|important|special|certain|large|great|little|early|young|different|right|social|local|sure|clear|white|black|red|blue|green|yellow|orange|purple|brown|pink|gray|grey)\b/gi,
    /\b\w+ful\b/gi,     // beautiful, helpful, useful
    /\b\w+less\b/gi,    // hopeless, careless
    /\b\w+able\b/gi,    // comfortable, reliable
    /\b\w+ible\b/gi,    // incredible, possible
    /\b\w+ous\b/gi,     // famous, dangerous
    /\b\w+ive\b/gi,     // active, creative
    /\b\w+ed\b/gi,      // interested, excited (past participles as adjectives)
    /\b\w+ing\b/gi      // interesting, exciting (present participles as adjectives)
  ];
  
  let count = 0;
  adjectivePatterns.forEach(pattern => {
    const matches = text.match(pattern) || [];
    count += matches.length;
  });
  
  return count * 0.3; // Rough approximation to avoid overcounting
}

function calculateReadability(avgSentenceLength: number, avgWordLength: number): number {
  // Simplified Flesch Reading Ease approximation
  const score = 206.835 - (1.015 * avgSentenceLength) - (84.6 * (avgWordLength / 4.7));
  return Math.max(0, Math.min(100, score));
}

function calculateFormality(text: string, usesContractions: boolean, vocabularyComplexity: number): number {
  let formalityScore = 0.5;
  
  // Contractions reduce formality
  if (usesContractions) {
    formalityScore -= 0.2;
  } else {
    formalityScore += 0.1;
  }
  
  // Complex vocabulary increases formality
  formalityScore += vocabularyComplexity * 0.3;
  
  // Academic/formal words increase formality
  const formalWords = (text.match(/\b(therefore|however|consequently|furthermore|moreover|nevertheless|nonetheless|thus|hence|accordingly|subsequently|additionally|specifically|particularly|essentially|fundamentally|significantly|substantially|considerably|respectively|alternatively|comparatively|definitively)\b/gi) || []).length;
  formalityScore += (formalWords / (text.split(/\s+/).length)) * 0.2;
  
  return Math.max(0, Math.min(1, formalityScore));
}

function createEmptyAnalysis(): TextAnalysis {
  return {
    wordCount: 0,
    sentenceCount: 0,
    avgSentenceLength: 0,
    avgWordLength: 0,
    vocabularyComplexity: 0,
    uniqueWords: 0,
    lexicalDiversity: 0,
    questionRatio: 0,
    exclamatoryRatio: 0,
    compoundSentenceRatio: 0,
    usesContractions: false,
    passiveVoiceRatio: 0,
    adverbDensity: 0,
    adjectiveDensity: 0,
    commaUsage: 0,
    semicolonUsage: 0,
    colonUsage: 0,
    dashUsage: 0,
    readabilityScore: 0,
    formalityScore: 0.5,
    transitionWordCount: 0,
    conjunctionDensity: 0,
    firstPersonUsage: 0,
    secondPersonUsage: 0,
    thirdPersonUsage: 0
  };
}

export function compareStyleTransformation(
  userSampleText: string,
  originalText: string,
  paraphrasedText: string
): StyleTransformation {
  const userStyle = analyzeSampleStyle(userSampleText);
  const originalAnalysis = analyzeText(originalText);
  const paraphrasedAnalysis = analyzeText(paraphrasedText);
  
  const detailedComparison = generateDetailedComparison(userStyle, originalAnalysis, paraphrasedAnalysis);
  const transformationInsights = generateTransformationInsights(userStyle, originalAnalysis, paraphrasedAnalysis);
  const alignmentScore = calculateAlignmentScore(userStyle, paraphrasedAnalysis);
  
  return {
    userStyle,
    originalAnalysis,
    paraphrasedAnalysis,
    transformationInsights,
    alignmentScore,
    detailedComparison
  };
}

function generateDetailedComparison(
  userStyle: SampleStyle,
  original: TextAnalysis,
  paraphrased: TextAnalysis
): ComparisonDetail[] {
  const comparisons: ComparisonDetail[] = [];
  
  // Sentence Structure Comparisons
  comparisons.push({
    category: 'Sentence Structure',
    metric: 'Average Sentence Length',
    userValue: `${Math.round(userStyle.avgSentenceLength)} words`,
    originalValue: `${Math.round(original.avgSentenceLength)} words`,
    paraphrasedValue: `${Math.round(paraphrased.avgSentenceLength)} words`,
    changeDescription: generateChangeDescription(
      original.avgSentenceLength,
      paraphrased.avgSentenceLength,
      userStyle.avgSentenceLength,
      'sentences became'
    ),
    alignment: getAlignment(paraphrased.avgSentenceLength, userStyle.avgSentenceLength, 5),
    impact: 'major'
  });
  
  // Vocabulary Complexity
  comparisons.push({
    category: 'Vocabulary',
    metric: 'Vocabulary Complexity',
    userValue: `${(userStyle.vocabularyComplexity * 100).toFixed(1)}%`,
    originalValue: `${(original.vocabularyComplexity * 100).toFixed(1)}%`,
    paraphrasedValue: `${(paraphrased.vocabularyComplexity * 100).toFixed(1)}%`,
    changeDescription: generateChangeDescription(
      original.vocabularyComplexity,
      paraphrased.vocabularyComplexity,
      userStyle.vocabularyComplexity,
      'vocabulary became'
    ),
    alignment: getAlignment(paraphrased.vocabularyComplexity, userStyle.vocabularyComplexity, 0.1),
    impact: 'major'
  });
  
  // Contractions Usage
  comparisons.push({
    category: 'Formality',
    metric: 'Uses Contractions',
    userValue: userStyle.usesContractions ? 'Yes' : 'No',
    originalValue: original.usesContractions ? 'Yes' : 'No',
    paraphrasedValue: paraphrased.usesContractions ? 'Yes' : 'No',
    changeDescription: original.usesContractions === paraphrased.usesContractions 
      ? 'Contraction usage remained the same'
      : paraphrased.usesContractions 
        ? 'Added contractions for casual tone'
        : 'Removed contractions for formal tone',
    alignment: userStyle.usesContractions === paraphrased.usesContractions ? 'excellent' : 'poor',
    impact: 'moderate'
  });
  
  // Question Usage
  if (userStyle.questionRatio > 0 || original.questionRatio > 0 || paraphrased.questionRatio > 0) {
    comparisons.push({
      category: 'Engagement',
      metric: 'Question Usage',
      userValue: `${(userStyle.questionRatio * 100).toFixed(1)}%`,
      originalValue: `${(original.questionRatio * 100).toFixed(1)}%`,
      paraphrasedValue: `${(paraphrased.questionRatio * 100).toFixed(1)}%`,
      changeDescription: generateChangeDescription(
        original.questionRatio,
        paraphrased.questionRatio,
        userStyle.questionRatio,
        'question usage'
      ),
      alignment: getAlignment(paraphrased.questionRatio, userStyle.questionRatio, 0.05),
      impact: 'moderate'
    });
  }
  
  // Passive Voice - Use a default value since SampleStyle doesn't have this property
  comparisons.push({
    category: 'Voice & Clarity',
    metric: 'Passive Voice Usage',
    userValue: 'N/A', // SampleStyle doesn't track passive voice
    originalValue: `${(original.passiveVoiceRatio * 100).toFixed(1)}%`,
    paraphrasedValue: `${(paraphrased.passiveVoiceRatio * 100).toFixed(1)}%`,
    changeDescription: generateChangeDescription(
      original.passiveVoiceRatio,
      paraphrased.passiveVoiceRatio,
      0.1, // Default target - moderate passive voice usage
      'passive voice'
    ),
    alignment: getAlignment(paraphrased.passiveVoiceRatio, 0.1, 0.05),
    impact: 'moderate'
  });
  
  // Readability
  comparisons.push({
    category: 'Readability',
    metric: 'Reading Ease Score',
    userValue: Math.round(calculateReadability(userStyle.avgSentenceLength, userStyle.avgWordLength)),
    originalValue: Math.round(original.readabilityScore),
    paraphrasedValue: Math.round(paraphrased.readabilityScore),
    changeDescription: original.readabilityScore < paraphrased.readabilityScore 
      ? 'Improved readability' 
      : original.readabilityScore > paraphrased.readabilityScore
      ? 'Reduced readability'
      : 'Maintained readability level',
    alignment: getAlignment(
      paraphrased.readabilityScore, 
      calculateReadability(userStyle.avgSentenceLength, userStyle.avgWordLength), 
      10
    ),
    impact: 'major'
  });
  
  // Transition Words
  if (userStyle.preferredTransitions.length > 0 || original.transitionWordCount > 0 || paraphrased.transitionWordCount > 0) {
    comparisons.push({
      category: 'Flow & Coherence',
      metric: 'Transition Words',
      userValue: userStyle.preferredTransitions.length > 0 ? userStyle.preferredTransitions.join(', ') : 'None',
      originalValue: original.transitionWordCount,
      paraphrasedValue: paraphrased.transitionWordCount,
      changeDescription: original.transitionWordCount < paraphrased.transitionWordCount 
        ? 'Added more transition words for better flow'
        : original.transitionWordCount > paraphrased.transitionWordCount
        ? 'Reduced transition words for directness'
        : 'Maintained transition word usage',
      alignment: 'good', // This needs more sophisticated logic
      impact: 'minor'
    });
  }
  
  return comparisons;
}

function generateTransformationInsights(
  userStyle: SampleStyle,
  original: TextAnalysis,
  paraphrased: TextAnalysis
): StyleTransformation['transformationInsights'] {
  const insights = {
    sentenceStructure: [] as string[],
    vocabularyChanges: [] as string[],
    formalityShifts: [] as string[],
    personalityAdjustments: [] as string[],
    technicalModifications: [] as string[],
    readabilityImprovements: [] as string[]
  };
  
  // Sentence Structure Insights
  const lengthDiff = paraphrased.avgSentenceLength - original.avgSentenceLength;
  if (Math.abs(lengthDiff) > 2) {
    if (lengthDiff > 0) {
      insights.sentenceStructure.push(`Extended sentences by average of ${lengthDiff.toFixed(1)} words to match user's preference for ${userStyle.avgSentenceLength.toFixed(1)}-word sentences`);
    } else {
      insights.sentenceStructure.push(`Shortened sentences by average of ${Math.abs(lengthDiff).toFixed(1)} words to match user's concise ${userStyle.avgSentenceLength.toFixed(1)}-word style`);
    }
  }
  
  // Vocabulary Changes
  const vocabDiff = paraphrased.vocabularyComplexity - original.vocabularyComplexity;
  if (Math.abs(vocabDiff) > 0.05) {
    if (vocabDiff > 0) {
      insights.vocabularyChanges.push(`Increased vocabulary complexity by ${(vocabDiff * 100).toFixed(1)}% to match user's sophisticated writing style (${(userStyle.vocabularyComplexity * 100).toFixed(1)}%)`);
    } else {
      insights.vocabularyChanges.push(`Simplified vocabulary by ${(Math.abs(vocabDiff) * 100).toFixed(1)}% to match user's accessible style (${(userStyle.vocabularyComplexity * 100).toFixed(1)}%)`);
    }
  }
  
  // Formality Shifts
  if (userStyle.usesContractions && !original.usesContractions && paraphrased.usesContractions) {
    insights.formalityShifts.push('Added contractions to create a more casual, conversational tone matching user style');
  } else if (!userStyle.usesContractions && original.usesContractions && !paraphrased.usesContractions) {
    insights.formalityShifts.push('Removed contractions to maintain formal tone consistent with user writing');
  }
  
  // Personal Voice Adjustments
  if (userStyle.personalVoice === 'first-person' && paraphrased.firstPersonUsage > original.firstPersonUsage) {
    insights.personalityAdjustments.push('Shifted to more first-person perspective to match user\'s personal writing style');
  } else if (userStyle.personalVoice === 'third-person' && paraphrased.thirdPersonUsage > original.thirdPersonUsage) {
    insights.personalityAdjustments.push('Adopted third-person perspective to match user\'s objective writing style');
  }
  
  // Technical Modifications
  if (paraphrased.passiveVoiceRatio < original.passiveVoiceRatio) {
    insights.technicalModifications.push(`Reduced passive voice by ${((original.passiveVoiceRatio - paraphrased.passiveVoiceRatio) * 100).toFixed(1)}% for more direct, active writing`);
  }
  
  // Readability Improvements
  const readabilityImprovement = paraphrased.readabilityScore - original.readabilityScore;
  if (readabilityImprovement > 5) {
    insights.readabilityImprovements.push(`Improved readability score by ${readabilityImprovement.toFixed(1)} points through better sentence structure and word choice`);
  } else if (readabilityImprovement < -5) {
    insights.readabilityImprovements.push(`Increased complexity by ${Math.abs(readabilityImprovement).toFixed(1)} points to match user's sophisticated writing style`);
  }
  
  return insights;
}

function generateChangeDescription(
  originalValue: number,
  paraphrasedValue: number,
  userTargetValue: number,
  descriptor: string
): string {
  const change = paraphrasedValue - originalValue;
  const targetDistance = Math.abs(paraphrasedValue - userTargetValue);
  
  if (Math.abs(change) < 0.01) {
    return `No significant change in ${descriptor}`;
  }
  
  const direction = change > 0 ? 'increased' : 'decreased';
  const magnitude = Math.abs(change);
  const alignment = targetDistance < Math.abs(originalValue - userTargetValue) ? ' (better alignment with user style)' : '';
  
  return `${descriptor} ${direction} by ${magnitude.toFixed(2)}${alignment}`;
}

function getAlignment(value: number, target: number, tolerance: number): 'excellent' | 'good' | 'fair' | 'poor' {
  const distance = Math.abs(value - target);
  if (distance <= tolerance) return 'excellent';
  if (distance <= tolerance * 2) return 'good';
  if (distance <= tolerance * 4) return 'fair';
  return 'poor';
}

function calculateAlignmentScore(userStyle: SampleStyle, paraphrased: TextAnalysis): number {
  let score = 0;
  let factors = 0;
  
  // Sentence length alignment (30% weight)
  const sentenceLengthDiff = Math.abs(paraphrased.avgSentenceLength - userStyle.avgSentenceLength);
  score += Math.max(0, 1 - (sentenceLengthDiff / 20)) * 0.3;
  factors += 0.3;
  
  // Vocabulary complexity alignment (25% weight)
  const vocabDiff = Math.abs(paraphrased.vocabularyComplexity - userStyle.vocabularyComplexity);
  score += Math.max(0, 1 - (vocabDiff / 0.5)) * 0.25;
  factors += 0.25;
  
  // Contractions alignment (20% weight)
  if (userStyle.usesContractions === paraphrased.usesContractions) {
    score += 0.2;
  }
  factors += 0.2;
  
  // Question usage alignment (15% weight)
  const questionDiff = Math.abs(paraphrased.questionRatio - userStyle.questionRatio);
  score += Math.max(0, 1 - (questionDiff / 0.3)) * 0.15;
  factors += 0.15;
  
  // Readability alignment (10% weight)
  const userReadability = calculateReadability(userStyle.avgSentenceLength, userStyle.avgWordLength);
  const readabilityDiff = Math.abs(paraphrased.readabilityScore - userReadability);
  score += Math.max(0, 1 - (readabilityDiff / 30)) * 0.1;
  factors += 0.1;
  
  return score / factors;
}
