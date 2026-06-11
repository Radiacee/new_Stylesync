'use client';

import { useState, useEffect } from 'react';
import { X, MessageCircle, ExternalLink } from 'lucide-react';

interface UAT_FeedbackModalProps {
  formLink: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function UAT_FeedbackModal({ formLink, isOpen, onClose }: UAT_FeedbackModalProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(isOpen);
  }, [isOpen]);

  if (!isVisible) return null;

  const handleOpenForm = () => {
    window.open(formLink, '_blank', 'noopener,noreferrer');
  };

  const handleClose = () => {
    setIsVisible(false);
    onClose();
    // Save to localStorage so we don't show it again this session
    localStorage.setItem('uat_feedback_dismissed', 'true');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop with blur */}
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-md transition-opacity"
        onClick={handleClose}
      />

      {/* Transparent Modal with glassmorphism */}
      <div className="relative bg-white/10 dark:bg-slate-900/20 backdrop-blur-xl w-full max-w-3xl max-h-[calc(100vh-3rem)] rounded-3xl border border-white/20 dark:border-white/10 shadow-2xl">
        {/* Close button - sticky at top */}
        <button
          onClick={handleClose}
          className="absolute top-6 right-6 p-2 hover:bg-white/20 dark:hover:bg-white/10 rounded-lg transition-colors z-20"
        >
          <X className="w-6 h-6 text-slate-900 dark:text-white" />
        </button>

        {/* Content */}
        <div className="p-6 sm:p-8 max-h-[calc(100vh-4rem)] overflow-y-auto">
          <div className="max-w-3xl mx-auto space-y-6">
            {/* Icon */}
            <div className="flex justify-center">
              <div className="bg-blue-400/30 backdrop-blur-md p-4 rounded-full border border-blue-300/50">
                <MessageCircle className="w-8 h-8 text-blue-200" />
              </div>
            </div>

            {/* Heading */}
            <div className="space-y-4 text-center">
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
                Help Us Improve StyleSync! 🎯
              </h2>
              <p className="text-base sm:text-lg text-slate-900 dark:text-white/80 mx-auto max-w-2xl">
                Your feedback and screen recording are invaluable to us.
              </p>
            </div>

            <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
              {/* Main Description */}
              <div className="bg-white/5 backdrop-blur-md rounded-2xl p-5 sm:p-6 border border-white/10">
                <p className="text-slate-900 dark:text-white/90 text-sm sm:text-base leading-relaxed">
                  We're currently testing StyleSync and would love to hear about your experience. Your honest feedback helps us make the app better for everyone.
                </p>
              </div>

              {/* What we'd like to know */}
              <div className="bg-blue-400/10 backdrop-blur-md rounded-2xl p-5 sm:p-6 border border-blue-300/30">
                <p className="text-xs sm:text-sm font-semibold text-blue-200 uppercase tracking-[0.12em] mb-3">
                  We'd like to know:
                </p>
                <ul className="text-sm text-slate-900 dark:text-white/90 space-y-2">
                  <li className="flex items-start gap-3">
                    <span className="mt-1 text-blue-200">✓</span>
                    <span>What features worked well?</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="mt-1 text-blue-200">✓</span>
                    <span>What could be improved?</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="mt-1 text-blue-200">✓</span>
                    <span>Any bugs or issues you encountered?</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="mt-1 text-blue-200">✓</span>
                    <span>Your overall experience and suggestions</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
              {/* Screen Recording Instructions */}
              <div className="bg-amber-400/10 backdrop-blur-md rounded-2xl p-5 sm:p-6 border-l-4 border-amber-300/50">
                <p className="text-sm font-semibold text-amber-200 mb-3 flex items-center gap-2">
                  <span>📹</span>
                  <span>Important: Please Record Your Screen</span>
                </p>
                <p className="text-sm text-amber-100/90 leading-relaxed mb-3">
                  To assist with our analysis, please record your screen at each step while completing the evaluation.
                </p>
                <ul className="text-sm text-amber-100/90 space-y-2 ml-4">
                  <li className="flex items-start gap-2">
                    <span className="flex-shrink-0">✓</span>
                    <span>Navigating the website and testing features</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="flex-shrink-0">✓</span>
                    <span>Interacting with the paraphrase tool</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="flex-shrink-0">✓</span>
                    <span>Filling out this feedback form</span>
                  </li>
                </ul>
                <p className="text-sm text-amber-100/90 leading-relaxed mt-3">
                  Once finished, save the recording and <strong>upload it in the last section of the form</strong>.
                </p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-950/10 rounded-2xl p-5 sm:p-6 border border-white/10">
                <p className="text-sm text-slate-900 dark:text-white/80 leading-relaxed">
                  This modal is now designed to fit most screens without scrolling. If the form still extends beyond your viewport, try opening it in a new tab and complete the recording steps first.
                </p>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                onClick={handleOpenForm}
                className="w-full bg-blue-500 hover:bg-blue-600 text-slate-900 dark:text-white font-semibold py-3 rounded-2xl transition-colors flex items-center justify-center gap-2 text-base sm:text-lg backdrop-blur-sm border border-blue-400/50 hover:border-blue-300"
              >
                <span>Open Feedback Form</span>
                <ExternalLink className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>

              <button
                onClick={handleClose}
                className="w-full bg-white/10 hover:bg-white/20 text-slate-900 dark:text-white font-semibold py-3 rounded-2xl transition-colors text-base sm:text-lg backdrop-blur-sm border border-white/20 hover:border-white/30"
              >
                Close
              </button>
            </div>

            {/* Footer note */}
            <p className="text-xs sm:text-sm text-slate-900 dark:text-white/70 text-center">
              Takes about 5 minutes (including screen recording) • Your email is optional
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
