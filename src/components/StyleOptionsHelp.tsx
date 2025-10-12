"use client";
import { useState } from 'react';

interface StyleOption {
  name: string;
  key: 'formality' | 'pacing' | 'descriptiveness' | 'directness';
  description: string;
  lowLabel: string;
  highLabel: string;
  examples: {
    low: { value: number; text: string; label: string };
    medium: { value: number; text: string; label: string };
    high: { value: number; text: string; label: string };
  };
  tips: string[];
}

const styleOptions: StyleOption[] = [
  {
    name: 'Formality',
    key: 'formality',
    description: 'Controls how formal or casual your writing style is.',
    lowLabel: 'Casual & Conversational',
    highLabel: 'Formal & Professional',
    examples: {
      low: {
        value: 0.2,
        text: "Hey! So I've been thinking about this project and honestly, it's pretty cool. We should totally try it out and see what happens.",
        label: 'Casual (20%)'
      },
      medium: {
        value: 0.5,
        text: "I've been considering this project and I think it has potential. We should test it and evaluate the results.",
        label: 'Balanced (50%)'
      },
      high: {
        value: 0.9,
        text: "Upon careful consideration of this initiative, I believe it demonstrates considerable merit. I recommend we conduct a thorough evaluation to assess its viability.",
        label: 'Formal (90%)'
      }
    },
    tips: [
      'Use 0-30% for casual blog posts, social media, or friendly emails',
      'Use 40-60% for business communication, reports, or professional articles',
      'Use 70-100% for academic writing, legal documents, or formal proposals'
    ]
  },
  {
    name: 'Pacing',
    key: 'pacing',
    description: 'Adjusts the rhythm and speed of your writing through sentence length and structure.',
    lowLabel: 'Slow & Deliberate',
    highLabel: 'Fast & Dynamic',
    examples: {
      low: {
        value: 0.2,
        text: "The sunset was magnificent. I watched as the colors changed. First orange, then pink, then deep purple. Each moment was beautiful. Time seemed to stop.",
        label: 'Slow (20%)'
      },
      medium: {
        value: 0.5,
        text: "The magnificent sunset unfolded before me, colors shifting from orange to pink to deep purple. Each moment held its own beauty as time seemed to pause.",
        label: 'Moderate (50%)'
      },
      high: {
        value: 0.9,
        text: "Colors exploded across the sky—orange to pink to purple—each shift more stunning than the last, time freezing in those perfect seconds.",
        label: 'Fast (90%)'
      }
    },
    tips: [
      'Use 0-30% for instructional content, technical documentation, or emphasis',
      'Use 40-60% for general articles, blog posts, or balanced narrative',
      'Use 70-100% for exciting stories, marketing copy, or engaging content'
    ]
  },
  {
    name: 'Descriptiveness',
    key: 'descriptiveness',
    description: 'Determines how much detail and imagery you use in your writing.',
    lowLabel: 'Minimal & Direct',
    highLabel: 'Rich & Detailed',
    examples: {
      low: {
        value: 0.2,
        text: "The room was large. It had windows and furniture. The walls were white.",
        label: 'Minimal (20%)'
      },
      medium: {
        value: 0.5,
        text: "The spacious room featured tall windows that let in natural light. Comfortable furniture was arranged throughout, and the walls were painted a clean white.",
        label: 'Balanced (50%)'
      },
      high: {
        value: 0.9,
        text: "The expansive room stretched before me, bathed in golden sunlight streaming through towering floor-to-ceiling windows. Plush, inviting furniture in warm earth tones was artfully positioned across the space, while pristine white walls created a canvas of serene elegance.",
        label: 'Rich (90%)'
      }
    },
    tips: [
      'Use 0-30% for technical writing, news reports, or when brevity is key',
      'Use 40-60% for business content, educational material, or general writing',
      'Use 70-100% for creative writing, marketing, or when painting a vivid picture'
    ]
  },
  {
    name: 'Directness',
    key: 'directness',
    description: 'Controls how straightforward or nuanced your communication style is.',
    lowLabel: 'Subtle & Nuanced',
    highLabel: 'Direct & Clear',
    examples: {
      low: {
        value: 0.2,
        text: "It might be worth considering that perhaps there could be some room for improvement in certain aspects of the approach we've been taking.",
        label: 'Subtle (20%)'
      },
      medium: {
        value: 0.5,
        text: "There are several areas in our current approach that could benefit from improvement.",
        label: 'Balanced (50%)'
      },
      high: {
        value: 0.9,
        text: "Our current approach needs improvement in three key areas.",
        label: 'Direct (90%)'
      }
    },
    tips: [
      'Use 0-30% for diplomatic communication, sensitive topics, or suggestion-based writing',
      'Use 40-60% for standard professional communication or informative content',
      'Use 70-100% for instructions, commands, or when clarity is paramount'
    ]
  }
];

const toneExamples = [
  {
    name: 'Professional',
    description: 'Polished, business-appropriate tone',
    example: 'I am writing to inform you of the recent developments in our project timeline.'
  },
  {
    name: 'Friendly',
    description: 'Warm, approachable, and conversational',
    example: 'I wanted to update you on how things are going with the project!'
  },
  {
    name: 'Authoritative',
    description: 'Confident, knowledgeable, and commanding',
    example: 'The data clearly demonstrates the effectiveness of our approach.'
  },
  {
    name: 'Empathetic',
    description: 'Understanding, compassionate, and supportive',
    example: 'I understand this situation may be challenging, and I\'m here to help you through it.'
  },
  {
    name: 'Enthusiastic',
    description: 'Energetic, excited, and positive',
    example: 'This is an amazing opportunity that we absolutely need to explore!'
  },
  {
    name: 'Neutral',
    description: 'Objective, unbiased, and factual',
    example: 'The project timeline has been adjusted to accommodate new requirements.'
  }
];

export default function StyleOptionsHelp() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'formality' | 'pacing' | 'descriptiveness' | 'directness' | 'tone'>('overview');
  const [selectedExample, setSelectedExample] = useState<{ [key: string]: 'low' | 'medium' | 'high' }>({
    formality: 'medium',
    pacing: 'medium',
    descriptiveness: 'medium',
    directness: 'medium'
  });

  const handleExampleChange = (key: string, value: 'low' | 'medium' | 'high') => {
    setSelectedExample(prev => ({ ...prev, [key]: value }));
  };

  const getActiveOption = () => styleOptions.find(opt => opt.key === activeTab);

  return (
    <>
      {/* Help Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-full bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-400 hover:to-brand-500 text-white font-medium shadow-lg hover:shadow-xl transition-all duration-300 group"
        title="Learn about style options"
      >
        <svg className="w-5 h-5 group-hover:rotate-12 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>Style Guide</span>
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Modal Content */}
          <div className="relative w-full max-w-5xl max-h-[90vh] bg-slate-900 rounded-2xl shadow-2xl border border-white/10 overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-gradient-to-r from-brand-500/10 to-purple-500/10">
              <div>
                <h2 className="text-2xl font-bold text-white">Style Options Guide</h2>
                <p className="text-sm text-slate-300 mt-1">Learn how each setting affects your writing style</p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                title="Close"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Tab Navigation */}
            <div className="px-6 pt-4 bg-slate-800/50">
              <div className="flex gap-1 overflow-x-auto scrollbar-hide">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`relative px-5 py-3 text-sm font-medium transition-all whitespace-nowrap ${
                    activeTab === 'overview'
                      ? 'text-brand-300'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span className="relative z-10">📚 Overview</span>
                  {activeTab === 'overview' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-brand-500 to-brand-400"></div>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('tone')}
                  className={`relative px-5 py-3 text-sm font-medium transition-all whitespace-nowrap ${
                    activeTab === 'tone'
                      ? 'text-brand-300'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span className="relative z-10">🎭 Tone</span>
                  {activeTab === 'tone' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-brand-500 to-brand-400"></div>
                  )}
                </button>
                {styleOptions.map(option => (
                  <button
                    key={option.key}
                    onClick={() => setActiveTab(option.key)}
                    className={`relative px-5 py-3 text-sm font-medium transition-all whitespace-nowrap ${
                      activeTab === option.key
                        ? 'text-brand-300'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span className="relative z-10">{option.name}</span>
                    {activeTab === option.key && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-brand-500 to-brand-400"></div>
                    )}
                  </button>
                ))}
              </div>
              <div className="h-px bg-white/10 w-full"></div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto px-6 py-6 bg-slate-900">
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  <div className="glass-panel p-6 space-y-4">
                    <h3 className="text-xl font-semibold text-brand-300">Welcome to StyleSync!</h3>
                    <p className="text-slate-300 leading-relaxed">
                      StyleSync allows you to transform any text to match your unique writing style. Each option controls a specific aspect of how your text reads and feels.
                    </p>
                  </div>

                  <div className="glass-panel p-6 space-y-4">
                    <h3 className="text-lg font-semibold text-white">Quick Overview</h3>
                    <div className="grid gap-4 md:grid-cols-2">
                      {styleOptions.map(option => (
                        <div key={option.key} className="p-4 rounded-lg bg-slate-800/40 border border-white/5">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium text-brand-300">{option.name}</h4>
                            <button
                              onClick={() => setActiveTab(option.key)}
                              className="text-xs px-2 py-1 rounded bg-brand-500/20 hover:bg-brand-500/30 text-brand-400 transition-colors"
                            >
                              Learn More →
                            </button>
                          </div>
                          <p className="text-sm text-slate-400">{option.description}</p>
                          <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                            <span>{option.lowLabel}</span>
                            <span>↔</span>
                            <span>{option.highLabel}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="glass-panel p-6 space-y-4">
                    <h3 className="text-lg font-semibold text-white">Getting Started</h3>
                    <ol className="space-y-3 text-slate-300">
                      <li className="flex gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-500/20 text-brand-300 flex items-center justify-center text-sm font-semibold">1</span>
                        <span><strong className="text-white">Create a style profile:</strong> Use the Style Profile Manager to set up your preferences</span>
                      </li>
                      <li className="flex gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-500/20 text-brand-300 flex items-center justify-center text-sm font-semibold">2</span>
                        <span><strong className="text-white">Provide a sample:</strong> Paste a few paragraphs of your own writing to help AI understand your style</span>
                      </li>
                      <li className="flex gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-500/20 text-brand-300 flex items-center justify-center text-sm font-semibold">3</span>
                        <span><strong className="text-white">Adjust settings:</strong> Fine-tune each option based on what you learn here</span>
                      </li>
                      <li className="flex gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-500/20 text-brand-300 flex items-center justify-center text-sm font-semibold">4</span>
                        <span><strong className="text-white">Paraphrase and refine:</strong> Test different texts and adjust your profile as needed</span>
                      </li>
                    </ol>
                  </div>

                  <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm">
                    <p className="font-medium mb-1">💡 Pro Tip:</p>
                    <p>Click on each tab above to see detailed examples and understand exactly how each setting transforms your text.</p>
                  </div>
                </div>
              )}

              {activeTab === 'tone' && (
                <div className="space-y-6">
                  <div className="glass-panel p-6 space-y-4">
                    <h3 className="text-xl font-semibold text-brand-300">Tone</h3>
                    <p className="text-slate-300 leading-relaxed">
                      Tone is the overall emotional character and attitude of your writing. It's expressed through word choice, 
                      sentence structure, and the general feeling your text conveys. Unlike the other numeric settings, tone is 
                      described with words like "professional," "friendly," "authoritative," etc.
                    </p>
                  </div>

                  <div className="glass-panel p-6 space-y-4">
                    <h3 className="text-lg font-semibold text-white">Common Tone Examples</h3>
                    <div className="grid gap-4 md:grid-cols-2">
                      {toneExamples.map(tone => (
                        <div key={tone.name} className="p-4 rounded-lg bg-slate-800/40 border border-white/5 space-y-2">
                          <h4 className="font-medium text-brand-300">{tone.name}</h4>
                          <p className="text-xs text-slate-400">{tone.description}</p>
                          <div className="mt-2 p-3 rounded bg-slate-900/60 border border-white/5">
                            <p className="text-sm text-slate-200 italic">"{tone.example}"</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="glass-panel p-6 space-y-3">
                    <h3 className="text-lg font-semibold text-white">Tips for Choosing Your Tone</h3>
                    <ul className="space-y-2 text-slate-300 text-sm">
                      <li className="flex gap-2">
                        <span className="text-brand-400">•</span>
                        <span>Match your audience: Professional for business, friendly for blogs, authoritative for expertise</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-brand-400">•</span>
                        <span>Be consistent: Your tone should remain steady throughout a piece of writing</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-brand-400">•</span>
                        <span>Consider the context: Formal presentations need different tones than casual emails</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-brand-400">•</span>
                        <span>You can combine tones: "Professional yet friendly" or "Authoritative but approachable"</span>
                      </li>
                    </ul>
                  </div>
                </div>
              )}

              {activeTab !== 'overview' && activeTab !== 'tone' && getActiveOption() && (
                <div className="space-y-6">
                  {(() => {
                    const option = getActiveOption()!;
                    return (
                      <>
                        <div className="glass-panel p-6 space-y-4">
                          <h3 className="text-xl font-semibold text-brand-300">{option.name}</h3>
                          <p className="text-slate-300 leading-relaxed">{option.description}</p>
                          <div className="flex items-center justify-between text-sm">
                            <span className="px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/30">
                              {option.lowLabel}
                            </span>
                            <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                            </svg>
                            <span className="px-3 py-1.5 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30">
                              {option.highLabel}
                            </span>
                          </div>
                        </div>

                        <div className="glass-panel p-6 space-y-4">
                          <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-white">Interactive Examples</h3>
                            <span className="text-xs text-slate-500">Click to see different levels</span>
                          </div>
                          
                          {/* Example Selector */}
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleExampleChange(option.key, 'low')}
                              className={`flex-1 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                                selectedExample[option.key] === 'low'
                                  ? 'bg-blue-500/30 text-blue-200 border-2 border-blue-400 shadow-lg'
                                  : 'bg-slate-800/40 text-slate-400 border border-white/10 hover:border-blue-400/50'
                              }`}
                            >
                              <div className="text-xs opacity-70 mb-1">Low</div>
                              <div>{option.examples.low.value * 100}%</div>
                            </button>
                            <button
                              onClick={() => handleExampleChange(option.key, 'medium')}
                              className={`flex-1 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                                selectedExample[option.key] === 'medium'
                                  ? 'bg-brand-500/30 text-brand-200 border-2 border-brand-400 shadow-lg'
                                  : 'bg-slate-800/40 text-slate-400 border border-white/10 hover:border-brand-400/50'
                              }`}
                            >
                              <div className="text-xs opacity-70 mb-1">Medium</div>
                              <div>{option.examples.medium.value * 100}%</div>
                            </button>
                            <button
                              onClick={() => handleExampleChange(option.key, 'high')}
                              className={`flex-1 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                                selectedExample[option.key] === 'high'
                                  ? 'bg-purple-500/30 text-purple-200 border-2 border-purple-400 shadow-lg'
                                  : 'bg-slate-800/40 text-slate-400 border border-white/10 hover:border-purple-400/50'
                              }`}
                            >
                              <div className="text-xs opacity-70 mb-1">High</div>
                              <div>{option.examples.high.value * 100}%</div>
                            </button>
                          </div>

                          {/* Example Display */}
                          <div className="p-5 rounded-lg bg-gradient-to-br from-slate-800/60 to-slate-800/30 border-2 border-brand-500/30">
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-xs font-semibold text-brand-300 uppercase tracking-wide">
                                {option.examples[selectedExample[option.key]].label}
                              </span>
                              <span className="text-xs px-2 py-1 rounded bg-brand-500/20 text-brand-300">
                                Example Output
                              </span>
                            </div>
                            <p className="text-slate-100 leading-relaxed">
                              {option.examples[selectedExample[option.key]].text}
                            </p>
                          </div>

                          {/* Visual Slider Representation */}
                          <div className="p-4 rounded-lg bg-slate-800/30">
                            <div className="relative h-2 bg-slate-700 rounded-full overflow-hidden">
                              <div 
                                className="absolute left-0 top-0 h-full bg-gradient-to-r from-blue-500 via-brand-500 to-purple-500 transition-all duration-500"
                                style={{ width: `${option.examples[selectedExample[option.key]].value * 100}%` }}
                              />
                            </div>
                            <div className="flex justify-between mt-2 text-xs text-slate-500">
                              <span>0%</span>
                              <span>25%</span>
                              <span>50%</span>
                              <span>75%</span>
                              <span>100%</span>
                            </div>
                          </div>
                        </div>

                        <div className="glass-panel p-6 space-y-3">
                          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                            <span>💡</span>
                            <span>Best Practices</span>
                          </h3>
                          <ul className="space-y-2 text-slate-300 text-sm">
                            {option.tips.map((tip, idx) => (
                              <li key={idx} className="flex gap-2">
                                <span className="text-brand-400">•</span>
                                <span>{tip}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-white/10 bg-slate-800/50 flex items-center justify-between">
              <p className="text-xs text-slate-400">
                💡 Tip: Combine multiple settings to create your unique writing style
              </p>
              <button
                onClick={() => setIsOpen(false)}
                className="px-6 py-2 rounded-lg bg-brand-500 hover:bg-brand-400 text-white font-medium transition-colors"
              >
                Got it!
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
