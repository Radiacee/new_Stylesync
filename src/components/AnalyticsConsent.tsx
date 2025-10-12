"use client";
import { useState, useEffect } from 'react';
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

  useEffect(() => {
    loadConsent();
  }, [userId]);

  async function loadConsent() {
    setLoading(true);
    const currentConsent = await getUserConsent(userId);
    setConsent(currentConsent);
    
    // Check if user has previously acknowledged (stored in localStorage)
    const acknowledged = localStorage.getItem(`analytics_acknowledged_${userId}`);
    setHasAcknowledged(!!acknowledged);
    
    setLoading(false);
  }

  async function handleToggle() {
    setSaving(true);
    const newConsent = !consent;
    const success = await updateUserConsent(userId, newConsent);
    
    if (success) {
      setConsent(newConsent);
      onConsentChange?.(newConsent);
    } else {
      alert('Failed to update consent. Please try again.');
    }
    setSaving(false);
  }

  function handleAcknowledge() {
    localStorage.setItem(`analytics_acknowledged_${userId}`, 'true');
    setHasAcknowledged(true);
  }

  if (loading) {
    return null;
  }

  // Show full-screen modal if user hasn't acknowledged yet
  if (!hasAcknowledged) {
    return (
      <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-xl z-50 flex items-center justify-center p-4">
        <div className="max-w-3xl w-full glass-panel p-8 space-y-6 max-h-[90vh] overflow-auto">
          <div className="text-center space-y-3">
            <div className="text-5xl mb-4">📊</div>
            <h2 className="text-3xl font-bold text-white">Analytics & Data Sharing</h2>
            <p className="text-lg text-slate-300">
              Help us improve StyleSync by understanding how the tool is used
            </p>
          </div>

          <div className="space-y-4 text-slate-300">
            <div className="p-5 rounded-lg bg-slate-800/60 border border-white/10 space-y-3">
              <div>
                <div className="font-semibold text-white text-lg mb-2">📋 What data is collected?</div>
                <ul className="space-y-2 ml-4 list-disc text-slate-300">
                  <li>Your style settings (tone, formality, pacing, descriptiveness, directness)</li>
                  <li>Verification scores</li>
                  <li>Text lengths (character counts of input and output)</li>
                  <li className="font-medium text-brand-300">Your sample excerpt (ONLY if you opt-in below)</li>
                </ul>
              </div>
            </div>

            <div className="p-5 rounded-lg bg-slate-800/60 border border-white/10 space-y-3">
              <div>
                <div className="font-semibold text-white text-lg mb-2">🎯 How is it used?</div>
                <ul className="space-y-2 ml-4 list-disc text-slate-300">
                  <li>To identify which style combinations work best</li>
                  <li>To suggest successful style patterns to other users</li>
                  <li>To improve the overall paraphrasing algorithm</li>
                  <li>To understand user preferences and usage patterns</li>
                  <li className="font-medium text-emerald-300">All data is anonymized and aggregated</li>
                </ul>
              </div>
            </div>

            <div className="p-5 rounded-lg bg-slate-800/60 border border-white/10 space-y-3">
              <div>
                <div className="font-semibold text-white text-lg mb-2">🔒 Your control & privacy:</div>
                <ul className="space-y-2 ml-4 list-disc text-slate-300">
                  <li>Toggle sharing on or off at any time</li>
                  <li>Sample text excerpts require explicit opt-in consent</li>
                  <li>No personally identifiable information is shared</li>
                  <li>You can change your preferences anytime from the Analytics button</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="p-6 rounded-lg bg-gradient-to-r from-brand-500/10 to-purple-500/10 border border-brand-500/30">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="font-semibold text-white text-lg mb-2">
                  📝 Share my sample excerpt with style settings
                </div>
                <p className="text-sm text-slate-300">
                  {consent 
                    ? '✓ Your sample text will be included with successful style combinations to help other users'
                    : '✗ Only style parameters will be shared (no text content)'}
                </p>
              </div>
              <button
                onClick={handleToggle}
                disabled={saving}
                className={`relative inline-flex h-8 w-16 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${
                  consent ? 'bg-brand-500' : 'bg-slate-700'
                } ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <span
                  className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                    consent ? 'translate-x-9' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          <div className="flex justify-center pt-4">
            <button
              onClick={handleAcknowledge}
              className="px-8 py-4 rounded-lg bg-brand-500 hover:bg-brand-400 text-slate-900 font-bold text-lg transition-colors shadow-lg"
            >
              Continue to StyleSync
            </button>
          </div>

          <p className="text-xs text-center text-slate-500">
            By continuing, you acknowledge that you understand how analytics data is collected and used.
          </p>
        </div>
      </div>
    );
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
