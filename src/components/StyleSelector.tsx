"use client";
import { useState } from 'react';

export type StylePreset = 'original' | 'formal' | 'casual' | 'academic' | 'professional' | 'creative';

interface StyleSelectorProps {
  selectedStyle: StylePreset;
  onStyleChange: (style: StylePreset) => void;
  disabled?: boolean;
  isPremium?: boolean;
}

const stylePresets: Record<StylePreset, { label: string; description: string; icon: string }> = {
  original: {
    label: 'My Style',
    description: 'Match your personal writing style from samples',
    icon: '✍️'
  },
  formal: {
    label: 'Formal',
    description: 'Professional, polished language for official contexts',
    icon: '📋'
  },
  casual: {
    label: 'Casual',
    description: 'Relaxed, conversational tone for everyday communication',
    icon: '💬'
  },
  academic: {
    label: 'Academic',
    description: 'Scholarly tone suitable for essays and research',
    icon: '🎓'
  },
  professional: {
    label: 'Professional',
    description: 'Clear, concise business communication style',
    icon: '💼'
  },
  creative: {
    label: 'Creative',
    description: 'Expressive, imaginative prose with flair',
    icon: '🎨'
  }
};

export default function StyleSelector({ selectedStyle, onStyleChange, disabled = false, isPremium = true }: StyleSelectorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const selected = stylePresets[selectedStyle];

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm font-medium text-slate-900 dark:text-white">
          Writing Style
        </label>
        {!isPremium && (
          <a href="/pricing" className="text-xs font-bold text-amber-500 flex items-center gap-1 hover:underline">
            👑 Premium Required
          </a>
        )}
      </div>
      
      {/* Dropdown trigger */}
      <button
        type="button"
        onClick={() => !disabled && isPremium && setIsExpanded(!isExpanded)}
        disabled={disabled || !isPremium}
        className={`
          w-full flex items-center justify-between gap-3 p-3 
          bg-slate-50 dark:bg-slate-800/80 border border-white/10 rounded-lg
          ${(disabled || !isPremium) ? 'opacity-50 cursor-not-allowed' : 'hover:border-blue-500/50 cursor-pointer'}
          transition-all
        `}
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">{selected.icon}</span>
          <div className="text-left">
            <div className="text-sm font-medium text-slate-900 dark:text-white">{selected.label}</div>
            <div className="text-xs text-slate-600 dark:text-slate-500 dark:text-slate-400">{selected.description}</div>
          </div>
        </div>
        <svg 
          className={`w-5 h-5 text-slate-600 dark:text-slate-500 dark:text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown menu */}
      {isExpanded && !disabled && isPremium && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsExpanded(false)}
          />
          
          {/* Options */}
          <div className="absolute z-20 w-full mt-2 bg-slate-50 dark:bg-slate-800 border border-white/10 rounded-lg shadow-xl overflow-hidden">
            {(Object.entries(stylePresets) as [StylePreset, typeof stylePresets[StylePreset]][]).map(([key, preset]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  onStyleChange(key);
                  setIsExpanded(false);
                }}
                className={`
                  w-full flex items-center gap-3 p-3 text-left transition-colors
                  ${selectedStyle === key 
                    ? 'bg-blue-500/20 border-l-2 border-blue-500' 
                    : 'hover:bg-slate-100 dark:bg-slate-700/50 border-l-2 border-transparent'}
                `}
              >
                <span className="text-xl">{preset.icon}</span>
                <div>
                  <div className="text-sm font-medium text-slate-900 dark:text-white">{preset.label}</div>
                  <div className="text-xs text-slate-600 dark:text-slate-500 dark:text-slate-400">{preset.description}</div>
                </div>
                {selectedStyle === key && (
                  <svg className="w-5 h-5 text-blue-400 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Quick style chips for mobile */}
      <div className="flex flex-wrap gap-2 mt-3">
        {(Object.entries(stylePresets) as [StylePreset, typeof stylePresets[StylePreset]][]).map(([key, preset]) => (
          <button
            key={key}
            type="button"
            onClick={() => !disabled && isPremium && onStyleChange(key)}
            disabled={disabled || !isPremium}
            className={`
              px-2.5 py-1 text-xs rounded-full flex items-center gap-1.5 transition-all
              ${selectedStyle === key 
                ? 'bg-blue-500 text-slate-900 dark:text-white' 
                : 'bg-slate-100 dark:bg-slate-700/50 text-slate-800 dark:text-slate-300 hover:bg-slate-600/50'}
              ${(disabled || !isPremium) ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            <span>{preset.icon}</span>
            <span>{preset.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function StyleChips({ 
  selectedStyle, 
  onStyleChange, 
  disabled = false,
  isPremium = true
}: StyleSelectorProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {(Object.entries(stylePresets) as [StylePreset, typeof stylePresets[StylePreset]][]).map(([key, preset]) => (
        <button
          key={key}
          type="button"
          onClick={() => !disabled && isPremium && onStyleChange(key)}
          disabled={disabled || !isPremium}
          className={`
            px-3 py-1.5 text-xs rounded-full flex items-center gap-1.5 transition-all
            ${selectedStyle === key 
              ? 'bg-blue-500 text-slate-900 dark:text-white shadow-lg shadow-blue-500/25' 
              : 'bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-300 border border-white/10 hover:border-blue-500/50'}
            ${(disabled || !isPremium) ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          <span>{preset.icon}</span>
          <span>{preset.label}</span>
        </button>
      ))}
    </div>
  );
}

// Get style instructions for API
export function getStyleInstructions(style: StylePreset): string {
  switch (style) {
    case 'original':
      return 'Match the user\'s personal writing style exactly as shown in their samples.';
    case 'formal':
      return 'Use formal, professional language. Avoid contractions, slang, and colloquialisms. Maintain a polished, respectful tone.';
    case 'casual':
      return 'Use relaxed, conversational language. Contractions are encouraged. Write as if speaking to a friend.';
    case 'academic':
      return 'Use scholarly, precise language. Avoid first person. Maintain objective tone. Use technical vocabulary appropriately.';
    case 'professional':
      return 'Use clear, concise business language. Be direct and action-oriented. Avoid jargon unless necessary.';
    case 'creative':
      return 'Use expressive, imaginative language. Employ vivid descriptions, metaphors, and varied sentence structures for impact.';
    default:
      return '';
  }
}
