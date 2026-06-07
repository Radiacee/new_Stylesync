"use client";

import React, { useState } from 'react';
import type { StyleProfile } from '../lib/styleProfile';

interface AITransparencyPanelProps {
  profile: StyleProfile;
  originalText: string;
  paraphrasedText: string;
  usedModel: boolean;
  className?: string;
}

export default function AITransparencyPanel({ 
  profile, 
  originalText, 
  paraphrasedText, 
  usedModel, 
  className = "" 
}: AITransparencyPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);

  if (!usedModel) {
    return null; // Only show for AI-generated results
  }

  const toggleSection = (section: string) => {
    setActiveSection(activeSection === section ? null : section);
  };

  const buildSystemPromptPreview = (profile: StyleProfile): string => {
    let prompt = "STYLE ANALYSIS APPLIED:\n\n";
    
    // Basic profile parameters
    prompt += `Core Style Settings:\n`;
    prompt += `• Tone: ${profile.tone}\n`;
    prompt += `• Formality: ${(profile.formality * 100).toFixed(0)}%\n`;
    prompt += `• Pacing: ${(profile.pacing * 100).toFixed(0)}%\n`;
    prompt += `• Descriptiveness: ${(profile.descriptiveness * 100).toFixed(0)}%\n`;
    prompt += `• Directness: ${(profile.directness * 100).toFixed(0)}%\n\n`;

    // Custom lexicon
    if (profile.customLexicon && profile.customLexicon.length > 0) {
      prompt += `Custom Vocabulary Preferences:\n`;
      prompt += `• Suggested words: ${profile.customLexicon.join(', ')}\n`;
      prompt += `• Application: Used only when naturally fitting\n\n`;
    } else {
      prompt += `Custom Vocabulary: None specified - focusing on natural language patterns\n\n`;
    }

    // Style analysis details
    if (profile.styleAnalysis) {
      const analysis = profile.styleAnalysis;
      prompt += `Writing Pattern Analysis:\n`;
      prompt += `• Average sentence length: ${Math.round(analysis.avgSentenceLength)} words\n`;
      prompt += `• Contractions: ${analysis.usesContractions ? 'Uses contractions' : 'Avoids contractions'}\n`;
      
      if (analysis.preferredTransitions && analysis.preferredTransitions.length > 0) {
        prompt += `• Preferred transitions: ${analysis.preferredTransitions.slice(0, 3).join(', ')}\n`;

    }

    return prompt;
  };

  const analyzeChanges = () => {
    if (!originalText || !paraphrasedText) return [];
    
    const originalSentences = originalText.split(/[.!?]+/).filter(s => s.trim());
    const paraphrasedSentences = paraphrasedText.split(/[.!?]+/).filter(s => s.trim());
    
    const changes = [];
    
    // Analyze sentence length changes
    const originalAvgLength = originalSentences.reduce((sum, s) => sum + s.trim().split(' ').length, 0) / originalSentences.length;
    const paraphrasedAvgLength = paraphrasedSentences.reduce((sum, s) => sum + s.trim().split(' ').length, 0) / paraphrasedSentences.length;
    
    if (Math.abs(originalAvgLength - paraphrasedAvgLength) > 2) {
      changes.push({
        type: 'Sentence Length',
        description: `Adjusted from ${originalAvgLength.toFixed(1)} to ${paraphrasedAvgLength.toFixed(1)} words per sentence`,
        reason: profile.styleAnalysis ? `Target: ${Math.round(profile.styleAnalysis.avgSentenceLength)} words` : 'Style preference'
      });
    }

    // Analyze vocabulary changes
    const originalWords: string[] = originalText.toLowerCase().match(/\b\w+\b/g) || [];
    const paraphrasedWords: string[] = paraphrasedText.toLowerCase().match(/\b\w+\b/g) || [];
    
    if (profile.customLexicon && profile.customLexicon.length > 0) {
      const usedCustomWords = profile.customLexicon.filter(word => 
        paraphrasedWords.includes(word.toLowerCase()) && !originalWords.includes(word.toLowerCase())
      );
      
      if (usedCustomWords.length > 0) {
        changes.push({
          type: 'Custom Vocabulary',
          description: `Incorporated: ${usedCustomWords.join(', ')}`,
          reason: 'From your personal lexicon'
        });
      }
    }

    // Analyze structural changes
    const originalHasContractions = /\b\w+'[a-z]+\b/i.test(originalText);
    const paraphrasedHasContractions = /\b\w+'[a-z]+\b/i.test(paraphrasedText);
    
    if (originalHasContractions !== paraphrasedHasContractions) {
      changes.push({
        type: 'Contraction Usage',
        description: paraphrasedHasContractions ? 'Added contractions' : 'Removed contractions',
        reason: profile.styleAnalysis?.usesContractions ? 'Your style uses contractions' : 'Your style avoids contractions'
      });
    }

    // Analyze tone adjustments
    changes.push({
      type: 'Tone Adjustment',
      description: `Applied ${profile.tone} tone`,
      reason: `Matching your ${(profile.formality * 100).toFixed(0)}% formality level`
    });

    return changes;
  };

  const changes = analyzeChanges();

  return (
    <div className={`bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl ${className}`}>
      {/* Header */}
      <div 
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/5 transition-colors rounded-t-xl"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center space-x-3">
          <span className="text-lg">👁️</span>
          <h3 className="text-lg font-semibold text-white">AI Transparency</h3>
          <span className="text-sm text-gray-400">
            See how your style was applied
          </span>
        </div>
        <span className="text-gray-400">
          {isExpanded ? '▼' : '▶'}
        </span>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-white/10">
          {/* Quick Summary */}
          <div className="p-4 bg-gradient-to-r from-purple-500/10 to-blue-500/10">
            <div className="flex items-center space-x-2 mb-2">
              <span>⚙️</span>
              <h4 className="font-medium text-white">Processing Summary</h4>
            </div>
            <p className="text-sm text-gray-300">
              Applied your {profile.tone} tone with {(profile.formality * 100).toFixed(0)}% formality, 
              targeting {profile.styleAnalysis?.avgSentenceLength ? `${Math.round(profile.styleAnalysis.avgSentenceLength)}-word` : 'natural'} sentences 
              and {(profile.descriptiveness * 100).toFixed(0)}% descriptiveness.
            </p>
          </div>

          {/* Style Parameters Applied */}
          <div className="p-4">
            <button
              onClick={() => toggleSection('parameters')}
              className="flex items-center justify-between w-full text-left mb-3 hover:text-purple-400 transition-colors"
            >
              <h4 className="font-medium text-white">Style Parameters Applied</h4>
              <span className="text-gray-400">
                {activeSection === 'parameters' ? '▼' : '▶'}
              </span>
            </button>
            
            {activeSection === 'parameters' && (
              <div className="space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/5 rounded-lg p-3">
                    <div className="font-medium text-purple-400">Tone & Style</div>
                    <div className="text-gray-300 mt-1">
                      • Tone: {profile.tone}<br/>
                      • Formality: {(profile.formality * 100).toFixed(0)}%<br/>
                      • Directness: {(profile.directness * 100).toFixed(0)}%
                    </div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <div className="font-medium text-blue-400">Structure</div>
                    <div className="text-gray-300 mt-1">
                      • Pacing: {(profile.pacing * 100).toFixed(0)}%<br/>
                      • Descriptiveness: {(profile.descriptiveness * 100).toFixed(0)}%<br/>
                      {profile.customLexicon?.length > 0 && `• Custom words: ${profile.customLexicon.length}`}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Changes Made */}
          <div className="p-4 border-t border-white/10">
            <button
              onClick={() => toggleSection('changes')}
              className="flex items-center justify-between w-full text-left mb-3 hover:text-purple-400 transition-colors"
            >
              <h4 className="font-medium text-white">Specific Changes Made</h4>
              <span className="text-gray-400">
                {activeSection === 'changes' ? '▼' : '▶'}
              </span>
            </button>
            
            {activeSection === 'changes' && (
              <div className="space-y-3">
                {changes.map((change, index) => (
                  <div key={index} className="bg-white/5 rounded-lg p-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-medium text-green-400">{change.type}</div>
                        <div className="text-gray-300 text-sm mt-1">{change.description}</div>
                        <div className="text-gray-400 text-xs mt-1 italic">{change.reason}</div>
                      </div>
                    </div>
                  </div>
                ))}
                {changes.length === 0 && (
                  <div className="text-gray-400 text-sm">No significant structural changes detected.</div>
                )}
              </div>
            )}
          </div>

          {/* AI System Prompt Preview */}
          <div className="p-4 border-t border-white/10">
            <button
              onClick={() => toggleSection('prompt')}
              className="flex items-center justify-between w-full text-left mb-3 hover:text-purple-400 transition-colors"
            >
              <h4 className="font-medium text-white">AI Instructions Used</h4>
              <span className="text-gray-400">
                {activeSection === 'prompt' ? '▼' : '▶'}
              </span>
            </button>
            
            {activeSection === 'prompt' && (
              <div className="bg-gray-900/50 rounded-lg p-4 text-xs">
                <pre className="text-gray-300 whitespace-pre-wrap font-mono">
                  {buildSystemPromptPreview(profile)}
                </pre>
              </div>
            )}
          </div>

          {/* Debugging Info */}
          <div className="p-4 border-t border-white/10 bg-yellow-500/5">
            <div className="text-xs text-yellow-400 mb-2">🔍 Debugging Information</div>
            <div className="text-xs text-gray-400">
              Model: GROQ Llama3-70B • Temperature: 0.3 • 
              Original: {originalText.length} chars • 
              Result: {paraphrasedText.length} chars •
              Processing: AI + Cleanup Pipeline
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
