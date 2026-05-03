"use client";
import { useState, useEffect, useMemo } from 'react';
import { BookOpen, Lightbulb, Target, Sparkles, PenTool, CheckCircle, AlertTriangle, ChevronDown, ChevronUp, ArrowRight, FileText, MessageSquare, Briefcase, GraduationCap, User, RefreshCw, Eye, Zap, TrendingUp, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { loadProfile, listProfiles, getActiveProfileId, type StyleProfile, loadProfileRemote, loadProfilesRemote } from '../../lib/styleProfile';
import { supabase } from '../../lib/supabaseClient';

interface Lesson {
  id: string;
  title: string;
  icon: React.ReactNode;
  description: string;
  sections: {
    title: string;
    content: string;
    tips?: string[];
    examples?: { bad: string; good: string; explanation: string }[];
  }[];
}

interface EssayIssue {
  id: string;
  type: 'warning' | 'suggestion' | 'improvement' | 'strength';
  category: string;
  title: string;
  description: string;
  examples?: string[];
  lessonLink?: string;
}

interface StyleSummary {
  tone: 'casual' | 'neutral' | 'formal';
  usesContractions: boolean;
  avgSentenceLength: number;
  vocabularyLevel: 'simple' | 'moderate' | 'advanced';
  perspective: 'first-person' | 'second-person' | 'third-person';
  strengths: string[];
}

// Analyze the user's writing style for summary display
function analyzeWritingStyle(essay: string): StyleSummary {
  if (!essay || essay.trim().length < 50) {
    return {
      tone: 'neutral',
      usesContractions: false,
      avgSentenceLength: 0,
      vocabularyLevel: 'moderate',
      perspective: 'third-person',
      strengths: []
    };
  }

  const sentences = essay.split(/[.!?]+/).filter(s => s.trim().length > 5);
  const words = essay.split(/\s+/).filter(w => w.length > 0);
  
  // Contractions
  const contractionPattern = /\b(don't|won't|can't|isn't|aren't|it's|that's|there's|I'm|you're|we're|they're|he's|she's|hasn't|haven't|couldn't|wouldn't|shouldn't|I've|I'll|I'd|we've|they've)\b/gi;
  const expandedPattern = /\b(do not|will not|cannot|is not|are not|it is|that is|there is|I am|you are|we are|they are|he is|she is|has not|have not|could not|would not|should not)\b/gi;
  const contractions = (essay.match(contractionPattern) || []).length;
  const expanded = (essay.match(expandedPattern) || []).length;
  const usesContractions = contractions > expanded;

  // Sentence length
  const avgSentenceLength = sentences.length > 0
    ? Math.round(sentences.reduce((sum, s) => sum + s.trim().split(/\s+/).length, 0) / sentences.length)
    : 0;

  // Tone detection
  const casualMarkers = /\b(gonna|wanna|gotta|kinda|sorta|yeah|yep|nope|cool|awesome|stuff|things|like|pretty|super|really|basically|actually)\b/gi;
  const formalMarkers = /\b(therefore|consequently|furthermore|nevertheless|subsequently|thus|hence|regarding|pertaining|aforementioned|moreover|additionally|significant|substantial)\b/gi;
  const casualCount = (essay.match(casualMarkers) || []).length;
  const formalCount = (essay.match(formalMarkers) || []).length;
  let tone: 'casual' | 'neutral' | 'formal' = 'neutral';
  if (casualCount > formalCount + 3 || usesContractions) tone = 'casual';
  if (formalCount > casualCount + 2 && !usesContractions) tone = 'formal';

  // Vocabulary level
  const complexWords = /\b\w{10,}\b/g;
  const complexCount = (essay.match(complexWords) || []).length;
  const complexRatio = complexCount / Math.max(words.length, 1);
  let vocabularyLevel: 'simple' | 'moderate' | 'advanced' = 'moderate';
  if (complexRatio > 0.08) vocabularyLevel = 'advanced';
  else if (complexRatio < 0.02) vocabularyLevel = 'simple';

  // Perspective
  const firstPerson = /\b(I|me|my|mine|we|us|our|ours)\b/gi;
  const secondPerson = /\b(you|your|yours)\b/gi;
  const firstCount = (essay.match(firstPerson) || []).length;
  const secondCount = (essay.match(secondPerson) || []).length;
  let perspective: 'first-person' | 'second-person' | 'third-person' = 'third-person';
  if (firstCount > words.length * 0.02) perspective = 'first-person';
  else if (secondCount > words.length * 0.02) perspective = 'second-person';

  // Identify strengths
  const strengths: string[] = [];
  
  // Good variety in sentence starters
  const starters = sentences.map(s => s.trim().split(/\s+/)[0]?.toLowerCase()).filter(Boolean);
  const uniqueStarters = new Set(starters).size;
  if (uniqueStarters / Math.max(starters.length, 1) > 0.6) {
    strengths.push('Varied sentence starters');
  }

  // Good use of transitions
  const transitionWords = ['however', 'moreover', 'furthermore', 'therefore', 'consequently', 'additionally', 'nevertheless', 'meanwhile', 'similarly', 'in contrast', 'for example'];
  const transitionCount = transitionWords.filter(t => essay.toLowerCase().includes(t)).length;
  if (transitionCount >= 3) {
    strengths.push('Good use of transitions');
  }

  // Vocabulary variety
  const uniqueWords = new Set(words.map(w => w.toLowerCase().replace(/[^a-z]/g, '')).filter(w => w.length > 3));
  const vocabRichness = uniqueWords.size / Math.max(words.length, 1);
  if (vocabRichness > 0.5) {
    strengths.push('Rich vocabulary');
  }

  // Balanced sentence lengths
  const sentenceLengths = sentences.map(s => s.trim().split(/\s+/).length);
  const hasShort = sentenceLengths.some(l => l < 10);
  const hasLong = sentenceLengths.some(l => l > 20);
  if (hasShort && hasLong) {
    strengths.push('Good sentence length variety');
  }

  // Active voice predominant
  const passiveCount = (essay.match(/\b(was|were|is|are|been)\s+\w+ed\b/gi) || []).length;
  if (passiveCount < sentences.length * 0.2) {
    strengths.push('Strong active voice usage');
  }

  return { tone, usesContractions, avgSentenceLength, vocabularyLevel, perspective, strengths };
}

// Analyze essay and return issues with links to relevant lessons
function analyzeEssayForLessons(essay: string): EssayIssue[] {
  if (!essay || essay.trim().length < 50) return [];
  
  const issues: EssayIssue[] = [];
  const lowerEssay = essay.toLowerCase();
  const sentences = essay.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const words = essay.split(/\s+/).filter(w => w.length > 0);
  
  // ========== DETECT STRENGTHS FIRST ==========
  
  // Check for good transition usage
  const transitionWords = ['however', 'moreover', 'furthermore', 'therefore', 'consequently', 'additionally', 'nevertheless', 'meanwhile', 'similarly', 'in contrast', 'for example', 'specifically', 'in addition', 'on the other hand'];
  const usedTransitions = transitionWords.filter(t => lowerEssay.includes(t));
  if (usedTransitions.length >= 3) {
    issues.push({
      id: 'good-transitions',
      type: 'strength',
      category: 'Flow',
      title: 'Excellent Use of Transitions',
      description: `You effectively use transition words to connect ideas and guide readers through your writing.`,
      examples: usedTransitions.slice(0, 4).map(t => `"${t.charAt(0).toUpperCase() + t.slice(1)}"`),
    });
  }

  // Check for vocabulary variety
  const contentWords = words
    .map(w => w.toLowerCase().replace(/[^a-z]/g, ''))
    .filter(w => w.length > 4);
  const uniqueContentWords = new Set(contentWords);
  const vocabRichness = uniqueContentWords.size / Math.max(contentWords.length, 1);
  if (vocabRichness > 0.55 && contentWords.length > 30) {
    issues.push({
      id: 'good-vocabulary',
      type: 'strength',
      category: 'Vocabulary',
      title: 'Strong Vocabulary Variety',
      description: `Your writing shows excellent word choice with ${Math.round(vocabRichness * 100)}% unique content words.`,
    });
  }

  // ========== DETECT ISSUES ==========
  
  // Check for filler words (more accurate - only flag if excessive)
  const fillerPatterns: { word: string; regex: RegExp }[] = [
    { word: 'very', regex: /\bvery\b/gi },
    { word: 'really', regex: /\breally\b/gi },
    { word: 'just', regex: /\bjust\b/gi },
    { word: 'basically', regex: /\bbasically\b/gi },
    { word: 'actually', regex: /\bactually\b/gi },
    { word: 'literally', regex: /\bliterally\b/gi },
    { word: 'simply', regex: /\bsimply\b/gi },
    { word: 'quite', regex: /\bquite\b/gi },
  ];
  const foundFillers: string[] = [];
  let totalFillers = 0;
  fillerPatterns.forEach(({ word, regex }) => {
    const matches = essay.match(regex);
    if (matches && matches.length > 0) {
      totalFillers += matches.length;
      if (matches.length >= 2) { // Only flag if used 2+ times
        foundFillers.push(`"${word}" (${matches.length}x)`);
      }
    }
  });
  // Only flag if filler ratio is high
  const fillerRatio = totalFillers / Math.max(sentences.length, 1);
  if (foundFillers.length > 0 && fillerRatio > 0.3) {
    issues.push({
      id: 'filler-words',
      type: 'suggestion',
      category: 'Clarity',
      title: 'Consider Reducing Filler Words',
      description: 'Some filler words appear frequently. Removing them can make your writing more impactful.',
      examples: foundFillers.slice(0, 4),
      lessonLink: 'clarity'
    });
  }

  // Check for passive voice (more accurate patterns)
  const passivePatterns = [
    /\b(was|were)\s+(\w+ed|written|done|made|taken|given|shown|seen|known|found)\b/gi,
    /\b(is|are)\s+being\s+\w+ed\b/gi,
    /\b(has|have|had)\s+been\s+(\w+ed|written|done|made|taken|given|shown|seen|known|found)\b/gi,
    /\b(will|would|could|should)\s+be\s+\w+ed\b/gi
  ];
  let passiveCount = 0;
  const passiveExamples: string[] = [];
  passivePatterns.forEach(pattern => {
    const matches = essay.match(pattern);
    if (matches) {
      passiveCount += matches.length;
      passiveExamples.push(...matches.slice(0, 2));
    }
  });
  // Only flag if passive ratio is high (>30% of sentences)
  if (passiveCount > sentences.length * 0.3 && passiveCount >= 3) {
    issues.push({
      id: 'passive-voice',
      type: 'improvement',
      category: 'Clarity',
      title: 'Consider More Active Voice',
      description: `Found ${passiveCount} passive constructions. Active voice is often more direct and engaging.`,
      examples: passiveExamples.length > 0 
        ? [`Examples found: "${passiveExamples[0]}"`, 'Tip: "The report was written" → "I wrote the report"']
        : ['Change "The report was written by me" to "I wrote the report"'],
      lessonLink: 'clarity'
    });
  }

  // Check sentence length variety
  const sentenceLengths = sentences.map(s => s.split(/\s+/).filter(w => w.length > 0).length);
  const avgLength = sentenceLengths.reduce((a, b) => a + b, 0) / Math.max(sentenceLengths.length, 1);
  const lengthVariance = sentenceLengths.reduce((sum, len) => sum + Math.pow(len - avgLength, 2), 0) / Math.max(sentenceLengths.length, 1);
  const lengthStdDev = Math.sqrt(lengthVariance);
  
  // Only flag if variance is very low (truly monotonous)
  if (sentenceLengths.length > 4 && lengthStdDev < 4) {
    issues.push({
      id: 'sentence-variety',
      type: 'improvement',
      category: 'Structure',
      title: 'Add Sentence Length Variety',
      description: `Your sentences average ${Math.round(avgLength)} words with little variation. Mix short punchy sentences with longer flowing ones.`,
      examples: ['Short: "This matters." (2 words)', 'Medium: "The team discussed options carefully." (5 words)', 'Long: "After reviewing all available data, we decided to proceed with the original plan." (13 words)'],
      lessonLink: 'structure'
    });
  }

  // Check for very long sentences (>40 words is clearer threshold)
  const longSentences = sentences.filter(s => s.split(/\s+/).filter(w => w.length > 0).length > 40);
  if (longSentences.length > 0) {
    issues.push({
      id: 'long-sentences',
      type: 'warning',
      category: 'Readability',
      title: 'Very Long Sentences Detected',
      description: `${longSentences.length} sentence(s) exceed 40 words. Consider breaking them up for easier reading.`,
      examples: [`Longest: ${longSentences[0]?.split(/\s+/).length || 0} words`],
      lessonLink: 'clarity'
    });
  }

  // Check for repetitive sentence starters (only if 4+ times)
  const starters = sentences.map(s => s.trim().split(/\s+/)[0]?.toLowerCase()).filter(Boolean);
  const starterCounts: Record<string, number> = {};
  starters.forEach(s => { starterCounts[s] = (starterCounts[s] || 0) + 1; });
  const repetitiveStarters = Object.entries(starterCounts)
    .filter(([word, count]) => count >= 4 && !['the', 'a', 'an', 'this', 'it'].includes(word));
  if (repetitiveStarters.length > 0) {
    issues.push({
      id: 'repetitive-starters',
      type: 'suggestion',
      category: 'Structure',
      title: 'Repetitive Sentence Starters',
      description: 'Some sentences begin with the same word repeatedly. Varying your openings adds interest.',
      examples: repetitiveStarters.map(([word, count]) => `"${word.charAt(0).toUpperCase() + word.slice(1)}..." appears ${count} times`),
      lessonLink: 'structure'
    });
  }

  // Check for weak phrases
  const weakPhrases = [
    { phrase: 'in order to', replacement: 'to' },
    { phrase: 'due to the fact that', replacement: 'because' },
    { phrase: 'at this point in time', replacement: 'now' },
    { phrase: 'in the event that', replacement: 'if' },
    { phrase: 'it is important to note that', replacement: '(remove entirely)' },
    { phrase: 'the fact that', replacement: 'that' },
    { phrase: 'in spite of the fact that', replacement: 'although' },
    { phrase: 'a large number of', replacement: 'many' },
    { phrase: 'in the near future', replacement: 'soon' },
  ];
  const foundWeak: string[] = [];
  weakPhrases.forEach(({ phrase, replacement }) => {
    if (lowerEssay.includes(phrase)) {
      foundWeak.push(`"${phrase}" → "${replacement}"`);
    }
  });
  if (foundWeak.length > 0) {
    issues.push({
      id: 'weak-phrases',
      type: 'suggestion',
      category: 'Clarity',
      title: 'Wordy Phrases Found',
      description: 'Some phrases can be simplified for clearer writing.',
      examples: foundWeak,
      lessonLink: 'clarity'
    });
  }

  // Check for missing transitions (only for longer essays)
  if (!usedTransitions.length && sentences.length > 6) {
    issues.push({
      id: 'missing-transitions',
      type: 'suggestion',
      category: 'Flow',
      title: 'Add Transition Words',
      description: 'Transition words help readers follow your ideas. Consider adding some to improve flow.',
      examples: ['However, Moreover, Furthermore, Therefore, For example, In addition'],
      lessonLink: 'engagement'
    });
  }

  // Sort: strengths first, then by type priority
  const typeOrder = { strength: 0, warning: 1, improvement: 2, suggestion: 3 };
  issues.sort((a, b) => typeOrder[a.type] - typeOrder[b.type]);

  return issues;
}

// Calculate essay metrics with vocabulary richness
function calculateEssayMetrics(essay: string) {
  if (!essay || essay.trim().length < 10) {
    return { wordCount: 0, sentenceCount: 0, avgSentenceLength: 0, paragraphCount: 0, readability: 'N/A', uniqueWords: 0, vocabRichness: 0 };
  }
  
  const words = essay.split(/\s+/).filter(w => w.length > 0);
  const sentences = essay.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const paragraphs = essay.split(/\n\n+/).filter(p => p.trim().length > 0);
  
  const wordCount = words.length;
  const sentenceCount = sentences.length;
  const avgSentenceLength = sentenceCount > 0 ? Math.round(wordCount / sentenceCount) : 0;
  const paragraphCount = paragraphs.length;
  
  // Unique words (content words only, 4+ chars)
  const contentWords = words.map(w => w.toLowerCase().replace(/[^a-z]/g, '')).filter(w => w.length > 3);
  const uniqueWords = new Set(contentWords).size;
  
  // Vocabulary richness (unique/total for content words)
  const vocabRichness = contentWords.length > 0 ? Math.round((uniqueWords / contentWords.length) * 100) : 0;
  
  // Readability assessment based on sentence length and word complexity
  const complexWords = words.filter(w => w.length >= 10).length;
  const complexRatio = complexWords / Math.max(words.length, 1);
  
  let readability = 'Moderate';
  if (avgSentenceLength < 12 && complexRatio < 0.05) readability = 'Easy';
  else if (avgSentenceLength > 22 || complexRatio > 0.1) readability = 'Complex';
  
  return { wordCount, sentenceCount, avgSentenceLength, paragraphCount, readability, uniqueWords, vocabRichness };
}

const LESSONS: Lesson[] = [
  {
    id: 'clarity',
    title: 'Clarity & Conciseness',
    icon: <Lightbulb className="w-5 h-5" />,
    description: 'Learn to express ideas clearly and remove unnecessary words for maximum impact.',
    sections: [
      {
        title: 'Eliminate Filler Words',
        content: 'Filler words dilute your message. Remove words that add no meaning to strengthen your writing.',
        tips: [
          'Remove "very", "really", "just", "basically", "actually", "literally"',
          'Replace "in order to" with "to"',
          'Cut "due to the fact that" – use "because"',
          'Remove "at this point in time" – use "now"'
        ],
        examples: [
          {
            bad: 'I basically just wanted to very quickly explain the really important concept.',
            good: 'I wanted to explain this important concept.',
            explanation: 'Removed 5 filler words without losing any meaning.'
          }
        ]
      },
      {
        title: 'Use Active Voice',
        content: 'Active voice makes your writing more direct and engaging. The subject performs the action.',
        tips: [
          'Identify the actor – who/what is doing the action?',
          'Put the actor as the subject of the sentence',
          'Passive is acceptable for emphasis or when actor is unknown'
        ],
        examples: [
          {
            bad: 'The report was written by the team.',
            good: 'The team wrote the report.',
            explanation: 'Active voice is more direct and uses fewer words.'
          }
        ]
      },
      {
        title: 'One Idea Per Sentence',
        content: 'Complex sentences with multiple ideas confuse readers. Break them up for clarity.',
        tips: [
          'If a sentence has more than one main idea, split it',
          'Use periods instead of semicolons when possible',
          'Keep average sentence length under 20 words'
        ]
      }
    ]
  },
  {
    id: 'structure',
    title: 'Sentence Structure',
    icon: <Target className="w-5 h-5" />,
    description: 'Master sentence variety and structure for better flow and readability.',
    sections: [
      {
        title: 'Vary Sentence Length',
        content: 'Mixing short and long sentences creates rhythm and keeps readers engaged.',
        tips: [
          'Use short sentences (5-10 words) for emphasis',
          'Use medium sentences (10-20 words) for explanations',
          'Follow a long sentence with a short one for punch'
        ],
        examples: [
          {
            bad: 'The meeting was productive. The team discussed the project. They made decisions.',
            good: 'The meeting was productive. The team discussed the project thoroughly, examining each aspect. They reached consensus.',
            explanation: 'Varying length creates rhythm and maintains interest.'
          }
        ]
      },
      {
        title: 'Vary Sentence Starters',
        content: 'Starting every sentence the same way creates monotonous writing.',
        tips: [
          'Start with transitions: However, Moreover, Therefore',
          'Start with dependent clauses: "After reviewing the data, we..."',
          'Start with adverbs: "Surprisingly, the results showed..."'
        ]
      },
      {
        title: 'Use Parallel Structure',
        content: 'Items in a series should follow the same grammatical pattern.',
        tips: [
          'Match verb forms in lists',
          'Match phrase structures',
          'Use consistent articles'
        ],
        examples: [
          {
            bad: 'The manager likes to plan projects, organizing teams, and implementation.',
            good: 'The manager likes planning projects, organizing teams, and implementing solutions.',
            explanation: 'All items now use the same -ing verb form.'
          }
        ]
      }
    ]
  },
  {
    id: 'vocabulary',
    title: 'Vocabulary & Word Choice',
    icon: <BookOpen className="w-5 h-5" />,
    description: 'Choose precise, powerful words that convey exactly what you mean.',
    sections: [
      {
        title: 'Be Specific',
        content: 'Vague words weaken your writing. Use precise language.',
        tips: [
          'Replace "things" with specific nouns',
          'Replace "good/bad" with descriptive adjectives',
          'Use concrete details instead of abstractions'
        ],
        examples: [
          {
            bad: 'The thing was very good.',
            good: 'The proposal exceeded expectations.',
            explanation: '"Proposal" is specific; "exceeded expectations" is more meaningful.'
          }
        ]
      },
      {
        title: 'Avoid Repetition',
        content: 'Repeating the same word makes writing feel lazy. Use synonyms and pronouns.',
        tips: [
          'Use pronouns after first mention',
          'Use synonyms for variety',
          'Restructure sentences to avoid the word'
        ]
      },
      {
        title: 'Match Your Audience',
        content: 'Adjust vocabulary complexity based on who will read your work.',
        tips: [
          'Academic: Use field-specific terminology',
          'Business: Be professional but accessible',
          'General: Avoid jargon; explain technical terms'
        ]
      }
    ]
  },
  {
    id: 'engagement',
    title: 'Reader Engagement',
    icon: <Sparkles className="w-5 h-5" />,
    description: 'Techniques to capture and maintain your reader\'s attention.',
    sections: [
      {
        title: 'Strong Openings',
        content: 'Your first sentence should hook the reader immediately.',
        tips: [
          'Start with a surprising fact or statistic',
          'Ask a thought-provoking question',
          'Begin with a bold statement'
        ],
        examples: [
          {
            bad: 'This essay will discuss climate change.',
            good: 'By 2050, 200 million people could become climate refugees.',
            explanation: 'A specific, startling fact immediately engages readers.'
          }
        ]
      },
      {
        title: 'Use Concrete Examples',
        content: 'Abstract ideas become memorable when illustrated with specific examples.',
        tips: [
          'Follow abstract statements with concrete examples',
          'Use real-world scenarios readers can relate to',
          'Include numbers and data when possible'
        ]
      },
      {
        title: 'Create Smooth Transitions',
        content: 'Transitions guide readers through your ideas logically.',
        tips: [
          'Addition: Furthermore, Moreover, Additionally',
          'Contrast: However, Nevertheless, On the other hand',
          'Cause/Effect: Therefore, Consequently, As a result'
        ]
      }
    ]
  },
  {
    id: 'grammar',
    title: 'Common Grammar Issues',
    icon: <PenTool className="w-5 h-5" />,
    description: 'Fix the most frequent grammar mistakes that undermine credibility.',
    sections: [
      {
        title: 'Subject-Verb Agreement',
        content: 'Subjects and verbs must match in number (singular/plural).',
        tips: [
          'Collective nouns (team, group) are usually singular',
          'Either/or, neither/nor: verb matches nearest subject',
          'Watch for phrases between subject and verb'
        ],
        examples: [
          {
            bad: 'The team are working on the project.',
            good: 'The team is working on the project.',
            explanation: '"Team" is a collective noun treated as singular.'
          }
        ]
      },
      {
        title: 'Pronoun Reference',
        content: 'Pronouns must clearly refer to a specific noun.',
        tips: [
          'Avoid vague "this" or "it"',
          'When in doubt, repeat the noun',
          'Keep pronouns close to their antecedents'
        ]
      },
      {
        title: 'Comma Usage',
        content: 'Commas clarify meaning and prevent misreading.',
        tips: [
          'Use commas after introductory phrases',
          'Use commas before conjunctions joining independent clauses',
          'Use Oxford comma in lists (recommended)'
        ],
        examples: [
          {
            bad: 'After eating the dog took a nap.',
            good: 'After eating, the dog took a nap.',
            explanation: 'Without the comma, it sounds like someone ate the dog!'
          }
        ]
      }
    ]
  }
];

const WRITING_CONTEXTS = [
  {
    id: 'academic',
    title: 'Academic Writing',
    icon: <GraduationCap className="w-5 h-5" />,
    description: 'Research papers, essays, and scholarly articles',
    tips: [
      'Use formal language and avoid contractions',
      'Support claims with evidence and citations',
      'Use hedging language appropriately',
      'Follow your citation style guide precisely'
    ]
  },
  {
    id: 'business',
    title: 'Business Writing',
    icon: <Briefcase className="w-5 h-5" />,
    description: 'Reports, proposals, and professional communications',
    tips: [
      'Lead with the main point',
      'Use bullet points for easy scanning',
      'Be action-oriented',
      'Keep paragraphs short'
    ]
  },
  {
    id: 'creative',
    title: 'Creative Writing',
    icon: <Sparkles className="w-5 h-5" />,
    description: 'Stories, personal essays, and narrative pieces',
    tips: [
      'Show, don\'t tell',
      'Vary sentence rhythm for effect',
      'Use dialogue to reveal character',
      'Choose specific, evocative words'
    ]
  },
  {
    id: 'email',
    title: 'Email & Messages',
    icon: <MessageSquare className="w-5 h-5" />,
    description: 'Professional emails and digital communication',
    tips: [
      'Write a clear, specific subject line',
      'State your purpose in the first sentence',
      'Keep emails brief',
      'End with a clear call to action'
    ]
  }
];

export default function WritingGuidePage() {
  const [profile, setProfile] = useState<StyleProfile | null>(null);
  const [profiles, setProfiles] = useState<StyleProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [activeLesson, setActiveLesson] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [activeContext, setActiveContext] = useState<string | null>(null);
  const [showMyEssay, setShowMyEssay] = useState(true);
  const [activeView, setActiveView] = useState<'analysis' | 'lessons'>('analysis');
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

  // Load user and profiles
  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        // Check auth
        let user = null;
        if (supabase) {
          const { data } = await supabase.auth.getUser();
          user = data?.user;
        }
        setUserId(user?.id || null);

        // Load profiles
        let loadedProfiles: StyleProfile[] = [];
        if (user?.id) {
          loadedProfiles = await loadProfilesRemote(user.id) || [];
        }
        if (loadedProfiles.length === 0) {
          loadedProfiles = listProfiles();
        }
        setProfiles(loadedProfiles);

        // Get active profile
        const activeId = getActiveProfileId();
        const activeProfile = loadedProfiles.find(p => p.id === activeId) || loadedProfiles[0] || null;
        setProfile(activeProfile);
        setSelectedProfileId(activeProfile?.id || null);
      } catch (err) {
        console.error('Failed to load profiles:', err);
        // Fallback to local
        const localProfiles = listProfiles();
        setProfiles(localProfiles);
        const localProfile = loadProfile();
        setProfile(localProfile);
        setSelectedProfileId(localProfile?.id || null);
      }
      setLoading(false);
    }
    init();
  }, []);

  // Get combined essay from profile
  const profileEssay = useMemo(() => {
    if (!profile) return '';
    if (profile.sampleExcerpts?.length) {
      return profile.sampleExcerpts.join('\n\n');
    }
    return profile.sampleExcerpt || '';
  }, [profile]);

  // Analyze essay
  const essayIssues = useMemo(() => analyzeEssayForLessons(profileEssay), [profileEssay]);
  const essayMetrics = useMemo(() => calculateEssayMetrics(profileEssay), [profileEssay]);
  const styleSummary = useMemo(() => analyzeWritingStyle(profileEssay), [profileEssay]);
  const hasRealEssay = Boolean(profile && profileEssay && !profile.notes?.includes('Generated from questionnaire answers'));

  // Separate strengths from issues
  const strengths = essayIssues.filter(i => i.type === 'strength');
  const issuesOnly = essayIssues.filter(i => i.type !== 'strength');

  const toggleSection = (lessonId: string, sectionIndex: number) => {
    const key = `${lessonId}-${sectionIndex}`;
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) newSet.delete(key);
      else newSet.add(key);
      return newSet;
    });
  };

  const handleProfileChange = (profileId: string) => {
    const selected = profiles.find(p => p.id === profileId);
    if (selected) {
      setProfile(selected);
      setSelectedProfileId(profileId);
    }
  };

  const scrollToLesson = (lessonId: string) => {
    setActiveLesson(lessonId);
    setTimeout(() => {
      document.getElementById(`lesson-${lessonId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const getIssueIcon = (type: EssayIssue['type']) => {
    switch (type) {
      case 'strength': return <CheckCircle className="w-4 h-4 text-emerald-400" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-amber-400" />;
      case 'improvement': return <TrendingUp className="w-4 h-4 text-blue-400" />;
      case 'suggestion': return <Lightbulb className="w-4 h-4 text-purple-400" />;
    }
  };

  const getIssueBg = (type: EssayIssue['type']) => {
    switch (type) {
      case 'strength': return 'bg-emerald-500/10 border-emerald-500/30';
      case 'warning': return 'bg-amber-500/10 border-amber-500/30';
      case 'improvement': return 'bg-blue-500/10 border-blue-500/30';
      case 'suggestion': return 'bg-purple-500/10 border-purple-500/30';
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Hero Section */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-500/10 border border-brand-500/30 text-brand-400 text-sm">
          <BookOpen className="w-4 h-4" />
          <span>Writing Guide</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold">
          Master the Art of{' '}
          <span className="bg-gradient-to-r from-brand-300 to-brand-500 bg-clip-text text-transparent">
            Clear Writing
          </span>
        </h1>
        <p className="text-slate-400 max-w-2xl mx-auto">
          Learn proven techniques and get personalized feedback on your writing style.
        </p>
      </div>

      {/* Analysis / Lessons Tabs */}
      <div className="glass-panel p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveView('analysis')}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition ${
              activeView === 'analysis'
                ? 'bg-brand-500 text-slate-900'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            📄 Essay Analysis
          </button>
          <button
            onClick={() => setActiveView('lessons')}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition ${
              activeView === 'lessons'
                ? 'bg-brand-500 text-slate-900'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            📖 Writing Lessons
          </button>
        </div>
        <p className="text-xs text-slate-400">Switch between your essay feedback and core writing lessons.</p>
      </div>

      {activeView === 'analysis' && (
        <>
          {/* Essay Analysis Section */}
          {loading ? (
            <div className="glass-panel p-6 text-center">
              <RefreshCw className="w-6 h-6 animate-spin text-brand-400 mx-auto mb-2" />
              <p className="text-slate-400">Loading your profile...</p>
            </div>
          ) : profile && profileEssay ? (
            <div className="glass-panel p-0 overflow-hidden border-2 border-brand-500/30">
              {/* Header */}
              <div className="bg-brand-500/10 p-4 sm:p-5 border-b border-brand-500/20">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-brand-500/20">
                      <User className="w-5 h-5 text-brand-400" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-white">Your Writing Analysis</h2>
                      <p className="text-sm text-slate-400">Personalized feedback based on your profile essay</p>
                    </div>
                  </div>
                  
                  {/* Profile Selector */}
                  {profiles.length > 1 && (
                    <div className="relative">
                      <select
                        value={selectedProfileId || ''}
                        onChange={(e) => handleProfileChange(e.target.value)}
                        className="appearance-none pl-4 pr-10 py-2.5 rounded-xl bg-slate-800/80 border border-white/20 text-sm text-white cursor-pointer hover:border-brand-500/50 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500/50 transition-all"
                      >
                        {profiles.map(p => (
                          <option key={p.id} value={p.id} className="bg-slate-800 text-white">
                            {p.name || `Profile ${p.id.slice(0, 6)}`}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                  )}
                </div>
              </div>

              {profile && profile.notes?.includes('Generated from questionnaire answers') && (
                <div className="mx-auto max-w-3xl p-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 text-amber-100">
                  <p className="text-sm font-semibold">Tip for better feedback</p>
                  <p className="text-xs text-amber-200 mt-1">
                    This profile was generated only from your questionnaire answers. Add a real essay sample in onboarding to see deeper, more accurate guidance.
                  </p>
                </div>
              )}

              {/* Metrics Bar */}
              <div className="grid grid-cols-3 sm:grid-cols-6 divide-x divide-white/10 bg-slate-900/50">
                <div className="p-3 text-center">
                  <p className="text-lg font-bold text-white">{essayMetrics.wordCount}</p>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide">Words</p>
                </div>
                <div className="p-3 text-center">
                  <p className="text-lg font-bold text-white">{essayMetrics.sentenceCount}</p>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide">Sentences</p>
                </div>
                <div className="p-3 text-center">
                  <p className="text-lg font-bold text-white">{essayMetrics.avgSentenceLength}</p>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide">Avg Length</p>
                </div>
                <div className="p-3 text-center hidden sm:block">
                  <p className="text-lg font-bold text-white">{essayMetrics.paragraphCount}</p>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide">Paragraphs</p>
                </div>
                <div className="p-3 text-center hidden sm:block">
                  <p className="text-lg font-bold text-white">{essayMetrics.uniqueWords}</p>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide">Unique</p>
                </div>
                <div className="p-3 text-center hidden sm:block">
                  <p className={`text-lg font-bold ${
                    essayMetrics.readability === 'Easy' ? 'text-emerald-400' :
                    essayMetrics.readability === 'Complex' ? 'text-amber-400' : 'text-blue-400'
                  }`}>{essayMetrics.readability}</p>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide">Readability</p>
                </div>
              </div>

              {/* Toggle Essay View */}
              {hasRealEssay && (
                <button
                  onClick={() => setShowMyEssay(!showMyEssay)}
                  className="w-full flex items-center justify-between p-4 border-b border-white/10 hover:bg-slate-800/50 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg transition-colors ${
                      showMyEssay 
                        ? 'bg-brand-500/20 text-brand-400' 
                        : 'bg-slate-700/50 text-slate-400 group-hover:bg-slate-700'
                    }`}>
                      <Eye className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                      <span className="text-sm font-medium text-white block">
                        {showMyEssay ? 'Hide' : 'Show'} Your Essay
                      </span>
                      <span className="text-xs text-slate-500">
                        {profile.name || 'Current Profile'}
                      </span>
                    </div>
                  </div>
                  <div className={`p-1.5 rounded-lg transition-all ${
                    showMyEssay 
                      ? 'bg-brand-500/20 rotate-180' 
                      : 'bg-slate-700/50 group-hover:bg-slate-700'
                  }`}>
                    <ChevronDown className={`w-4 h-4 transition-colors ${
                      showMyEssay ? 'text-brand-400' : 'text-slate-400'
                    }`} />
                  </div>
                </button>
              )}

              {/* Essay Content */}
              {hasRealEssay && showMyEssay && (
                <div className="p-4 bg-slate-900/30 border-b border-white/10 max-h-60 overflow-y-auto">
                  <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
                    {profileEssay}
                  </p>
                </div>
              )}

              {/* Your Writing Style Summary */}
              <div className="p-4 sm:p-5 border-b border-white/10 bg-slate-900/30">
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <PenTool className="w-4 h-4 text-brand-400" />
                  Your Writing Style
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                    <p className={`text-sm font-semibold ${
                      styleSummary.tone === 'casual' ? 'text-emerald-400' :
                      styleSummary.tone === 'formal' ? 'text-blue-400' : 'text-slate-300'
                    }`}>
                      {styleSummary.tone.charAt(0).toUpperCase() + styleSummary.tone.slice(1)}
                    </p>
                    <p className="text-[10px] text-slate-500 uppercase">Tone</p>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                    <p className={`text-sm font-semibold ${styleSummary.usesContractions ? 'text-emerald-400' : 'text-blue-400'}`}>
                      {styleSummary.usesContractions ? "Uses" : "Avoids"}
                    </p>
                    <p className="text-[10px] text-slate-500 uppercase">Contractions</p>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                    <p className={`text-sm font-semibold ${
                      styleSummary.vocabularyLevel === 'advanced' ? 'text-purple-400' :
                      styleSummary.vocabularyLevel === 'simple' ? 'text-emerald-400' : 'text-slate-300'
                    }`}>
                      {styleSummary.vocabularyLevel.charAt(0).toUpperCase() + styleSummary.vocabularyLevel.slice(1)}
                    </p>
                    <p className="text-[10px] text-slate-500 uppercase">Vocabulary</p>
                  </div>
                </div>
                
                {/* Detected Strengths */}
                {styleSummary.strengths.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {styleSummary.strengths.map((strength, i) => (
                      <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs">
                        <CheckCircle className="w-3 h-3" />
                        {strength}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Strengths Section */}
              {strengths.length > 0 && (
                <div className="p-4 sm:p-5 border-b border-white/10">
                  <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    What You're Doing Well ({strengths.length})
                  </h3>
                  <div className="space-y-2">
                    {strengths.map(issue => (
                      <div key={issue.id} className={`rounded-lg border p-3 ${getIssueBg(issue.type)}`}>
                        <div className="flex items-start gap-3">
                          {getIssueIcon(issue.type)}
                          <div className="flex-1">
                            <h4 className="text-sm font-medium text-white">{issue.title}</h4>
                            <p className="text-xs text-slate-400 mt-0.5">{issue.description}</p>
                            {issue.examples && issue.examples.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {issue.examples.map((ex, i) => (
                                  <span key={i} className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                                    {ex}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Issues & Suggestions */}
              <div className="p-4 sm:p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Zap className="w-4 h-4 text-yellow-400" />
                    Areas to Improve ({issuesOnly.length})
                  </h3>
                </div>

                {issuesOnly.length === 0 ? (
                  <div className="text-center py-6">
                    <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
                    <p className="text-sm text-slate-300">Excellent! No issues detected in your writing.</p>
                    <p className="text-xs text-slate-500">Your essay follows strong writing practices.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {issuesOnly.map(issue => (
                      <div key={issue.id} className={`rounded-lg border p-4 ${getIssueBg(issue.type)}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            {getIssueIcon(issue.type)}
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="text-sm font-medium text-white">{issue.title}</h4>
                                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-700 text-slate-300">{issue.category}</span>
                              </div>
                              <p className="text-xs text-slate-400 mt-1">{issue.description}</p>
                              {issue.examples && issue.examples.length > 0 && (
                                <ul className="mt-2 space-y-1">
                                  {issue.examples.map((ex, i) => (
                                    <li key={i} className="text-xs text-slate-300 flex items-start gap-2">
                                      <span className="text-slate-500">•</span>
                                      <span>{ex}</span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </div>
                          {issue.lessonLink && (
                            <button
                              onClick={() => scrollToLesson(issue.lessonLink!)}
                              className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-brand-500/20 hover:bg-brand-500/30 text-brand-400 text-xs font-medium transition"
                            >
                              Learn More
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="glass-panel p-6 border-2 border-dashed border-white/20">
              <div className="text-center space-y-4">
                <AlertCircle className="w-10 h-10 text-slate-500 mx-auto" />
                <div>
                  <h3 className="text-lg font-semibold text-white">No Profile Found</h3>
                  <p className="text-sm text-slate-400 mt-1">Create a style profile with a real essay sample to get the most helpful, personalized writing guidance.</p>
                </div>
                <Link
                  href="/style/onboarding"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand-500 hover:bg-brand-400 text-slate-900 font-semibold transition text-sm"
                >
                  Create Profile
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          )}
        </>
      )}

      {activeView === 'lessons' && (
        <>
          {/* Writing Contexts */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white">Writing for Different Contexts</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {WRITING_CONTEXTS.map(context => (
                <button
                  key={context.id}
                  onClick={() => setActiveContext(activeContext === context.id ? null : context.id)}
                  className={`text-left p-4 rounded-xl border transition-all ${
                    activeContext === context.id
                      ? 'bg-brand-500/10 border-brand-500/50'
                      : 'bg-slate-800/50 border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${
                      activeContext === context.id ? 'bg-brand-500/20 text-brand-400' : 'bg-slate-700 text-slate-400'
                    }`}>
                      {context.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-white">{context.title}</h3>
                        {activeContext === context.id 
                          ? <ChevronUp className="w-4 h-4 text-slate-400" />
                          : <ChevronDown className="w-4 h-4 text-slate-400" />
                        }
                      </div>
                      <p className="text-xs text-slate-400 mt-1">{context.description}</p>
                    </div>
                  </div>
                  
                  {activeContext === context.id && (
                    <div className="mt-4 pt-4 border-t border-white/10">
                      <ul className="space-y-2">
                        {context.tips.map((tip, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-slate-400">
                            <CheckCircle className="w-3 h-3 text-emerald-400 mt-0.5 flex-shrink-0" />
                            <span>{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Main Lessons */}
          <div className="space-y-4">
        <h2 className="text-xl font-bold text-white">Core Writing Lessons</h2>
        <div className="space-y-4">
          {LESSONS.map(lesson => (
            <div 
              key={lesson.id}
              id={`lesson-${lesson.id}`}
              className={`rounded-xl border overflow-hidden transition-all scroll-mt-24 ${
                activeLesson === lesson.id
                  ? 'bg-slate-800/80 border-brand-500/50'
                  : 'bg-slate-800/40 border-white/10'
              }`}
            >
              {/* Lesson Header */}
              <button
                onClick={() => setActiveLesson(activeLesson === lesson.id ? null : lesson.id)}
                className="w-full flex items-center justify-between p-4 sm:p-5 text-left hover:bg-white/5 transition"
              >
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${
                    activeLesson === lesson.id 
                      ? 'bg-brand-500/20 text-brand-400' 
                      : 'bg-slate-700 text-slate-400'
                  }`}>
                    {lesson.icon}
                  </div>
                  <div>
                    <h3 className="font-semibold text-white text-lg">{lesson.title}</h3>
                    <p className="text-sm text-slate-400 mt-0.5">{lesson.description}</p>
                  </div>
                </div>
                {activeLesson === lesson.id 
                  ? <ChevronUp className="w-5 h-5 text-slate-400 flex-shrink-0" />
                  : <ChevronDown className="w-5 h-5 text-slate-400 flex-shrink-0" />
                }
              </button>

              {/* Lesson Content */}
              {activeLesson === lesson.id && (
                <div className="px-4 sm:px-5 pb-5 space-y-4">
                  {lesson.sections.map((section, sectionIndex) => {
                    const sectionKey = `${lesson.id}-${sectionIndex}`;
                    const isExpanded = expandedSections.has(sectionKey);
                    
                    return (
                      <div 
                        key={sectionIndex}
                        className="rounded-lg border border-white/10 overflow-hidden"
                      >
                        <button
                          onClick={() => toggleSection(lesson.id, sectionIndex)}
                          className="w-full flex items-center justify-between p-4 text-left bg-slate-900/50 hover:bg-slate-900/70 transition"
                        >
                          <span className="font-medium text-white">{section.title}</span>
                          {isExpanded 
                            ? <ChevronUp className="w-4 h-4 text-slate-400" />
                            : <ChevronDown className="w-4 h-4 text-slate-400" />
                          }
                        </button>
                        
                        {isExpanded && (
                          <div className="p-4 space-y-4 bg-slate-900/30">
                            <p className="text-sm text-slate-300">{section.content}</p>
                            
                            {section.tips && (
                              <ul className="space-y-2">
                                {section.tips.map((tip, i) => (
                                  <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                                    <Lightbulb className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                                    <span>{tip}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                            
                            {section.examples && section.examples.length > 0 && (
                              <div className="space-y-3">
                                {section.examples.map((example, i) => (
                                  <div key={i} className="rounded-lg border border-white/10 overflow-hidden">
                                    <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-white/10">
                                      <div className="p-3 bg-red-500/5">
                                        <div className="flex items-center gap-2 mb-2">
                                          <AlertTriangle className="w-4 h-4 text-red-400" />
                                          <span className="text-xs font-semibold text-red-400">Before</span>
                                        </div>
                                        <p className="text-sm text-slate-300">{example.bad}</p>
                                      </div>
                                      <div className="p-3 bg-emerald-500/5">
                                        <div className="flex items-center gap-2 mb-2">
                                          <CheckCircle className="w-4 h-4 text-emerald-400" />
                                          <span className="text-xs font-semibold text-emerald-400">After</span>
                                        </div>
                                        <p className="text-sm text-slate-300">{example.good}</p>
                                      </div>
                                    </div>
                                    <div className="p-3 bg-slate-900/50 border-t border-white/10">
                                      <p className="text-xs text-slate-400">
                                        <span className="font-semibold text-slate-300">Why:</span> {example.explanation}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      </>
      )}

      {/* Bottom CTA */}
      <div className="glass-panel p-6 text-center space-y-4">
        <FileText className="w-10 h-10 text-brand-400 mx-auto" />
        <h2 className="text-xl font-bold text-white">Ready to Apply What You&apos;ve Learned?</h2>
        <p className="text-slate-400 max-w-lg mx-auto">
          Use StyleSync to paraphrase text while maintaining your unique writing style.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link 
            href="/paraphrase"
            className="px-6 py-3 rounded-lg bg-brand-500 hover:bg-brand-400 text-slate-900 font-semibold transition"
          >
            Go to Paraphrase
          </Link>
          <Link 
            href="/style/onboarding"
            className="px-6 py-3 rounded-lg border border-white/20 hover:border-brand-400/60 text-slate-200 font-medium transition"
          >
            Update Profile
          </Link>
        </div>
      </div>
    </div>
  );
}
