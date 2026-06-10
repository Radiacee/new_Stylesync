'use client';

import React from 'react';
// @ts-ignore
import ReactMarkdown from 'react-markdown';
// @ts-ignore
import remarkGfm from 'remark-gfm';
import { Sparkles, Check, Info } from 'lucide-react';

interface PresetStyleProofPanelProps {
  stylePreset: string;
  explanation: string;
}

const presetMetadata: Record<string, { label: string; icon: string; bgGradient: string; borderGlow: string }> = {
  formal: {
    label: 'Formal Style',
    icon: '📋',
    bgGradient: 'from-blue-500/10 to-indigo-500/10',
    borderGlow: 'hover:border-blue-500/40'
  },
  casual: {
    label: 'Casual Style',
    icon: '💬',
    bgGradient: 'from-emerald-500/10 to-teal-500/10',
    borderGlow: 'hover:border-emerald-500/40'
  },
  academic: {
    label: 'Academic Style',
    icon: '🎓',
    bgGradient: 'from-purple-500/10 to-pink-500/10',
    borderGlow: 'hover:border-purple-500/40'
  },
  professional: {
    label: 'Professional Style',
    icon: '💼',
    bgGradient: 'from-amber-500/10 to-orange-500/10',
    borderGlow: 'hover:border-amber-500/40'
  },
  creative: {
    label: 'Creative Style',
    icon: '🎨',
    bgGradient: 'from-cyan-500/10 to-blue-500/10',
    borderGlow: 'hover:border-cyan-500/40'
  }
};

export default function PresetStyleProofPanel({ stylePreset, explanation }: PresetStyleProofPanelProps) {
  const meta = presetMetadata[stylePreset] || {
    label: `${stylePreset.charAt(0).toUpperCase() + stylePreset.slice(1)} Style`,
    icon: '✨',
    bgGradient: 'from-brand-500/10 to-purple-500/10',
    borderGlow: 'hover:border-brand-500/40'
  };

  if (!explanation) return null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-3">
        <div className="flex items-center gap-2.5">
          <span className="text-xl sm:text-2xl">{meta.icon}</span>
          <div>
            <h3 className="font-bold text-white text-sm sm:text-base flex items-center gap-1.5">
              <span>{meta.label} Applied</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-medium flex items-center gap-0.5">
                <Check className="w-2.5 h-2.5" /> Verified
              </span>
            </h3>
            <p className="text-xs text-slate-400">Proof of style transformation and alignment</p>
          </div>
        </div>
        <Sparkles className="w-5 h-5 text-brand-300 animate-pulse" />
      </div>

      {/* Explanation Box */}
      <div className={`rounded-lg bg-gradient-to-r ${meta.bgGradient} border border-white/5 p-4`}>
        <div className="flex items-start gap-2.5 mb-3">
          <Info className="w-4 h-4 text-brand-300 mt-0.5" />
          <h4 className="text-xs font-semibold text-brand-300 uppercase tracking-wider">
            Why is this {stylePreset}?
          </h4>
        </div>

        <div className="prose prose-invert prose-xs sm:prose-sm max-w-none text-slate-300 leading-relaxed">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              ul: ({ children }: any) => <ul className="space-y-2.5 pl-0 list-none my-2">{children}</ul>,
              li: ({ children }: any) => (
                <li className="flex items-start gap-2.5 pl-0">
                  <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-brand-400/80 mt-2"></span>
                  <span className="text-xs text-slate-200">{children}</span>
                </li>
              ),
              p: ({ children }: any) => <p className="text-xs text-slate-300 my-1">{children}</p>,
              strong: ({ children }: any) => <strong className="font-semibold text-white">{children}</strong>,
              code: ({ children }: any) => (
                <code className="px-1.5 py-0.5 rounded bg-white/10 text-brand-300 font-mono text-[0.9em] break-all">
                  {children}
                </code>
              )
            }}
          >
            {explanation}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
