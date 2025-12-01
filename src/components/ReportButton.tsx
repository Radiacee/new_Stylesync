"use client";
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface ReportButtonProps {
  contentText: string;
  userId?: string | null;
  variant?: 'icon' | 'text' | 'full';
  className?: string;
}

type ReportType = 'inappropriate_content' | 'hate_speech' | 'spam' | 'copyright' | 'other';

export default function ReportButton({ contentText, userId, variant = 'icon', className = '' }: ReportButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const [reportType, setReportType] = useState<ReportType>('inappropriate_content');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  async function handleSubmit() {
    if (!contentText.trim()) return;
    
    setSubmitting(true);
    setError(null);
    
    try {
      const response = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportType,
          contentText,
          description: description.trim() || undefined,
          userId: userId || undefined
        })
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to submit report');
      }
      
      setSubmitted(true);
      setTimeout(() => {
        setShowModal(false);
        setSubmitted(false);
        setDescription('');
        setReportType('inappropriate_content');
      }, 2000);
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const reportTypes: { value: ReportType; label: string; description: string }[] = [
    { value: 'inappropriate_content', label: 'Inappropriate Content', description: 'Vulgar, offensive, or inappropriate language' },
    { value: 'hate_speech', label: 'Hate Speech', description: 'Racist, discriminatory, or hateful content' },
    { value: 'spam', label: 'Spam', description: 'Irrelevant or promotional content' },
    { value: 'copyright', label: 'Copyright Issue', description: 'Content that violates copyright' },
    { value: 'other', label: 'Other', description: 'Other issues not listed above' }
  ];

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => setShowModal(true)}
        className={`transition-colors ${className} ${
          variant === 'icon' 
            ? 'p-1.5 rounded hover:bg-red-500/20 text-slate-400 hover:text-red-400' 
            : variant === 'text'
            ? 'text-xs text-slate-400 hover:text-red-400'
            : 'px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30'
        }`}
        title="Report inappropriate content"
      >
        {variant === 'icon' ? (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
          </svg>
        ) : variant === 'text' ? (
          'Report'
        ) : (
          <>
            <svg className="w-3.5 h-3.5 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
            </svg>
            Report Issue
          </>
        )}
      </button>

      {/* Full Screen Modal - Rendered via Portal */}
      {showModal && mounted && createPortal(
        <div className="fixed inset-0 bg-slate-900/98 backdrop-blur-xl z-50 overflow-y-auto">
          <div className="min-h-screen flex flex-col">
            {/* Header */}
            <div className="sticky top-0 bg-slate-900/95 backdrop-blur-sm border-b border-white/10 px-6 py-4 z-10">
              <div className="max-w-2xl mx-auto flex items-center justify-between">
                <h3 className="text-xl font-semibold text-white flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                    <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                    </svg>
                  </div>
                  Report Content
                </h3>
                <button 
                  onClick={() => setShowModal(false)}
                  className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 px-6 py-8">
              <div className="max-w-2xl mx-auto">
                {submitted ? (
                  <div className="text-center py-16">
                    <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                      <svg className="w-12 h-12 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <h4 className="text-2xl font-semibold text-white mb-3">Report Submitted</h4>
                    <p className="text-slate-300 mb-8">Thank you for helping keep our community safe.</p>
                    <button
                      onClick={() => {
                        setShowModal(false);
                        setSubmitted(false);
                        setDescription('');
                        setReportType('inappropriate_content');
                      }}
                      className="px-6 py-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium transition"
                    >
                      Close
                    </button>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {/* Report Type Selection */}
                    <div className="space-y-4">
                      <label className="text-lg font-medium text-white">What type of issue are you reporting?</label>
                      <div className="grid gap-3">
                        {reportTypes.map(type => (
                          <div 
                            key={type.value}
                            onClick={() => setReportType(type.value)}
                            className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition ${
                              reportType === type.value 
                                ? 'border-red-500 bg-red-500/10' 
                                : 'border-white/10 hover:border-white/20 bg-slate-800/50'
                            }`}
                          >
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                              reportType === type.value ? 'border-red-500' : 'border-slate-500'
                            }`}>
                              {reportType === type.value && (
                                <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                              )}
                            </div>
                            <div className="flex-1">
                              <div className="text-base font-medium text-white">{type.label}</div>
                              <div className="text-sm text-slate-400">{type.description}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Content Preview */}
                    <div className="space-y-3">
                      <label className="text-lg font-medium text-white">Content being reported</label>
                      <div className="bg-slate-800/60 border border-white/10 rounded-xl p-4 max-h-48 overflow-y-auto">
                        <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{contentText.slice(0, 500)}{contentText.length > 500 ? '...' : ''}</p>
                      </div>
                    </div>

                    {/* Additional Description */}
                    <div className="space-y-3">
                      <label className="text-lg font-medium text-white">Additional details <span className="text-slate-500 font-normal">(optional)</span></label>
                      <textarea
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        placeholder="Provide any additional context about this report..."
                        rows={4}
                        className="w-full bg-slate-800/60 border border-white/10 rounded-xl px-4 py-3 text-base text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition"
                        maxLength={1000}
                      />
                      <p className="text-sm text-slate-500">{description.length}/1000 characters</p>
                    </div>

                    {/* Error Message */}
                    {error && (
                      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                        <p className="text-base text-red-400">{error}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Footer Actions */}
            {!submitted && (
              <div className="sticky bottom-0 bg-slate-900/95 backdrop-blur-sm border-t border-white/10 px-6 py-4">
                <div className="max-w-2xl mx-auto">
                  <div className="flex gap-4">
                    <button
                      onClick={() => setShowModal(false)}
                      className="flex-1 px-6 py-3 rounded-xl border border-white/10 text-slate-300 hover:border-white/20 hover:bg-white/5 transition font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={submitting}
                      className="flex-1 px-6 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {submitting ? (
                        <span className="flex items-center justify-center gap-2">
                          <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Submitting...
                        </span>
                      ) : 'Submit Report'}
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 text-center mt-4">
                    Reports are reviewed by our team. False reports may result in action against your account.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
