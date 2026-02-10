'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

interface UserProfile {
  id: string;
  email: string;
  mfa_enabled: boolean;
  status: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Password change form
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const getToken = () => {
    if (typeof window !== 'undefined') return localStorage.getItem('access_token');
    return null;
  };

  useEffect(() => {
    fetchUser();
  }, []);

  const fetchUser = async () => {
    const token = getToken();
    if (!token) { router.push('/login'); return; }

    try {
      const res = await fetch(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) { router.push('/login'); return; }
      if (res.ok) {
        setUser(await res.json());
      }
    } catch (err) {
      setError('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (newPassword.length < 12) {
      setError('Password must be at least 12 characters');
      return;
    }

    const token = getToken();
    if (!token) return;

    setChangingPassword(true);
    try {
      const res = await fetch(`${API_URL}/auth/password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });

      if (res.ok) {
        setSuccess('Password changed successfully!');
        setShowPasswordForm(false);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        const err = await res.json();
        setError(err.detail || 'Failed to change password');
      }
    } catch (err) {
      setError('Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="max-w-3xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">⚙️ Settings</h1>
            <p className="text-gray-400 text-sm">Manage your account and security preferences</p>
          </div>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-4 py-2 text-gray-300 hover:text-white transition"
          >
            ← Dashboard
          </button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto p-6 space-y-6">
        {error && (
          <div className="p-4 bg-red-900/50 border border-red-500 rounded-lg text-red-200 flex justify-between items-center">
            <span>{error}</span>
            <button onClick={() => setError('')} className="text-red-400 hover:text-red-200">✕</button>
          </div>
        )}
        {success && (
          <div className="p-4 bg-green-900/50 border border-green-500 rounded-lg text-green-200">
            ✅ {success}
          </div>
        )}

        {/* Profile Info */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">👤 Profile</h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center py-2 border-b border-gray-700">
              <span className="text-gray-400">Email</span>
              <span className="font-medium">{user?.email}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-700">
              <span className="text-gray-400">User ID</span>
              <span className="text-sm font-mono text-gray-300">{user?.id}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-gray-400">Status</span>
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                user?.status === 'active' ? 'bg-green-600/30 text-green-400' : 'bg-red-600/30 text-red-400'
              }`}>
                {user?.status?.charAt(0).toUpperCase()}{user?.status?.slice(1)}
              </span>
            </div>
          </div>
        </div>

        {/* Security */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">🔒 Security</h2>
          <div className="space-y-4">
            {/* MFA */}
            <div className="flex justify-between items-center py-3 border-b border-gray-700">
              <div>
                <p className="font-medium">Two-Factor Authentication</p>
                <p className="text-sm text-gray-400">
                  {user?.mfa_enabled ? 'Your account is protected with MFA' : 'Add an extra layer of security'}
                </p>
              </div>
              {user?.mfa_enabled ? (
                <span className="px-3 py-1 bg-green-600/30 text-green-400 rounded text-sm font-medium">
                  ✓ Enabled
                </span>
              ) : (
                <button
                  onClick={() => router.push('/mfa-setup')}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition"
                >
                  Enable MFA
                </button>
              )}
            </div>

            {/* Password */}
            <div className="py-3">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-medium">Password</p>
                  <p className="text-sm text-gray-400">Change your master password</p>
                </div>
                <button
                  onClick={() => setShowPasswordForm(!showPasswordForm)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition"
                >
                  {showPasswordForm ? 'Cancel' : 'Change Password'}
                </button>
              </div>

              {showPasswordForm && (
                <form onSubmit={handlePasswordChange} className="mt-4 space-y-4 bg-gray-700/30 rounded-lg p-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Current Password</label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                      className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">New Password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      minLength={12}
                      placeholder="Min. 12 characters"
                      className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Confirm New Password</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 transition"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={changingPassword}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition disabled:opacity-50"
                  >
                    {changingPassword ? 'Changing...' : 'Update Password'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-gray-800 border border-red-900/50 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4 text-red-400">⚠️ Danger Zone</h2>
          <p className="text-sm text-gray-400 mb-4">
            These actions are irreversible. Please proceed with caution.
          </p>
          <button
            onClick={() => {
              localStorage.removeItem('access_token');
              localStorage.removeItem('refresh_token');
              router.push('/login');
            }}
            className="px-4 py-2 bg-red-600/20 border border-red-600 text-red-400 hover:bg-red-600/30 rounded-lg text-sm font-medium transition"
          >
            Sign Out of All Sessions
          </button>
        </div>
      </div>
    </div>
  );
}
