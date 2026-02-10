'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export default function MFASetupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [mfaData, setMfaData] = useState<{ secret: string; provisioning_uri: string } | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [user, setUser] = useState<{ email: string; mfa_enabled: boolean } | null>(null);

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
        const data = await res.json();
        setUser(data);
      }
    } catch (err) {
      setError('Failed to load user info');
    }
  };

  const handleSetupMFA = async () => {
    const token = getToken();
    if (!token) return;

    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/auth/mfa/setup`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setMfaData(data);
      } else {
        const err = await res.json();
        setError(err.detail || 'Failed to setup MFA');
      }
    } catch (err) {
      setError('Failed to setup MFA');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyMFA = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getToken();
    if (!token) return;

    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/auth/mfa/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code: verifyCode }),
      });

      if (res.ok) {
        setSuccess('MFA enabled successfully! Your account is now more secure.');
        setMfaData(null);
        setTimeout(() => router.push('/dashboard'), 2000);
      } else {
        const err = await res.json();
        setError(err.detail || 'Invalid verification code');
      }
    } catch (err) {
      setError('Failed to verify MFA code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="max-w-3xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">📱 Multi-Factor Authentication</h1>
            <p className="text-gray-400 text-sm">Add an extra layer of security to your account</p>
          </div>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-4 py-2 text-gray-300 hover:text-white transition"
          >
            ← Dashboard
          </button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto p-6">
        {error && (
          <div className="mb-4 p-4 bg-red-900/50 border border-red-500 rounded-lg text-red-200 flex justify-between items-center">
            <span>{error}</span>
            <button onClick={() => setError('')} className="text-red-400 hover:text-red-200">✕</button>
          </div>
        )}
        {success && (
          <div className="mb-4 p-4 bg-green-900/50 border border-green-500 rounded-lg text-green-200 flex justify-between items-center">
            <span>✅ {success}</span>
          </div>
        )}

        {/* Status Card */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 mb-6">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl ${user?.mfa_enabled ? 'bg-green-600/20' : 'bg-yellow-600/20'}`}>
              {user?.mfa_enabled ? '🔒' : '⚠️'}
            </div>
            <div>
              <h2 className="text-lg font-semibold">
                MFA is {user?.mfa_enabled ? 'Enabled' : 'Not Enabled'}
              </h2>
              <p className="text-gray-400 text-sm">
                {user?.mfa_enabled
                  ? 'Your account is protected with two-factor authentication'
                  : 'Enable MFA to protect your account from unauthorized access'
                }
              </p>
            </div>
          </div>
        </div>

        {/* Setup Flow */}
        {!user?.mfa_enabled && !mfaData && (
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-4">Setup Two-Factor Authentication</h3>
            <div className="space-y-4 mb-6">
              <div className="flex items-start gap-3">
                <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm flex-shrink-0">1</span>
                <p className="text-gray-300">Install an authenticator app like Google Authenticator, Authy, or Microsoft Authenticator</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm flex-shrink-0">2</span>
                <p className="text-gray-300">Click the button below to generate your secret key</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm flex-shrink-0">3</span>
                <p className="text-gray-300">Enter the secret key manually in your authenticator app</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm flex-shrink-0">4</span>
                <p className="text-gray-300">Verify by entering the 6-digit code from your app</p>
              </div>
            </div>
            <button
              onClick={handleSetupMFA}
              disabled={loading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition disabled:opacity-50"
            >
              {loading ? 'Setting up...' : '🔐 Enable MFA'}
            </button>
          </div>
        )}

        {/* Secret & Verify */}
        {mfaData && (
          <div className="space-y-6">
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4">Step 1: Add to Authenticator App</h3>
              <p className="text-gray-400 text-sm mb-4">
                Enter this secret key manually in your authenticator app:
              </p>
              <div className="bg-gray-900 rounded-lg p-4 font-mono text-center text-lg tracking-widest text-blue-400 border border-gray-700 select-all">
                {mfaData.secret}
              </div>
              <p className="text-xs text-gray-500 mt-3 text-center">
                Click to select, then copy. Keep this secret safe — you won&apos;t see it again.
              </p>

              {/* Show provisioning URI for manual entry */}
              <details className="mt-4">
                <summary className="text-sm text-gray-400 cursor-pointer hover:text-gray-300">
                  Show provisioning URI (for advanced users)
                </summary>
                <div className="mt-2 bg-gray-900 rounded-lg p-3 border border-gray-700">
                  <code className="text-xs text-gray-400 break-all">{mfaData.provisioning_uri}</code>
                </div>
              </details>
            </div>

            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4">Step 2: Verify Code</h3>
              <p className="text-gray-400 text-sm mb-4">
                Enter the 6-digit code from your authenticator app to confirm setup:
              </p>
              <form onSubmit={handleVerifyMFA} className="space-y-4">
                <input
                  type="text"
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-center text-2xl font-mono tracking-[0.5em] focus:outline-none focus:border-blue-500 transition"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={verifyCode.length !== 6 || loading}
                  className="w-full py-3 bg-green-600 hover:bg-green-700 rounded-lg font-medium transition disabled:opacity-50"
                >
                  {loading ? 'Verifying...' : '✅ Verify & Enable MFA'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Already enabled */}
        {user?.mfa_enabled && (
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-2">MFA is Active</h3>
            <p className="text-gray-400 text-sm">
              Your account requires a verification code from your authenticator app when signing in.
              This provides additional protection against unauthorized access.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
