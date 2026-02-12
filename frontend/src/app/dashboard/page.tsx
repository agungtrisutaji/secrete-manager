'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AppShell, { useAuth } from '@/components/AppShell';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

interface User {
  id: string;
  email: string;
  mfa_enabled: boolean;
  status: string;
}

function DashboardContent() {
  const router = useRouter();
  const auth = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUser();
  }, []);

  const fetchUser = async () => {
    const token = localStorage.getItem('access_token');
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setUser(await res.json());
    } catch {} finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Welcome */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white mb-1">Welcome back!</h2>
        <p className="text-gray-400">Here's an overview of your account and quick actions.</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="text-gray-400 text-sm">Status</div>
          <div className={`font-semibold mt-1 text-lg ${user?.status === 'active' ? 'text-green-400' : 'text-red-400'}`}>
            {user?.status === 'active' ? '● Active' : '● ' + (user?.status || 'Unknown')}
          </div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="text-gray-400 text-sm">MFA</div>
          <div className={`font-semibold mt-1 text-lg ${user?.mfa_enabled ? 'text-green-400' : 'text-yellow-400'}`}>
            {user?.mfa_enabled ? '✓ Enabled' : '⚠ Not Enabled'}
          </div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="text-gray-400 text-sm">Role</div>
          <div className="font-semibold mt-1 text-lg text-white capitalize">
            {auth.role.replace('_', ' ')}
          </div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="text-gray-400 text-sm">Email</div>
          <div className="font-semibold mt-1 text-sm text-white truncate">
            {user?.email}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          onClick={() => router.push('/credentials')}
          className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-blue-500/40 cursor-pointer transition group"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-blue-600/15 rounded-lg flex items-center justify-center group-hover:bg-blue-600/25 transition">
              <span className="text-xl">🔑</span>
            </div>
            <h4 className="font-semibold text-white">Credentials</h4>
          </div>
          <p className="text-gray-500 text-sm">Manage passwords, API keys, and secrets</p>
        </div>

        <div
          onClick={() => router.push('/audit')}
          className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-purple-500/40 cursor-pointer transition group"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-purple-600/15 rounded-lg flex items-center justify-center group-hover:bg-purple-600/25 transition">
              <span className="text-xl">📋</span>
            </div>
            <h4 className="font-semibold text-white">Audit Logs</h4>
          </div>
          <p className="text-gray-500 text-sm">Track access and export for compliance</p>
        </div>

        <div
          onClick={() => router.push(user?.mfa_enabled ? '/mfa-setup' : '/mfa-setup')}
          className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-emerald-500/40 cursor-pointer transition group"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-emerald-600/15 rounded-lg flex items-center justify-center group-hover:bg-emerald-600/25 transition">
              <span className="text-xl">📱</span>
            </div>
            <h4 className="font-semibold text-white">MFA Security</h4>
          </div>
          <p className="text-gray-500 text-sm">
            {user?.mfa_enabled ? 'Two-factor is active' : 'Enable two-factor authentication'}
          </p>
        </div>

        {auth.isAdmin && (
          <>
            <div
              onClick={() => router.push('/credentials/admin')}
              className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-orange-500/40 cursor-pointer transition group"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-orange-600/15 rounded-lg flex items-center justify-center group-hover:bg-orange-600/25 transition">
                  <span className="text-xl">🛡️</span>
                </div>
                <h4 className="font-semibold text-white">Roles & Permissions</h4>
              </div>
              <p className="text-gray-500 text-sm">Configure access controls</p>
            </div>

            <div
              onClick={() => router.push('/credentials/admin/users')}
              className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-teal-500/40 cursor-pointer transition group"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-teal-600/15 rounded-lg flex items-center justify-center group-hover:bg-teal-600/25 transition">
                  <span className="text-xl">👥</span>
                </div>
                <h4 className="font-semibold text-white">User Management</h4>
              </div>
              <p className="text-gray-500 text-sm">Create and manage user accounts</p>
            </div>
          </>
        )}

        <div
          onClick={() => router.push('/settings')}
          className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-600/40 cursor-pointer transition group"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-gray-600/15 rounded-lg flex items-center justify-center group-hover:bg-gray-600/25 transition">
              <span className="text-xl">⚙️</span>
            </div>
            <h4 className="font-semibold text-white">Settings</h4>
          </div>
          <p className="text-gray-500 text-sm">Profile, password, and preferences</p>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <AppShell title="Dashboard" subtitle="Overview and quick actions">
      <DashboardContent />
    </AppShell>
  );
}
