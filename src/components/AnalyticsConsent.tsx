"use client";
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getUserConsent, updateUserConsent } from '../lib/analytics';

interface AnalyticsConsentProps {
  userId: string;
  onConsentChange?: (consent: boolean) => void;
}

export default function AnalyticsConsent({ userId, onConsentChange }: AnalyticsConsentProps) {
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasAcknowledged, setHasAcknowledged] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  
  const totalSteps = 4;

  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  useEffect(() => {
    loadConsent();
  }, [userId]);

  async function loadConsent() {
    setLoading(true);
    const currentConsent = await getUserConsent(userId);
    // Default to false (off) if no consent found
    setConsent(currentConsent || false);
    
    // Check if user has previously acknowledged (stored in localStorage)
    const acknowledged = localStorage.getItem(`analytics_acknowledged_${userId}`);
    setHasAcknowledged(!!acknowledged);
    
    setLoading(false);
  }

  async function handleToggle(e?: React.MouseEvent) {
    e?.preventDefault();
    e?.stopPropagation();
    
    // Optimistic UI update - change immediately
    const newConsent = !consent;
    setConsent(newConsent);
    onConsentChange?.(newConsent);
    
    // Then update the database in the background
    setSaving(true);
    const success = await updateUserConsent(userId, newConsent);
    
    if (!success) {
      // Revert if failed
      setConsent(!newConsent);
      onConsentChange?.(!newConsent);
      alert('Failed to update consent. Please try again.');
    }
    setSaving(false);
  }

  function handleNext() {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  }

  function handleBack() {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  }

  function handleFinish() {
    handleAcknowledge();
  }

  function handleAcknowledge() {
    localStorage.setItem(`analytics_acknowledged_${userId}`, 'true');
    setHasAcknowledged(true);
  }

  if (loading) {
    return null;
  }

  // Modal content component
  const ModalContent = () => (
    <div 
      className="fixed inset-0 bg-slate-900/95 backdrop-blur-xl z-50 flex items-center justify-center p-4"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="max-w-2xl w-full glass-panel p-6 sm:p-8 space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="text-4xl sm:text-5xl mb-3">📊</div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">Analytics & Data Sharing</h2>
          <p className="text-sm sm:text-base text-slate-300">
            Help us improve StyleSync by understanding how the tool is used
          </p>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-slate-400">
            <span>{currentStep} of {totalSteps}</span>
            <span>{Math.round((currentStep / totalSteps) * 100)}%</span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
            <div 
              className="bg-gradient-to-r from-brand-500 to-purple-500 h-full transition-all duration-500 ease-out"
              style={{ width: `${(currentStep / totalSteps) * 100}%` }}
            />
          </div>
        </div>

        {/* Step Content */}
        <div className="min-h-[300px] flex flex-col justify-between">
          {currentStep === 1 && (
            <div key="step-1" className="space-y-4 animate-fadeIn">
              <div className="p-5 rounded-lg bg-slate-800/60 border border-white/10">
                <div className="font-semibold text-white text-lg mb-3">📋 What data is collected?</div>
                <ul className="space-y-2.5 ml-4 list-disc text-slate-300 text-sm sm:text-base">
                  <li>Your style settings (tone, formality, pacing, descriptiveness, directness)</li>
                  <li>Verification scores</li>
                  <li>Text lengths (character counts of input and output)</li>
                  <li className="font-medium text-brand-300">Your sample excerpt (ONLY if you opt-in)</li>
                </ul>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div key="step-2" className="space-y-4 animate-fadeIn">
              <div className="p-5 rounded-lg bg-slate-800/60 border border-white/10">
                <div className="font-semibold text-white text-lg mb-3">🎯 How is it used?</div>
                <ul className="space-y-2.5 ml-4 list-disc text-slate-300 text-sm sm:text-base">
                  <li>To identify which style combinations work best</li>
                  <li>To suggest successful style patterns to other users</li>
                  <li>To improve the overall paraphrasing algorithm</li>
                  <li>To understand user preferences and usage patterns</li>
                  <li className="font-medium text-emerald-300">All data is anonymized and aggregated</li>
                </ul>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div key="step-3" className="space-y-4 animate-fadeIn">
              <div className="p-5 rounded-lg bg-slate-800/60 border border-white/10">
                <div className="font-semibold text-white text-lg mb-3">🔒 Your control & privacy:</div>
                <ul className="space-y-2.5 ml-4 list-disc text-slate-300 text-sm sm:text-base">
                  <li>Toggle sharing on or off at any time</li>
                  <li>Sample text excerpts require explicit opt-in consent</li>
                  <li>No personally identifiable information is shared</li>
                  <li>You can change your preferences anytime from the Analytics button</li>
                </ul>
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div key="step-4" className="space-y-6">{/* Removed animate-fadeIn */}
              <div className="p-6 rounded-lg bg-gradient-to-br from-brand-500/10 to-purple-500/10 border border-brand-500/30">
                <div className="text-center mb-6">
                  <div className="font-bold text-white text-xl mb-3">
                    📝 Share Sample Excerpt?
                  </div>
                  <p className="text-sm text-slate-400">
                    Choose whether to share sample text with your style settings
                  </p>
                </div>
                
                <div className="flex items-center justify-center mb-6">
                  <button
                    onClick={handleToggle}
                    disabled={saving}
                    className={`relative inline-flex h-12 w-24 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${
                      consent ? 'bg-brand-500' : 'bg-slate-700'
                    } ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
                    title={consent ? 'Click to disable sharing' : 'Click to enable sharing'}
                    type="button"
                  >
                    <span
                      className={`inline-block h-10 w-10 transform rounded-full bg-white transition-transform shadow-lg ${
                        consent ? 'translate-x-12' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-center gap-2 text-sm">
                    <div className={`w-3 h-3 rounded-full ${consent ? 'bg-brand-500' : 'bg-slate-500'}`}></div>
                    <span className={`font-semibold ${consent ? 'text-brand-300' : 'text-slate-400'}`}>
                      {consent ? '✓ Sharing enabled' : '✗ Sharing disabled'}
                    </span>
                  </div>
                  
                  <p className="text-xs text-center text-slate-400 italic">
                    {consent 
                      ? 'Sample text will be included with successful style combinations'
                      : 'Only style parameters will be shared (no text content)'}
                  </p>
                </div>
              </div>

              <p className="text-xs text-center text-slate-500 leading-relaxed">
                By continuing, you acknowledge that you understand how analytics data is collected and used.
              </p>
            </div>
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between pt-4 border-t border-white/10">
          <button
            onClick={handleBack}
            disabled={currentStep === 1}
            className={`px-6 py-2.5 rounded-lg font-semibold transition-all ${
              currentStep === 1
                ? 'bg-slate-800/40 text-slate-600 cursor-not-allowed'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white'
            }`}
          >
            ← Back
          </button>

          {currentStep < totalSteps ? (
            <button
              onClick={handleNext}
              className="px-6 py-2.5 rounded-lg bg-brand-500 hover:bg-brand-400 text-slate-900 font-bold transition-colors shadow-lg"
            >
              Next →
            </button>
          ) : (
            <button
              onClick={handleFinish}
              className="px-8 py-2.5 rounded-lg bg-gradient-to-r from-brand-500 to-purple-500 hover:from-brand-400 hover:to-purple-400 text-white font-bold transition-all shadow-lg"
            >
              Continue to StyleSync ✓
            </button>
          )}
        </div>
      </div>
    </div>
  );

  // Show full-screen modal if user hasn't acknowledged yet
  if (!hasAcknowledged) {
    // Use portal to render at document root, ensuring full-screen display
    return isMounted ? createPortal(<ModalContent />, document.body) : null;
  }

  // After acknowledgment, show a small settings button
  return (
    <button
      onClick={() => {
        setHasAcknowledged(false); // Re-show the full modal
      }}
      className="flex items-center gap-2 px-4 py-2 rounded-lg border border-white/10 hover:border-brand-400/60 bg-slate-800/40 hover:bg-slate-800/60 transition-all group"
      title="Analytics Sharing Settings"
    >
      <span className="text-base">📊</span>
      <span className="text-xs font-medium text-slate-400 group-hover:text-brand-300 transition-colors">
        Analytics
      </span>
      <div className={`w-1.5 h-1.5 rounded-full transition-colors ${consent ? 'bg-brand-500 shadow-[0_0_8px_rgba(139,92,246,0.5)]' : 'bg-slate-500'}`} 
           title={consent ? 'Sharing enabled' : 'Sharing disabled'} />
    </button>
  );
}
