'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';

interface AuditLog {
  id: string;
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  details: Record<string, any> | null;
  ip_address: string | null;
  created_at: string;
}

interface Pagination {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

const ACTION_COLORS: Record<string, string> = {
  LOGIN: 'text-blue-400', LOGOUT: 'text-gray-400', REGISTER: 'text-green-400',
  SECRET_CREATE: 'text-emerald-400', SECRET_READ: 'text-sky-400', SECRET_UPDATE: 'text-yellow-400', SECRET_DELETE: 'text-red-400',
  USER_CREATE: 'text-green-400', USER_UPDATE: 'text-yellow-400', USER_SUSPEND: 'text-red-400',
  PASSWORD_CHANGE: 'text-orange-400', MFA_ENABLE: 'text-purple-400',
  PERMISSION_GRANT: 'text-teal-400', PERMISSION_REVOKE: 'text-rose-400', AUDIT_EXPORT: 'text-indigo-400',
};

const ACTION_ICONS: Record<string, string> = {
  LOGIN: '🔑', LOGOUT: '🚪', REGISTER: '📝',
  SECRET_CREATE: '➕', SECRET_READ: '👁️', SECRET_UPDATE: '✏️', SECRET_DELETE: '🗑️',
  USER_CREATE: '👤', USER_UPDATE: '👤', USER_SUSPEND: '🚫',
  PASSWORD_CHANGE: '🔒', MFA_ENABLE: '📱',
  PERMISSION_GRANT: '✅', PERMISSION_REVOKE: '❌', AUDIT_EXPORT: '📤',
};

function AuditContent() {
  const router = useRouter();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState('');
  const [resourceFilter, setResourceFilter] = useState('');
  const [page, setPage] = useState(1);
  const [actions, setActions] = useState<{ value: string; name: string }[]>([]);

  const getToken = () => {
    if (typeof window !== 'undefined') return localStorage.getItem('access_token');
    return null;
  };

  useEffect(() => { fetchActions(); }, []);
  useEffect(() => { fetchLogs(); }, [page, actionFilter, resourceFilter]);

  const fetchActions = async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/audit/actions`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { const data = await res.json(); setActions(data.actions); }
    } catch {}
  };

  const fetchLogs = async () => {
    const token = getToken();
    if (!token) { router.push('/login'); return; }
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('per_page', '25');
      if (actionFilter) params.set('action', actionFilter);
      if (resourceFilter) params.set('resource_type', resourceFilter);
      const res = await fetch(`${API_URL}/audit/logs?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401) { router.push('/login'); return; }
      if (res.ok) { const data = await res.json(); setLogs(data.data); setPagination(data.pagination); }
      else setError('Failed to load audit logs');
    } catch { setError('Failed to load audit logs'); }
    finally { setLoading(false); }
  };

  return (
    <div className="p-6">
       <div className="text-white">Loading... {loading ? 'Yes' : 'No'}</div>
    </div>
  );
}

export default function AuditPage() {
  return (
    <AppShell title="Audit Logs" subtitle="Track all access and operations for compliance">
      <AuditContent />
    </AppShell>
  );
}
