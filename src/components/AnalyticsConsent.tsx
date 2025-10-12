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
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    loadConsent();
  }, [userId]);

  async function loadConsent() {
    setLoading(true);
    const currentConsent = await getUserConsent(userId);
    setConsent(currentConsent);
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

  if (loading) {
    return (
      <div className="glass-panel p-4">
        <div className="text-sm text-slate-400">Loading preferences...</div>
      </div>
    );
  }

  return (
    <div className="glass-panel p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="font-semibold text-white mb-1 flex items-center gap-2">
            📊 Analytics Sharing
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-xs px-2 py-0.5 rounded bg-slate-700/50 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              {showDetails ? 'Hide' : 'Details'}
            </button>
          </h3>
          <p className="text-sm text-slate-400">
            Help improve StyleSync by sharing your successful paraphrases
          </p>
        </div>
      </div>

      {showDetails && (
        <div className="p-4 rounded-lg bg-slate-800/40 border border-white/5 space-y-3 text-sm text-slate-300">
          <div>
            <div className="font-medium text-white mb-1">What data is collected?</div>
            <ul className="space-y-1 ml-4 list-disc text-slate-400">
              <li>Your style settings (tone, formality, pacing, etc.)</li>
              <li>Verification scores when they exceed 50%</li>
              <li>Text lengths (input and output)</li>
              <li><strong>Your sample excerpt (ONLY if you enable sharing)</strong></li>
            </ul>
          </div>
          <div>
            <div className="font-medium text-white mb-1">How is it used?</div>
            <ul className="space-y-1 ml-4 list-disc text-slate-400">
              <li>To suggest successful style combinations to other users</li>
              <li>To improve overall paraphrasing quality</li>
              <li>To understand which styles work best</li>
              <li>Your data is anonymized and aggregated</li>
            </ul>
          </div>
          <div>
            <div className="font-medium text-white mb-1">Your control:</div>
            <ul className="space-y-1 ml-4 list-disc text-slate-400">
              <li>Toggle on/off anytime</li>
              <li>Only high-quality results (50%+ match) are collected</li>
              <li>Sample excerpts require explicit consent</li>
              <li>No personally identifiable information is shared</li>
            </ul>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between p-4 rounded-lg bg-slate-800/30 border border-white/10">
        <div className="flex-1">
          <div className="font-medium text-white mb-1">
            Share my sample excerpt with style settings
          </div>
          <p className="text-xs text-slate-400">
            {consent 
              ? '✓ Your sample text will be included with your successful style combinations'
              : '✗ Only style settings will be shared (no text content)'}
          </p>
        </div>
        <button
          onClick={handleToggle}
          disabled={saving}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${
            consent ? 'bg-brand-500' : 'bg-slate-700'
          } ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              consent ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      <div className="text-xs text-slate-500">
        {consent 
          ? '✓ Sample excerpts will be shared with high-performing style settings'
          : 'ℹ️ Only style parameters will be collected (no text content)'}
      </div>
    </div>
  );
}
