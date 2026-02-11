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

  const handleExport = async (format: 'json' | 'csv') => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/audit/logs/export?format=${format}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `audit_logs.${format}`; a.click();
        URL.revokeObjectURL(url);
      }
    } catch { setError('Export failed'); }
  };

  const formatDate = (iso: string) => new Date(iso).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const formatAction = (action: string) => action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  return (
    <div className="p-6">
      {error && (
        <div className="mb-4 p-4 bg-red-900/50 border border-red-500 rounded-lg text-red-200 flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-200">✕</button>
        </div>
      )}

      {/* Filters + Export */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <select value={actionFilter} onChange={(e) => { setActionFilter(e.target.value); setPage(1); }} className="px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 text-white min-w-[180px]">
          <option value="">All Actions</option>
          {actions.map((a) => <option key={a.value} value={a.value}>{formatAction(a.value)}</option>)}
        </select>
        <select value={resourceFilter} onChange={(e) => { setResourceFilter(e.target.value); setPage(1); }} className="px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 text-white min-w-[180px]">
          <option value="">All Resources</option>
          <option value="user">User</option>
          <option value="credential">Credential</option>
          <option value="vault">Vault</option>
          <option value="session">Session</option>
        </select>
        <div className="ml-auto flex gap-2">
          <button onClick={() => handleExport('json')} className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300 hover:text-white hover:border-gray-600 transition">📤 JSON</button>
          <button onClick={() => handleExport('csv')} className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300 hover:text-white hover:border-gray-600 transition">📤 CSV</button>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="ml-3 text-gray-400">Loading logs...</span>
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-lg mb-2">No audit logs found</p>
            <p className="text-sm">Actions performed in the system will appear here</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-800/50">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider w-[170px]">Time</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Action</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Actor</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Resource</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">IP</th>
                <th className="w-[50px]" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {logs.map((log) => (
                <>
                  <tr key={log.id} className="hover:bg-gray-800/30 transition cursor-pointer" onClick={() => setExpandedRow(expandedRow === log.id ? null : log.id)}>
                    <td className="px-4 py-3 text-xs text-gray-500 font-mono">{formatDate(log.created_at)}</td>
                    <td className="px-4 py-3">
                      <span className={`font-medium text-sm ${ACTION_COLORS[log.action] || 'text-gray-300'}`}>
                        {ACTION_ICONS[log.action] || '•'} {formatAction(log.action)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">{log.actor_email || <span className="text-gray-600">System</span>}</td>
                    <td className="px-4 py-3 text-sm">
                      {log.resource_type && <span className="bg-gray-800 px-2 py-0.5 rounded text-xs text-gray-400">{log.resource_type}</span>}
                      {log.resource_id && <span className="ml-1 text-xs text-gray-600">{log.resource_id.slice(0, 8)}...</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 font-mono">{log.ip_address || '-'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-gray-500 text-xs transition-transform inline-block ${expandedRow === log.id ? 'rotate-90' : ''}`}>▶</span>
                    </td>
                  </tr>
                  {expandedRow === log.id && log.details && (
                    <tr key={`${log.id}-details`}>
                      <td colSpan={6} className="px-6 py-3">
                        <div className="bg-gray-950 rounded-lg p-4 border border-gray-800">
                          <p className="text-xs text-gray-500 font-medium mb-2">Details:</p>
                          <pre className="text-xs text-gray-400 overflow-x-auto whitespace-pre-wrap">{JSON.stringify(log.details, null, 2)}</pre>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.total_pages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1} className="px-4 py-2 bg-gray-900 border border-gray-800 rounded-lg disabled:opacity-40 hover:bg-gray-800 transition text-white text-sm">← Previous</button>
          <span className="text-gray-500 text-sm">Page {pagination.page} of {pagination.total_pages} · {pagination.total} entries</span>
          <button onClick={() => setPage(Math.min(pagination.total_pages, page + 1))} disabled={page >= pagination.total_pages} className="px-4 py-2 bg-gray-900 border border-gray-800 rounded-lg disabled:opacity-40 hover:bg-gray-800 transition text-white text-sm">Next →</button>
        </div>
      )}
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
