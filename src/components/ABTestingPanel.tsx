import { useCallback, useEffect, useState } from 'react';
import { Microscope, Circle, CheckCircle2, RotateCw, Lightbulb } from 'lucide-react';
import { getStyleInstructions, type StylePreset } from './StyleSelector';

interface ABTestingPanelProps {
  paraphrasedText: string;
}

interface StyleVersions {
  professional: string;
  withStyle: string;
  casual: string;
}

async function restyleResult(baseResult: string, stylePreset: Exclude<StylePreset, 'original'>): Promise<string> {
  const response = await fetch('/api/paraphrase', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: baseResult,
      useModel: true,
      profile: null,
      debug: false,
      stylePreset,
      styleInstructions: getStyleInstructions(stylePreset),
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to generate ${stylePreset} style`);
  }

  const data = await response.json();
  return typeof data.result === 'string' && data.result.trim() ? data.result : baseResult;
}

export default function ABTestingPanel({ paraphrasedText }: ABTestingPanelProps) {
  const [showPanel, setShowPanel] = useState(false);
  const [versions, setVersions] = useState<StyleVersions | null>(null);
  const [generating, setGenerating] = useState(false);
  const [variantError, setVariantError] = useState<string | null>(null);

  const generateVersions = useCallback(async () => {
    const baseResult = paraphrasedText.trim();
    if (!baseResult) return;
    
    setGenerating(true);
    setVariantError(null);
    
    try {
      const [professionalVersion, casualVersion] = await Promise.all([
        restyleResult(baseResult, 'professional'),
        restyleResult(baseResult, 'casual'),
      ]);

      setVersions({
        professional: professionalVersion,
        withStyle: baseResult,
        casual: casualVersion,
      });
    } catch (error) {
      setVariantError(error instanceof Error ? error.message : 'Failed to generate style options');
      setVersions({
        professional: baseResult,
        withStyle: baseResult,
        casual: baseResult,
      });
    } finally {
      setGenerating(false);
    }
  }, [paraphrasedText]);

  useEffect(() => {
    setVersions(null);
    if (showPanel) {
      generateVersions();
    }
  }, [generateVersions, showPanel]);

  return (
    <div className="mt-6">
      <button
        onClick={() => {
          setShowPanel(!showPanel);
        }}
        className="w-full py-3 bg-gradient-to-r from-brand-600 to-brand-700 hover:from-brand-700 hover:to-brand-800 text-white rounded-lg font-medium transition-all duration-300 flex items-center justify-center gap-2"
      >
        <Microscope className="w-4 h-4" />
        <span>{showPanel ? 'Hide' : 'Show'} A/B/C Style Comparison</span>
      </button>

      {showPanel && (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-slate-400 mb-4">
            Compare how different style settings treat the paraphrased result.
          </p>

          {generating ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-400"></div>
            </div>
          ) : versions ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Version A: Professional */}
              <div className="bg-slate-800/40 border border-white/10 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Circle className="w-5 h-5 text-slate-400" />
                  <div>
                    <h4 className="font-semibold text-white">Version A: Professional</h4>
                    <p className="text-xs text-slate-500">Clear business style</p>
                  </div>
                </div>
                <div className="bg-slate-900/60 rounded-lg p-3 text-sm text-slate-300 min-h-[120px]">
                  {versions.professional}
                </div>
                <div className="mt-3 text-xs text-slate-500">
                  Restyled from the generated result
                </div>
              </div>

              {/* Version B: With User's Style */}
              <div className="bg-gradient-to-br from-emerald-900/30 to-teal-900/20 border-2 border-brand-500/50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <div>
                    <h4 className="font-semibold text-emerald-400">Version B: Your Style</h4>
                    <p className="text-xs text-slate-400">Current paraphrased result</p>
                  </div>
                </div>
                <div className="bg-slate-900/60 rounded-lg p-3 text-sm text-slate-300 min-h-[120px]">
                  {versions.withStyle}
                </div>
                <div className="mt-3 text-xs text-emerald-400 font-medium flex items-center gap-1">
                  <span>*</span> This is the generated result
                </div>
              </div>

              {/* Version C: Casual Style */}
              <div className="bg-slate-800/40 border border-white/10 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <RotateCw className="w-5 h-5 text-slate-400" />
                  <div>
                    <h4 className="font-semibold text-white">Version C: Casual</h4>
                    <p className="text-xs text-slate-500">Relaxed result style</p>
                  </div>
                </div>
                <div className="bg-slate-900/60 rounded-lg p-3 text-sm text-slate-300 min-h-[120px]">
                  {versions.casual}
                </div>
                <div className="mt-3 text-xs text-slate-500">
                  Restyled from the generated result
                </div>
              </div>
            </div>
          ) : null}

          {variantError && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
              Style variants could not be generated, so the current result is shown instead. {variantError}
            </div>
          )}

          {versions && (
            <div className="mt-4 p-4 bg-brand-900/20 border border-brand-500/30 rounded-lg">
              <h5 className="text-brand-300 font-medium mb-2 flex items-center gap-2">
                <Lightbulb className="w-4 h-4" />
                What This Proves
              </h5>
              <ul className="text-sm text-slate-300 space-y-1">
                <li>- <strong>Version A</strong> shows a professional style treatment of the paraphrased result</li>
                <li>- <strong>Version B</strong> shows the exact generated result</li>
                <li>- <strong>Version C</strong> shows a casual style treatment of that same result</li>
                <li>- The comparison starts from the result, not the original input</li>
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
