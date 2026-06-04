'use client';

import { BarChart3 } from 'lucide-react';
import { useState } from 'react';

interface SurveyButtonProps {
  surveyLink?: string;
}

export default function SurveyButton({ surveyLink = 'https://forms.gle/5sZTqCYnBVCGTfUM9' }: SurveyButtonProps) {
  const [isHovered, setIsHovered] = useState(false);

  const handleClick = () => {
    window.open(surveyLink, '_blank', 'noopener,noreferrer');
  };

  return (
      <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3">
        <div
          className={`transition-all duration-200 ${
            isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
          }`}
          aria-hidden={!isHovered}
          role="tooltip"
        >
          <div className="w-56 p-4 rounded-lg text-xs text-white/90 bg-slate-900/90 backdrop-blur-md border border-white/10 shadow-xl">
            <div className="font-semibold text-sm text-white">📊 User Acceptance Testing</div>
            <div className="mt-2 text-[13px] text-white/70 leading-relaxed">Takes about 5 minutes. Your feedback helps us improve StyleSync.</div>
          </div>
        </div>

        <button
          onClick={handleClick}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onFocus={() => setIsHovered(true)}
          onBlur={() => setIsHovered(false)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick(); }}
          className={`p-3 rounded-full backdrop-blur-md transition-all duration-200 border focus:outline-none focus:ring-2 focus:ring-purple-400 ${
            isHovered
              ? 'bg-purple-500/50 border-purple-300/50 scale-105'
              : 'bg-purple-500/20 border-purple-400/30'
          }`}
          title="Take our quick survey"
          aria-label="Open quick survey (5 minutes)"
        >
          <BarChart3 className="w-6 h-6 text-purple-200" />
        </button>
      </div>
  );
}
