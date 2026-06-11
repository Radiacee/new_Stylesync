'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import AdminLayout from '../AdminLayout';
import { Plus, Trash2, Search, CheckCircle } from 'lucide-react';

export default function AdminSubscriptions() {
  const [emailInput, setEmailInput] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchSubscriptions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('premium_subscriptions')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (error) {
        if (error.code === '42P01') {
          setErrorMsg('Table premium_subscriptions does not exist. Please run the SQL setup script first.');
        } else {
          console.error(error);
        }
      } else {
        setSubscriptions(data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const handleGrantPremium = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim() || !emailInput.includes('@')) {
      setErrorMsg('Please enter a valid email address');
      setStatus('error');
      return;
    }

    try {
      setStatus('loading');
      setErrorMsg('');

      // First, get the user id for this email if possible. 
      // Supabase admin might be needed for this, but as a workaround we can just store the email, 
      // and when they log in, they can be matched, OR we can query `auth.users` if we have privileges.
      // Wait, we can't query auth.users from client without service_role key.
      // So we will insert a record by email, but we don't know the UUID.
      // If we don't have UUID, RLS might be tricky.
      // Since it's a demo app, let's assume we can grant it based on finding their style_profiles 
      // to get their user_id, or we just store the email and let the paraphrase page match by user.email.
      // Let's modify the Paraphrase check to just check `premium_subscriptions` by email if user_id is null.
      
      const { data: profileData } = await supabase
        .from('style_profiles')
        .select('user_id')
        .limit(1); // Just to test query

      // Calculate expiration date (30 days from now)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      const { error: insertError } = await supabase
        .from('premium_subscriptions')
        .insert({
          email: emailInput.toLowerCase().trim(),
          status: 'active',
          expires_at: expiresAt.toISOString()
        });

      if (insertError) {
        throw insertError;
      }

      setStatus('success');
      setEmailInput('');
      fetchSubscriptions();
      setTimeout(() => setStatus('idle'), 3000);
      
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message || 'Failed to grant premium');
      setStatus('error');
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm('Are you sure you want to revoke premium access for this user?')) return;
    try {
      await supabase.from('premium_subscriptions').delete().eq('id', id);
      fetchSubscriptions();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">Premium Subscriptions</h2>
            <p className="text-slate-600 dark:text-slate-500">Manage premium access for users who paid via GCash</p>
          </div>
        </div>

        {/* Grant Access Form */}
        <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Grant Premium Access</h3>
          
          <form onSubmit={handleGrantPremium} className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                User Email Address
              </label>
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="e.g. user@example.com"
                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <button
              type="submit"
              disabled={status === 'loading'}
              className="flex items-center gap-2 px-6 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-medium transition-colors disabled:opacity-50"
            >
              {status === 'loading' ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  <Plus className="w-5 h-5" />
                  Grant Premium
                </>
              )}
            </button>
          </form>

          {status === 'success' && (
            <div className="mt-4 p-3 rounded-lg bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              <span>Premium access granted successfully!</span>
            </div>
          )}
          
          {status === 'error' && (
            <div className="mt-4 p-3 rounded-lg bg-red-500/10 text-red-600 border border-red-500/20">
              {errorMsg}
            </div>
          )}
        </div>

        {/* List */}
        <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by email..."
                className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 text-sm"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-100 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-6 py-4 font-semibold text-slate-700 dark:text-slate-300">Email</th>
                  <th className="px-6 py-4 font-semibold text-slate-700 dark:text-slate-300">Status</th>
                  <th className="px-6 py-4 font-semibold text-slate-700 dark:text-slate-300">Granted On</th>
                  <th className="px-6 py-4 font-semibold text-slate-700 dark:text-slate-300">Expires On</th>
                  <th className="px-6 py-4 font-semibold text-slate-700 dark:text-slate-300 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                      Loading subscriptions...
                    </td>
                  </tr>
                ) : subscriptions.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                      No premium subscriptions found.
                    </td>
                  </tr>
                ) : (
                  subscriptions
                    .filter((sub) => sub.email.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map((sub) => {
                      const isExpired = sub.expires_at && new Date(sub.expires_at) < new Date();
                      const statusColor = isExpired ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
                      const statusText = isExpired ? 'expired' : sub.status;
                      
                      return (
                        <tr key={sub.id} className="hover:bg-slate-100/50 dark:hover:bg-slate-700/50">
                          <td className="px-6 py-4 text-slate-900 dark:text-white font-medium">
                            {sub.email}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${statusColor}`}>
                              {statusText}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                            {new Date(sub.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                            {sub.expires_at ? new Date(sub.expires_at).toLocaleDateString() : 'Never'}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => handleRevoke(sub.id)}
                              className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                              title="Revoke Access"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
