"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';
import AdminLayout from '../AdminLayout';

interface AnalyticsEntry {
  id: string;
  user_id: string;
  profile_id?: string | null;
  profile_name?: string | null;
  tone: string;
  formality: number;
  pacing: number;
  descriptiveness: number;
  directness: number;
  custom_lexicon: string[];
  sample_excerpt: string | null;
  verification_score: number;
  input_length: number;
  output_length: number;
  consent_given: boolean;
  created_at: string;
}

interface AggregatedStats {
  totalSubmissions: number;
  averageScore: number;
  topTones: { tone: string; count: number }[];
  averageFormality: number;
  averagePacing: number;
  averageDescriptiveness: number;
  averageDirectness: number;
  consentRate: number;
}

export default function AnalyticsPage() {
  const router = useRouter();
  const [analytics, setAnalytics] = useState<AnalyticsEntry[]>([]);
  const [stats, setStats] = useState<AggregatedStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'with-consent' | 'high-score'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'score'>('date');
  const [expandedExcerpts, setExpandedExcerpts] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const [cleaningUp, setCleaningUp] = useState(false);

  useEffect(() => {
    loadAnalytics();
  }, []);

  async function loadAnalytics() {
    if (!supabase) return;

    setLoading(true);
    try {
      console.log('Loading analytics from database...');
      const { data, error } = await supabase
        .from('paraphrase_analytics')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading analytics:', error);
        throw error;
      }

      console.log('Analytics loaded:', data?.length || 0, 'entries');
      setAnalytics(data || []);
      calculateStats(data || []);
    } catch (error) {
      console.error('Error loading analytics:', error);
      setAnalytics([]);
      setStats(null);
    } finally {
      setLoading(false);
    }
  }

  async function cleanupDuplicates() {
    if (!confirm('This will remove duplicate analytics entries. Continue?')) {
      return;
    }

    setCleaningUp(true);
    try {
      const response = await fetch('/api/analytics/cleanup-duplicates', {
        method: 'POST',
      });

      const result = await response.json();

      if (response.ok) {
        alert(`✅ Cleanup complete!\n\nRemoved: ${result.duplicatesRemoved} duplicates\nRemaining: ${result.remainingEntries} entries`);
        // Reload analytics data
        await loadAnalytics();
      } else {
        alert(`❌ Cleanup failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Error cleaning up duplicates:', error);
      alert('❌ Error cleaning up duplicates');
    } finally {
      setCleaningUp(false);
    }
  }

  async function deleteAllAnalytics() {
    if (!confirm('⚠️ WARNING: This will DELETE ALL analytics data permanently!\n\nThis action cannot be undone. Are you sure?')) {
      return;
    }

    // Double confirmation for safety
    if (!confirm('🚨 FINAL CONFIRMATION: Delete all analytics data?\n\nClick OK to proceed with deletion.')) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/analytics/delete-all', {
        method: 'DELETE',
      });

      const result = await response.json();

      if (response.ok) {
        alert(`✅ All analytics deleted successfully!\n\nDeleted: ${result.deletedCount} entries`);
        // Clear local state
        setAnalytics([]);
        setStats(null);
        setCurrentPage(1);
      } else {
        alert(`❌ Delete failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Error deleting all analytics:', error);
      alert('❌ Error deleting analytics');
    } finally {
      setLoading(false);
    }
  }

  function calculateStats(data: AnalyticsEntry[]) {
    if (data.length === 0) {
      setStats(null);
      return;
    }

    const totalSubmissions = data.length;
    const averageScore = data.reduce((sum, item) => sum + item.verification_score, 0) / totalSubmissions;
    
    // Count tones
    const toneCount = new Map<string, number>();
    data.forEach(item => {
      toneCount.set(item.tone, (toneCount.get(item.tone) || 0) + 1);
    });
    const topTones = Array.from(toneCount.entries())
      .map(([tone, count]) => ({ tone, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const averageFormality = data.reduce((sum, item) => sum + item.formality, 0) / totalSubmissions;
    const averagePacing = data.reduce((sum, item) => sum + item.pacing, 0) / totalSubmissions;
    const averageDescriptiveness = data.reduce((sum, item) => sum + item.descriptiveness, 0) / totalSubmissions;
    const averageDirectness = data.reduce((sum, item) => sum + item.directness, 0) / totalSubmissions;
    const consentRate = (data.filter(item => item.consent_given).length / totalSubmissions) * 100;

    setStats({
      totalSubmissions,
      averageScore: Math.round(averageScore * 10) / 10,
      topTones,
      averageFormality: Math.round(averageFormality * 100) / 100,
      averagePacing: Math.round(averagePacing * 100) / 100,
      averageDescriptiveness: Math.round(averageDescriptiveness * 100) / 100,
      averageDirectness: Math.round(averageDirectness * 100) / 100,
      consentRate: Math.round(consentRate * 10) / 10
    });
  }

  function getFilteredAnalytics() {
    let filtered = [...analytics];

    if (filter === 'with-consent') {
      filtered = filtered.filter(item => item.consent_given);
    } else if (filter === 'high-score') {
      filtered = filtered.filter(item => item.verification_score >= 70);
    }

    if (sortBy === 'score') {
      filtered.sort((a, b) => b.verification_score - a.verification_score);
    } else {
      filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    return filtered;
  }

  function toggleExcerpt(id: string) {
    setExpandedExcerpts(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  // Get paginated data
  function getPaginatedData() {
    const filtered = getFilteredAnalytics();
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filtered.slice(startIndex, endIndex);
  }

  const filteredData = getFilteredAnalytics();
  const paginatedData = getPaginatedData();
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const pct = (v: number) => Math.round(v * 100) + '%';

  // Reset to page 1 when filter or sort changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, sortBy]);

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-slate-400">Loading analytics...</div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="py-4 sm:py-8 space-y-6 sm:space-y-8">
        {/* Header with Back Button */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
          <button
            onClick={() => router.push('/admin')}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg bg-slate-700/50 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-600/50 transition-colors text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Admin
          </button>
          <div className="hidden sm:block h-8 w-px bg-slate-600"></div>
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold">Paraphrase Analytics</h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">Complete style performance data from all paraphrases</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="text-xs sm:text-sm text-slate-400">
            {analytics.length > 0 && (
              <span>{analytics.length} total entries</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <button
              onClick={cleanupDuplicates}
              disabled={cleaningUp || loading}
              className="px-4 py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {cleaningUp ? '⏳ Cleaning...' : '🧹 Clean Duplicates'}
            </button>
            <button
              onClick={loadAnalytics}
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-brand-500/20 hover:bg-brand-500/30 text-brand-300 border border-brand-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              🔄 Refresh
            </button>
            <button
              onClick={deleteAllAnalytics}
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold"
            >
              🗑️ Delete All
            </button>
          </div>
        </div>

      {/* Summary Stats */}
      {stats && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <div className="glass-panel p-6">
            <div className="text-sm text-slate-400 mb-1">Total Submissions</div>
            <div className="text-3xl font-bold text-brand-300">{stats.totalSubmissions}</div>
          </div>
          <div className="glass-panel p-6">
            <div className="text-sm text-slate-400 mb-1">Average Score</div>
            <div className="text-3xl font-bold text-emerald-400">{stats.averageScore}%</div>
          </div>
          <div className="glass-panel p-6">
            <div className="text-sm text-slate-400 mb-1">Consent Rate</div>
            <div className="text-3xl font-bold text-purple-400">{stats.consentRate}%</div>
          </div>
          <div className="glass-panel p-6">
            <div className="text-sm text-slate-400 mb-1">Top Tone</div>
            <div className="text-2xl font-bold text-white capitalize">{stats.topTones[0]?.tone || 'N/A'}</div>
            <div className="text-xs text-slate-500">{stats.topTones[0]?.count || 0} uses</div>
          </div>
        </div>
      )}

      {/* Average Style Settings */}
      {stats && (
        <div className="glass-panel p-6 space-y-4">
          <h2 className="text-xl font-semibold text-brand-300">Average Style Settings</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="text-sm text-slate-400 mb-2">Formality</div>
              <div className="text-2xl font-bold">{pct(stats.averageFormality)}</div>
            </div>
            <div>
              <div className="text-sm text-slate-400 mb-2">Pacing</div>
              <div className="text-2xl font-bold">{pct(stats.averagePacing)}</div>
            </div>
            <div>
              <div className="text-sm text-slate-400 mb-2">Descriptiveness</div>
              <div className="text-2xl font-bold">{pct(stats.averageDescriptiveness)}</div>
            </div>
            <div>
              <div className="text-sm text-slate-400 mb-2">Directness</div>
              <div className="text-2xl font-bold">{pct(stats.averageDirectness)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Top Tones */}
      {stats && stats.topTones.length > 0 && (
        <div className="glass-panel p-6 space-y-4">
          <h2 className="text-xl font-semibold text-brand-300">Top Tones</h2>
          <div className="space-y-3">
            {stats.topTones.map((item, idx) => (
              <div key={item.tone} className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-full bg-brand-500/20 flex items-center justify-center text-brand-300 font-semibold text-sm">
                  {idx + 1}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-white capitalize">{item.tone}</span>
                    <span className="text-slate-400 text-sm">{item.count} uses</span>
                  </div>
                  <div className="mt-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-brand-500 to-brand-400"
                      style={{ width: `${(item.count / stats.totalSubmissions) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters and Sort */}
      <div className="glass-panel p-6">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === 'all'
                  ? 'bg-brand-500/30 text-brand-300 border border-brand-500/50'
                  : 'bg-slate-800/50 text-slate-400 border border-white/10 hover:text-slate-200'
              }`}
            >
              All ({analytics.length})
            </button>
            <button
              onClick={() => setFilter('with-consent')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === 'with-consent'
                  ? 'bg-brand-500/30 text-brand-300 border border-brand-500/50'
                  : 'bg-slate-800/50 text-slate-400 border border-white/10 hover:text-slate-200'
              }`}
            >
              With Consent ({analytics.filter(a => a.consent_given).length})
            </button>
            <button
              onClick={() => setFilter('high-score')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === 'high-score'
                  ? 'bg-brand-500/30 text-brand-300 border border-brand-500/50'
                  : 'bg-slate-800/50 text-slate-400 border border-white/10 hover:text-slate-200'
              }`}
            >
              High Score (≥70%) ({analytics.filter(a => a.verification_score >= 70).length})
            </button>
          </div>
          <div className="flex gap-2 items-center">
            <span className="text-sm text-slate-400">Sort by:</span>
            <button
              onClick={() => setSortBy('date')}
              className={`px-3 py-1.5 rounded text-sm transition-colors ${
                sortBy === 'date'
                  ? 'bg-brand-500/20 text-brand-300'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Date
            </button>
            <button
              onClick={() => setSortBy('score')}
              className={`px-3 py-1.5 rounded text-sm transition-colors ${
                sortBy === 'score'
                  ? 'bg-brand-500/20 text-brand-300'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Score
            </button>
          </div>
        </div>
      </div>

      {/* Analytics Data Table */}
      <div className="glass-panel p-6 space-y-4">
        <h2 className="text-xl font-semibold text-brand-300">
          Analytics Data ({filteredData.length})
        </h2>
        {filteredData.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-slate-400 mb-4">No analytics data available</div>
            <div className="text-sm text-slate-500 space-y-2">
              <p>Analytics will appear here once users start paraphrasing.</p>
              <p className="mt-2">Make sure the database schema has been executed:</p>
              <code className="block mt-2 p-2 bg-slate-900/60 rounded text-xs">
                ANALYTICS_DATABASE_SCHEMA.sql
              </code>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {paginatedData.map(entry => (
                <div key={entry.id} className="border border-white/10 rounded-lg p-4 bg-slate-800/40 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        entry.verification_score >= 80 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                        entry.verification_score >= 70 ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                        entry.verification_score >= 60 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                        'bg-slate-500/20 text-slate-400 border border-slate-500/30'
                      }`}>
                        {entry.verification_score}% Match
                      </div>
                      {entry.profile_name && (
                        <div className="px-3 py-1 rounded-lg text-sm bg-brand-500/20 text-brand-300 border border-brand-500/30 font-medium">
                          📝 {entry.profile_name}
                        </div>
                      )}
                      {entry.consent_given && (
                        <div className="px-2 py-0.5 rounded text-xs bg-purple-500/20 text-purple-400 border border-purple-500/30">
                          ✓ Consent
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-slate-500">
                      {new Date(entry.created_at).toLocaleString()}
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <div className="text-xs text-slate-400 mb-2">Style Settings</div>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Tone:</span>
                          <span className="text-white capitalize">{entry.tone}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Formality:</span>
                          <span className="text-white">{pct(entry.formality)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Pacing:</span>
                          <span className="text-white">{pct(entry.pacing)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Descriptiveness:</span>
                          <span className="text-white">{pct(entry.descriptiveness)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Directness:</span>
                          <span className="text-white">{pct(entry.directness)}</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-slate-400 mb-2">Performance</div>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Input Length:</span>
                          <span className="text-white">{entry.input_length} chars</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Output Length:</span>
                          <span className="text-white">{entry.output_length} chars</span>
                        </div>
                        {entry.custom_lexicon && entry.custom_lexicon.length > 0 && (
                          <div className="pt-2">
                            <div className="text-xs text-slate-400 mb-1">Custom Lexicon:</div>
                            <div className="flex flex-wrap gap-1">
                              {entry.custom_lexicon.slice(0, 5).map(word => (
                                <span key={word} className="px-2 py-0.5 bg-brand-500/20 text-brand-300 rounded text-xs">
                                  {word}
                                </span>
                              ))}
                              {entry.custom_lexicon.length > 5 && (
                                <span className="text-xs text-slate-500">+{entry.custom_lexicon.length - 5} more</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {entry.consent_given && entry.sample_excerpt && (
                    <div className="pt-3 border-t border-white/10">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-xs text-slate-400">Sample Excerpt (Shared with Consent)</div>
                        <button
                          onClick={() => toggleExcerpt(entry.id)}
                          className="text-xs text-brand-400 hover:text-brand-300 transition-colors flex items-center gap-1"
                        >
                          {expandedExcerpts.has(entry.id) ? '▲ Collapse' : '▼ Expand'}
                        </button>
                      </div>
                      <div className={`text-sm text-slate-300 bg-slate-900/60 rounded p-3 transition-all ${
                        expandedExcerpts.has(entry.id) ? 'max-h-96 overflow-auto' : 'max-h-24 overflow-hidden'
                      }`}>
                        {entry.sample_excerpt}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t border-white/10">
                <div className="text-sm text-slate-400">
                  Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredData.length)} of {filteredData.length} entries
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 rounded text-sm bg-slate-700/50 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    ← Previous
                  </button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                      // Show first page, last page, current page, and pages around current
                      const showPage = page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1;
                      const showEllipsis = (page === 2 && currentPage > 3) || (page === totalPages - 1 && currentPage < totalPages - 2);
                      
                      if (showEllipsis) {
                        return <span key={page} className="px-2 text-slate-500">...</span>;
                      }
                      
                      if (!showPage) return null;
                      
                      return (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`px-3 py-1.5 rounded text-sm transition-colors ${
                            currentPage === page
                              ? 'bg-brand-500/20 text-brand-300 border border-brand-500/30'
                              : 'bg-slate-700/50 hover:bg-slate-700 text-slate-300'
                          }`}
                        >
                          {page}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 rounded text-sm bg-slate-700/50 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      </div>
    </AdminLayout>
  );
}
