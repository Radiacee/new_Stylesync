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
  type: 'warning' | 'suggestion' | 'improvement';
  category: string;
  title: string;
  description: string;
  examples?: string[];
  lessonLink?: string;
}

// Analyze essay and return issues with links to relevant lessons
function analyzeEssayForLessons(essay: string): EssayIssue[] {
  if (!essay || essay.trim().length < 50) return [];
  
  const issues: EssayIssue[] = [];
  const lowerEssay = essay.toLowerCase();
  const sentences = essay.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const words = essay.split(/\s+/).filter(w => w.length > 0);
  
  // Check for filler words
  const fillerWords = ['very', 'really', 'just', 'basically', 'actually', 'literally', 'simply', 'quite'];
  const foundFillers: string[] = [];
  fillerWords.forEach(w => {
    const regex = new RegExp(`\\b${w}\\b`, 'gi');
    const matches = essay.match(regex);
    if (matches && matches.length > 0) {
      foundFillers.push(`"${w}" (${matches.length}x)`);
    }
  });
  if (foundFillers.length > 0) {
    issues.push({
      id: 'filler-words',
      type: 'suggestion',
      category: 'Clarity',
      title: 'Filler Words Detected',
      description: 'Your essay contains filler words that can be removed to strengthen your writing.',
      examples: foundFillers.slice(0, 5),
      lessonLink: 'clarity'
    });
  }

  // Check for passive voice
  const passivePatterns = [
    /\b(was|were)\s+\w+ed\b/gi,
    /\b(is|are)\s+being\s+\w+ed\b/gi,
    /\b(has|have|had)\s+been\s+\w+ed\b/gi
  ];
  let passiveCount = 0;
  passivePatterns.forEach(pattern => {
    const matches = essay.match(pattern);
    if (matches) passiveCount += matches.length;
  });
  if (passiveCount > sentences.length * 0.3) {
    issues.push({
      id: 'passive-voice',
      type: 'improvement',
      category: 'Clarity',
      title: 'Heavy Passive Voice Usage',
      description: `Found approximately ${passiveCount} passive constructions. Consider using more active voice for directness.`,
      examples: ['Change "The report was written by me" to "I wrote the report"'],
      lessonLink: 'clarity'
    });
  }

  // Check sentence length variety
  const sentenceLengths = sentences.map(s => s.split(/\s+/).filter(w => w.length > 0).length);
  const avgLength = sentenceLengths.reduce((a, b) => a + b, 0) / Math.max(sentenceLengths.length, 1);
  const allSimilar = sentenceLengths.length > 3 && 
    sentenceLengths.every(len => Math.abs(len - avgLength) < 5);
  
  if (allSimilar) {
    issues.push({
      id: 'sentence-variety',
      type: 'improvement',
      category: 'Structure',
      title: 'Monotonous Sentence Length',
      description: `Your sentences average ${Math.round(avgLength)} words each with little variation. Mix short and long sentences for better rhythm.`,
      lessonLink: 'structure'
    });
  }

  // Check for very long sentences
  const longSentences = sentenceLengths.filter(len => len > 35);
  if (longSentences.length > 0) {
    issues.push({
      id: 'long-sentences',
      type: 'warning',
      category: 'Structure',
      title: 'Very Long Sentences',
      description: `${longSentences.length} sentence(s) exceed 35 words. Consider breaking them into smaller sentences for clarity.`,
      lessonLink: 'clarity'
    });
  }

  // Check for repetitive sentence starters
  const starters = sentences.map(s => s.trim().split(/\s+/)[0]?.toLowerCase()).filter(Boolean);
  const starterCounts: Record<string, number> = {};
  starters.forEach(s => { starterCounts[s] = (starterCounts[s] || 0) + 1; });
  const repetitiveStarters = Object.entries(starterCounts).filter(([_, count]) => count >= 3);
  if (repetitiveStarters.length > 0) {
    issues.push({
      id: 'repetitive-starters',
      type: 'suggestion',
      category: 'Structure',
      title: 'Repetitive Sentence Starters',
      description: 'Multiple sentences begin with the same word, creating a monotonous pattern.',
      examples: repetitiveStarters.map(([word, count]) => `"${word}" starts ${count} sentences`),
      lessonLink: 'structure'
    });
  }

  // Check for weak phrases
  const weakPhrases = [
    { phrase: 'in order to', replacement: 'to' },
    { phrase: 'due to the fact that', replacement: 'because' },
    { phrase: 'at this point in time', replacement: 'now' },
    { phrase: 'in the event that', replacement: 'if' },
    { phrase: 'it is important to note that', replacement: '(remove entirely)' }
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
      title: 'Wordy Phrases',
      description: 'Your essay contains phrases that can be simplified.',
      examples: foundWeak,
      lessonLink: 'clarity'
    });
  }

  // Check for word repetition
  const wordCounts: Record<string, number> = {};
  const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'is', 'it', 'that', 'this', 'with', 'as', 'be', 'are', 'was', 'were', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'i', 'you', 'he', 'she', 'we', 'they', 'my', 'your', 'his', 'her', 'our', 'their', 'its', 'not', 'so', 'if', 'when', 'what', 'which', 'who', 'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'only', 'own', 'same', 'than', 'too', 'very', 'just', 'also']);
  words.forEach(w => {
    const lower = w.toLowerCase().replace(/[^a-z]/g, '');
    if (lower.length > 3 && !commonWords.has(lower)) {
      wordCounts[lower] = (wordCounts[lower] || 0) + 1;
    }
  });
  const overusedWords = Object.entries(wordCounts).filter(([_, count]) => count >= 5);
  if (overusedWords.length > 0) {
    issues.push({
      id: 'word-repetition',
      type: 'improvement',
      category: 'Vocabulary',
      title: 'Word Repetition',
      description: 'Some words appear frequently. Consider using synonyms for variety.',
      examples: overusedWords.slice(0, 4).map(([word, count]) => `"${word}" appears ${count} times`),
      lessonLink: 'vocabulary'
    });
  }

  // Check for missing transitions
  const transitionWords = ['however', 'moreover', 'furthermore', 'therefore', 'consequently', 'additionally', 'nevertheless', 'meanwhile', 'similarly', 'in contrast', 'for example', 'specifically'];
  const hasTransitions = transitionWords.some(t => lowerEssay.includes(t));
  if (!hasTransitions && sentences.length > 5) {
    issues.push({
      id: 'missing-transitions',
      type: 'suggestion',
      category: 'Engagement',
      title: 'Consider Adding Transitions',
      description: 'Your essay could benefit from transition words to improve flow between ideas.',
      examples: ['However, Moreover, Furthermore, Therefore, For example'],
      lessonLink: 'engagement'
    });
  }

  // Sort by type priority
  const typeOrder = { warning: 0, improvement: 1, suggestion: 2 };
  issues.sort((a, b) => typeOrder[a.type] - typeOrder[b.type]);

  return issues;
}

// Calculate essay metrics
function calculateEssayMetrics(essay: string) {
  if (!essay || essay.trim().length < 10) {
    return { wordCount: 0, sentenceCount: 0, avgSentenceLength: 0, paragraphCount: 0, readability: 'N/A', uniqueWords: 0 };
  }
  
  const words = essay.split(/\s+/).filter(w => w.length > 0);
  const sentences = essay.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const paragraphs = essay.split(/\n\n+/).filter(p => p.trim().length > 0);
  
  const wordCount = words.length;
  const sentenceCount = sentences.length;
  const avgSentenceLength = sentenceCount > 0 ? Math.round(wordCount / sentenceCount) : 0;
  const paragraphCount = paragraphs.length;
  
  // Unique words
  const uniqueWords = new Set(words.map(w => w.toLowerCase().replace(/[^a-z]/g, '')).filter(w => w.length > 0)).size;
  
  // Simple readability assessment
  let readability = 'Moderate';
  if (avgSentenceLength < 15) readability = 'Easy';
  else if (avgSentenceLength > 25) readability = 'Complex';
  
  return { wordCount, sentenceCount, avgSentenceLength, paragraphCount, readability, uniqueWords };
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
      case 'warning': return <AlertTriangle className="w-4 h-4 text-amber-400" />;
      case 'improvement': return <TrendingUp className="w-4 h-4 text-blue-400" />;
      case 'suggestion': return <Lightbulb className="w-4 h-4 text-purple-400" />;
    }
  };

  const getIssueBg = (type: EssayIssue['type']) => {
    switch (type) {
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

      {/* My Essay Analysis Section */}
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
                <select
                  value={selectedProfileId || ''}
                  onChange={(e) => handleProfileChange(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  {profiles.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name || `Profile ${p.id.slice(0, 6)}`}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

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
          <button
            onClick={() => setShowMyEssay(!showMyEssay)}
            className="w-full flex items-center justify-between p-4 border-b border-white/10 hover:bg-white/5 transition"
          >
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-medium text-slate-300">
                {showMyEssay ? 'Hide' : 'Show'} Your Essay ({profile.name || 'Current Profile'})
              </span>
            </div>
            {showMyEssay ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>

          {/* Essay Content */}
          {showMyEssay && (
            <div className="p-4 bg-slate-900/30 border-b border-white/10 max-h-60 overflow-y-auto">
              <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
                {profileEssay}
              </p>
            </div>
          )}

          {/* Issues & Suggestions */}
          <div className="p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-400" />
                Areas to Optimize ({essayIssues.length})
              </h3>
            </div>

            {essayIssues.length === 0 ? (
              <div className="text-center py-6">
                <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
                <p className="text-sm text-slate-300">Great job! No major issues detected.</p>
                <p className="text-xs text-slate-500">Your writing follows good practices.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {essayIssues.map(issue => (
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
              <p className="text-sm text-slate-400 mt-1">Create a style profile to get personalized writing analysis.</p>
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
