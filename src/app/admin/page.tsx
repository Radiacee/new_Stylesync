"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from './AdminLayout';
import { Users, BarChart3 } from 'lucide-react';

export default function AdminDashboard() {
  const router = useRouter();
  
  const dashboardCards = [
    {
      title: 'User Management',
      description: 'View, edit, and manage user accounts',
      icon: Users,
      color: 'blue',
      route: '/admin/users',
    },
    {
      title: 'Analytics Dashboard',
      description: 'View paraphrase analytics and style insights',
      icon: BarChart3,
      color: 'purple',
      route: '/admin/analytics',
    },
  ];

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">Admin Dashboard</h2>
          <p className="text-gray-400">Manage your StyleSync application</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {dashboardCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.route}
                onClick={() => router.push(card.route)}
                className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-6 hover:bg-white/15 transition-all cursor-pointer group"
              >
                <div className="flex items-start space-x-4">
                  <div className={`p-3 rounded-lg bg-${card.color}-600/20 group-hover:bg-${card.color}-600/30 transition-colors`}>
                    <Icon className={`w-6 h-6 text-${card.color}-400`} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-white mb-2 group-hover:text-brand-300 transition-colors">
                      {card.title}
                    </h3>
                    <p className="text-gray-400 mb-4">
                      {card.description}
                    </p>
                    <button
                      className={`bg-${card.color}-600 hover:bg-${card.color}-700 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium`}
                    >
                      Open →
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AdminLayout>
  );
}