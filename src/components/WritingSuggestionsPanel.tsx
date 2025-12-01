"use client";
import { useState, useMemo } from 'react';
import { analyzeWriting, getQuickTips, type WritingAnalysis, type WritingSuggestion } from '../lib/writingSuggestions';

interface WritingSuggestionsPanelProps {
  text: string;
  styleType?: 'academic' | 'casual' | 'professional' | 'creative';
  onClose?: () => void;
}

export default function WritingSuggestionsPanel({ text, styleType = 'professional', onClose }: WritingSuggestionsPanelProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  
  const analysis = useMemo(() => {
    if (!text || text.trim().length < 50) return null;
    return analyzeWriting(text);
  }, [text]);
  
  const quickTips = useMemo(() => getQuickTips(styleType), [styleType]);
  
  if (!text || text.trim().length < 50) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            Writing Suggestions
          </h3>
          {onClose && (
            <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
          )}
        </div>
        <p className="text-sm text-slate-400">Enter at least 50 characters to get writing suggestions.</p>
        
        {/* Quick Tips */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-blue-300 mb-2">Quick Tips for {styleType.charAt(0).toUpperCase() + styleType.slice(1)} Writing</h4>
          <ul className="space-y-1.5">
            {quickTips.map((tip, i) => (
              <li key={i} className="text-xs text-blue-200 flex items-start gap-2">
                <span className="text-blue-400">•</span>
                {tip}
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }
  
  if (!analysis) return null;
  
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'warning': return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
      case 'improvement': return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
      default: return 'text-slate-400 bg-slate-500/10 border-slate-500/30';
    }
  };
  
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'grammar': return '📝';
      case 'clarity': return '💡';
      case 'style': return '✨';
      case 'vocabulary': return '📚';
      case 'structure': return '🏗️';
      case 'engagement': return '🎯';
      default: return '📌';
    }
  };
  
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-400';
    if (score >= 60) return 'text-amber-400';
    return 'text-red-400';
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          Writing Suggestions
        </h3>
        {onClose && (
          <button onClick={onClose} className="text-slate-400 hover:text-white transition">✕</button>
        )}
      </div>

      {/* Overall Score */}
      <div className="bg-slate-800/50 rounded-lg p-4 border border-white/10">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-slate-300">Writing Quality Score</span>
          <span className={`text-2xl font-bold ${getScoreColor(analysis.overallScore)}`}>
            {analysis.overallScore}/100
          </span>
        </div>
        <div className="w-full bg-slate-700 rounded-full h-2">
          <div 
            className={`h-2 rounded-full transition-all ${
              analysis.overallScore >= 80 ? 'bg-emerald-500' :
              analysis.overallScore >= 60 ? 'bg-amber-500' : 'bg-red-500'
            }`}
            style={{ width: `${analysis.overallScore}%` }}
          />
        </div>
      </div>

      {/* Strengths */}
      {analysis.strengths.length > 0 && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3">
          <h4 className="text-sm font-semibold text-emerald-300 mb-2 flex items-center gap-2">
            <span>✓</span> Strengths
          </h4>
          <ul className="space-y-1">
            {analysis.strengths.map((strength, i) => (
              <li key={i} className="text-xs text-emerald-200 flex items-center gap-2">
                <span className="text-emerald-400">•</span>
                {strength}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Suggestions */}
      {analysis.suggestions.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-white">Suggestions ({analysis.suggestions.length})</h4>
          {analysis.suggestions.map((suggestion, i) => (
            <div 
              key={i}
              className={`rounded-lg border p-3 ${getSeverityColor(suggestion.severity)}`}
            >
              <button 
                onClick={() => setExpanded(expanded === `${i}` ? null : `${i}`)}
                className="w-full text-left"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <span className="text-base">{getCategoryIcon(suggestion.category)}</span>
                    <div>
                      <h5 className="text-sm font-medium">{suggestion.title}</h5>
                      <p className="text-xs opacity-80 mt-0.5">{suggestion.description}</p>
                    </div>
                  </div>
                  {suggestion.example && (
                    <svg 
                      className={`w-4 h-4 flex-shrink-0 transition-transform ${expanded === `${i}` ? 'rotate-180' : ''}`} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  )}
                </div>
              </button>
              
              {/* Example */}
              {expanded === `${i}` && suggestion.example && (
                <div className="mt-3 pt-3 border-t border-white/10 space-y-2">
                  <div>
                    <span className="text-xs font-medium opacity-60">Before:</span>
                    <p className="text-xs mt-1 line-through opacity-60">{suggestion.example.before}</p>
                  </div>
                  <div>
                    <span className="text-xs font-medium opacity-80">After:</span>
                    <p className="text-xs mt-1 font-medium">{suggestion.example.after}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Metrics */}
      <details className="group">
        <summary className="text-sm text-slate-400 cursor-pointer hover:text-white transition flex items-center gap-1">
          <svg className="w-4 h-4 group-open:rotate-90 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          View Detailed Metrics
        </summary>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="bg-slate-800/50 rounded p-2.5">
            <div className="text-xs text-slate-400">Avg Sentence Length</div>
            <div className="text-sm font-medium text-white">{analysis.metrics.avgSentenceLength} words</div>
          </div>
          <div className="bg-slate-800/50 rounded p-2.5">
            <div className="text-xs text-slate-400">Vocabulary Diversity</div>
            <div className="text-sm font-medium text-white">{Math.round(analysis.metrics.vocabularyDiversity * 100)}%</div>
          </div>
          <div className="bg-slate-800/50 rounded p-2.5">
            <div className="text-xs text-slate-400">Passive Voice</div>
            <div className="text-sm font-medium text-white">{Math.round(analysis.metrics.passiveVoiceRatio * 100)}%</div>
          </div>
          <div className="bg-slate-800/50 rounded p-2.5">
            <div className="text-xs text-slate-400">Reading Level</div>
            <div className="text-sm font-medium text-white">Grade {Math.round(analysis.metrics.readabilityGrade)}</div>
          </div>
        </div>
      </details>

      {/* Quick Tips */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
        <h4 className="text-sm font-semibold text-blue-300 mb-2">
          💡 Tips for {styleType.charAt(0).toUpperCase() + styleType.slice(1)} Writing
        </h4>
        <ul className="space-y-1">
          {quickTips.slice(0, 3).map((tip, i) => (
            <li key={i} className="text-xs text-blue-200 flex items-start gap-2">
              <span className="text-blue-400">•</span>
              {tip}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
