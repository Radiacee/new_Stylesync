"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from './AdminLayout';

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalProfiles: 0,
    totalParaphrases: 0,
    recentActivity: 0
  });

  const adminSections = [
    {
      title: 'User Management',
      description: 'View, edit, and manage user accounts',
      icon: '👥',
      path: '/admin/users',
      color: 'from-blue-500 to-cyan-500'
    },
    {
      title: 'Style Profiles',
      description: 'Manage user style profiles and settings',
      icon: '🎨',
      path: '/admin/users',
      color: 'from-purple-500 to-pink-500'
    },
    {
      title: 'Paraphrase History',
      description: 'Monitor paraphrase usage and history',
      icon: '📝',
      path: '/admin/history',
      color: 'from-green-500 to-emerald-500'
    },
    {
      title: 'System Analytics',
      description: 'View system performance and usage metrics',
      icon: '📊',
      path: '/admin/analytics',
      color: 'from-orange-500 to-red-500'
    },
    {
      title: 'Database Tools',
      description: 'Advanced database operations and maintenance',
      icon: '🛠️',
      path: '/admin/database',
      color: 'from-gray-500 to-slate-500'
    },
    {
      title: 'API Monitoring',
      description: 'Monitor API usage and error logs',
      icon: '🔍',
      path: '/admin/api',
      color: 'from-indigo-500 to-blue-500'
    }
  ];

  useEffect(() => {
    // Load basic stats - you can expand this with real data
    const loadStats = async () => {
      // This is placeholder data - replace with actual database queries
      setStats({
        totalUsers: 0, // You'll connect this to Supabase queries
        totalProfiles: 0,
        totalParaphrases: 0,
        recentActivity: 0
      });
    };

    loadStats();
  }, []);

  return (
    <AdminLayout>
      <div className="space-y-8">
        {/* Dashboard Header */}
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">Dashboard</h2>
          <p className="text-gray-400">Manage your StyleSync application</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total Users</p>
                <p className="text-2xl font-bold text-white">{stats.totalUsers}</p>
              </div>
              <div className="text-2xl">👥</div>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Style Profiles</p>
                <p className="text-2xl font-bold text-white">{stats.totalProfiles}</p>
              </div>
              <div className="text-2xl">🎨</div>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Paraphrases</p>
                <p className="text-2xl font-bold text-white">{stats.totalParaphrases}</p>
              </div>
              <div className="text-2xl">📝</div>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Recent Activity</p>
                <p className="text-2xl font-bold text-white">{stats.recentActivity}</p>
              </div>
              <div className="text-2xl">⚡</div>
            </div>
          </div>
        </div>

        {/* Admin Sections */}
        <div>
          <h3 className="text-xl font-semibold text-white mb-6">Management Tools</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {adminSections.map((section, index) => (
              <div
                key={index}
                onClick={() => router.push(section.path)}
                className="group bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-6 hover:bg-white/20 transition-all duration-300 cursor-pointer"
              >
                <div className={`text-4xl mb-4 bg-gradient-to-r ${section.color} w-16 h-16 rounded-lg flex items-center justify-center text-2xl`}>
                  {section.icon}
                </div>
                <h4 className="text-lg font-semibold text-white mb-2 group-hover:text-purple-300 transition-colors">
                  {section.title}
                </h4>
                <p className="text-gray-400 text-sm">
                  {section.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-6">
          <h3 className="text-xl font-semibold text-white mb-4">Quick Actions</h3>
          <div className="flex flex-wrap gap-4">
            <button
              onClick={() => router.push('/admin/users')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              View All Users
            </button>
            <button
              onClick={() => router.push('/admin/users')}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Manage Profiles
            </button>
            <button
              onClick={() => router.push('/admin/database')}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Database Tools
            </button>
            <button
              onClick={() => window.open('https://supabase.com/dashboard', '_blank')}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Supabase Dashboard
            </button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
