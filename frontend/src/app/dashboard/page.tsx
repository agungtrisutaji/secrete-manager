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

      <div className="text-white">Widgets Placeholder</div>
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
