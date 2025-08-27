"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from './AdminLayout';

export default function AdminDashboard() {
  const router = useRouter();
  return (
    <AdminLayout>
      <div className="space-y-8">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">User Management</h2>
          <p className="text-gray-400">View, edit, and manage user accounts</p>
        </div>
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-6">
          <button
            onClick={() => router.push('/admin/users')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Go to User Management
          </button>
        </div>
      </div>
    </AdminLayout>
  );
}
