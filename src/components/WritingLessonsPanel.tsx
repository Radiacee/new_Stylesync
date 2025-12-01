"use client";
import { useState, useMemo } from 'react';

interface WritingLessonsPanelProps {
  userEssay: string;
  onClose?: () => void;
}

interface Lesson {
  id: string;
  title: string;
  icon: string;
  description: string;
  tips: string[];
  example?: {
    bad: string;
    good: string;
    explanation: string;
  };
}

const LESSONS: Lesson[] = [
  {
    id: 'clarity',
    title: 'Clarity & Conciseness',
    icon: '💡',
    description: 'Learn to express ideas clearly and remove unnecessary words.',
    tips: [
      'Remove filler words like "very", "really", "just", "basically"',
      'Replace weak phrases: "in order to" → "to"',
      'Use active voice instead of passive voice',
      'Break long sentences into shorter ones',
      'One idea per sentence'
    ],
    example: {
      bad: 'In order to basically understand the very important concept, it is necessary for students to really study the material.',
      good: 'To understand this concept, students must study the material.',
      explanation: 'Removed filler words and weak phrases, making the sentence direct and clear.'
    }
  },
  {
    id: 'structure',
    title: 'Sentence Structure',
    icon: '🏗️',
    description: 'Vary your sentence length and structure for better flow.',
    tips: [
      'Mix short and long sentences for rhythm',
      'Start sentences with different words',
      'Use transitions to connect ideas',
      'Avoid starting every sentence with "I" or "The"',
      'Use parallel structure in lists'
    ],
    example: {
      bad: 'The report was completed. The data was analyzed. The results were presented.',
      good: 'After completing the report, we analyzed the data and presented compelling results.',
      explanation: 'Combined choppy sentences and varied the structure for better flow.'
    }
  },
  {
    id: 'vocabulary',
    title: 'Vocabulary Enhancement',
    icon: '📚',
    description: 'Use precise words and avoid repetition.',
    tips: [
      'Avoid repeating the same word multiple times',
      'Use specific words instead of vague ones',
      'Replace overused words with synonyms',
      '"Good" → excellent, effective, beneficial',
      '"Bad" → detrimental, problematic, inadequate'
    ],
    example: {
      bad: 'The thing was good. It made the other things good too.',
      good: 'The initiative proved effective, improving overall productivity.',
      explanation: 'Replaced vague words with specific, descriptive language.'
    }
  },
  {
    id: 'engagement',
    title: 'Reader Engagement',
    icon: '🎯',
    description: 'Capture and maintain your reader\'s attention.',
    tips: [
      'Start with a hook (question, fact, or bold statement)',
      'Use concrete examples to illustrate points',
      'Ask rhetorical questions to involve readers',
      'End paragraphs with impactful statements',
      'Tell stories when appropriate'
    ],
    example: {
      bad: 'Climate change is a problem. We should do something about it.',
      good: 'What if your hometown became uninhabitable by 2050? Climate change threatens millions—and action is needed now.',
      explanation: 'Opens with a question and creates urgency to engage readers.'
    }
  },
  {
    id: 'grammar',
    title: 'Common Grammar Issues',
    icon: '📝',
    description: 'Avoid frequent grammar mistakes in writing.',
    tips: [
      'Subject-verb agreement: "The team is" not "The team are"',
      'Their/there/they\'re - know the difference',
      'Its (possessive) vs it\'s (it is)',
      'Affect (verb) vs effect (noun)',
      'Use commas after introductory phrases'
    ],
    example: {
      bad: 'Its important that their going to effect the outcome.',
      good: 'It\'s important that they\'re going to affect the outcome.',
      explanation: 'Corrected common confusion between similar-sounding words.'
    }
  },
  {
    id: 'academic',
    title: 'Academic Writing',
    icon: '🎓',
    description: 'Write professionally for academic contexts.',
    tips: [
      'Avoid contractions in formal writing',
      'Use third person (avoid "I think")',
      'Support claims with evidence',
      'Define technical terms',
      'Use hedging language: "suggests", "indicates", "may"'
    ],
    example: {
      bad: 'I think social media is bad for kids because they use it too much.',
      good: 'Research suggests excessive social media use correlates with decreased well-being among adolescents (Smith, 2023).',
      explanation: 'Uses formal language, third person, and cites evidence.'
    }
  }
];

export default function WritingLessonsPanel({ userEssay, onClose }: WritingLessonsPanelProps) {
  const [activeTab, setActiveTab] = useState<'essay' | 'lessons'>('lessons');
  const [selectedLesson, setSelectedLesson] = useState<string>('clarity');
  const [expandedTip, setExpandedTip] = useState<string | null>(null);

  // Analyze the essay to show relevant metrics
  const essayAnalysis = useMemo(() => {
    if (!userEssay || userEssay.length < 20) return null;
    
    const words = userEssay.split(/\s+/).filter(w => w.length > 0);
    const sentences = userEssay.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const paragraphs = userEssay.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    const avgSentenceLength = words.length / Math.max(sentences.length, 1);
    
    // Check for issues
    const fillerWords = ['very', 'really', 'just', 'basically', 'actually', 'literally'];
    const fillerCount = words.filter(w => fillerWords.includes(w.toLowerCase())).length;
    
    const contractions = userEssay.match(/\b\w+'\w+\b/g) || [];
    
    return {
      wordCount: words.length,
      sentenceCount: sentences.length,
      paragraphCount: paragraphs.length,
      avgSentenceLength: Math.round(avgSentenceLength),
      fillerCount,
      contractionCount: contractions.length
    };
  }, [userEssay]);

  const currentLesson = LESSONS.find(l => l.id === selectedLesson) || LESSONS[0];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <span className="text-xl">✨</span>
          Writing Improvement Center
        </h3>
        {onClose && (
          <button onClick={onClose} className="text-slate-400 hover:text-white transition">✕</button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/10 pb-2">
        <button
          onClick={() => setActiveTab('lessons')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            activeTab === 'lessons'
              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          📖 Writing Lessons
        </button>
        <button
          onClick={() => setActiveTab('essay')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            activeTab === 'essay'
              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          📄 Your Essay {essayAnalysis && `(${essayAnalysis.wordCount} words)`}
        </button>
      </div>

      {/* Lessons Tab */}
      {activeTab === 'lessons' && (
        <div className="space-y-4">
          {/* Lesson Selection */}
          <div className="flex flex-wrap gap-2">
            {LESSONS.map(lesson => (
              <button
                key={lesson.id}
                onClick={() => setSelectedLesson(lesson.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  selectedLesson === lesson.id
                    ? 'bg-blue-500 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-white/10'
                }`}
              >
                {lesson.icon} {lesson.title}
              </button>
            ))}
          </div>

          {/* Current Lesson Content */}
          <div className="bg-slate-800/50 rounded-lg border border-white/10 p-4 space-y-4">
            <div>
              <h4 className="text-base font-semibold text-white flex items-center gap-2">
                <span className="text-xl">{currentLesson.icon}</span>
                {currentLesson.title}
              </h4>
              <p className="text-sm text-slate-400 mt-1">{currentLesson.description}</p>
            </div>

            {/* Tips */}
            <div className="space-y-2">
              <h5 className="text-sm font-semibold text-blue-300">Key Tips:</h5>
              <ul className="space-y-2">
                {currentLesson.tips.map((tip, i) => (
                  <li 
                    key={i} 
                    className="flex items-start gap-2 text-sm text-slate-300 bg-slate-900/50 rounded-lg p-2.5 border border-white/5"
                  >
                    <span className="text-blue-400 font-bold">{i + 1}.</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Example */}
            {currentLesson.example && (
              <div className="space-y-3 pt-3 border-t border-white/10">
                <h5 className="text-sm font-semibold text-emerald-300">📝 Example:</h5>
                <div className="grid gap-3">
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                    <div className="text-[10px] uppercase tracking-wide text-red-400 mb-1">❌ Before</div>
                    <p className="text-sm text-red-200 italic">"{currentLesson.example.bad}"</p>
                  </div>
                  <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3">
                    <div className="text-[10px] uppercase tracking-wide text-emerald-400 mb-1">✓ After</div>
                    <p className="text-sm text-emerald-200 italic">"{currentLesson.example.good}"</p>
                  </div>
                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-2.5">
                    <p className="text-xs text-blue-200">
                      <strong>💡 Why it's better:</strong> {currentLesson.example.explanation}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Essay Tab */}
      {activeTab === 'essay' && (
        <div className="space-y-4">
          {essayAnalysis ? (
            <>
              {/* Quick Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-800/50 rounded-lg p-3 border border-white/10 text-center">
                  <div className="text-2xl font-bold text-white">{essayAnalysis.wordCount}</div>
                  <div className="text-xs text-slate-400">Words</div>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3 border border-white/10 text-center">
                  <div className="text-2xl font-bold text-white">{essayAnalysis.sentenceCount}</div>
                  <div className="text-xs text-slate-400">Sentences</div>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3 border border-white/10 text-center">
                  <div className="text-2xl font-bold text-white">{essayAnalysis.avgSentenceLength}</div>
                  <div className="text-xs text-slate-400">Avg Words/Sent</div>
                </div>
              </div>

              {/* Quick Feedback */}
              <div className="space-y-2">
                {essayAnalysis.avgSentenceLength > 25 && (
                  <div className="flex items-start gap-2 p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                    <span>⚠️</span>
                    <p className="text-xs text-amber-200">Your sentences are quite long (avg {essayAnalysis.avgSentenceLength} words). Consider breaking them up for clarity.</p>
                  </div>
                )}
                {essayAnalysis.fillerCount > 3 && (
                  <div className="flex items-start gap-2 p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                    <span>⚠️</span>
                    <p className="text-xs text-amber-200">Found {essayAnalysis.fillerCount} filler words (very, really, just, etc.). Try removing some for stronger writing.</p>
                  </div>
                )}
                {essayAnalysis.avgSentenceLength <= 25 && essayAnalysis.avgSentenceLength >= 10 && (
                  <div className="flex items-start gap-2 p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                    <span>✓</span>
                    <p className="text-xs text-emerald-200">Good sentence length! Your writing has a nice rhythm.</p>
                  </div>
                )}
              </div>

              {/* Essay Preview */}
              <div>
                <h5 className="text-sm font-semibold text-slate-300 mb-2">Your Essay:</h5>
                <div className="bg-slate-900/50 rounded-lg p-4 border border-white/10 max-h-64 overflow-y-auto">
                  <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{userEssay}</p>
                </div>
              </div>

              {/* Suggestions */}
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                <h5 className="text-sm font-semibold text-blue-300 mb-2">💡 Quick Improvements</h5>
                <ul className="space-y-1.5 text-xs text-blue-200">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400">•</span>
                    Read your essay aloud to catch awkward phrasing
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400">•</span>
                    Check the Lessons tab for specific improvement tips
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400">•</span>
                    Paraphrase to get a fresh perspective on your writing
                  </li>
                </ul>
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-slate-400">
              <p className="text-lg mb-2">📝</p>
              <p className="text-sm">Paste your essay in the input field below to see analysis here.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
