'use client';

import { useEffect, useState } from 'react';

export default function WelcomeModal() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Check if user has seen the welcome modal before
    const hasSeenWelcome = localStorage.getItem('hasSeenWelcome');
    
    if (!hasSeenWelcome) {
      // Show modal after a short delay for better UX
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    localStorage.setItem('hasSeenWelcome', 'true');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className="relative glass-panel max-w-lg w-full p-6 lg:p-8 space-y-6 animate-scale-in shadow-2xl">
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 rounded-lg hover:bg-white/10 transition-colors text-slate-400 hover:text-slate-200"
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Content */}
        <div className="space-y-4">
          {/* Icon/Badge */}
          <div className="w-12 h-12 rounded-full bg-brand-500/20 flex items-center justify-center">
            <svg className="w-6 h-6 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>

          {/* Title */}
          <h2 className="text-2xl lg:text-3xl font-bold text-slate-100">
            Welcome to StyleSync! 👋
          </h2>

          {/* Message */}
          <div className="space-y-3 text-slate-300">
            <p className="text-base lg:text-lg leading-relaxed">
              For the <span className="font-semibold text-brand-400">best accuracy</span> when creating your style profile, we recommend:
            </p>
            
            <ul className="space-y-2 pl-1">
              <li className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-brand-400 flex-shrink-0 mt-2"></div>
                <span><span className="font-semibold text-white">Use 0% AI content</span> — Your authentic writing style works best</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-brand-400 flex-shrink-0 mt-2"></div>
                <span><span className="font-semibold text-white">Submit your own words</span> — Original essays or writing samples</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-brand-400 flex-shrink-0 mt-2"></div>
                <span><span className="font-semibold text-white">Longer is better</span> — 200+ words give the AI more patterns to learn</span>
              </li>
            </ul>

            <div className="mt-4 p-4 rounded-lg bg-brand-500/10 border border-brand-400/20">
              <p className="text-sm text-slate-300">
                💡 <span className="font-medium">Pro tip:</span> If you have an essay or article you've written, that's perfect for capturing your unique voice!
              </p>
            </div>
          </div>
        </div>

        {/* Action button */}
        <button
          onClick={handleClose}
          className="w-full px-6 py-3 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-900 font-semibold shadow-subtle-glow transition"
        >
          Got it, let's begin!
        </button>
      </div>
    </div>
  );
}
