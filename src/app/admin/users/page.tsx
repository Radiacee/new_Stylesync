"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';
import AdminLayout from '../AdminLayout';

interface User {
  id: string;
  email?: string;
  created_at: string;
  last_sign_in_at?: string;
  email_confirmed_at?: string;
  user_metadata: any;
}

export default function UserManagement() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    if (!supabase) return;

    setLoading(true);
    try {
      // Get the auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.error('No auth token available');
        await loadUsersFromProfiles();
        return;
      }

      // Fetch users from the admin API
      const response = await fetch('/api/admin?endpoint=users', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      } else {
        console.error('API response not ok:', response.status);
        // Fallback to old method if API fails
        await loadUsersFromProfiles();
      }
    } catch (error) {
      console.error('Error loading users:', error);
      // Fallback to old method
      await loadUsersFromProfiles();
    } finally {
      setLoading(false);
    }
  };

  const loadUsersFromProfiles = async () => {
    if (!supabase) return;
    
    try {
      // This assumes you have user profile data stored somewhere
      // Adjust the table name and structure based on your schema
      const { data, error } = await supabase
        .from('style_profiles') // Using correct table name
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        // Transform profile data to user-like structure
        const profileUsers = data.map(profile => ({
          id: profile.user_id || profile.id,
          email: 'Email not available (admin access required)',
          created_at: profile.created_at,
          last_sign_in_at: profile.updated_at,
          email_confirmed_at: profile.created_at,
          user_metadata: profile,
          profile: profile
        }));
        setUsers(profileUsers);
      }
    } catch (error) {
      console.error('Error loading user profiles:', error);
    }
  };

  const deleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }

    setActionLoading(true);
    try {
      const response = await fetch('/api/deleteUser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to delete user');

      // Remove from local state
      setUsers(users.filter(user => user.id !== userId));
      setShowUserModal(false);
      alert('User deleted successfully');
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Error deleting user: ' + (error as Error).message);
    } finally {
      setActionLoading(false);
    }
  };

  const updateUserEmail = async (userId: string, newEmail: string) => {
    if (!supabase || !newEmail.trim()) return;

    setActionLoading(true);
    try {
      const { error } = await supabase.auth.admin.updateUserById(userId, {
        email: newEmail
      });

      if (error) throw error;

      // Update local state
      setUsers(users.map(user => 
        user.id === userId ? { ...user, email: newEmail } : user
      ));
      
      alert('User email updated successfully');
    } catch (error) {
      console.error('Error updating user:', error);
      alert('Error updating user: ' + (error as Error).message);
    } finally {
      setActionLoading(false);
    }
  };

  const filteredUsers = users.filter(user =>
    (user.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.id.includes(searchTerm)
  );

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString() + ' ' + 
           new Date(dateString).toLocaleTimeString();
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header with Back Button */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => router.push('/admin')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700/50 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-600/50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Admin
          </button>
          <div className="h-8 w-px bg-slate-600"></div>
          <div className="flex-1 flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold text-white">User Management</h2>
              <p className="text-gray-400">Manage user accounts and permissions</p>
            </div>
            <button
              onClick={loadUsers}
              disabled={loading}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Search and Stats */}
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <div>
                <p className="text-sm text-gray-400">Total Users</p>
                <p className="text-2xl font-bold text-white">{users.length}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Confirmed</p>
                <p className="text-2xl font-bold text-green-400">
                  {users.filter(u => u.email_confirmed_at).length}
                </p>
              </div>
            </div>
            <div className="flex-1 max-w-md">
              <input
                type="text"
                placeholder="Search users by email or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white placeholder-gray-400"
              />
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/5">
                <tr>
                  <th className="text-left p-4 text-gray-300 font-medium">Email</th>
                  <th className="text-left p-4 text-gray-300 font-medium">Status</th>
                  <th className="text-left p-4 text-gray-300 font-medium">Created</th>
                  <th className="text-left p-4 text-gray-300 font-medium">Last Login</th>
                  <th className="text-left p-4 text-gray-300 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-white/5">
                    <td className="p-4">
                      <div>
                        <p className="text-white font-medium">{user.email || 'No email'}</p>
                        <p className="text-xs text-gray-400">{user.id}</p>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        user.email_confirmed_at 
                          ? 'bg-green-500/20 text-green-400' 
                          : 'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {user.email_confirmed_at ? 'Confirmed' : 'Pending'}
                      </span>
                    </td>
                    <td className="p-4 text-gray-300 text-sm">
                      {formatDate(user.created_at)}
                    </td>
                    <td className="p-4 text-gray-300 text-sm">
                      {formatDate(user.last_sign_in_at)}
                    </td>
                    <td className="p-4">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => {
                            setSelectedUser(user);
                            setShowUserModal(true);
                          }}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteUser(user.id)}
                          disabled={actionLoading}
                          className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm transition-colors disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* User Edit Modal */}
        {showUserModal && selectedUser && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 border border-white/20 rounded-xl p-6 max-w-md w-full">
              <h3 className="text-xl font-bold text-white mb-4">Edit User</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    User ID
                  </label>
                  <input
                    type="text"
                    value={selectedUser.id}
                    disabled
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-gray-400"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    defaultValue={selectedUser.email || ''}
                    id="userEmail"
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Status
                  </label>
                  <p className={`px-3 py-2 rounded-lg ${
                    selectedUser.email_confirmed_at 
                      ? 'bg-green-500/20 text-green-400' 
                      : 'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {selectedUser.email_confirmed_at ? 'Email Confirmed' : 'Email Pending'}
                  </p>
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    onClick={() => {
                      const newEmail = (document.getElementById('userEmail') as HTMLInputElement)?.value;
                      if (newEmail) {
                        updateUserEmail(selectedUser.id, newEmail);
                      }
                    }}
                    disabled={actionLoading}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {actionLoading ? 'Updating...' : 'Update'}
                  </button>
                  <button
                    onClick={() => setShowUserModal(false)}
                    className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {loading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400 mx-auto"></div>
            <p className="text-gray-400 mt-4">Loading users...</p>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
