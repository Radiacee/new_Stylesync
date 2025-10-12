import { StyleProfile } from '../lib/styleProfile';
import { useEffect, useRef } from 'react';

interface StyleVerificationProps {
  original: string;
  transformed: string;
  profile: StyleProfile | null;
  onScoreCalculated?: (score: number) => void;
}

interface StyleMetrics {
  formalityScore: number;
  sentenceLengthAvg: number;
  adjectiveDensity: number;
  contractionCount: number;
  transitionWordCount: number;
  lexiconMatch: number;
}

function analyzeText(text: string): StyleMetrics {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const words = text.toLowerCase().match(/\b\w+\b/g) || [];
  
  // Count adjectives (simple heuristic - words ending in common adjective suffixes)
  const adjectivePatterns = /\b\w+(ful|ous|ive|able|al|ent|ant|less)\b/gi;
  const adjectives = text.match(adjectivePatterns) || [];
  
  // Count contractions
  const contractions = text.match(/\b\w+'\w+\b/g) || [];
  
  // Common transition words
  const transitionWords = ['however', 'therefore', 'moreover', 'furthermore', 'additionally', 'consequently', 'thus', 'hence'];
  const transitionCount = transitionWords.reduce((count, word) => {
    return count + (text.toLowerCase().match(new RegExp(`\\b${word}\\b`, 'g')) || []).length;
  }, 0);
  
  // Formality score (higher = more formal)
  // Based on: longer words, fewer contractions, more transition words
  const avgWordLength = words.reduce((sum, w) => sum + w.length, 0) / (words.length || 1);
  const formalityScore = Math.min(1, (avgWordLength / 6 + transitionCount / 5 - contractions.length / 10));
  
  return {
    formalityScore: Math.max(0, Math.min(1, formalityScore)),
    sentenceLengthAvg: words.length / (sentences.length || 1),
    adjectiveDensity: adjectives.length / (words.length || 1),
    contractionCount: contractions.length,
    transitionWordCount: transitionCount,
    lexiconMatch: 0, // Will be calculated separately with profile
  };
}

function calculateStyleMatch(original: StyleMetrics, transformed: StyleMetrics, profile: StyleProfile | null): number {
  if (!profile) return 0;
  
  let matchScore = 0;
  let totalWeight = 0;
  
  // Check formality alignment
  const targetFormality = profile.formality || 0.5;
  const formalityDiff = Math.abs(transformed.formalityScore - targetFormality);
  matchScore += (1 - formalityDiff) * 30;
  totalWeight += 30;
  
  // Check descriptiveness (adjective density)
  const targetDescriptiveness = profile.descriptiveness || 0.5;
  const expectedAdjectiveDensity = targetDescriptiveness * 0.2; // 0.2 is max reasonable density
  const descriptivenessDiff = Math.abs(transformed.adjectiveDensity - expectedAdjectiveDensity);
  matchScore += (1 - Math.min(1, descriptivenessDiff * 10)) * 25;
  totalWeight += 25;
  
  // Check directness (sentence length - shorter = more direct)
  const targetDirectness = profile.directness || 0.5;
  const expectedSentenceLength = 20 - (targetDirectness * 10); // 10-20 words range
  const sentenceDiff = Math.abs(transformed.sentenceLengthAvg - expectedSentenceLength) / 10;
  matchScore += (1 - Math.min(1, sentenceDiff)) * 20;
  totalWeight += 20;
  
  // Check lexicon usage
  if (profile.customLexicon && profile.customLexicon.length > 0) {
    const lexiconWords = profile.customLexicon;
    const usedCount = lexiconWords.filter(word => 
      new RegExp(`\\b${word}\\b`, 'i').test(transformed.toString())
    ).length;
    const lexiconScore = usedCount / lexiconWords.length;
    matchScore += lexiconScore * 25;
    totalWeight += 25;
  }
  
  return Math.round((matchScore / totalWeight) * 100);
}

export default function StyleVerification({ original, transformed, profile, onScoreCalculated }: StyleVerificationProps) {
  if (!original || !transformed) return null;
  
  const hasCalledCallback = useRef(false);
  
  const originalMetrics = analyzeText(original);
  const transformedMetrics = analyzeText(transformed);
  const styleMatchPercentage = calculateStyleMatch(originalMetrics, transformedMetrics, profile);
  
  // Call the callback when score is calculated (only once per text change)
  useEffect(() => {
    if (onScoreCalculated && styleMatchPercentage > 0 && !hasCalledCallback.current) {
      hasCalledCallback.current = true;
      onScoreCalculated(styleMatchPercentage);
    }
    
    // Reset the ref when the text changes so we can call again for new paraphrases
    return () => {
      hasCalledCallback.current = false;
    };
  }, [styleMatchPercentage, original, transformed]); // Removed onScoreCalculated from deps
  
  return (
    <div className="mt-6 p-6 bg-slate-800/40 border border-white/10 rounded-xl space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-brand-300">Style Verification</h3>
        <div className="flex items-center gap-2">
          <div className="w-32 bg-gray-700 rounded-full h-3">
            <div 
              className={`h-3 rounded-full transition-all duration-500 ${
                styleMatchPercentage >= 80 ? 'bg-green-500' :
                styleMatchPercentage >= 60 ? 'bg-yellow-500' :
                'bg-red-500'
              }`}
              style={{ width: `${styleMatchPercentage}%` }}
            />
          </div>
          <span className="text-white font-bold text-lg">{styleMatchPercentage}%</span>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="space-y-2">
          <h4 className="text-brand-200 font-medium">Original Text</h4>
          <div className="space-y-1 text-gray-400">
            <div className="flex justify-between">
              <span>Formality:</span>
              <span className="text-white">{(originalMetrics.formalityScore * 100).toFixed(0)}%</span>
            </div>
            <div className="flex justify-between">
              <span>Avg Sentence Length:</span>
              <span className="text-white">{originalMetrics.sentenceLengthAvg.toFixed(1)} words</span>
            </div>
            <div className="flex justify-between">
              <span>Adjective Density:</span>
              <span className="text-white">{(originalMetrics.adjectiveDensity * 100).toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span>Contractions:</span>
              <span className="text-white">{originalMetrics.contractionCount}</span>
            </div>
          </div>
        </div>
        
        <div className="space-y-2">
          <h4 className="text-brand-200 font-medium">Transformed Text</h4>
          <div className="space-y-1 text-gray-400">
            <div className="flex justify-between">
              <span>Formality:</span>
              <span className="text-white">{(transformedMetrics.formalityScore * 100).toFixed(0)}%</span>
            </div>
            <div className="flex justify-between">
              <span>Avg Sentence Length:</span>
              <span className="text-white">{transformedMetrics.sentenceLengthAvg.toFixed(1)} words</span>
            </div>
            <div className="flex justify-between">
              <span>Adjective Density:</span>
              <span className="text-white">{(transformedMetrics.adjectiveDensity * 100).toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span>Contractions:</span>
              <span className="text-white">{transformedMetrics.contractionCount}</span>
            </div>
          </div>
        </div>
      </div>
      
      {profile && (
        <div className="mt-4 p-4 bg-slate-900/60 rounded-lg">
          <h4 className="text-brand-200 font-medium mb-3">Your Style Profile Settings</h4>
          <div className="grid grid-cols-2 gap-3 text-sm text-gray-400">
            <div className="flex justify-between">
              <span>Target Formality:</span>
              <span className="text-white">{((profile.formality || 0.5) * 100).toFixed(0)}%</span>
            </div>
            <div className="flex justify-between">
              <span>Target Descriptiveness:</span>
              <span className="text-white">{((profile.descriptiveness || 0.5) * 100).toFixed(0)}%</span>
            </div>
            <div className="flex justify-between">
              <span>Target Directness:</span>
              <span className="text-white">{((profile.directness || 0.5) * 100).toFixed(0)}%</span>
            </div>
            {profile.customLexicon && profile.customLexicon.length > 0 && (
              <div className="flex justify-between">
                <span>Custom Lexicon:</span>
                <span className="text-white">{profile.customLexicon.length} words</span>
              </div>
            )}
          </div>
        </div>
      )}
      
      <details className="text-xs text-gray-500 mt-2">
        <summary className="cursor-pointer hover:text-gray-400">Show Technical Details</summary>
        <pre className="mt-2 p-2 bg-black/20 rounded overflow-auto text-xs">
{`Original Metrics:
${JSON.stringify(originalMetrics, null, 2)}

Transformed Metrics:
${JSON.stringify(transformedMetrics, null, 2)}

Profile Settings:
${JSON.stringify(profile, null, 2)}`}
        </pre>
      </details>
    </div>
  );
}
