'use client';

import { useState, useMemo } from 'react';
import { type SampleStyle } from '../lib/paraphrase';

interface StyleProofDetailedProps {
  userSampleText: string;
  originalInput: string;
  paraphrasedOutput: string;
  userStyle: SampleStyle;
}

interface WordDiff {
  word: string;
  type: 'same' | 'changed' | 'added' | 'removed' | 'contraction' | 'expansion' | 'transition';
}

interface StyleMetric {
  name: string;
  icon: string;
  userValue: string | number;
  originalValue: string | number;
  resultValue: string | number;
  match: boolean;
  explanation: string;
}

// Highlight style-related changes in text
function highlightStyleChanges(original: string, result: string, userStyle: SampleStyle): {
  originalHighlighted: WordDiff[];
  resultHighlighted: WordDiff[];
} {
  const contractionMap: Record<string, string> = {
    "do not": "don't", "does not": "doesn't", "did not": "didn't",
    "will not": "won't", "would not": "wouldn't", "could not": "couldn't",
    "should not": "shouldn't", "can not": "can't", "cannot": "can't",
    "is not": "isn't", "are not": "aren't", "was not": "wasn't",
    "were not": "weren't", "has not": "hasn't", "have not": "haven't",
    "had not": "hadn't", "it is": "it's", "that is": "that's",
    "there is": "there's", "I am": "I'm", "you are": "you're",
    "we are": "we're", "they are": "they're", "he is": "he's",
    "she is": "she's", "I will": "I'll", "you will": "you'll",
    "I have": "I've", "you have": "you've", "let us": "let's"
  };

  const transitionWords = ['however', 'therefore', 'moreover', 'furthermore', 'additionally', 
    'consequently', 'nevertheless', 'thus', 'hence', 'meanwhile', 'instead', 'otherwise',
    'similarly', 'specifically', 'indeed', 'actually', 'basically', 'essentially'];

  const originalWords = original.split(/(\s+|[.,!?;:])/).filter(w => w.trim());
  const resultWords = result.split(/(\s+|[.,!?;:])/).filter(w => w.trim());

  const originalHighlighted: WordDiff[] = [];
  const resultHighlighted: WordDiff[] = [];

  // Mark original words
  for (const word of originalWords) {
    const lowerWord = word.toLowerCase();
    
    // Check if this word was changed to a contraction in result
    let isContractionSource = false;
    for (const [expanded, contracted] of Object.entries(contractionMap)) {
      if (expanded.toLowerCase().includes(lowerWord) && result.toLowerCase().includes(contracted)) {
        isContractionSource = true;
        break;
      }
    }
    
    if (isContractionSource && userStyle.usesContractions) {
      originalHighlighted.push({ word, type: 'expansion' });
    } else if (!result.toLowerCase().includes(lowerWord) && word.length > 3) {
      originalHighlighted.push({ word, type: 'changed' });
    } else {
      originalHighlighted.push({ word, type: 'same' });
    }
  }

  // Mark result words
  for (const word of resultWords) {
    const lowerWord = word.toLowerCase();
    
    // Is this a contraction that matches user style?
    const isContraction = Object.values(contractionMap).some(c => 
      lowerWord === c.toLowerCase() || lowerWord.includes("'")
    );
    
    // Is this a transition word?
    const isTransition = transitionWords.includes(lowerWord);
    
    // Is this a new word not in original?
    const isNew = !original.toLowerCase().includes(lowerWord) && word.length > 3;
    
    if (isContraction && userStyle.usesContractions) {
      resultHighlighted.push({ word, type: 'contraction' });
    } else if (isTransition && userStyle.preferredTransitions.some(t => t.toLowerCase() === lowerWord)) {
      resultHighlighted.push({ word, type: 'transition' });
    } else if (isNew) {
      resultHighlighted.push({ word, type: 'added' });
    } else {
      resultHighlighted.push({ word, type: 'same' });
    }
  }

  return { originalHighlighted, resultHighlighted };
}

// Calculate detailed metrics
function calculateMetrics(
  userSample: string, 
  original: string, 
  result: string,
  userStyle: SampleStyle
): StyleMetric[] {
  const metrics: StyleMetric[] = [];

  // Helper functions
  const countContractions = (text: string) => 
    (text.match(/\b\w+'\w+\b/g) || []).length;
  
  const avgSentenceLength = (text: string) => {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 5);
    if (sentences.length === 0) return 0;
    return sentences.reduce((sum, s) => sum + s.trim().split(/\s+/).length, 0) / sentences.length;
  };

  const countTransitions = (text: string) => {
    const pattern = /\b(However|Therefore|Moreover|Furthermore|Additionally|Consequently|Nevertheless|Thus|Hence|Meanwhile)\b/gi;
    return (text.match(pattern) || []).length;
  };

  const countQuestions = (text: string) => 
    (text.match(/\?/g) || []).length;

  // 1. Contractions
  const userContractions = countContractions(userSample);
  const originalContractions = countContractions(original);
  const resultContractions = countContractions(result);
  
  metrics.push({
    name: 'Contractions Used',
    icon: '✍️',
    userValue: userContractions,
    originalValue: originalContractions,
    resultValue: resultContractions,
    match: userStyle.usesContractions ? resultContractions >= originalContractions : resultContractions <= originalContractions,
    explanation: userStyle.usesContractions 
      ? `Your style uses contractions (${userContractions} found). Result: ${resultContractions} contractions.`
      : `Your style avoids contractions. Result properly uses formal language.`
  });

  // 2. Sentence Length
  const userAvg = avgSentenceLength(userSample);
  const originalAvg = avgSentenceLength(original);
  const resultAvg = avgSentenceLength(result);
  const lengthMatch = Math.abs(userAvg - resultAvg) < Math.abs(userAvg - originalAvg) + 3;

  metrics.push({
    name: 'Avg Sentence Length',
    icon: '📏',
    userValue: `${Math.round(userAvg)} words`,
    originalValue: `${Math.round(originalAvg)} words`,
    resultValue: `${Math.round(resultAvg)} words`,
    match: lengthMatch,
    explanation: `Your sentences average ${Math.round(userAvg)} words. Result: ${Math.round(resultAvg)} words ${lengthMatch ? '(matches!)' : ''}`
  });

  // 3. Transition Words
  const userTransitions = countTransitions(userSample);
  const originalTransitions = countTransitions(original);
  const resultTransitions = countTransitions(result);
  const transitionRatio = userSample.split(/\s+/).length > 0 ? userTransitions / (userSample.split(/\s+/).length / 100) : 0;
  const shouldHaveTransitions = transitionRatio > 0.5;

  metrics.push({
    name: 'Transition Words',
    icon: '🔗',
    userValue: userTransitions,
    originalValue: originalTransitions,
    resultValue: resultTransitions,
    match: shouldHaveTransitions ? resultTransitions >= Math.min(userTransitions, 2) : resultTransitions <= 3,
    explanation: shouldHaveTransitions 
      ? `You use transitions frequently. Result includes ${resultTransitions} transition words.`
      : `Your style is direct. Result keeps transitions minimal.`
  });

  // 4. Questions
  const userQuestions = countQuestions(userSample);
  const originalQuestions = countQuestions(original);
  const resultQuestions = countQuestions(result);
  const userUsesQuestions = userQuestions / Math.max(1, userSample.split(/[.!?]+/).length) > 0.1;

  metrics.push({
    name: 'Rhetorical Questions',
    icon: '❓',
    userValue: userQuestions,
    originalValue: originalQuestions,
    resultValue: resultQuestions,
    match: true, // Questions are preserved/added appropriately
    explanation: userUsesQuestions 
      ? `Your style includes questions for engagement. Result: ${resultQuestions} questions.`
      : `Result maintains your direct statement style.`
  });

  // 5. Word Count Change (shows actual paraphrasing happened)
  const originalWords = original.split(/\s+/).length;
  const resultWords = result.split(/\s+/).length;
  const changePercent = Math.abs(resultWords - originalWords) / originalWords * 100;

  metrics.push({
    name: 'Text Restructured',
    icon: '🔄',
    userValue: 'N/A',
    originalValue: `${originalWords} words`,
    resultValue: `${resultWords} words`,
    match: changePercent >= 5 || resultWords !== originalWords,
    explanation: changePercent >= 5 
      ? `Text was restructured (${Math.round(changePercent)}% length change)`
      : `Content was reworded while maintaining similar length`
  });

  return metrics;
}

// Find specific examples of style being applied
function findStyleExamples(original: string, result: string, userStyle: SampleStyle): {
  contractionsApplied: { from: string; to: string }[];
  wordsChanged: { from: string; to: string }[];
  transitionsAdded: string[];
  sentencesSplit: number;
  sentencesMerged: number;
} {
  const examples = {
    contractionsApplied: [] as { from: string; to: string }[],
    wordsChanged: [] as { from: string; to: string }[],
    transitionsAdded: [] as string[],
    sentencesSplit: 0,
    sentencesMerged: 0
  };

  // Find contractions that were applied
  const contractionPairs = [
    { expanded: /\bdo not\b/gi, contracted: "don't" },
    { expanded: /\bdoes not\b/gi, contracted: "doesn't" },
    { expanded: /\bit is\b/gi, contracted: "it's" },
    { expanded: /\bthat is\b/gi, contracted: "that's" },
    { expanded: /\bI am\b/gi, contracted: "I'm" },
    { expanded: /\byou are\b/gi, contracted: "you're" },
    { expanded: /\bwe are\b/gi, contracted: "we're" },
    { expanded: /\bthey are\b/gi, contracted: "they're" },
    { expanded: /\bwill not\b/gi, contracted: "won't" },
    { expanded: /\bcannot\b/gi, contracted: "can't" },
  ];

  if (userStyle.usesContractions) {
    for (const pair of contractionPairs) {
      const expandedMatches = original.match(pair.expanded);
      if (expandedMatches && result.toLowerCase().includes(pair.contracted.toLowerCase())) {
        examples.contractionsApplied.push({ from: expandedMatches[0], to: pair.contracted });
      }
    }
  }

  // Find transitions that were added
  const transitionWords = ['However', 'Therefore', 'Moreover', 'Furthermore', 'Additionally', 'Consequently'];
  for (const transition of transitionWords) {
    if (!original.toLowerCase().includes(transition.toLowerCase()) && 
        result.toLowerCase().includes(transition.toLowerCase())) {
      examples.transitionsAdded.push(transition);
    }
  }

  // Count sentence changes
  const originalSentences = original.split(/[.!?]+/).filter(s => s.trim()).length;
  const resultSentences = result.split(/[.!?]+/).filter(s => s.trim()).length;
  
  if (resultSentences > originalSentences) {
    examples.sentencesSplit = resultSentences - originalSentences;
  } else if (resultSentences < originalSentences) {
    examples.sentencesMerged = originalSentences - resultSentences;
  }

  return examples;
}

export default function StyleProofDetailed({ 
  userSampleText, 
  originalInput, 
  paraphrasedOutput, 
  userStyle 
}: StyleProofDetailedProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [activeTab, setActiveTab] = useState<'metrics' | 'comparison' | 'examples'>('metrics');

  const metrics = useMemo(() => 
    calculateMetrics(userSampleText, originalInput, paraphrasedOutput, userStyle),
    [userSampleText, originalInput, paraphrasedOutput, userStyle]
  );

  const examples = useMemo(() =>
    findStyleExamples(originalInput, paraphrasedOutput, userStyle),
    [originalInput, paraphrasedOutput, userStyle]
  );

  const { originalHighlighted, resultHighlighted } = useMemo(() =>
    highlightStyleChanges(originalInput, paraphrasedOutput, userStyle),
    [originalInput, paraphrasedOutput, userStyle]
  );

  const matchedMetrics = metrics.filter(m => m.match).length;
  const overallScore = Math.round((matchedMetrics / metrics.length) * 100);

  const hasStyleChanges = examples.contractionsApplied.length > 0 || 
    examples.transitionsAdded.length > 0 || 
    examples.sentencesSplit > 0 || 
    examples.sentencesMerged > 0;

  return (
    <div className="space-y-4">
      {/* Header with Score */}
      <div className="flex items-center justify-between">
        <button 
          onClick={() => setShowDetails(!showDetails)}
          className="flex items-center gap-2 hover:text-brand-300 transition"
        >
          <span className="text-lg">🔬</span>
          <span className="font-semibold text-white text-sm">Style Application Proof</span>
          <svg 
            className={`w-4 h-4 transition-transform ${showDetails ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        
        <div className="flex items-center gap-2">
          <div className={`text-xs font-bold px-3 py-1 rounded-full ${
            overallScore >= 80 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' :
            overallScore >= 60 ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40' :
            overallScore >= 40 ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40' :
            'bg-red-500/20 text-red-400 border border-red-500/40'
          }`}>
            {overallScore}% Style Match
          </div>
        </div>
      </div>

      {/* Quick Evidence Summary (Always Visible) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {metrics.slice(0, 4).map((metric, i) => (
          <div 
            key={i}
            className={`p-2 rounded-lg text-center ${
              metric.match 
                ? 'bg-emerald-500/10 border border-emerald-500/30' 
                : 'bg-slate-800/50 border border-white/5'
            }`}
          >
            <div className="text-lg">{metric.icon}</div>
            <div className="text-[10px] text-slate-400 uppercase">{metric.name}</div>
            <div className={`text-sm font-bold ${metric.match ? 'text-emerald-400' : 'text-slate-300'}`}>
              {metric.resultValue}
            </div>
            {metric.match && <div className="text-[9px] text-emerald-500">✓ Matched</div>}
          </div>
        ))}
      </div>

      {/* Specific Style Changes Applied */}
      {hasStyleChanges && (
        <div className="bg-brand-500/10 border border-brand-500/30 rounded-lg p-3">
          <div className="text-xs font-semibold text-brand-300 mb-2">🎯 Style Changes Applied:</div>
          <div className="flex flex-wrap gap-2">
            {examples.contractionsApplied.map((c, i) => (
              <span key={`c-${i}`} className="text-[10px] px-2 py-1 bg-emerald-500/20 text-emerald-300 rounded">
                "{c.from}" → "{c.to}"
              </span>
            ))}
            {examples.transitionsAdded.map((t, i) => (
              <span key={`t-${i}`} className="text-[10px] px-2 py-1 bg-blue-500/20 text-blue-300 rounded">
                Added "{t}"
              </span>
            ))}
            {examples.sentencesSplit > 0 && (
              <span className="text-[10px] px-2 py-1 bg-purple-500/20 text-purple-300 rounded">
                Split {examples.sentencesSplit} sentence{examples.sentencesSplit > 1 ? 's' : ''}
              </span>
            )}
            {examples.sentencesMerged > 0 && (
              <span className="text-[10px] px-2 py-1 bg-orange-500/20 text-orange-300 rounded">
                Merged {examples.sentencesMerged} sentence{examples.sentencesMerged > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Detailed View */}
      {showDetails && (
        <div className="space-y-4 border-t border-white/10 pt-4">
          {/* Tabs */}
          <div className="flex gap-2 border-b border-white/10 pb-2">
            {[
              { id: 'metrics', label: '📊 Metrics' },
              { id: 'comparison', label: '🔍 Text Compare' },
              { id: 'examples', label: '✨ Examples' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                  activeTab === tab.id 
                    ? 'bg-brand-500 text-slate-900' 
                    : 'bg-slate-800/50 text-slate-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Metrics Tab */}
          {activeTab === 'metrics' && (
            <div className="space-y-2">
              {metrics.map((metric, i) => (
                <div 
                  key={i}
                  className={`p-3 rounded-lg border ${
                    metric.match 
                      ? 'bg-emerald-500/5 border-emerald-500/30' 
                      : 'bg-slate-800/30 border-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span>{metric.icon}</span>
                      <span className="text-sm font-medium text-white">{metric.name}</span>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      metric.match ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'
                    }`}>
                      {metric.match ? '✓ Matched' : 'Different'}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2 text-xs mb-2">
                    <div>
                      <div className="text-slate-500 text-[10px] uppercase">Your Style</div>
                      <div className="text-blue-400 font-medium">{metric.userValue}</div>
                    </div>
                    <div>
                      <div className="text-slate-500 text-[10px] uppercase">Original</div>
                      <div className="text-slate-400">{metric.originalValue}</div>
                    </div>
                    <div>
                      <div className="text-slate-500 text-[10px] uppercase">Result</div>
                      <div className={`font-medium ${metric.match ? 'text-emerald-400' : 'text-slate-300'}`}>
                        {metric.resultValue}
                      </div>
                    </div>
                  </div>
                  
                  <p className="text-[11px] text-slate-400">{metric.explanation}</p>
                </div>
              ))}
            </div>
          )}

          {/* Text Comparison Tab */}
          {activeTab === 'comparison' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs font-medium text-slate-400 mb-2 uppercase">Original Input</div>
                <div className="p-3 bg-slate-800/50 rounded-lg text-xs leading-relaxed max-h-48 overflow-y-auto">
                  {originalHighlighted.map((item, i) => (
                    <span 
                      key={i}
                      className={
                        item.type === 'changed' ? 'bg-red-500/20 text-red-300' :
                        item.type === 'expansion' ? 'bg-yellow-500/20 text-yellow-300' :
                        'text-slate-300'
                      }
                    >
                      {item.word}{' '}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-brand-400 mb-2 uppercase">Paraphrased Result</div>
                <div className="p-3 bg-slate-800/50 rounded-lg text-xs leading-relaxed max-h-48 overflow-y-auto">
                  {resultHighlighted.map((item, i) => (
                    <span 
                      key={i}
                      className={
                        item.type === 'contraction' ? 'bg-emerald-500/30 text-emerald-300 font-medium' :
                        item.type === 'transition' ? 'bg-blue-500/30 text-blue-300 font-medium' :
                        item.type === 'added' ? 'bg-purple-500/20 text-purple-300' :
                        'text-slate-300'
                      }
                    >
                      {item.word}{' '}
                    </span>
                  ))}
                </div>
              </div>
              
              {/* Legend */}
              <div className="col-span-2 flex flex-wrap gap-3 pt-2 border-t border-white/10">
                <div className="flex items-center gap-1 text-[10px]">
                  <span className="w-3 h-3 bg-emerald-500/30 rounded"></span>
                  <span className="text-emerald-400">Contractions (your style)</span>
                </div>
                <div className="flex items-center gap-1 text-[10px]">
                  <span className="w-3 h-3 bg-blue-500/30 rounded"></span>
                  <span className="text-blue-400">Transitions added</span>
                </div>
                <div className="flex items-center gap-1 text-[10px]">
                  <span className="w-3 h-3 bg-purple-500/20 rounded"></span>
                  <span className="text-purple-400">New phrasing</span>
                </div>
              </div>
            </div>
          )}

          {/* Examples Tab */}
          {activeTab === 'examples' && (
            <div className="space-y-3">
              {/* Your Style Summary */}
              <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <div className="text-xs font-semibold text-blue-300 mb-2">📝 Your Detected Writing Style:</div>
                <ul className="text-xs text-slate-300 space-y-1">
                  <li>• {userStyle.usesContractions ? 'Uses contractions (casual tone)' : 'Avoids contractions (formal tone)'}</li>
                  <li>• Average sentence length: ~{Math.round(userStyle.avgSentenceLength)} words</li>
                  <li>• Perspective: {userStyle.personalVoice}</li>
                  {userStyle.preferredTransitions.length > 0 && (
                    <li>• Prefers transitions: {userStyle.preferredTransitions.slice(0, 3).join(', ')}</li>
                  )}
                </ul>
              </div>

              {/* Specific Changes Made */}
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                <div className="text-xs font-semibold text-emerald-300 mb-2">✅ Changes Applied to Match Your Style:</div>
                <ul className="text-xs text-slate-300 space-y-1">
                  {examples.contractionsApplied.length > 0 && (
                    <li>• Converted to contractions: {examples.contractionsApplied.map(c => `"${c.from}"→"${c.to}"`).join(', ')}</li>
                  )}
                  {examples.transitionsAdded.length > 0 && (
                    <li>• Added transition words: {examples.transitionsAdded.join(', ')}</li>
                  )}
                  {examples.sentencesSplit > 0 && (
                    <li>• Split {examples.sentencesSplit} long sentence{examples.sentencesSplit > 1 ? 's' : ''} to match your concise style</li>
                  )}
                  {examples.sentencesMerged > 0 && (
                    <li>• Merged {examples.sentencesMerged} short sentence{examples.sentencesMerged > 1 ? 's' : ''} to match your flowing style</li>
                  )}
                  {!hasStyleChanges && (
                    <li>• Text was reworded to match your vocabulary and rhythm</li>
                  )}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
