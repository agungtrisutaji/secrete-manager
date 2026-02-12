'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

function MFASetupContent() {
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

  useEffect(() => { fetchUser(); }, []);

  const fetchUser = async () => {
    const token = getToken();
    if (!token) { router.push('/login'); return; }
    try {
      const res = await fetch(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401) { router.push('/login'); return; }
      if (res.ok) setUser(await res.json());
    } catch { setError('Failed to load user info'); }
  };

  const handleSetupMFA = async () => {
    const token = getToken();
    if (!token) return;
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API_URL}/auth/mfa/setup`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setMfaData(await res.json());
      else { const err = await res.json(); setError(err.detail || 'Failed to setup MFA'); }
    } catch { setError('Failed to setup MFA'); }
    finally { setLoading(false); }
  };

  const handleVerifyMFA = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getToken();
    if (!token) return;
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API_URL}/auth/mfa/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code: verifyCode }),
      });
      if (res.ok) {
        setSuccess('MFA enabled successfully! Your account is now more secure.');
        setMfaData(null);
        setTimeout(() => router.push('/dashboard'), 2000);
      } else { const err = await res.json(); setError(err.detail || 'Invalid verification code'); }
    } catch { setError('Failed to verify MFA code'); }
    finally { setLoading(false); }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {error && (
        <div className="mb-4 p-4 bg-red-900/50 border border-red-500 rounded-lg text-red-200 flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-200">✕</button>
        </div>
      )}
      {success && (
        <div className="mb-4 p-4 bg-green-900/50 border border-green-500 rounded-lg text-green-200">✅ {success}</div>
      )}

      {/* Status */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl ${user?.mfa_enabled ? 'bg-green-600/15' : 'bg-yellow-600/15'}`}>
            {user?.mfa_enabled ? '🔒' : '⚠️'}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">
              MFA is {user?.mfa_enabled ? 'Enabled' : 'Not Enabled'}
            </h2>
            <p className="text-gray-400 text-sm">
              {user?.mfa_enabled
                ? 'Your account is protected with two-factor authentication'
                : 'Enable MFA to protect your account from unauthorized access'}
            </p>
          </div>
        </div>
      </div>

      {/* Setup flow */}
      {!user?.mfa_enabled && !mfaData && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4 text-white">Setup Two-Factor Authentication</h3>
          <div className="space-y-4 mb-6">
            {['Install an authenticator app (Google Authenticator, Authy, etc.)', 'Click the button below to generate your secret key', 'Enter the secret key manually in your authenticator', 'Verify by entering the 6-digit code from your app'].map((txt, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm flex-shrink-0">{i + 1}</span>
                <p className="text-gray-300">{txt}</p>
              </div>
            ))}
          </div>
          <button onClick={handleSetupMFA} disabled={loading} className="w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition disabled:opacity-50 text-white">
            {loading ? 'Setting up...' : '🔐 Enable MFA'}
          </button>
        </div>
      )}

      {/* Secret & Verify */}
      {mfaData && (
        <div className="space-y-6">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-4 text-white">Step 1: Add to Authenticator App</h3>
            <p className="text-gray-400 text-sm mb-4">Enter this secret key manually in your authenticator app:</p>
            <div className="bg-gray-950 rounded-lg p-4 font-mono text-center text-lg tracking-widest text-blue-400 border border-gray-800 select-all">
              {mfaData.secret}
            </div>
            <p className="text-xs text-gray-600 mt-3 text-center">Click to select, then copy. Keep this secret safe.</p>
            <details className="mt-4">
              <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-400">Show provisioning URI</summary>
              <div className="mt-2 bg-gray-950 rounded-lg p-3 border border-gray-800">
                <code className="text-xs text-gray-500 break-all">{mfaData.provisioning_uri}</code>
              </div>
            </details>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-4 text-white">Step 2: Verify Code</h3>
            <p className="text-gray-400 text-sm mb-4">Enter the 6-digit code from your authenticator app:</p>
            <form onSubmit={handleVerifyMFA} className="space-y-4">
              <input type="text" value={verifyCode} onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" maxLength={6} className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-center text-2xl font-mono tracking-[0.5em] focus:outline-none focus:border-blue-500 transition text-white" autoFocus />
              <button type="submit" disabled={verifyCode.length !== 6 || loading} className="w-full py-3 bg-green-600 hover:bg-green-700 rounded-lg font-medium transition disabled:opacity-50 text-white">
                {loading ? 'Verifying...' : '✅ Verify & Enable MFA'}
              </button>
            </form>
          </div>
        </div>
      )}

      {user?.mfa_enabled && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-2 text-white">MFA is Active</h3>
          <p className="text-gray-400 text-sm">Your account requires a verification code from your authenticator app when signing in.</p>
        </div>
      )}
    </div>
  );
}

export default function MFASetupPage() {
  return (
    <AppShell title="MFA Security" subtitle="Multi-factor authentication setup">
      <MFASetupContent />
    </AppShell>
  );
}
