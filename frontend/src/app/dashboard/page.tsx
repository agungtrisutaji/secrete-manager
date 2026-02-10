'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  id: string;
  email: string;
  mfa_enabled: boolean;
  status: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [role, setRole] = useState('user');

  useEffect(() => {
    const fetchUser = async () => {
      const token = localStorage.getItem('access_token');
      
      if (!token) {
        router.push('/login');
        return;
      }

      try {
        const response = await fetch(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.status === 401) {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          router.push('/login');
          return;
        }

        if (!response.ok) throw new Error('Failed to fetch user');
        const data = await response.json();
        setUser(data);

        // Fetch role
        try {
          const permRes = await fetch(`${API_URL}/credentials/my-permissions`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (permRes.ok) {
            const permData = await permRes.json();
            setRole(permData.role || 'user');
          }
        } catch {}
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard');
      } finally {
        setIsLoading(false);
      }
    };

    fetchUser();
  }, [router]);

  const handleLogout = async () => {
    const token = localStorage.getItem('access_token');
    
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {}

    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    router.push('/login');
  };

  const isAdmin = role === 'admin' || role === 'super_admin';

  const getRoleBadge = () => {
    const styles: Record<string, string> = {
      super_admin: 'bg-red-600',
      admin: 'bg-purple-600',
      user: 'bg-gray-600',
    };
    const labels: Record<string, string> = {
      super_admin: 'Super Admin',
      admin: 'Admin',
      user: 'User',
    };
    return (
      <span className={`px-2 py-0.5 rounded text-xs ${styles[role]}`}>
        {labels[role] || role}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <div className="text-white text-lg">Loading dashboard...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="bg-red-900/50 border border-red-500 text-red-200 px-6 py-4 rounded-lg">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-white">🔐 Secrets Manager</h1>
              {getRoleBadge()}
            </div>
            <div className="flex items-center gap-4">
              <span className="text-gray-300 text-sm">{user?.email}</span>
              <button
                onClick={() => router.push('/settings')}
                className="px-3 py-1.5 text-sm text-gray-300 hover:text-white transition"
                title="Settings"
              >
                ⚙️
              </button>
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white mb-1">Welcome back!</h2>
          <p className="text-gray-400">Manage your secrets and credentials securely</p>
        </div>

        {/* Navigation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Credentials */}
          <div
            onClick={() => router.push('/credentials')}
            className="bg-gray-800 border border-gray-700 rounded-xl p-6 hover:border-blue-500/50 hover:bg-gray-800/80 cursor-pointer transition group"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center group-hover:bg-blue-600/30 transition">
                <span className="text-xl">🔑</span>
              </div>
              <h2 className="text-lg font-semibold text-white">Credentials</h2>
            </div>
            <p className="text-gray-400 text-sm mb-4">
              Store, organize, and manage your passwords, API keys, and sensitive data.
            </p>
            <span className="text-blue-400 text-sm font-medium group-hover:text-blue-300 transition">
              Open Credentials →
            </span>
          </div>

          {/* Audit Logs */}
          <div
            onClick={() => router.push('/audit')}
            className="bg-gray-800 border border-gray-700 rounded-xl p-6 hover:border-purple-500/50 hover:bg-gray-800/80 cursor-pointer transition group"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-purple-600/20 rounded-lg flex items-center justify-center group-hover:bg-purple-600/30 transition">
                <span className="text-xl">📋</span>
              </div>
              <h2 className="text-lg font-semibold text-white">Audit Logs</h2>
            </div>
            <p className="text-gray-400 text-sm mb-4">
              Track all access and operations. Export for compliance reporting.
            </p>
            <span className="text-purple-400 text-sm font-medium group-hover:text-purple-300 transition">
              View Logs →
            </span>
          </div>

          {/* MFA Setup */}
          <div
            onClick={() => router.push('/mfa-setup')}
            className="bg-gray-800 border border-gray-700 rounded-xl p-6 hover:border-emerald-500/50 hover:bg-gray-800/80 cursor-pointer transition group"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-emerald-600/20 rounded-lg flex items-center justify-center group-hover:bg-emerald-600/30 transition">
                <span className="text-xl">📱</span>
              </div>
              <h2 className="text-lg font-semibold text-white">MFA Security</h2>
            </div>
            <p className="text-gray-400 text-sm mb-4">
              {user?.mfa_enabled 
                ? 'Two-factor authentication is active on your account.'
                : 'Enable two-factor authentication to secure your account.'}
            </p>
            <span className="text-emerald-400 text-sm font-medium group-hover:text-emerald-300 transition">
              {user?.mfa_enabled ? 'View MFA Status →' : 'Enable MFA →'}
            </span>
          </div>

          {/* Settings */}
          <div
            onClick={() => router.push('/settings')}
            className="bg-gray-800 border border-gray-700 rounded-xl p-6 hover:border-gray-500/50 hover:bg-gray-800/80 cursor-pointer transition group"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-gray-600/20 rounded-lg flex items-center justify-center group-hover:bg-gray-600/30 transition">
                <span className="text-xl">⚙️</span>
              </div>
              <h2 className="text-lg font-semibold text-white">Settings</h2>
            </div>
            <p className="text-gray-400 text-sm mb-4">
              Manage your profile, change password, and security preferences.
            </p>
            <span className="text-gray-400 text-sm font-medium group-hover:text-gray-300 transition">
              Open Settings →
            </span>
          </div>

          {/* Admin Panel - Only show for admins */}
          {isAdmin && (
            <>
              <div
                onClick={() => router.push('/credentials/admin')}
                className="bg-gray-800 border border-gray-700 rounded-xl p-6 hover:border-orange-500/50 hover:bg-gray-800/80 cursor-pointer transition group"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-orange-600/20 rounded-lg flex items-center justify-center group-hover:bg-orange-600/30 transition">
                    <span className="text-xl">🛡️</span>
                  </div>
                  <h2 className="text-lg font-semibold text-white">Roles & Permissions</h2>
                </div>
                <p className="text-gray-400 text-sm mb-4">
                  Manage user roles and category-based access permissions.
                </p>
                <span className="text-orange-400 text-sm font-medium group-hover:text-orange-300 transition">
                  Manage Access →
                </span>
              </div>

              <div
                onClick={() => router.push('/credentials/admin/users')}
                className="bg-gray-800 border border-gray-700 rounded-xl p-6 hover:border-teal-500/50 hover:bg-gray-800/80 cursor-pointer transition group"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-teal-600/20 rounded-lg flex items-center justify-center group-hover:bg-teal-600/30 transition">
                    <span className="text-xl">👥</span>
                  </div>
                  <h2 className="text-lg font-semibold text-white">User Management</h2>
                </div>
                <p className="text-gray-400 text-sm mb-4">
                  Create, edit, and manage user accounts in your organization.
                </p>
                <span className="text-teal-400 text-sm font-medium group-hover:text-teal-300 transition">
                  Manage Users →
                </span>
              </div>
            </>
          )}
        </div>

        {/* Account Status */}
        <div className="mt-8 bg-gray-800 border border-gray-700 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Account Overview</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gray-700/30 rounded-lg p-4">
              <div className="text-gray-400 text-sm">Status</div>
              <div className={`font-medium mt-1 ${user?.status === 'active' ? 'text-green-400' : 'text-red-400'}`}>
                {user?.status === 'active' ? '● Active' : '● ' + (user?.status || 'Unknown')}
              </div>
            </div>
            <div className="bg-gray-700/30 rounded-lg p-4">
              <div className="text-gray-400 text-sm">MFA</div>
              <div className={`font-medium mt-1 ${user?.mfa_enabled ? 'text-green-400' : 'text-yellow-400'}`}>
                {user?.mfa_enabled ? '✓ Enabled' : '⚠ Not Enabled'}
              </div>
            </div>
            <div className="bg-gray-700/30 rounded-lg p-4">
              <div className="text-gray-400 text-sm">Role</div>
              <div className="font-medium mt-1 text-white capitalize">
                {role.replace('_', ' ')}
              </div>
            </div>
            <div className="bg-gray-700/30 rounded-lg p-4">
              <div className="text-gray-400 text-sm">User ID</div>
              <div className="text-white font-medium mt-1 text-xs font-mono truncate">{user?.id}</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
