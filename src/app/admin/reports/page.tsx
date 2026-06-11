"use client";

import { useState, useEffect } from 'react';
import AdminLayout from '../AdminLayout';
import { supabase } from '../../../lib/supabaseClient';
import { Flag, CheckCircle, XCircle, Clock, AlertTriangle, Trash2, Archive } from 'lucide-react';

interface Report {
  id: string;
  report_type: string;
  content_text: string;
  description: string | null;
  user_id: string | null;
  status: 'pending' | 'reviewed' | 'dismissed' | 'actioned' | 'archived';
  admin_action: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'reviewed' | 'dismissed' | 'archived'>('all');
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [adminActionInput, setAdminActionInput] = useState('');
  const [tableExists, setTableExists] = useState(true);

  useEffect(() => {
    fetchReports();
  }, []);

  async function fetchReports() {
    setLoading(true);
    setError(null);
    
    try {
      const session = await supabase?.auth.getSession();
      const token = session?.data?.session?.access_token;
      
      if (!token) {
        setError('Not authenticated');
        setLoading(false);
        return;
      }

      const response = await fetch('/api/admin?endpoint=reports', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      
      if (!response.ok) {
        if (data.tableNotFound) {
          setTableExists(false);
        } else {
          throw new Error(data.error || 'Failed to fetch reports');
        }
      } else {
        setReports(data.reports || []);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function updateReportStatus(reportId: string, status: 'reviewed' | 'dismissed' | 'actioned' | 'archived', adminAction?: string) {
    try {
      const session = await supabase?.auth.getSession();
      const token = session?.data?.session?.access_token;
      
      const response = await fetch('/api/admin', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          endpoint: 'reports',
          reportId,
          status,
          adminAction
        })
      });

      if (response.ok) {
        setReports(reports.map(r => 
          r.id === reportId ? { ...r, status, reviewed_at: new Date().toISOString(), admin_action: adminAction || null } : r
        ));
        setSelectedReport(null);
        setAdminActionInput('');
      }
    } catch (err) {
      console.error('Failed to update report:', err);
    }
  }

  async function deleteReport(reportId: string) {
    if (!window.confirm('Are you sure you want to permanently delete this report? This cannot be undone.')) return;
    
    try {
      const session = await supabase?.auth.getSession();
      const token = session?.data?.session?.access_token;
      
      const response = await fetch(`/api/admin?endpoint=reports&reportId=${reportId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setReports(reports.filter(r => r.id !== reportId));
        setSelectedReport(null);
      }
    } catch (err) {
      console.error('Failed to delete report:', err);
    }
  }

  async function archiveAll() {
    const unarchivedReports = filteredReports.filter(r => r.status !== 'archived');
    if (unarchivedReports.length === 0) return;
    
    if (!window.confirm(`Are you sure you want to archive all ${unarchivedReports.length} visible non-archived reports?`)) return;
    
    try {
      const session = await supabase?.auth.getSession();
      const token = session?.data?.session?.access_token;
      
      const response = await fetch('/api/admin', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          endpoint: 'reports',
          reportIds: unarchivedReports.map(r => r.id),
          status: 'archived',
          adminAction: 'Bulk archived by admin'
        })
      });

      if (response.ok) {
        setReports(reports.map(r => 
          unarchivedReports.some(u => u.id === r.id) 
            ? { ...r, status: 'archived', reviewed_at: new Date().toISOString(), admin_action: 'Bulk archived by admin' } 
            : r
        ));
      }
    } catch (err) {
      console.error('Failed to archive all reports:', err);
    }
  }

  async function deleteAll() {
    if (filteredReports.length === 0) return;
    
    if (!window.confirm(`Are you sure you want to permanently delete all ${filteredReports.length} visible reports? This cannot be undone.`)) return;
    
    try {
      const session = await supabase?.auth.getSession();
      const token = session?.data?.session?.access_token;
      
      const ids = filteredReports.map(r => r.id).join(',');
      const response = await fetch(`/api/admin?endpoint=reports&reportIds=${ids}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const deletedIds = new Set(filteredReports.map(r => r.id));
        setReports(reports.filter(r => !deletedIds.has(r.id)));
      }
    } catch (err) {
      console.error('Failed to delete all reports:', err);
    }
  }

  const filteredReports = filter === 'all' 
    ? reports.filter(r => r.status !== 'archived')
    : reports.filter(r => r.status === filter);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="px-2.5 py-1 rounded text-xs bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-600 flex items-center gap-1.5"><Clock className="w-3 h-3" /> Pending</span>;
      case 'reviewed':
        return <span className="px-2.5 py-1 rounded text-xs bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-600 flex items-center gap-1.5"><CheckCircle className="w-3 h-3" /> Reviewed</span>;
      case 'dismissed':
        return <span className="px-2.5 py-1 rounded text-xs bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-500 border border-slate-200 dark:border-slate-700 flex items-center gap-1.5"><XCircle className="w-3 h-3" /> Dismissed</span>;
      case 'actioned':
        return <span className="px-2.5 py-1 rounded text-xs bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white border border-slate-500 flex items-center gap-1.5"><AlertTriangle className="w-3 h-3" /> Actioned</span>;
      case 'archived':
        return <span className="px-2.5 py-1 rounded text-xs bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 flex items-center gap-1.5"><Archive className="w-3 h-3" /> Archived</span>;
      default:
        return <span className="px-2.5 py-1 rounded text-xs bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-500 dark:text-slate-400">{status}</span>;
    }
  };

  const getTypeBadge = (type: string) => {
    return <span className="px-2.5 py-1 rounded text-xs bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700 capitalize">{type.replace(/_/g, ' ')}</span>;
  };

  // SQL for creating the table
  const CREATE_TABLE_SQL = `-- Run this in your Supabase SQL Editor:

create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  report_type text not null,
  content_text text not null,
  description text,
  user_id uuid references auth.users(id) on delete set null,
  status text default 'pending',
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.content_reports enable row level security;

-- Allow anyone to insert reports
create policy "Allow insert reports" on public.content_reports 
  for insert with check (true);

-- Allow authenticated users to view their own reports
create policy "Users view own reports" on public.content_reports 
  for select using (auth.uid() = user_id);

-- Allow service role full access (for admin)
create policy "Service role full access" on public.content_reports 
  for all using (true);`;

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => window.history.back()}
              className="p-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white rounded-lg transition border border-slate-200 dark:border-slate-700"
              title="Go Back"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                <Flag className="w-6 h-6 text-slate-600 dark:text-slate-500 dark:text-slate-400" />
                Content Reports
              </h2>
              <p className="text-slate-600 dark:text-slate-500 mt-1">Review and manage reported content</p>
            </div>
          </div>
          <button
            onClick={fetchReports}
            className="px-4 py-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-300 rounded-lg transition border border-slate-200 dark:border-slate-700"
          >
            Refresh
          </button>
        </div>

        {/* Table not exists warning */}
        {!tableExists && (
          <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-2 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-slate-600 dark:text-slate-500 dark:text-slate-400" />
              Reports Table Not Found
            </h3>
            <p className="text-slate-600 dark:text-slate-500 dark:text-slate-400 text-sm mb-4">
              The content_reports table doesn't exist in your Supabase database. Run the following SQL to create it:
            </p>
            <details className="group">
              <summary className="cursor-pointer text-slate-800 dark:text-slate-300 hover:text-slate-900 dark:text-white text-sm font-medium">
                Show SQL →
              </summary>
              <pre className="mt-4 p-4 bg-white dark:bg-slate-900 rounded-lg text-xs text-slate-600 dark:text-slate-500 dark:text-slate-400 overflow-x-auto whitespace-pre-wrap border border-slate-200 dark:border-slate-700">
                {CREATE_TABLE_SQL}
              </pre>
            </details>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
            <div className="text-2xl font-bold text-slate-900 dark:text-white">{reports.length}</div>
            <div className="text-sm text-slate-600 dark:text-slate-500">Total Reports</div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
            <div className="text-2xl font-bold text-slate-900 dark:text-white">{reports.filter(r => r.status === 'pending').length}</div>
            <div className="text-sm text-slate-600 dark:text-slate-500">Pending</div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
            <div className="text-2xl font-bold text-slate-900 dark:text-white">{reports.filter(r => r.status === 'reviewed').length}</div>
            <div className="text-sm text-slate-600 dark:text-slate-500">Reviewed</div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
            <div className="text-2xl font-bold text-slate-900 dark:text-white">{reports.filter(r => r.status === 'actioned').length}</div>
            <div className="text-sm text-slate-600 dark:text-slate-500">Actioned</div>
          </div>
        </div>

        {/* Actions Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Filter */}
          <div className="flex flex-wrap gap-2">
            {(['all', 'pending', 'reviewed', 'dismissed', 'archived'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition border ${
                  filter === f 
                    ? 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white border-slate-300 dark:border-slate-600' 
                    : 'bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:bg-slate-800 hover:text-slate-800 dark:text-slate-300'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          {/* Bulk Actions */}
          <div className="flex gap-2">
            {filteredReports.some(r => r.status !== 'archived') && (
              <button
                onClick={archiveAll}
                className="px-4 py-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-300 rounded-lg transition border border-slate-200 dark:border-slate-700 flex items-center gap-2 text-sm font-medium"
              >
                <Archive className="w-4 h-4" /> Archive All Visible
              </button>
            )}
            {filteredReports.length > 0 && filter === 'archived' && (
              <button
                onClick={deleteAll}
                className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition border border-red-500/30 flex items-center gap-2 text-sm font-medium"
              >
                <Trash2 className="w-4 h-4" /> Delete All Archived
              </button>
            )}
          </div>
        </div>

        {/* Reports List */}
        {loading ? (
          <div className="text-center py-12 text-slate-600 dark:text-slate-500 dark:text-slate-400">Loading reports...</div>
        ) : error ? (
          <div className="text-center py-12 text-red-400">{error}</div>
        ) : filteredReports.length === 0 ? (
          <div className="text-center py-12 text-slate-600 dark:text-slate-500 dark:text-slate-400">
            {tableExists ? 'No reports found' : 'Create the table to start collecting reports'}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredReports.map(report => (
              <div 
                key={report.id}
                className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-4 hover:bg-slate-50 dark:bg-slate-800 transition cursor-pointer"
                onClick={() => setSelectedReport(report)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      {getTypeBadge(report.report_type)}
                      {getStatusBadge(report.status)}
                    </div>
                    <p className="text-sm text-slate-800 dark:text-slate-300 line-clamp-2">{report.content_text}</p>
                    {report.description && (
                      <p className="text-xs text-slate-600 dark:text-slate-500 mt-1">Note: {report.description}</p>
                    )}
                  </div>
                  <div className="text-right text-xs text-slate-600 dark:text-slate-500 flex-shrink-0">
                    <div>{new Date(report.created_at).toLocaleDateString()}</div>
                    <div>{new Date(report.created_at).toLocaleTimeString()}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Report Detail Modal */}
        {selectedReport && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => { setSelectedReport(null); setAdminActionInput(''); }}>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-slate-900 dark:text-white">Report Details</h3>
                  <button onClick={() => { setSelectedReport(null); setAdminActionInput(''); }} className="text-slate-600 dark:text-slate-500 hover:text-slate-900 dark:text-white transition">✕</button>
                </div>

                <div className="flex gap-2">
                  {getTypeBadge(selectedReport.report_type)}
                  {getStatusBadge(selectedReport.status)}
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-slate-600 dark:text-slate-500 uppercase tracking-wide">Reported Content</label>
                    <div className="mt-1 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-sm text-slate-800 dark:text-slate-300 whitespace-pre-wrap max-h-48 overflow-y-auto border border-slate-200 dark:border-slate-700">
                      {selectedReport.content_text}
                    </div>
                  </div>

                  {selectedReport.description && (
                    <div>
                      <label className="text-xs text-slate-600 dark:text-slate-500 uppercase tracking-wide">Reporter's Note</label>
                      <div className="mt-1 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-sm text-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        {selectedReport.description}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <label className="text-xs text-slate-600 dark:text-slate-500 uppercase tracking-wide">Submitted</label>
                      <div className="text-slate-800 dark:text-slate-300 mt-1">{new Date(selectedReport.created_at).toLocaleString()}</div>
                    </div>
                    <div>
                      <label className="text-xs text-slate-600 dark:text-slate-500 uppercase tracking-wide">Reporter ID</label>
                      <div className="text-slate-600 dark:text-slate-500 dark:text-slate-400 font-mono text-xs mt-1">{selectedReport.user_id || 'Anonymous'}</div>
                    </div>
                  </div>
                </div>

                {selectedReport.admin_action && (
                  <div>
                    <label className="text-xs text-slate-600 dark:text-slate-500 uppercase tracking-wide">Action Taken</label>
                    <div className="mt-1 p-3 bg-brand-500/10 rounded-lg text-sm text-brand-700 dark:text-brand-200 border border-brand-500/30">
                      {selectedReport.admin_action}
                    </div>
                  </div>
                )}

                {selectedReport.status === 'pending' && (
                  <div className="pt-4 border-t border-slate-200 dark:border-slate-700 space-y-4">
                    <div>
                      <label className="text-xs text-slate-600 dark:text-slate-500 uppercase tracking-wide">Admin Action Note (Optional)</label>
                      <textarea
                        value={adminActionInput}
                        onChange={e => setAdminActionInput(e.target.value)}
                        placeholder="Describe the action taken (e.g., 'Content removed', 'User warned')..."
                        className="w-full mt-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-sm text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:border-slate-500"
                        rows={2}
                      />
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => updateReportStatus(selectedReport.id, 'reviewed', adminActionInput)}
                        className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-600 text-slate-900 dark:text-white rounded-lg transition flex items-center justify-center gap-2 border border-slate-300 dark:border-slate-600"
                      >
                        <CheckCircle className="w-4 h-4" /> Mark Reviewed
                      </button>
                      <button
                        onClick={() => updateReportStatus(selectedReport.id, 'actioned', adminActionInput)}
                        className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg transition flex items-center justify-center gap-2 border border-slate-300 dark:border-slate-600"
                      >
                        <AlertTriangle className="w-4 h-4" /> Take Action
                      </button>
                      <button
                        onClick={() => updateReportStatus(selectedReport.id, 'dismissed', adminActionInput)}
                        className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-500 dark:text-slate-400 rounded-lg transition border border-slate-200 dark:border-slate-700"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                )}
                
                {/* Archive and Delete Actions */}
                <div className="pt-4 border-t border-slate-200 dark:border-slate-700 flex gap-3">
                  {selectedReport.status !== 'archived' && (
                    <button
                      onClick={() => updateReportStatus(selectedReport.id, 'archived', adminActionInput)}
                      className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-300 rounded-lg transition border border-slate-200 dark:border-slate-700 flex items-center gap-2"
                    >
                      <Archive className="w-4 h-4" /> Archive Report
                    </button>
                  )}
                  {selectedReport.status === 'archived' && (
                    <button
                      onClick={() => deleteReport(selectedReport.id)}
                      className="px-4 py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition border border-red-500/30 flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" /> Delete Permanently
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
