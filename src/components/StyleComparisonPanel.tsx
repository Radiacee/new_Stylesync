import React from 'react';
import { type StyleTransformation, type ComparisonDetail } from '../lib/styleComparison';

interface StyleComparisonPanelProps {
  transformation: StyleTransformation;
  originalText: string;
  paraphrasedText: string;
  className?: string;
}

export default function StyleComparisonPanel({
  transformation,
  originalText,
  paraphrasedText,
  className = ""
}: StyleComparisonPanelProps) {
  const getAlignmentColor = (alignment: ComparisonDetail['alignment']) => {
    switch (alignment) {
      case 'excellent': return 'text-green-400';
      case 'good': return 'text-blue-400';
      case 'fair': return 'text-yellow-400';
      case 'poor': return 'text-red-400';
    }
  };

  const getAlignmentBadge = (alignment: ComparisonDetail['alignment']) => {
    const baseClasses = "px-2 py-1 rounded-full text-xs font-medium";
    switch (alignment) {
      case 'excellent': return `${baseClasses} bg-green-900/30 text-green-400 border border-green-500/30`;
      case 'good': return `${baseClasses} bg-blue-900/30 text-blue-400 border border-blue-500/30`;
      case 'fair': return `${baseClasses} bg-yellow-900/30 text-yellow-400 border border-yellow-500/30`;
      case 'poor': return `${baseClasses} bg-red-900/30 text-red-400 border border-red-500/30`;
    }
  };

  const getImpactIcon = (impact: ComparisonDetail['impact']) => {
    switch (impact) {
      case 'major': return '🔥';
      case 'moderate': return '📊';
      case 'minor': return '✨';
    }
  };

  return (
    <div className={`bg-slate-900 rounded-xl border border-white/10 ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-white">Style Transformation Analysis</h3>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm text-slate-400">Style Alignment</div>
              <div className={`text-2xl font-bold ${transformation.alignmentScore >= 0.8 ? 'text-green-400' : 
                transformation.alignmentScore >= 0.6 ? 'text-blue-400' :
                transformation.alignmentScore >= 0.4 ? 'text-yellow-400' : 'text-red-400'}`}>
                {(transformation.alignmentScore * 100).toFixed(0)}%
              </div>
            </div>
          </div>
        </div>
        
        {/* Text Length Comparison */}
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="bg-slate-800/50 rounded-lg p-3">
            <div className="text-slate-400 mb-1">User Sample</div>
            <div className="text-white font-medium">{transformation.userStyle.avgSentenceLength.toFixed(0)} avg words/sentence</div>
            <div className="text-slate-400 text-xs">{originalText.split(' ').length} words total</div>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-3">
            <div className="text-slate-400 mb-1">Original Text</div>
            <div className="text-white font-medium">{transformation.originalAnalysis.avgSentenceLength.toFixed(0)} avg words/sentence</div>
            <div className="text-slate-400 text-xs">{originalText.split(' ').length} words total</div>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-3">
            <div className="text-slate-400 mb-1">Paraphrased</div>
            <div className="text-white font-medium">{transformation.paraphrasedAnalysis.avgSentenceLength.toFixed(0)} avg words/sentence</div>
            <div className="text-slate-400 text-xs">{paraphrasedText.split(' ').length} words total</div>
          </div>
        </div>
      </div>

      {/* Detailed Comparison Table */}
      <div className="p-6">
        <h4 className="text-lg font-medium text-white mb-4">Detailed Metrics Comparison</h4>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-3 px-2 text-sm font-medium text-slate-400">Category</th>
                <th className="text-left py-3 px-2 text-sm font-medium text-slate-400">Metric</th>
                <th className="text-center py-3 px-2 text-sm font-medium text-slate-400">User Style</th>
                <th className="text-center py-3 px-2 text-sm font-medium text-slate-400">Original</th>
                <th className="text-center py-3 px-2 text-sm font-medium text-slate-400">Paraphrased</th>
                <th className="text-left py-3 px-2 text-sm font-medium text-slate-400">Change</th>
                <th className="text-center py-3 px-2 text-sm font-medium text-slate-400">Alignment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {transformation.detailedComparison.map((comparison, index) => (
                <tr key={index} className="hover:bg-slate-800/20 transition-colors">
                  <td className="py-4 px-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs">{getImpactIcon(comparison.impact)}</span>
                      <span className="text-sm text-slate-300">{comparison.category}</span>
                    </div>
                  </td>
                  <td className="py-4 px-2 text-sm text-white font-medium">
                    {comparison.metric}
                  </td>
                  <td className="py-4 px-2 text-center text-sm text-slate-300 font-mono">
                    {comparison.userValue}
                  </td>
                  <td className="py-4 px-2 text-center text-sm text-slate-300 font-mono">
                    {comparison.originalValue}
                  </td>
                  <td className="py-4 px-2 text-center text-sm text-white font-mono font-medium">
                    {comparison.paraphrasedValue}
                  </td>
                  <td className="py-4 px-2 text-sm text-slate-300 max-w-xs">
                    {comparison.changeDescription}
                  </td>
                  <td className="py-4 px-2 text-center">
                    <span className={getAlignmentBadge(comparison.alignment)}>
                      {comparison.alignment}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transformation Insights */}
      <div className="p-6 border-t border-white/10">
        <h4 className="text-lg font-medium text-white mb-4">Transformation Insights</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Sentence Structure */}
          {transformation.transformationInsights.sentenceStructure.length > 0 && (
            <div>
              <h5 className="text-sm font-medium text-slate-400 mb-2 flex items-center gap-2">
                📝 Sentence Structure
              </h5>
              <ul className="space-y-1">
                {transformation.transformationInsights.sentenceStructure.map((insight, index) => (
                  <li key={index} className="text-sm text-slate-300 pl-4 border-l-2 border-blue-500/30">
                    {insight}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Vocabulary Changes */}
          {transformation.transformationInsights.vocabularyChanges.length > 0 && (
            <div>
              <h5 className="text-sm font-medium text-slate-400 mb-2 flex items-center gap-2">
                📚 Vocabulary Changes
              </h5>
              <ul className="space-y-1">
                {transformation.transformationInsights.vocabularyChanges.map((insight, index) => (
                  <li key={index} className="text-sm text-slate-300 pl-4 border-l-2 border-green-500/30">
                    {insight}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Formality Shifts */}
          {transformation.transformationInsights.formalityShifts.length > 0 && (
            <div>
              <h5 className="text-sm font-medium text-slate-400 mb-2 flex items-center gap-2">
                🎩 Formality Adjustments
              </h5>
              <ul className="space-y-1">
                {transformation.transformationInsights.formalityShifts.map((insight, index) => (
                  <li key={index} className="text-sm text-slate-300 pl-4 border-l-2 border-purple-500/30">
                    {insight}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Personality Adjustments */}
          {transformation.transformationInsights.personalityAdjustments.length > 0 && (
            <div>
              <h5 className="text-sm font-medium text-slate-400 mb-2 flex items-center gap-2">
                👤 Voice & Personality
              </h5>
              <ul className="space-y-1">
                {transformation.transformationInsights.personalityAdjustments.map((insight, index) => (
                  <li key={index} className="text-sm text-slate-300 pl-4 border-l-2 border-yellow-500/30">
                    {insight}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Technical Modifications */}
          {transformation.transformationInsights.technicalModifications.length > 0 && (
            <div>
              <h5 className="text-sm font-medium text-slate-400 mb-2 flex items-center gap-2">
                ⚙️ Technical Improvements
              </h5>
              <ul className="space-y-1">
                {transformation.transformationInsights.technicalModifications.map((insight, index) => (
                  <li key={index} className="text-sm text-slate-300 pl-4 border-l-2 border-orange-500/30">
                    {insight}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Readability Improvements */}
          {transformation.transformationInsights.readabilityImprovements.length > 0 && (
            <div>
              <h5 className="text-sm font-medium text-slate-400 mb-2 flex items-center gap-2">
                📈 Readability Changes
              </h5>
              <ul className="space-y-1">
                {transformation.transformationInsights.readabilityImprovements.map((insight, index) => (
                  <li key={index} className="text-sm text-slate-300 pl-4 border-l-2 border-cyan-500/30">
                    {insight}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* User Style Summary */}
      <div className="p-6 border-t border-white/10 bg-slate-800/20">
        <h4 className="text-lg font-medium text-white mb-4">Your Writing Style Profile</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-slate-400 mb-1">Sentence Length</div>
            <div className="text-white font-medium">{Math.round(transformation.userStyle.avgSentenceLength)} words</div>
            <div className="text-slate-400 text-xs">±{Math.round(transformation.userStyle.sentenceLengthStd)}</div>
          </div>
          <div>
            <div className="text-slate-400 mb-1">Word Complexity</div>
            <div className="text-white font-medium">{(transformation.userStyle.vocabularyComplexity * 100).toFixed(1)}%</div>
            <div className="text-slate-400 text-xs">complex words</div>
          </div>
          <div>
            <div className="text-slate-400 mb-1">Contractions</div>
            <div className="text-white font-medium">{transformation.userStyle.usesContractions ? 'Yes' : 'No'}</div>
            <div className="text-slate-400 text-xs">{transformation.userStyle.usesContractions ? 'casual' : 'formal'}</div>
          </div>
          <div>
            <div className="text-slate-400 mb-1">Questions</div>
            <div className="text-white font-medium">{(transformation.userStyle.questionRatio * 100).toFixed(1)}%</div>
            <div className="text-slate-400 text-xs">of sentences</div>
          </div>
        </div>
        
        {/* Preferred Transitions */}
        {transformation.userStyle.preferredTransitions.length > 0 && (
          <div className="mt-4 pt-4 border-t border-white/5">
            <div className="text-slate-400 text-sm mb-2">Your Preferred Transitions</div>
            <div className="flex flex-wrap gap-2">
              {transformation.userStyle.preferredTransitions.slice(0, 5).map((transition, index) => (
                <span key={index} className="px-2 py-1 bg-brand-500/20 text-brand-300 rounded text-xs">
                  {transition}
                </span>
              ))}
            </div>
          </div>
        )}
        
        {/* Common Starters */}
        {transformation.userStyle.commonStarters.length > 0 && (
          <div className="mt-3">
            <div className="text-slate-400 text-sm mb-2">Your Common Sentence Starters</div>
            <div className="flex flex-wrap gap-2">
              {transformation.userStyle.commonStarters.slice(0, 5).map((starter, index) => (
                <span key={index} className="px-2 py-1 bg-slate-700/50 text-slate-300 rounded text-xs">
                  {starter}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
