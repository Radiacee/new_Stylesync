'use client';

import { CheckCircle, Shield, Zap } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

export default function PricingPage() {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText('09938845988');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen pt-24 pb-12 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 dark:text-white">
            Unlock <span className="inline-block bg-gradient-to-r from-brand-600 to-brand-500 dark:from-brand-300 dark:to-brand-400 bg-clip-text text-transparent pb-1 pr-2">StyleSync Premium</span>
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            Get unrestricted access to all writing styles, unlimited paraphrasing, and deep style analytics to perfect your voice.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 items-start">
          {/* Plan Details */}
          <div className="glass-panel p-8 sm:p-10 space-y-8 h-full flex flex-col">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Premium Plan</h2>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-5xl font-extrabold text-slate-900 dark:text-white">₱99</span>
                <span className="text-slate-600 dark:text-slate-400">/month</span>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-slate-900 dark:text-white">Everything you need:</h3>
              <ul className="space-y-3">
                {[
                  'Access to ALL Custom & Preset Styles',
                  'Unlimited Paraphrasing Words',
                  'Deep Style Analytics & Reports',
                  'Priority Support',
                ].map((feature, i) => (
                  <li key={i} className="flex items-start gap-3 text-slate-700 dark:text-slate-300">
                    <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="mt-auto pt-8">
              <div className="p-4 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-700 dark:text-brand-300 text-sm flex items-start gap-3">
                <Zap className="w-5 h-5 flex-shrink-0" />
                <p>Enhance your writing instantly. Your account will be upgraded within 24 hours of payment verification.</p>
              </div>
            </div>
          </div>

          {/* Payment Instructions */}
          <div className="glass-panel p-8 sm:p-10 h-full relative overflow-hidden flex flex-col">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
            
            <div className="relative z-10">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Payment Instructions
              </h2>
              <p className="text-slate-600 dark:text-slate-400 mt-2 text-sm">
                We currently accept GCash payments only. Follow the steps below to activate your premium account.
              </p>
            </div>

            <div className="space-y-6 relative z-10 mt-8">
              {/* Step 1 */}
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold flex-shrink-0">1</div>
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white">Send Payment via GCash</h3>
                  <div className="mt-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 space-y-2">
                    <p className="text-sm text-slate-600 dark:text-slate-400">GCash Name</p>
                    <p className="font-bold text-lg text-slate-900 dark:text-white">Christian Dave Banluta</p>
                    <div className="h-px bg-slate-200 dark:bg-white/10 my-2"></div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">GCash Number</p>
                    <div className="flex items-center justify-between gap-4">
                      <p className="font-bold text-2xl tracking-wider text-brand-600 dark:text-brand-400">09938845988</p>
                      <button 
                        onClick={handleCopy}
                        className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-xs font-medium transition-colors"
                      >
                        {copied ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold flex-shrink-0">2</div>
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white">Send Receipt via Email</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    Take a screenshot of your successful GCash transaction and email it to:
                  </p>
                  <a href="mailto:banlutachristiandave@gmail.com?subject=StyleSync%20Premium%20Payment" className="inline-block mt-2 font-semibold text-brand-600 dark:text-brand-400 hover:underline">
                    banlutachristiandave@gmail.com
                  </a>
                  <p className="text-xs text-slate-500 mt-2">
                    * Please use the email address associated with your StyleSync account so we can verify you quickly.
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold flex-shrink-0">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white">Wait for Confirmation</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    Once we verify your payment, we will activate your Premium status manually. This usually takes less than 24 hours.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
