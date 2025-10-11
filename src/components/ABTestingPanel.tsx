import { useState } from 'react';
import { StyleProfile } from '../lib/styleProfile';
import { paraphraseWithProfile } from '../lib/paraphrase';

interface ABTestingPanelProps {
  inputText: string;
  userProfile: StyleProfile | null;
}

export default function ABTestingPanel({ inputText, userProfile }: ABTestingPanelProps) {
  const [showPanel, setShowPanel] = useState(false);
  const [versions, setVersions] = useState<{
    generic: string;
    withStyle: string;
    alternative: string;
  } | null>(null);
  const [generating, setGenerating] = useState(false);

  const generateVersions = () => {
    if (!inputText.trim()) return;
    
    setGenerating(true);
    
    // Version A: Generic paraphrasing (no style)
    const genericVersion = paraphraseWithProfile(inputText, undefined);
    
    // Version B: With user's style profile
    const styledVersion = paraphraseWithProfile(inputText, userProfile || undefined);
    
    // Version C: With a contrasting style profile (opposite settings)
    const alternativeProfile: StyleProfile = {
      id: 'alt',
      name: 'Alternative',
      tone: 'contrasting',
      formality: 1 - (userProfile?.formality || 0.5),
      descriptiveness: 1 - (userProfile?.descriptiveness || 0.5),
      directness: 1 - (userProfile?.directness || 0.5),
      pacing: 1 - (userProfile?.pacing || 0.5),
      sampleExcerpt: '',
      customLexicon: [],
      notes: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const alternativeVersion = paraphraseWithProfile(inputText, alternativeProfile);
    
    setVersions({
      generic: genericVersion,
      withStyle: styledVersion,
      alternative: alternativeVersion,
    });
    
    setGenerating(false);
  };

  return (
    <div className="mt-6">
      <button
        onClick={() => {
          setShowPanel(!showPanel);
          if (!showPanel && !versions) {
            generateVersions();
          }
        }}
        className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-lg font-medium transition-all duration-300 flex items-center justify-center gap-2"
      >
        <span>🔬</span>
        <span>{showPanel ? 'Hide' : 'Show'} A/B/C Style Comparison</span>
      </button>

      {showPanel && (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-gray-400 mb-4">
            Compare how different style settings transform the same text. This proves your style profile makes a real difference!
          </p>

          {generating ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400"></div>
            </div>
          ) : versions ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Version A: Generic */}
              <div className="bg-slate-800/40 border border-white/10 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">⚪</span>
                  <div>
                    <h4 className="font-semibold text-white">Version A: Generic</h4>
                    <p className="text-xs text-gray-500">No style applied</p>
                  </div>
                </div>
                <div className="bg-slate-900/60 rounded-lg p-3 text-sm text-gray-300 min-h-[120px]">
                  {versions.generic}
                </div>
                <div className="mt-3 text-xs text-gray-500">
                  Basic paraphrasing without personalization
                </div>
              </div>

              {/* Version B: With User's Style */}
              <div className="bg-gradient-to-br from-green-900/20 to-emerald-900/20 border-2 border-green-500/50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">✅</span>
                  <div>
                    <h4 className="font-semibold text-green-400">Version B: Your Style</h4>
                    <p className="text-xs text-gray-400">With your profile applied</p>
                  </div>
                </div>
                <div className="bg-slate-900/60 rounded-lg p-3 text-sm text-gray-300 min-h-[120px]">
                  {versions.withStyle}
                </div>
                <div className="mt-3 text-xs text-green-400 font-medium">
                  ⭐ This matches YOUR writing style
                </div>
              </div>

              {/* Version C: Alternative Style */}
              <div className="bg-slate-800/40 border border-white/10 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">🔄</span>
                  <div>
                    <h4 className="font-semibold text-white">Version C: Opposite</h4>
                    <p className="text-xs text-gray-500">Contrasting style settings</p>
                  </div>
                </div>
                <div className="bg-slate-900/60 rounded-lg p-3 text-sm text-gray-300 min-h-[120px]">
                  {versions.alternative}
                </div>
                <div className="mt-3 text-xs text-gray-500">
                  Different formality, directness & descriptiveness
                </div>
              </div>
            </div>
          ) : null}

          {versions && (
            <div className="mt-4 p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
              <h5 className="text-blue-300 font-medium mb-2">💡 What This Proves</h5>
              <ul className="text-sm text-gray-300 space-y-1">
                <li>• <strong>Version A</strong> shows generic output without any personalization</li>
                <li>• <strong>Version B</strong> demonstrates your style profile is actively applied</li>
                <li>• <strong>Version C</strong> confirms different settings produce different results</li>
                <li>• The clear differences prove StyleSync adapts to YOUR preferences</li>
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
