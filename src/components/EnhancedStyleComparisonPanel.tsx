import React, { useState } from 'react';
import type { StructuredStyleComparison, MetricGroup, StructuredMetric } from '../lib/styleComparison';

interface EnhancedStyleComparisonPanelProps {
  comparison: StructuredStyleComparison;
  className?: string;
}

/**
 * Enhanced UI component for displaying structured style metrics with collapsible groups.
 * Step 5: Build the New UI Panel
 */
export default function EnhancedStyleComparisonPanel({
  comparison,
  className = ""
}: EnhancedStyleComparisonPanelProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(comparison.metricGroups.map(g => g.groupName)));

  const toggleGroup = (groupName: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupName)) {
      newExpanded.delete(groupName);
    } else {
      newExpanded.add(groupName);
    }
    setExpandedGroups(newExpanded);
  };

  const getAlignmentColor = (alignment: 'excellent' | 'good' | 'fair' | 'poor') => {
    switch (alignment) {
      case 'excellent':
        return 'bg-green-900/20 border-green-500/30 text-green-400';
      case 'good':
        return 'bg-blue-900/20 border-blue-500/30 text-blue-400';
      case 'fair':
        return 'bg-yellow-900/20 border-yellow-500/30 text-yellow-400';
      case 'poor':
        return 'bg-red-900/20 border-red-500/30 text-red-400';
    }
  };

  const getAlignmentLabel = (alignment: 'excellent' | 'good' | 'fair' | 'poor') => {
    switch (alignment) {
      case 'excellent':
        return '✓ Excellent';
      case 'good':
        return '✓ Good';
      case 'fair':
        return '~ Fair';
      case 'poor':
        return '✗ Poor';
    }
  };

  const getSimilarityColor = (similarity: number) => {
    if (similarity >= 0.85) return 'text-green-400';
    if (similarity >= 0.70) return 'text-blue-400';
    if (similarity >= 0.55) return 'text-yellow-400';
    return 'text-red-400';
  };

  const renderMetricValue = (value: any) => {
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return value.toFixed(2);
    return String(value);
  };

  return (
    <div className={`bg-slate-900 rounded-xl border border-white/10 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-white/10 bg-gradient-to-r from-slate-900 to-slate-800/50">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-2xl font-bold text-white">Style Analysis Report</h3>
            <p className="text-sm text-slate-400 mt-1">Detailed comparison of your writing style</p>
          </div>
          <div className="text-right">
            <div className="text-sm text-slate-400 mb-1">Overall Match</div>
            <div className={`text-4xl font-bold ${getSimilarityColor(comparison.overallSimilarity)}`}>
              {Math.round(comparison.overallSimilarity * 100)}%
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="bg-slate-800/50 rounded-lg p-3 border border-white/5">
          <p className="text-sm text-slate-300">{comparison.summary}</p>
        </div>
      </div>

      {/* Metric Groups */}
      <div className="divide-y divide-white/5">
        {comparison.metricGroups.map((group: MetricGroup) => (
          <div key={group.groupName} className="border-b border-white/5 last:border-b-0">
            {/* Group Header */}
            <button
              onClick={() => toggleGroup(group.groupName)}
              className="w-full px-6 py-4 text-left hover:bg-slate-800/30 transition-colors flex items-center justify-between"
            >
              <div className="flex-1">
                <h4 className="text-lg font-semibold text-white">{group.groupName}</h4>
                <p className="text-sm text-slate-400 mt-1">{group.description}</p>
              </div>
              <div className={`text-xl transition-transform ${expandedGroups.has(group.groupName) ? 'rotate-180' : ''}`}>
                ▼
              </div>
            </button>

            {/* Group Content */}
            {expandedGroups.has(group.groupName) && (
              <div className="px-6 py-4 bg-slate-800/20">
                <div className="space-y-3">
                  {group.metrics.map((metric: StructuredMetric, idx: number) => (
                    <div key={idx} className="bg-slate-800/50 rounded-lg p-4 border border-white/5 hover:border-white/10 transition-colors">
                      {/* Metric Header */}
                      <div className="flex items-start justify-between mb-2">
                        <h5 className="font-medium text-white">{metric.name}</h5>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getAlignmentColor(metric.alignment)}`}>
                          {getAlignmentLabel(metric.alignment)}
                        </span>
                      </div>

                      {/* Metric Values */}
                      <div className="grid grid-cols-3 gap-3 mb-3">
                        <div className="bg-slate-900/50 rounded p-2">
                          <div className="text-xs text-slate-400 mb-1">Your Style</div>
                          <div className="text-sm font-medium text-white">{renderMetricValue(metric.target)}</div>
                        </div>
                        <div className="bg-slate-900/50 rounded p-2">
                          <div className="text-xs text-slate-400 mb-1">Original</div>
                          <div className="text-sm font-medium text-slate-300">{renderMetricValue(metric.original)}</div>
                        </div>
                        <div className="bg-slate-900/50 rounded p-2">
                          <div className="text-xs text-slate-400 mb-1">Paraphrased</div>
                          <div className="text-sm font-medium text-white">{renderMetricValue(metric.paraphrased)}</div>
                        </div>
                      </div>

                      {/* Percent Difference */}
                      {metric.percentDifference !== undefined && (
                        <div className="mb-3 pb-3 border-b border-white/10">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-400">Variation from target:</span>
                            <span className={`font-medium ${metric.percentDifference < 10 ? 'text-green-400' : metric.percentDifference < 25 ? 'text-yellow-400' : 'text-red-400'}`}>
                              {metric.percentDifference}%
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Explanation */}
                      <p className="text-xs text-slate-400">{metric.explanation}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="p-6 bg-slate-800/30 border-t border-white/10">
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 bg-green-400/30 border border-green-400 rounded-sm"></span>
            <span className="text-slate-300">Excellent (&lt;5% difference)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 bg-blue-400/30 border border-blue-400 rounded-sm"></span>
            <span className="text-slate-300">Good (5-15% difference)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 bg-yellow-400/30 border border-yellow-400 rounded-sm"></span>
            <span className="text-slate-300">Fair (15-30% difference)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 bg-red-400/30 border border-red-400 rounded-sm"></span>
            <span className="text-slate-300">Poor (&gt;30% difference)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
