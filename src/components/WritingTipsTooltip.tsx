"use client";
import { useState, useRef, useEffect, useMemo } from 'react';
import { Lightbulb, X, ChevronDown, ChevronUp, AlertCircle, CheckCircle } from 'lucide-react';

interface WritingTipsTooltipProps {
  profileEssay: string;
  profileName?: string;
}

interface WritingIssue {
  type: 'warning' | 'suggestion' | 'improvement';
  title: string;
  description: string;
  examples?: string[];
}

// Analyze the essay and generate personalized tips
function analyzeEssay(essay: string): { issues: WritingIssue[]; metrics: { wordCount: number; sentenceCount: number; avgSentenceLength: number; readabilityScore: string } } {
  if (!essay || essay.trim().length < 20) {
    return { 
      issues: [], 
      metrics: { wordCount: 0, sentenceCount: 0, avgSentenceLength: 0, readabilityScore: 'N/A' } 
    };
  }

  const words = essay.split(/\s+/).filter(w => w.length > 0);
  const sentences = essay.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const wordCount = words.length;
  const sentenceCount = sentences.length;
  const avgSentenceLength = sentenceCount > 0 ? Math.round(wordCount / sentenceCount) : 0;
  
  // Calculate readability (simple Flesch-Kincaid approximation)
  const syllableCount = words.reduce((acc, word) => acc + countSyllables(word), 0);
  const avgSyllablesPerWord = wordCount > 0 ? syllableCount / wordCount : 0;
  let readabilityScore = 'Moderate';
  if (avgSentenceLength < 15 && avgSyllablesPerWord < 1.5) readabilityScore = 'Easy';
  else if (avgSentenceLength > 25 || avgSyllablesPerWord > 2) readabilityScore = 'Complex';

  const issues: WritingIssue[] = [];
  const lowerEssay = essay.toLowerCase();

  // Check for filler words
  const fillerWords = ['very', 'really', 'just', 'basically', 'actually', 'literally', 'simply', 'quite'];
  const foundFillers = fillerWords.filter(w => lowerEssay.includes(w));
  if (foundFillers.length > 0) {
    issues.push({
      type: 'suggestion',
      title: 'Remove Filler Words',
      description: 'Your essay contains filler words that weaken your writing.',
      examples: foundFillers.map(w => `Consider removing or replacing "${w}"`)
    });
  }

  // Check for passive voice indicators
  const passiveIndicators = ['was ', 'were ', 'is being', 'was being', 'has been', 'have been', 'will be'];
  const hasPassive = passiveIndicators.some(p => lowerEssay.includes(p));
  if (hasPassive) {
    issues.push({
      type: 'suggestion',
      title: 'Consider Active Voice',
      description: 'Some sentences may use passive voice. Active voice is often clearer and more engaging.',
      examples: ['"The report was written by me" → "I wrote the report"']
    });
  }

  // Check sentence length variety
  const sentenceLengths = sentences.map(s => s.split(/\s+/).filter(w => w.length > 0).length);
  const allSimilar = sentenceLengths.length > 2 && 
    sentenceLengths.every(len => Math.abs(len - avgSentenceLength) < 5);
  if (allSimilar) {
    issues.push({
      type: 'improvement',
      title: 'Vary Sentence Length',
      description: 'Your sentences are similar in length. Mix short and long sentences for better rhythm.',
      examples: ['Short sentences create impact.', 'Longer sentences can elaborate on complex ideas and provide detailed explanations.']
    });
  }

  // Check for repetitive sentence starters
  const starters = sentences.map(s => s.trim().split(/\s+/)[0]?.toLowerCase()).filter(Boolean);
  const starterCounts: Record<string, number> = {};
  starters.forEach(s => { starterCounts[s] = (starterCounts[s] || 0) + 1; });
  const repetitiveStarters = Object.entries(starterCounts).filter(([_, count]) => count >= 3);
  if (repetitiveStarters.length > 0) {
    issues.push({
      type: 'warning',
      title: 'Repetitive Sentence Starters',
      description: 'Multiple sentences start with the same word.',
      examples: repetitiveStarters.map(([word, count]) => `"${word}" starts ${count} sentences`)
    });
  }

  // Check for weak phrases
  const weakPhrases = ['in order to', 'due to the fact that', 'at this point in time', 'in the event that'];
  const foundWeak = weakPhrases.filter(p => lowerEssay.includes(p));
  if (foundWeak.length > 0) {
    issues.push({
      type: 'suggestion',
      title: 'Simplify Phrases',
      description: 'Your essay contains wordy phrases that can be simplified.',
      examples: [
        '"in order to" → "to"',
        '"due to the fact that" → "because"',
        '"at this point in time" → "now"'
      ]
    });
  }

  // Check word repetition
  const wordCounts: Record<string, number> = {};
  const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'is', 'it', 'that', 'this', 'with', 'as', 'be', 'are', 'was', 'were', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'i', 'you', 'he', 'she', 'we', 'they', 'my', 'your', 'his', 'her', 'our', 'their']);
  words.forEach(w => {
    const lower = w.toLowerCase().replace(/[^a-z]/g, '');
    if (lower.length > 3 && !commonWords.has(lower)) {
      wordCounts[lower] = (wordCounts[lower] || 0) + 1;
    }
  });
  const overusedWords = Object.entries(wordCounts).filter(([_, count]) => count >= 4);
  if (overusedWords.length > 0) {
    issues.push({
      type: 'improvement',
      title: 'Word Variety',
      description: 'Some words appear frequently. Consider using synonyms.',
      examples: overusedWords.slice(0, 3).map(([word, count]) => `"${word}" appears ${count} times`)
    });
  }

  // Add positive feedback if few issues
  if (issues.length === 0) {
    issues.push({
      type: 'improvement',
      title: 'Well Written!',
      description: 'Your essay follows good writing practices. Keep up the excellent work!',
      examples: ['Clear sentence structure', 'Good vocabulary variety', 'Appropriate sentence length']
    });
  }

  return { issues, metrics: { wordCount, sentenceCount, avgSentenceLength, readabilityScore } };
}

function countSyllables(word: string): number {
  word = word.toLowerCase().replace(/[^a-z]/g, '');
  if (word.length <= 3) return 1;
  const vowels = 'aeiouy';
  let count = 0;
  let prevWasVowel = false;
  for (const char of word) {
    const isVowel = vowels.includes(char);
    if (isVowel && !prevWasVowel) count++;
    prevWasVowel = isVowel;
  }
  if (word.endsWith('e')) count--;
  return Math.max(1, count);
}

export default function WritingTipsTooltip({ profileEssay, profileName }: WritingTipsTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedIssues, setExpandedIssues] = useState<Set<number>>(new Set());
  const popoverRef = useRef<HTMLDivElement>(null);

  const analysis = useMemo(() => analyzeEssay(profileEssay), [profileEssay]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const toggleIssue = (index: number) => {
    setExpandedIssues(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) newSet.delete(index);
      else newSet.add(index);
      return newSet;
    });
  };

  const getIssueIcon = (type: WritingIssue['type']) => {
    switch (type) {
      case 'warning': return <AlertCircle className="w-4 h-4 text-amber-400" />;
      case 'suggestion': return <Lightbulb className="w-4 h-4 text-blue-400" />;
      case 'improvement': return <CheckCircle className="w-4 h-4 text-emerald-400" />;
    }
  };

  const getIssueBg = (type: WritingIssue['type']) => {
    switch (type) {
      case 'warning': return 'bg-amber-500/10 border-amber-500/30';
      case 'suggestion': return 'bg-blue-500/10 border-blue-500/30';
      case 'improvement': return 'bg-emerald-500/10 border-emerald-500/30';
    }
  };

  if (!profileEssay || profileEssay.trim().length < 20) {
    return null;
  }

  return (
    <div className="relative inline-block" ref={popoverRef}>
      {/* Bulb Icon Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={() => !isOpen && setIsOpen(true)}
        className={`p-2 rounded-lg transition-all ${
          isOpen 
            ? 'bg-yellow-500/20 text-yellow-400 ring-2 ring-yellow-500/30' 
            : 'bg-slate-700/50 text-slate-400 hover:bg-yellow-500/10 hover:text-yellow-400'
        }`}
        title="Writing Tips"
      >
        <Lightbulb className="w-5 h-5" />
      </button>

      {/* Popover */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-[420px] max-h-[70vh] overflow-hidden rounded-xl bg-slate-800 border border-white/10 shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Header */}
          <div className="sticky top-0 bg-slate-800 border-b border-white/10 p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-yellow-400" />
              <span className="font-semibold text-white">Writing Tips</span>
              {profileName && (
                <span className="text-xs text-slate-400">({profileName})</span>
              )}
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="overflow-y-auto max-h-[calc(70vh-60px)]">
            {/* Essay Preview */}
            <div className="p-4 border-b border-white/5">
              <p className="text-xs font-medium text-slate-400 mb-2">Your Profile Essay</p>
              <div className="bg-slate-900/50 rounded-lg p-3 max-h-32 overflow-y-auto">
                <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
                  {profileEssay.length > 500 ? profileEssay.slice(0, 500) + '...' : profileEssay}
                </p>
              </div>
            </div>

            {/* Metrics */}
            <div className="px-4 py-3 bg-slate-900/30 grid grid-cols-4 gap-2 text-center border-b border-white/5">
              <div>
                <p className="text-lg font-bold text-white">{analysis.metrics.wordCount}</p>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide">Words</p>
              </div>
              <div>
                <p className="text-lg font-bold text-white">{analysis.metrics.sentenceCount}</p>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide">Sentences</p>
              </div>
              <div>
                <p className="text-lg font-bold text-white">{analysis.metrics.avgSentenceLength}</p>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide">Avg Length</p>
              </div>
              <div>
                <p className={`text-lg font-bold ${
                  analysis.metrics.readabilityScore === 'Easy' ? 'text-emerald-400' :
                  analysis.metrics.readabilityScore === 'Complex' ? 'text-amber-400' : 'text-blue-400'
                }`}>{analysis.metrics.readabilityScore}</p>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide">Readability</p>
              </div>
            </div>

            {/* Issues & Tips */}
            <div className="p-4 space-y-3">
              <p className="text-xs font-medium text-slate-400 mb-2">
                Analysis & Suggestions ({analysis.issues.length})
              </p>
              {analysis.issues.map((issue, index) => (
                <div 
                  key={index}
                  className={`rounded-lg border p-3 ${getIssueBg(issue.type)}`}
                >
                  <button
                    onClick={() => toggleIssue(index)}
                    className="w-full flex items-center justify-between text-left"
                  >
                    <div className="flex items-center gap-2">
                      {getIssueIcon(issue.type)}
                      <span className="text-sm font-medium text-white">{issue.title}</span>
                    </div>
                    {expandedIssues.has(index) 
                      ? <ChevronUp className="w-4 h-4 text-slate-400" />
                      : <ChevronDown className="w-4 h-4 text-slate-400" />
                    }
                  </button>
                  
                  {expandedIssues.has(index) && (
                    <div className="mt-3 pt-3 border-t border-white/10 space-y-2">
                      <p className="text-xs text-slate-300">{issue.description}</p>
                      {issue.examples && issue.examples.length > 0 && (
                        <ul className="space-y-1">
                          {issue.examples.map((ex, i) => (
                            <li key={i} className="text-xs text-slate-400 flex items-start gap-2">
                              <span className="text-slate-500 mt-0.5">•</span>
                              <span>{ex}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
