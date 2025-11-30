'use client';

import { useMemo } from 'react';
import { type SampleStyle } from '../lib/paraphrase';

interface StyleProofPanelProps {
  userSampleText: string;
  originalInput: string;
  paraphrasedOutput: string;
  userStyle: SampleStyle;
}

interface StyleEvidence {
  category: string;
  icon: string;
  yourStyle: {
    description: string;
    examples: string[];
  };
  inResult: {
    description: string;
    examples: string[];
    found: boolean;
  };
  match: 'perfect' | 'good' | 'partial' | 'none';
}

/**
 * Extract actual examples from text for proof
 */
function extractContractions(text: string): string[] {
  const contractions = text.match(/\b(don't|won't|can't|isn't|aren't|wasn't|weren't|haven't|hasn't|hadn't|I'm|you're|he's|she's|it's|we're|they're|I've|you've|we've|they've|I'll|you'll|we'll|they'll|I'd|you'd|he'd|she'd|we'd|they'd|couldn't|wouldn't|shouldn't|didn't|doesn't|that's|there's|here's|what's|let's)\b/gi) || [];
  return [...new Set(contractions)].slice(0, 5);
}

function extractExpandedForms(text: string): string[] {
  const expanded = text.match(/\b(do not|will not|can not|cannot|is not|are not|was not|were not|have not|has not|had not|I am|you are|he is|she is|it is|we are|they are|I have|you have|we have|they have|I will|you will|we will|they will|I would|could not|would not|should not|did not|does not)\b/gi) || [];
  return [...new Set(expanded)].slice(0, 5);
}

function extractTransitions(text: string): string[] {
  const transitionPattern = /\b(However|Therefore|Moreover|Furthermore|Additionally|Consequently|Nevertheless|Thus|Hence|Meanwhile|In addition|On the other hand|As a result|For example|In contrast|Similarly|Specifically|Indeed|In fact|Actually|Basically|Essentially)\b/gi;
  const matches = text.match(transitionPattern) || [];
  return [...new Set(matches.map(m => m.toLowerCase()))].slice(0, 5);
}

function extractSentenceLengths(text: string): { short: string[], long: string[], avg: number } {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 5);
  const withLengths = sentences.map(s => ({ text: s.trim(), words: s.trim().split(/\s+/).length }));
  const avg = withLengths.reduce((sum, s) => sum + s.words, 0) / withLengths.length || 0;
  
  const short = withLengths.filter(s => s.words < 10).slice(0, 2).map(s => s.text.substring(0, 60) + (s.text.length > 60 ? '...' : ''));
  const long = withLengths.filter(s => s.words > 20).slice(0, 2).map(s => s.text.substring(0, 80) + (s.text.length > 80 ? '...' : ''));
  
  return { short, long, avg };
}

function extractQuestions(text: string): string[] {
  const questions = text.match(/[^.!?]*\?/g) || [];
  return questions.slice(0, 3).map(q => q.trim().substring(0, 70) + (q.length > 70 ? '...' : ''));
}

function extractVocabulary(text: string, type: 'formal' | 'casual'): string[] {
  const formalWords = ['utilize', 'facilitate', 'implement', 'demonstrate', 'consequently', 'furthermore', 'nevertheless', 'comprehensive', 'significant', 'substantial', 'appropriate', 'establish', 'maintain', 'regarding', 'therefore'];
  const casualWords = ['get', 'got', 'use', 'show', 'help', 'thing', 'stuff', 'pretty', 'really', 'actually', 'basically', 'kind of', 'sort of', 'a lot', 'lots of'];
  
  const words = type === 'formal' ? formalWords : casualWords;
  const found: string[] = [];
  
  for (const word of words) {
    if (new RegExp(`\\b${word}\\b`, 'i').test(text)) {
      found.push(word);
    }
  }
  
  return found.slice(0, 5);
}

export default function StyleProofPanel({ userSampleText, originalInput, paraphrasedOutput, userStyle }: StyleProofPanelProps) {
  
  const evidence = useMemo<StyleEvidence[]>(() => {
    const proofs: StyleEvidence[] = [];
    
    // 1. CONTRACTIONS - Very visible proof
    const userContractions = extractContractions(userSampleText);
    const userExpanded = extractExpandedForms(userSampleText);
    const resultContractions = extractContractions(paraphrasedOutput);
    const resultExpanded = extractExpandedForms(paraphrasedOutput);
    
    const userUsesContractions = userContractions.length > userExpanded.length;
    const resultUsesContractions = resultContractions.length > resultExpanded.length;
    
    proofs.push({
      category: 'Contractions',
      icon: '✍️',
      yourStyle: {
        description: userUsesContractions 
          ? `You use contractions naturally` 
          : `You write formally without contractions`,
        examples: userUsesContractions ? userContractions : (userExpanded.length ? userExpanded : ['do not', 'will not', 'cannot'])
      },
      inResult: {
        description: resultUsesContractions 
          ? `Result uses contractions like you do` 
          : `Result avoids contractions like you do`,
        examples: resultUsesContractions ? resultContractions : (resultExpanded.length ? resultExpanded : ['Formal style applied']),
        found: userUsesContractions === resultUsesContractions
      },
      match: userUsesContractions === resultUsesContractions ? 'perfect' : 'none'
    });
    
    // 2. SENTENCE LENGTH - Show actual examples
    const userSentences = extractSentenceLengths(userSampleText);
    const resultSentences = extractSentenceLengths(paraphrasedOutput);
    const lengthDiff = Math.abs(userSentences.avg - resultSentences.avg);
    
    proofs.push({
      category: 'Sentence Length',
      icon: '📏',
      yourStyle: {
        description: `Your average: ${Math.round(userSentences.avg)} words per sentence`,
        examples: userSentences.avg > 15 
          ? (userSentences.long.length ? userSentences.long : ['You write longer, detailed sentences'])
          : (userSentences.short.length ? userSentences.short : ['You write short, punchy sentences'])
      },
      inResult: {
        description: `Result average: ${Math.round(resultSentences.avg)} words per sentence`,
        examples: resultSentences.avg > 15 
          ? (resultSentences.long.length ? resultSentences.long : ['Longer sentences used'])
          : (resultSentences.short.length ? resultSentences.short : ['Shorter sentences used']),
        found: lengthDiff < 5
      },
      match: lengthDiff < 3 ? 'perfect' : lengthDiff < 6 ? 'good' : lengthDiff < 10 ? 'partial' : 'none'
    });
    
    // 3. TRANSITIONS
    const userTransitions = extractTransitions(userSampleText);
    const resultTransitions = extractTransitions(paraphrasedOutput);
    const originalTransitions = extractTransitions(originalInput);
    
    // Check if result uses similar transition style
    const userHeavyTransitions = userTransitions.length >= 2;
    const resultHeavyTransitions = resultTransitions.length >= 2;
    
    proofs.push({
      category: 'Transition Words',
      icon: '🔗',
      yourStyle: {
        description: userHeavyTransitions 
          ? `You use transition words frequently` 
          : `You use minimal transitions`,
        examples: userTransitions.length ? userTransitions : ['Simple, direct flow']
      },
      inResult: {
        description: resultHeavyTransitions 
          ? `Result includes transitions` 
          : `Result uses minimal transitions`,
        examples: resultTransitions.length ? resultTransitions : ['Direct sentence flow'],
        found: userHeavyTransitions === resultHeavyTransitions || resultTransitions.some(t => userTransitions.includes(t))
      },
      match: userHeavyTransitions === resultHeavyTransitions ? 'good' : 'partial'
    });
    
    // 5. VOCABULARY FORMALITY
    const userFormal = extractVocabulary(userSampleText, 'formal');
    const userCasual = extractVocabulary(userSampleText, 'casual');
    const resultFormal = extractVocabulary(paraphrasedOutput, 'formal');
    const resultCasual = extractVocabulary(paraphrasedOutput, 'casual');
    
    const userIsFormal = userFormal.length > userCasual.length;
    const resultIsFormal = resultFormal.length > resultCasual.length;
    
    proofs.push({
      category: 'Vocabulary Style',
      icon: '📚',
      yourStyle: {
        description: userIsFormal 
          ? `You use formal/academic vocabulary` 
          : `You use casual/everyday words`,
        examples: userIsFormal ? (userFormal.length ? userFormal : ['formal', 'academic']) : (userCasual.length ? userCasual : ['simple', 'direct'])
      },
      inResult: {
        description: resultIsFormal 
          ? `Result uses formal vocabulary` 
          : `Result uses casual vocabulary`,
        examples: resultIsFormal ? (resultFormal.length ? resultFormal : ['Formal style']) : (resultCasual.length ? resultCasual : ['Casual style']),
        found: userIsFormal === resultIsFormal
      },
      match: userIsFormal === resultIsFormal ? 'perfect' : 'partial'
    });
    
    return proofs;
  }, [userSampleText, originalInput, paraphrasedOutput, userStyle]);
  
  // Calculate overall match
  const overallMatch = useMemo(() => {
    const scores: number[] = evidence.map(e => {
      switch (e.match) {
        case 'perfect': return 1;
        case 'good': return 0.75;
        case 'partial': return 0.5;
        default: return 0;
      }
    });
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  }, [evidence]);
  
  const matchedCount = evidence.filter(e => e.match === 'perfect' || e.match === 'good').length;

  return (
    <div className="space-y-4">
      {/* Header with Overall Score */}
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-brand-300 flex items-center gap-2 text-sm sm:text-base">
          <span className="text-lg">🔍</span> Style Application Proof
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">{matchedCount}/{evidence.length} patterns matched</span>
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
      
      {/* Evidence Cards */}
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
                <span className="font-medium text-white text-sm">{item.category}</span>
              </div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                item.match === 'perfect' ? 'bg-emerald-500/20 text-emerald-400' :
                item.match === 'good' ? 'bg-blue-500/20 text-blue-400' :
                item.match === 'partial' ? 'bg-yellow-500/20 text-yellow-400' :
                'bg-red-500/20 text-red-400'
              }`}>
                {item.match === 'perfect' ? '✓ Perfect Match' :
                 item.match === 'good' ? '✓ Good Match' :
                 item.match === 'partial' ? '◐ Partial' :
                 '✗ Different'}
              </span>
            </div>
            
            {/* Side by Side Comparison */}
            <div className="grid grid-cols-2 divide-x divide-white/10">
              {/* Your Style */}
              <div className="p-3 space-y-2">
                <div className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">Your Writing Style</div>
                <p className="text-xs text-slate-300">{item.yourStyle.description}</p>
                <div className="space-y-1">
                  {item.yourStyle.examples.map((ex, i) => (
                    <div key={i} className="text-[10px] px-2 py-1 bg-slate-800/50 rounded text-slate-400 italic truncate">
                      "{ex}"
                    </div>
                  ))}
                </div>
              </div>
              
              {/* In Result */}
              <div className="p-3 space-y-2">
                <div className="text-[10px] uppercase tracking-wide text-brand-400 font-medium">In Paraphrased Result</div>
                <p className="text-xs text-slate-300">{item.inResult.description}</p>
                <div className="space-y-1">
                  {item.inResult.examples.map((ex, i) => (
                    <div key={i} className={`text-[10px] px-2 py-1 rounded italic truncate ${
                      item.inResult.found ? 'bg-emerald-500/10 text-emerald-300' : 'bg-slate-800/50 text-slate-400'
                    }`}>
                      "{ex}"
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Summary */}
      <div className={`rounded-lg p-3 ${
        overallMatch >= 0.7 ? 'bg-emerald-500/10 border border-emerald-500/30' :
        overallMatch >= 0.5 ? 'bg-blue-500/10 border border-blue-500/30' :
        'bg-yellow-500/10 border border-yellow-500/30'
      }`}>
        <p className="text-xs text-slate-300">
          {overallMatch >= 0.7 ? (
            <>
              <span className="text-emerald-400 font-medium">✓ Excellent style match!</span> The paraphrased text closely follows your personal writing patterns including your use of {evidence.filter(e => e.match === 'perfect').map(e => e.category.toLowerCase()).join(', ')}.
            </>
          ) : overallMatch >= 0.5 ? (
            <>
              <span className="text-blue-400 font-medium">◐ Good style application.</span> Most of your writing patterns were applied. The result captures your style in {evidence.filter(e => e.match === 'perfect' || e.match === 'good').map(e => e.category.toLowerCase()).join(', ')}.
            </>
          ) : (
            <>
              <span className="text-yellow-400 font-medium">⚠ Partial style match.</span> Some patterns differ. Consider providing more writing samples in your profile to improve accuracy.
            </>
          )}
        </p>
      </div>
    </div>
  );
}
