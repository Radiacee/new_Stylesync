"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from './AdminLayout';
import { Users, BarChart3, Flag } from 'lucide-react';

export default function AdminDashboard() {
  const router = useRouter();
  
  const dashboardCards = [
    {
      title: 'User Management',
      description: 'View, edit, and manage user accounts',
      icon: Users,
      route: '/admin/users',
    },
    {
      title: 'Analytics',
      description: 'View paraphrase analytics and style insights',
      icon: BarChart3,
      route: '/admin/analytics',
    },
    {
      title: 'Content Reports',
      description: 'Review reported inappropriate content',
      icon: Flag,
      route: '/admin/reports',
    },
  ];

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">Dashboard</h2>
          <p className="text-slate-500">Manage your StyleSync application</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {dashboardCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.route}
                onClick={() => router.push(card.route)}
                className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 hover:bg-slate-800 hover:border-slate-600 transition-all cursor-pointer group"
              >
                <div className="flex items-start gap-4">
                  <div className="p-2.5 rounded-lg bg-slate-700/50 group-hover:bg-slate-700 transition-colors">
                    <Icon className="w-5 h-5 text-slate-400 group-hover:text-slate-300" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base font-semibold text-white mb-1 group-hover:text-slate-100">
                      {card.title}
                    </h3>
                    <p className="text-sm text-slate-500">
                      {card.description}
                    </p>
                  </div>
                  <svg className="w-5 h-5 text-slate-600 group-hover:text-slate-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AdminLayout>
  );
}