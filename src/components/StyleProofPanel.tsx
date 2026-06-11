'use client';

import { useMemo, useState } from 'react';
import { type SampleStyle } from '../lib/paraphrase';

interface VerificationData {
  score: number;
  passed: boolean;
  issues: { type: string; severity: string; description: string }[];
  styleBreakdown?: {
    contractions: { match: boolean; score: number };
    sentenceLength: { match: boolean; score: number; diff: number };
    vocabulary: { match: boolean; score: number };
    transitions: { match: boolean; score: number };
  };
}

interface StyleProofPanelProps {
  userSampleText: string;
  originalInput: string;
  paraphrasedOutput: string;
  userStyle: SampleStyle;
  verification?: VerificationData | null;
}

interface StyleEvidence {
  category: string;
  icon: string;
  userValue: string;
  userExamples: string[];
  resultValue: string;
  resultExamples: string[];
  match: 'perfect' | 'good' | 'partial' | 'none';
  explanation: string;
}

interface DirectEvidence {
  type: 'phrase' | 'pattern' | 'word';
  fromEssay: string;
  inOutput: string;
  description: string;
}

/**
 * Find direct evidence of style transfer - patterns from user's essay applied to output
 */
function findDirectEvidence(userSample: string, output: string): DirectEvidence[] {
  const evidence: DirectEvidence[] = [];
  
  // 1. Check for matching sentence patterns (short vs long)
  const userSentences = userSample.split(/[.!?]+/).filter(s => s.trim().length > 10);
  const outputSentences = output.split(/[.!?]+/).filter(s => s.trim().length > 10);
  
  if (userSentences.length > 0 && outputSentences.length > 0) {
    const userAvgLen = userSentences.reduce((sum, s) => sum + s.split(/\s+/).length, 0) / userSentences.length;
    const outputAvgLen = outputSentences.reduce((sum, s) => sum + s.split(/\s+/).length, 0) / outputSentences.length;
    const diff = Math.abs(userAvgLen - outputAvgLen);
    
    const sentenceStyle = userAvgLen < 15 ? 'Short & concise' : userAvgLen < 25 ? 'Medium length' : 'Detailed & elaborate';
    
    if (diff < 8) {
      evidence.push({
        type: 'pattern',
        fromEssay: `Your style: ${sentenceStyle} (~${Math.round(userAvgLen)} words)`,
        inOutput: `Applied: ${Math.round(outputAvgLen)} words per sentence`,
        description: `Sentence structure matched your writing pattern`
      });
    }
  }
  
  // 2. Check vocabulary level match (simple vs academic)
  const simpleWords = /\b(good|bad|big|small|very|really|thing|stuff|lot|make|get|put|use|way)\b/gi;
  const academicWords = /\b(significant|substantial|fundamental|comprehensive|considerable|demonstrate|indicate|facilitate|implement|establish|maintain|enhance)\b/gi;
  
  const userSimple = (userSample.match(simpleWords) || []).length;
  const userAcademic = (userSample.match(academicWords) || []).length;
  const outputSimple = (output.match(simpleWords) || []).length;
  const outputAcademic = (output.match(academicWords) || []).length;
  
  const userVocabLevel = userAcademic > userSimple ? 'academic' : 'conversational';
  const outputVocabLevel = outputAcademic > outputSimple ? 'academic' : 'conversational';
  
  if (userVocabLevel === outputVocabLevel) {
    evidence.push({
      type: 'pattern',
      fromEssay: `Your vocabulary: ${userVocabLevel === 'academic' ? 'Academic & formal' : 'Natural & conversational'}`,
      inOutput: `Applied: ${outputVocabLevel === 'academic' ? 'Academic tone' : 'Conversational tone'}`,
      description: `Vocabulary level matched your writing style`
    });
  }
  
  // 3. Check contraction style match
  const userContractions = (userSample.match(/\b(don't|won't|can't|isn't|aren't|wasn't|weren't|I'm|you're|it's|that's|there's|we're|they're|I've|I'll|I'd)\b/gi) || []).length;
  const userExpanded = (userSample.match(/\b(do not|will not|cannot|is not|are not|was not|were not|I am|you are|it is|that is|there is|we are|they are|I have|I will|I would)\b/gi) || []).length;
  const outputContractions = (output.match(/\b(don't|won't|can't|isn't|aren't|wasn't|weren't|I'm|you're|it's|that's|there's|we're|they're|I've|I'll|I'd)\b/gi) || []).length;
  const outputExpanded = (output.match(/\b(do not|will not|cannot|is not|are not|was not|were not|I am|you are|it is|that is|there is|we are|they are|I have|I will|I would)\b/gi) || []).length;
  
  const userUsesContractions = userContractions > userExpanded;
  const outputUsesContractions = outputContractions > outputExpanded;
  
  if (userContractions + userExpanded > 0 && userUsesContractions === outputUsesContractions) {
    evidence.push({
      type: 'pattern',
      fromEssay: userUsesContractions ? `Your style: Uses contractions (casual)` : `Your style: Formal language`,
      inOutput: outputUsesContractions ? `Applied: Casual contractions` : `Applied: Formal expressions`,
      description: userUsesContractions ? 'Casual contraction style matched' : 'Formal writing style matched'
    });
  }
  
  // 4. Check transition word usage pattern
  const transitions = ['however', 'therefore', 'moreover', 'furthermore', 'additionally', 'consequently', 'nevertheless', 'thus', 'hence', 'meanwhile', 'besides', 'similarly', 'likewise'];
  const userHasTransitions = transitions.some(t => userSample.toLowerCase().includes(t));
  const outputHasTransitions = transitions.some(t => output.toLowerCase().includes(t));
  
  if (userHasTransitions && outputHasTransitions) {
    evidence.push({
      type: 'pattern',
      fromEssay: `Your style: Uses connecting words`,
      inOutput: `Applied: Logical connectors added`,
      description: 'Transition word pattern matched your style'
    });
  } else if (!userHasTransitions && !outputHasTransitions) {
    evidence.push({
      type: 'pattern',
      fromEssay: `Your style: Direct flow (minimal connectors)`,
      inOutput: `Applied: Natural flow maintained`,
      description: 'Minimal transition style matched'
    });
  }
  
  return evidence;
}

/**
 * Count contractions in text
 */
function countContractions(text: string): { count: number; examples: string[] } {
  const matches = text.match(/\b(don't|won't|can't|isn't|aren't|wasn't|weren't|haven't|hasn't|hadn't|I'm|you're|he's|she's|it's|we're|they're|I've|you've|we've|they've|I'll|you'll|we'll|they'll|I'd|you'd|he'd|she'd|we'd|they'd|couldn't|wouldn't|shouldn't|didn't|doesn't|that's|there's|here's|what's|let's)\b/gi) || [];
  return {
    count: matches.length,
    examples: [...new Set(matches.map(m => m.toLowerCase()))].slice(0, 4)
  };
}

/**
 * Count expanded forms (formal) in text
 */
function countExpanded(text: string): { count: number; examples: string[] } {
  const matches = text.match(/\b(do not|will not|can not|cannot|is not|are not|was not|were not|have not|has not|had not|I am|you are|he is|she is|it is|we are|they are|I have|you have|we have|they have|I will|you will|we will|they will|could not|would not|should not|did not|does not)\b/gi) || [];
  return {
    count: matches.length,
    examples: [...new Set(matches.map(m => m.toLowerCase()))].slice(0, 4)
  };
}

/**
 * Calculate average sentence length
 */
function getSentenceStats(text: string): { avg: number; count: number; examples: string[] } {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 5);
  if (sentences.length === 0) return { avg: 0, count: 0, examples: [] };
  
  const wordCounts = sentences.map(s => s.trim().split(/\s+/).length);
  const avg = wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length;
  
  // Get example sentences
  const examples = sentences.slice(0, 2).map(s => {
    const trimmed = s.trim();
    return trimmed.length > 60 ? trimmed.substring(0, 60) + '...' : trimmed;
  });
  
  return { avg, count: sentences.length, examples };
}

/**
 * Detect vocabulary complexity
 */
function getVocabularyLevel(text: string): { level: 'simple' | 'moderate' | 'advanced'; avgWordLength: number; examples: string[] } {
  const words = text.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
  if (words.length === 0) return { level: 'moderate', avgWordLength: 0, examples: [] };
  
  const avgWordLength = words.reduce((sum, w) => sum + w.length, 0) / words.length;
  const longWords = words.filter(w => w.length >= 8);
  const complexRatio = longWords.length / words.length;
  
  let level: 'simple' | 'moderate' | 'advanced' = 'moderate';
  if (complexRatio > 0.2 || avgWordLength > 6) {
    level = 'advanced';
  } else if (complexRatio < 0.08 && avgWordLength < 5) {
    level = 'simple';
  }
  
  const examples = [...new Set(longWords)].slice(0, 4);
  return { level, avgWordLength, examples };
}

/**
 * Detect transitions used
 */
function getTransitions(text: string): string[] {
  const transitionPattern = /\b(However|Therefore|Moreover|Furthermore|Additionally|Consequently|Nevertheless|Thus|Hence|Meanwhile|In addition|On the other hand|As a result|For example|In contrast|Similarly|Also|Besides|Actually|Basically)\b/gi;
  const matches = text.match(transitionPattern) || [];
  return [...new Set(matches.map(m => m.toLowerCase()))].slice(0, 5);
}

export default function StyleProofPanel({ userSampleText, originalInput, paraphrasedOutput, userStyle, verification }: StyleProofPanelProps) {
  
  const evidence = useMemo<StyleEvidence[]>(() => {
    const proofs: StyleEvidence[] = [];
    
    // 1. CONTRACTIONS
    const userContractions = countContractions(userSampleText);
    const userExpanded = countExpanded(userSampleText);
    const resultContractions = countContractions(paraphrasedOutput);
    const resultExpanded = countExpanded(paraphrasedOutput);
    
    const userUsesContractions = userContractions.count > userExpanded.count;
    const resultUsesContractions = resultContractions.count > resultExpanded.count;
    // Use server verification if available, otherwise calculate locally
    const contractionsMatch = verification?.styleBreakdown?.contractions?.match ?? (userUsesContractions === resultUsesContractions);
    
    proofs.push({
      category: 'Contractions',
      icon: '✍️',
      userValue: userUsesContractions 
        ? `Uses contractions (${userContractions.count} found)`
        : `Formal style (${userExpanded.count} expanded forms)`,
      userExamples: userUsesContractions ? userContractions.examples : userExpanded.examples,
      resultValue: resultUsesContractions
        ? `Uses contractions (${resultContractions.count} found)`
        : `Formal style (${resultExpanded.count} expanded forms)`,
      resultExamples: resultUsesContractions ? resultContractions.examples : resultExpanded.examples,
      match: contractionsMatch ? 'perfect' : 'none',
      explanation: contractionsMatch 
        ? 'Contraction style matches your writing!'
        : 'Contraction style differs from your sample.'
    });
    
    // 2. SENTENCE LENGTH
    const userSentences = getSentenceStats(userSampleText);
    const resultSentences = getSentenceStats(paraphrasedOutput);
    const lengthDiff = verification?.styleBreakdown?.sentenceLength?.diff ?? Math.abs(userSentences.avg - resultSentences.avg);
    const sentenceLengthMatch = verification?.styleBreakdown?.sentenceLength?.match ?? (lengthDiff < 8);
    const lengthMatch = lengthDiff < 5 ? 'perfect' : lengthDiff < 8 ? 'good' : lengthDiff < 12 ? 'partial' : 'none';
    
    proofs.push({
      category: 'Sentence Length',
      icon: '📏',
      userValue: `Avg ${Math.round(userSentences.avg)} words/sentence`,
      userExamples: userSentences.examples.length ? userSentences.examples : ['No examples available'],
      resultValue: `Avg ${Math.round(resultSentences.avg)} words/sentence`,
      resultExamples: resultSentences.examples.length ? resultSentences.examples : ['No examples available'],
      match: lengthMatch,
      explanation: sentenceLengthMatch 
        ? `Sentence length matches! (diff: ${Math.round(lengthDiff)} words)`
        : `Sentence length differs by ${Math.round(lengthDiff)} words`
    });
    
    // 3. VOCABULARY COMPLEXITY
    const userVocab = getVocabularyLevel(userSampleText);
    const resultVocab = getVocabularyLevel(paraphrasedOutput);
    const vocabMatch = verification?.styleBreakdown?.vocabulary?.match ?? (userVocab.level === resultVocab.level);
    
    proofs.push({
      category: 'Vocabulary Level',
      icon: '📚',
      userValue: `${userVocab.level.charAt(0).toUpperCase() + userVocab.level.slice(1)} (avg ${userVocab.avgWordLength.toFixed(1)} chars)`,
      userExamples: userVocab.examples.length ? userVocab.examples : ['Standard vocabulary'],
      resultValue: `${resultVocab.level.charAt(0).toUpperCase() + resultVocab.level.slice(1)} (avg ${resultVocab.avgWordLength.toFixed(1)} chars)`,
      resultExamples: resultVocab.examples.length ? resultVocab.examples : ['Standard vocabulary'],
      match: vocabMatch ? 'perfect' : 'partial',
      explanation: vocabMatch 
        ? `Vocabulary complexity matches your style!`
        : `Vocabulary level slightly different from your sample`
    });
    
    // 4. TRANSITIONS
    const userTransitions = getTransitions(userSampleText);
    const resultTransitions = getTransitions(paraphrasedOutput);
    const userUsesTransitions = userTransitions.length >= 2;
    const resultUsesTransitions = resultTransitions.length >= 2;
    const transitionMatch = verification?.styleBreakdown?.transitions?.match ?? (userUsesTransitions === resultUsesTransitions);
    
    proofs.push({
      category: 'Transition Words',
      icon: '🔗',
      userValue: userUsesTransitions 
        ? `Uses transitions (${userTransitions.length} found)`
        : 'Minimal transitions',
      userExamples: userTransitions.length ? userTransitions : ['Direct flow'],
      resultValue: resultUsesTransitions
        ? `Uses transitions (${resultTransitions.length} found)`
        : 'Minimal transitions',
      resultExamples: resultTransitions.length ? resultTransitions : ['Direct flow'],
      match: transitionMatch ? 'good' : 'partial',
      explanation: transitionMatch 
        ? 'Transition usage matches your style!'
        : 'Transition style slightly different'
    });
    
    return proofs;
  }, [userSampleText, paraphrasedOutput, verification]);
  
  // Find direct evidence of style transfer
  const directEvidence = useMemo(() => {
    return findDirectEvidence(userSampleText, paraphrasedOutput);
  }, [userSampleText, paraphrasedOutput]);
  
  // Use server verification score if available, otherwise calculate locally
  const overallMatch = useMemo(() => {
    if (verification?.score !== undefined) {
      return verification.score / 100;
    }
    const scores: number[] = evidence.map(e => {
      switch (e.match) {
        case 'perfect': return 1;
        case 'good': return 0.75;
        case 'partial': return 0.5;
        default: return 0;
      }
    });
    return scores.reduce((a: number, b: number) => a + b, 0) / scores.length;
  }, [evidence, verification]);
  
  const matchedCount = evidence.filter(e => e.match === 'perfect' || e.match === 'good').length;
  const passed = verification?.passed ?? overallMatch >= 0.7;
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="space-y-4">
      {/* Header with Overall Score */}
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-brand-600 dark:text-brand-300 flex items-center gap-2 text-sm sm:text-base">
          <span className="text-lg">🔍</span> Style Application Proof
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-600 dark:text-slate-500 dark:text-slate-400">{matchedCount}/{evidence.length} matched</span>
          {passed ? (
            <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Verified
            </span>
          ) : null}
          <span className={`text-sm font-bold px-2 py-0.5 rounded ${
            overallMatch >= 0.7 ? 'bg-emerald-500/20 text-emerald-400' :
            overallMatch >= 0.5 ? 'bg-blue-500/20 text-blue-400' :
            overallMatch >= 0.3 ? 'bg-yellow-500/20 text-yellow-400' :
            'bg-red-500/20 text-red-400'
          }`}>
            {Math.round(overallMatch * 100)}%
          </span>
        </div>
      </div>
      
      {/* Direct Evidence Section - Shows concrete proof from user's essay */}
      {directEvidence.length > 0 && (
        <div className="rounded-lg border border-brand-500/40 bg-brand-500/5 p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-brand-600 dark:text-brand-300 flex items-center gap-1">
              📋 Direct Evidence from Your Essay
            </p>
            <span className="text-[10px] px-2 py-0.5 rounded bg-brand-500/20 text-brand-600 dark:text-brand-300">
              {directEvidence.length} patterns matched
            </span>
          </div>
          <div className="space-y-2">
            {directEvidence.map((ev, idx) => (
              <div key={idx} className="grid grid-cols-2 gap-2 text-xs bg-white dark:bg-slate-900/50 rounded p-2">
                <div>
                  <p className="text-[10px] uppercase text-slate-600 dark:text-slate-500 mb-0.5">From Your Essay</p>
                  <p className="text-emerald-300">{ev.fromEssay}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-slate-600 dark:text-slate-500 mb-0.5">Applied to Result</p>
                  <p className="text-brand-600 dark:text-brand-300">{ev.inOutput}</p>
                </div>
                <p className="col-span-2 text-[10px] text-slate-600 dark:text-slate-500 dark:text-slate-400 border-t border-white/5 pt-1 mt-1">
                  ✓ {ev.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Show/Hide Details Button */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="w-full text-xs text-slate-600 dark:text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white py-2 flex items-center justify-center gap-1 transition-colors"
      >
        {showDetails ? (
          <>Hide Detailed Breakdown <span className="text-lg">▲</span></>
        ) : (
          <>Show Detailed Breakdown <span className="text-lg">▼</span></>
        )}
      </button>
      
      {/* Verification Issues */}
      {verification && verification.issues.length > 0 && !verification.passed && showDetails && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
          <p className="text-xs font-medium text-amber-300 mb-2">⚠️ Areas for Improvement</p>
          <ul className="space-y-1 text-xs text-slate-800 dark:text-slate-300">
            {verification.issues.slice(0, 3).map((issue, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-amber-400">•</span>
                <span>{issue.description}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {/* Evidence Cards - Only show when expanded */}
      {showDetails && (
      <div className="space-y-3">
        {evidence.map((item, index) => (
          <div 
            key={index}
            className={`rounded-lg border overflow-hidden ${
              item.match === 'perfect' ? 'border-emerald-500/40 bg-emerald-500/5' :
              item.match === 'good' ? 'border-blue-500/40 bg-blue-500/5' :
              item.match === 'partial' ? 'border-yellow-500/40 bg-yellow-500/5' :
              'border-red-500/40 bg-red-500/5'
            }`}
          >
            {/* Category Header */}
            <div className={`px-3 py-2 flex items-center justify-between ${
              item.match === 'perfect' ? 'bg-emerald-500/10' :
              item.match === 'good' ? 'bg-blue-500/10' :
              item.match === 'partial' ? 'bg-yellow-500/10' :
              'bg-red-500/10'
            }`}>
              <div className="flex items-center gap-2">
                <span>{item.icon}</span>
                <span className="font-medium text-slate-900 dark:text-white text-sm">{item.category}</span>
              </div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                item.match === 'perfect' ? 'bg-emerald-500/20 text-emerald-400' :
                item.match === 'good' ? 'bg-blue-500/20 text-blue-400' :
                item.match === 'partial' ? 'bg-yellow-500/20 text-yellow-400' :
                'bg-red-500/20 text-red-400'
              }`}>
                {item.match === 'perfect' ? '✓ Match' :
                 item.match === 'good' ? '✓ Good' :
                 item.match === 'partial' ? '◐ Partial' :
                 '✗ Diff'}
              </span>
            </div>
            
            {/* Side by Side Comparison */}
            <div className="grid grid-cols-2 divide-x divide-white/10">
              {/* Your Style */}
              <div className="p-3 space-y-2">
                <div className="text-[10px] uppercase tracking-wide text-slate-600 dark:text-slate-500 dark:text-slate-400 font-medium">Your Style</div>
                <p className="text-xs text-slate-800 dark:text-slate-300 font-medium">{item.userValue}</p>
                {item.userExamples.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {item.userExamples.map((ex, i) => (
                      <span key={i} className="text-[10px] px-1.5 py-0.5 bg-slate-50 dark:bg-slate-800/70 rounded text-slate-600 dark:text-slate-500 dark:text-slate-400">
                        {ex}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Result */}
              <div className="p-3 space-y-2">
                <div className="text-[10px] uppercase tracking-wide text-brand-600 dark:text-brand-400 font-medium">Result</div>
                <p className="text-xs text-slate-800 dark:text-slate-300 font-medium">{item.resultValue}</p>
                {item.resultExamples.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {item.resultExamples.map((ex, i) => (
                      <span key={i} className={`text-[10px] px-1.5 py-0.5 rounded ${
                        item.match === 'perfect' || item.match === 'good'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-500 dark:text-slate-400'
                      }`}>
                        {ex}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            {/* Explanation */}
            <div className="px-3 py-2 bg-black/20 border-t border-white/5">
              <p className="text-[10px] text-slate-600 dark:text-slate-500 dark:text-slate-400">{item.explanation}</p>
            </div>
          </div>
        ))}
      </div>
      )}
      
      {/* Summary */}
      <div className={`rounded-lg p-3 ${
        overallMatch >= 0.7 ? 'bg-emerald-500/10 border border-emerald-500/30' :
        overallMatch >= 0.5 ? 'bg-blue-500/10 border border-blue-500/30' :
        'bg-yellow-500/10 border border-yellow-500/30'
      }`}>
        <p className="text-xs text-slate-800 dark:text-slate-300">
          {overallMatch >= 0.7 ? (
            <><span className="text-emerald-400 font-medium">✓ Great style match!</span> The output closely follows your writing patterns.</>
          ) : overallMatch >= 0.5 ? (
            <><span className="text-blue-400 font-medium">◐ Good match.</span> Most style patterns were applied correctly.</>
          ) : (
            <><span className="text-yellow-400 font-medium">⚠ Partial match.</span> Try providing more writing samples for better results.</>
          )}
        </p>
      </div>
    </div>
  );
}
