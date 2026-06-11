"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import { ThemeToggle } from '../../components/ThemeToggle';

interface AdminLayoutProps {
  children: React.ReactNode;
}

const ADMIN_EMAILS = [
  'banlutachristiandave2@gmail.com', // Add your admin email here
  'admin@stylesync.com', // Add more admin emails as needed
];

export default function AdminLayout({ children }: AdminLayoutProps) {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const checkAdminAccess = async () => {
      if (!supabase) {
        router.push('/auth/sign-in');
        return;
      }

      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (error || !user) {
          router.push('/auth/sign-in');
          return;
        }

        // Check if user email is in admin list
        if (!ADMIN_EMAILS.includes(user.email || '')) {
          router.push('/paraphrase');
          return;
        }

        setUser(user);
        setIsAdmin(true);
      } catch (error) {
        console.error('Admin check error:', error);
        router.push('/auth/sign-in');
      } finally {
        setLoading(false);
      }
    };

    checkAdminAccess();
  }, [router]);

  const handleSignOut = async () => {
    if (supabase) {
      await supabase.auth.signOut();
      router.push('/auth/sign-in');
    }
  };

  if (loading) {
    return (
      <div className="admin-container fixed inset-0 bg-white dark:bg-slate-900 flex items-center justify-center z-50">
        <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-400 mx-auto"></div>
          <p className="text-slate-800 dark:text-slate-300 mt-4 text-center">Checking admin access...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="admin-container fixed inset-0 bg-white dark:bg-slate-900 flex items-center justify-center z-50">
        <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-8 text-center">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Access Denied</h1>
          <p className="text-slate-600 dark:text-slate-500 dark:text-slate-400 mb-6">You don't have admin privileges.</p>
          <button
            onClick={() => router.push('/paraphrase')}
            className="bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-900 dark:text-white px-6 py-2 rounded-lg transition-colors border border-slate-300 dark:border-slate-600"
          >
            Go to App
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-container fixed inset-0 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 overflow-auto z-50">
      {/* Admin Header */}
      <header className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                StyleSync Admin
              </h1>
              <p className="text-slate-600 dark:text-slate-500 text-sm">Database & User Management</p>
            </div>
            <div className="flex items-center space-x-4">
              <ThemeToggle />
              <button
                onClick={() => router.push('/paraphrase')}
                className="bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-900 dark:text-white px-4 py-2 rounded-lg text-sm transition-colors border border-slate-300 dark:border-slate-600"
              >
                Go to App
              </button>
              <span className="text-slate-600 dark:text-slate-500 dark:text-slate-400 text-sm hidden sm:inline-block">
                {user?.email}
              </span>
              <button
                onClick={handleSignOut}
                className="bg-slate-100 dark:bg-slate-700 hover:bg-red-500 hover:text-white text-slate-800 dark:text-slate-300 px-4 py-2 rounded-lg text-sm transition-colors border border-slate-300 dark:border-slate-600 hover:border-red-500"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Admin Content */}
      <main className="container mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  );
}
