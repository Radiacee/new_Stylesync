"use client";

import { useState, useEffect } from 'react';
import { Clock, CheckCircle, XCircle, AlertTriangle, AlertCircle } from 'lucide-react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabaseClient';

interface Report {
  id: string;
  report_type: string;
  content_text: string;
  description: string | null;
  status: 'pending' | 'reviewed' | 'dismissed' | 'actioned';
  admin_action: string | null;
  created_at: string;
}

interface MyReportsModalProps {
  userId: string;
  onClose: () => void;
}

export default function MyReportsModal({ userId, onClose }: MyReportsModalProps) {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetchReports();
    return () => setMounted(false);
  }, [userId]);

  async function fetchReports() {
    try {
      const session = await supabase?.auth.getSession();
      const token = session?.data?.session?.access_token;

      const response = await fetch(`/api/report?userId=${userId}`, {
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch reports');
      }
      
      setReports(data.reports || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="px-2.5 py-1 rounded text-xs bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-600 flex items-center gap-1.5"><Clock className="w-3 h-3" /> Under Review</span>;
      case 'reviewed':
        return <span className="px-2.5 py-1 rounded text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5"><CheckCircle className="w-3 h-3" /> Reviewed</span>;
      case 'dismissed':
        return <span className="px-2.5 py-1 rounded text-xs bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-500 border border-slate-200 dark:border-slate-700 flex items-center gap-1.5"><XCircle className="w-3 h-3" /> Dismissed</span>;
      case 'actioned':
        return <span className="px-2.5 py-1 rounded text-xs bg-brand-500/20 text-brand-600 dark:text-brand-300 border border-brand-500/30 flex items-center gap-1.5"><AlertTriangle className="w-3 h-3" /> Action Taken</span>;
      default:
        return <span className="px-2.5 py-1 rounded text-xs bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-500 dark:text-slate-400">{status}</span>;
    }
  };

  const getTypeBadge = (type: string) => {
    return <span className="px-2.5 py-1 rounded text-xs bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700 capitalize">{type.replace(/_/g, ' ')}</span>;
  };

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 bg-slate-50 dark:bg-slate-900 z-[60] overflow-y-auto">
      <div className="min-h-screen flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-white/10 px-6 py-4 z-10">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-brand-500/20 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-brand-600 dark:text-brand-400" />
              </div>
              My Submitted Reports
            </h3>
            <button 
              onClick={onClose}
              className="p-2 rounded-lg text-slate-600 dark:text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white hover:bg-white/10 transition"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 px-6 py-8">
          <div className="max-w-3xl mx-auto">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-brand-500"></div>
              </div>
            ) : error ? (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
                <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
                <p className="text-red-400">{error}</p>
                <button 
                  onClick={fetchReports}
                  className="mt-4 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition"
                >
                  Try Again
                </button>
              </div>
            ) : reports.length === 0 ? (
              <div className="text-center py-20 bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700/50 rounded-2xl">
                <AlertCircle className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <h4 className="text-lg font-medium text-slate-800 dark:text-slate-300 mb-2">No Reports Found</h4>
                <p className="text-slate-600 dark:text-slate-500 max-w-sm mx-auto">
                  You haven't submitted any reports yet. Reports you submit to help keep our community safe will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {reports.map((report) => (
                  <div key={report.id} className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                    <div className="p-5 border-b border-slate-200 dark:border-slate-700/50">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                        <div className="flex flex-wrap items-center gap-2">
                          {getTypeBadge(report.report_type)}
                          {getStatusBadge(report.status)}
                        </div>
                        <span className="text-xs text-slate-600 dark:text-slate-500">
                          {new Date(report.created_at).toLocaleDateString()} at {new Date(report.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                      
                      <div className="space-y-3">
                        <div>
                          <p className="text-xs text-slate-600 dark:text-slate-500 uppercase tracking-wider font-medium mb-1.5">Reported Content</p>
                          <p className="text-sm text-slate-800 dark:text-slate-300 line-clamp-3 bg-white dark:bg-slate-900/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700/50">
                            {report.content_text}
                          </p>
                        </div>
                        
                        {report.description && (
                          <div>
                            <p className="text-xs text-slate-600 dark:text-slate-500 uppercase tracking-wider font-medium mb-1.5">Your Note</p>
                            <p className="text-sm text-slate-600 dark:text-slate-500 dark:text-slate-400 italic">"{report.description}"</p>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {report.status !== 'pending' && (
                      <div className={`p-4 ${
                        report.status === 'actioned' ? 'bg-brand-500/10 border-t border-brand-500/20' : 
                        report.status === 'reviewed' ? 'bg-emerald-500/10 border-t border-emerald-500/20' :
                        'bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700'
                      }`}>
                        <div className="flex items-start gap-3">
                          <div className={`mt-0.5 rounded-full p-1 ${
                            report.status === 'actioned' ? 'bg-brand-500/20 text-brand-600 dark:text-brand-400' :
                            report.status === 'reviewed' ? 'bg-emerald-500/20 text-emerald-400' :
                            'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-500 dark:text-slate-400'
                          }`}>
                            {report.status === 'actioned' ? <AlertTriangle className="w-3.5 h-3.5" /> : 
                             report.status === 'reviewed' ? <CheckCircle className="w-3.5 h-3.5" /> : 
                             <XCircle className="w-3.5 h-3.5" />}
                          </div>
                          <div>
                            <p className={`text-sm font-medium ${
                              report.status === 'actioned' ? 'text-brand-600 dark:text-brand-300' :
                              report.status === 'reviewed' ? 'text-emerald-300' :
                              'text-slate-600 dark:text-slate-500 dark:text-slate-400'
                            }`}>
                              {report.status === 'actioned' ? 'Action Taken' :
                               report.status === 'reviewed' ? 'Reviewed' : 'Dismissed'}
                            </p>
                            {report.admin_action ? (
                              <p className="text-sm text-slate-800 dark:text-slate-300 mt-1">{report.admin_action}</p>
                            ) : (
                              <p className="text-sm text-slate-600 dark:text-slate-500 mt-1">
                                {report.status === 'actioned' ? 'An administrator has taken action regarding this report.' :
                                 report.status === 'reviewed' ? 'An administrator has reviewed your report and found no further action was necessary at this time.' :
                                 'This report was dismissed after review.'}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
