import React, { useState } from 'react';
import EnhancedStyleComparisonPanel from './EnhancedStyleComparisonPanel';
import { useStructuredComparison } from '../hooks/useStructuredComparison';

/**
 * Example: Enhanced Style Analysis Integration
 * Step 5: Complete example showing how to use the new UI panel
 * 
 * This component demonstrates:
 * 1. Importing the hook and component
 * 2. Managing paraphrase state
 * 3. Fetching structured comparison data
 * 4. Rendering the enhanced UI panel
 */

interface ParaphraseResult {
  originalText: string;
  paraphrasedText: string;
  userSample: string;
}

export default function EnhancedAnalysisExample() {
  const [paraphraseResult, setParaphraseResult] = useState<ParaphraseResult | null>(null);
  const [paraphraseLoading, setParaphraseLoading] = useState(false);
  const [paraphraseError, setParaphraseError] = useState<string | null>(null);

  // Hook to fetch structured comparison
  const { comparison, loading: comparisonLoading, error: comparisonError, fetchComparison } = useStructuredComparison();

  // Simulate paraphrasing
  const handleParaphrase = async (userSample: string, originalText: string) => {
    setParaphraseLoading(true);
    setParaphraseError(null);

    try {
      // Call your paraphrase API
      const response = await fetch('/api/paraphrase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userSample, originalText }),
      });

      if (!response.ok) {
        throw new Error('Failed to paraphrase');
      }

      const data = await response.json();
      const result = {
        userSample,
        originalText,
        paraphrasedText: data.paraphrased,
      };

      setParaphraseResult(result);

      // Automatically fetch structured comparison after successful paraphrase
      await fetchComparison(result.userSample, result.originalText, result.paraphrasedText);
    } catch (error) {
      setParaphraseError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setParaphraseLoading(false);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="border-b border-white/10 pb-6">
        <h1 className="text-3xl font-bold text-white mb-2">Enhanced Style Analysis Example</h1>
        <p className="text-slate-400">
          This example demonstrates the complete Step 5 integration with the new structured metrics UI panel.
        </p>
      </div>

      {/* Input Section */}
      <div className="bg-slate-800/30 rounded-lg border border-white/10 p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Input Your Text</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white mb-2">Your Writing Style Sample</label>
            <textarea
              id="userSample"
              placeholder="Enter a sample of your writing style..."
              className="w-full h-32 bg-slate-900 text-white rounded px-3 py-2 border border-white/10 focus:border-blue-500 resize-none"
              defaultValue="The quick brown fox jumps over the lazy dog. This is my writing style."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">Text to Paraphrase</label>
            <textarea
              id="originalText"
              placeholder="Enter text you want paraphrased..."
              className="w-full h-32 bg-slate-900 text-white rounded px-3 py-2 border border-white/10 focus:border-blue-500 resize-none"
              defaultValue="The rapid vermillion fox leaps across the lethargic canine."
            />
          </div>

          <button
            onClick={() => {
              const userSample = (document.getElementById('userSample') as HTMLTextAreaElement).value;
              const originalText = (document.getElementById('originalText') as HTMLTextAreaElement).value;
              handleParaphrase(userSample, originalText);
            }}
            disabled={paraphraseLoading || comparisonLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 text-white font-medium py-2 px-4 rounded transition-colors"
          >
            {paraphraseLoading ? 'Paraphrasing...' : comparisonLoading ? 'Analyzing...' : 'Paraphrase & Analyze'}
          </button>
        </div>

        {/* Error Messages */}
        {paraphraseError && (
          <div className="mt-4 p-3 bg-red-900/20 border border-red-500/30 text-red-400 rounded text-sm">
            Paraphrase Error: {paraphraseError}
          </div>
        )}
        {comparisonError && (
          <div className="mt-4 p-3 bg-red-900/20 border border-red-500/30 text-red-400 rounded text-sm">
            Analysis Error: {comparisonError}
          </div>
        )}
      </div>

      {/* Results Section */}
      {paraphraseResult && (
        <div className="space-y-6">
          {/* Paraphrase Results */}
          <div className="bg-slate-800/30 rounded-lg border border-white/10 p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Paraphrase Results</h2>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-medium text-slate-400 mb-2">Original</h3>
                <div className="bg-slate-900 rounded p-3 text-white text-sm border border-white/5">
                  {paraphraseResult.originalText}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium text-slate-400 mb-2">Paraphrased</h3>
                <div className="bg-slate-900 rounded p-3 text-white text-sm border border-white/5">
                  {paraphraseResult.paraphrasedText}
                </div>
              </div>
            </div>
          </div>

          {/* Enhanced Style Analysis Panel */}
          {comparison ? (
            <EnhancedStyleComparisonPanel
              comparison={comparison}
              className="w-full"
            />
          ) : comparisonLoading ? (
            <div className="bg-slate-800/30 rounded-lg border border-white/10 p-12 text-center">
              <div className="inline-block">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
              </div>
              <p className="text-slate-400 mt-4">Analyzing style metrics...</p>
            </div>
          ) : null}
        </div>
      )}

      {/* Info Section */}
      <div className="bg-slate-800/20 rounded-lg border border-white/10 p-6">
        <h3 className="text-lg font-semibold text-white mb-3">How This Works</h3>
        <ol className="space-y-2 text-sm text-slate-400">
          <li><strong className="text-white">Step 1:</strong> Enter your writing style sample (teaches the system your style)</li>
          <li><strong className="text-white">Step 2:</strong> Enter text to paraphrase</li>
          <li><strong className="text-white">Step 3:</strong> Click "Paraphrase & Analyze"</li>
          <li><strong className="text-white">Step 4:</strong> System paraphrases while maintaining your style</li>
          <li><strong className="text-white">Step 5:</strong> Structured metrics are analyzed and displayed</li>
          <li><strong className="text-white">Step 6:</strong> Enhanced panel shows 5 metric groups with alignment ratings</li>
        </ol>
        
        <div className="mt-4 pt-4 border-t border-white/10">
          <p className="text-xs text-slate-500">
            The enhanced UI shows detailed metrics across: Structural Analysis, Vocabulary & Complexity, 
            Sentence Style & Flow, Tone & Formality, and Descriptiveness & Detail.
          </p>
        </div>
      </div>
    </div>
  );
}
