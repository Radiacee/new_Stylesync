'use client';

import { useState, useEffect } from 'react';
import { detectAIContent, compareAIDetection, getScoreColor, getVerdictLabel, type AIDetectionResult } from '../lib/aiDetection';

interface AIDetectionDisplayProps {
  originalText: string;
  paraphrasedText: string;
  showComparison?: boolean;
}

export default function AIDetectionDisplay({ originalText, paraphrasedText, showComparison = true }: AIDetectionDisplayProps) {
  const [originalResult, setOriginalResult] = useState<AIDetectionResult | null>(null);
  const [paraphrasedResult, setParaphrasedResult] = useState<AIDetectionResult | null>(null);
  const [improvement, setImprovement] = useState<number>(0);
  const [summary, setSummary] = useState<string>('');
  const [showDetails, setShowDetails] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    if (originalText && paraphrasedText && originalText.length > 50 && paraphrasedText.length > 50) {
      setAnalyzing(true);
      // Small delay to show loading state
      setTimeout(() => {
        const comparison = compareAIDetection(originalText, paraphrasedText);
        setOriginalResult(comparison.original);
        setParaphrasedResult(comparison.paraphrased);
        setImprovement(comparison.improvement);
        setSummary(comparison.summary);
        setAnalyzing(false);
      }, 300);
    }
  }, [originalText, paraphrasedText]);

  if (!originalText || !paraphrasedText || originalText.length < 50 || paraphrasedText.length < 50) {
    return null;
  }

  if (analyzing) {
    return (
      <div className="bg-slate-800/50 rounded-lg p-4 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-slate-400">Analyzing AI patterns...</span>
        </div>
      </div>
    );
  }

  if (!paraphrasedResult) return null;

  const colorClasses = {
    emerald: { bg: 'bg-emerald-500/20', border: 'border-emerald-500/40', text: 'text-emerald-400', bar: 'from-emerald-500 to-green-400' },
    green: { bg: 'bg-green-500/20', border: 'border-green-500/40', text: 'text-green-400', bar: 'from-green-500 to-emerald-400' },
    yellow: { bg: 'bg-yellow-500/20', border: 'border-yellow-500/40', text: 'text-yellow-400', bar: 'from-yellow-500 to-amber-400' },
    orange: { bg: 'bg-orange-500/20', border: 'border-orange-500/40', text: 'text-orange-400', bar: 'from-orange-500 to-red-400' },
    red: { bg: 'bg-red-500/20', border: 'border-red-500/40', text: 'text-red-400', bar: 'from-red-500 to-pink-500' }
  };

  const resultColor = colorClasses[getScoreColor(paraphrasedResult.humanScore) as keyof typeof colorClasses];
  const originalColor = originalResult ? colorClasses[getScoreColor(originalResult.humanScore) as keyof typeof colorClasses] : null;

  return (
    <div className="space-y-4">
      {/* Main Result Card */}
      <div className={`rounded-lg p-4 ${resultColor.bg} border ${resultColor.border}`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">🛡️</span>
            <span className="font-semibold text-white text-sm">AI Detection Result</span>
          </div>
          <span className={`text-xs px-2 py-1 rounded-full ${resultColor.bg} ${resultColor.text} border ${resultColor.border}`}>
            {getVerdictLabel(paraphrasedResult.verdict)}
          </span>
        </div>

        {/* Main Score */}
        <div className="mb-4">
          <div className="flex items-baseline gap-2 mb-2">
            <span className={`text-3xl font-bold ${resultColor.text}`}>
              {Math.round(paraphrasedResult.humanScore * 100)}%
            </span>
            <span className="text-sm text-slate-400">Human-like</span>
            {improvement !== 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded ${
                improvement > 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
              }`}>
                {improvement > 0 ? '+' : ''}{Math.round(improvement * 100)}%
              </span>
            )}
          </div>
          
          {/* Progress Bar */}
          <div className="h-3 bg-slate-700/50 rounded-full overflow-hidden">
            <div 
              className={`h-full bg-gradient-to-r ${resultColor.bar} transition-all duration-500`}
              style={{ width: `${Math.round(paraphrasedResult.humanScore * 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-slate-500 mt-1">
            <span>AI-generated</span>
            <span>Human-written</span>
          </div>
        </div>

        {/* Summary */}
        <p className="text-xs text-slate-300 mb-3">{summary}</p>

        {/* Confidence */}
        <div className="flex items-center gap-4 text-[10px] text-slate-400">
          <span>Confidence: {Math.round(paraphrasedResult.confidence * 100)}%</span>
          <span>•</span>
          <span>AI Score: {Math.round(paraphrasedResult.aiScore * 100)}%</span>
        </div>
      </div>

      {/* Comparison (if showing original) */}
      {showComparison && originalResult && (
        <div className="grid grid-cols-2 gap-3">
          {/* Original */}
          <div className={`rounded-lg p-3 ${originalColor?.bg} border ${originalColor?.border}`}>
            <div className="text-[10px] text-slate-400 mb-1">Original Input</div>
            <div className="flex items-baseline gap-1">
              <span className={`text-xl font-bold ${originalColor?.text}`}>
                {Math.round(originalResult.humanScore * 100)}%
              </span>
              <span className="text-[10px] text-slate-400">human</span>
            </div>
            <div className="h-1.5 bg-slate-700/50 rounded-full overflow-hidden mt-2">
              <div 
                className={`h-full bg-gradient-to-r ${originalColor?.bar}`}
                style={{ width: `${Math.round(originalResult.humanScore * 100)}%` }}
              />
            </div>
          </div>

          {/* Paraphrased */}
          <div className={`rounded-lg p-3 ${resultColor.bg} border ${resultColor.border}`}>
            <div className="text-[10px] text-slate-400 mb-1">After Paraphrase</div>
            <div className="flex items-baseline gap-1">
              <span className={`text-xl font-bold ${resultColor.text}`}>
                {Math.round(paraphrasedResult.humanScore * 100)}%
              </span>
              <span className="text-[10px] text-slate-400">human</span>
            </div>
            <div className="h-1.5 bg-slate-700/50 rounded-full overflow-hidden mt-2">
              <div 
                className={`h-full bg-gradient-to-r ${resultColor.bar}`}
                style={{ width: `${Math.round(paraphrasedResult.humanScore * 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Detection Signals */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition"
      >
        <svg 
          className={`w-4 h-4 transition-transform ${showDetails ? 'rotate-90' : ''}`}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        {showDetails ? 'Hide' : 'Show'} detection breakdown
      </button>

      {showDetails && (
        <div className="space-y-3 bg-slate-800/30 rounded-lg p-3">
          {/* Breakdown Bars */}
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(paraphrasedResult.breakdown).map(([key, value]) => (
              <div key={key} className="space-y-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-slate-400 capitalize">{key}</span>
                  <span className={value > 0.5 ? 'text-red-400' : 'text-emerald-400'}>
                    {value > 0.5 ? 'AI-like' : 'Human-like'}
                  </span>
                </div>
                <div className="h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all ${value > 0.5 ? 'bg-red-500/60' : 'bg-emerald-500/60'}`}
                    style={{ width: `${Math.round(value * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Signals */}
          {paraphrasedResult.signals.length > 0 && (
            <div className="space-y-1.5 mt-3 pt-3 border-t border-white/10">
              <div className="text-[10px] text-slate-400 font-medium">Detection Signals:</div>
              {paraphrasedResult.signals.slice(0, 5).map((signal, i) => (
                <div 
                  key={i}
                  className={`text-[10px] p-2 rounded ${
                    signal.type === 'ai' 
                      ? 'bg-red-500/10 border border-red-500/20 text-red-300' 
                      : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
                  }`}
                >
                  <span className="font-medium">{signal.category}:</span> {signal.description}
                </div>
              ))}
            </div>
          )}

          {/* Info */}
          <div className="text-[10px] text-slate-500 italic pt-2 border-t border-white/10">
            Note: This is a heuristic-based detection analyzing vocabulary, sentence structure, 
            and common AI writing patterns. Results are estimates and may not match all AI detectors.
          </div>
        </div>
      )}
    </div>
  );
}
