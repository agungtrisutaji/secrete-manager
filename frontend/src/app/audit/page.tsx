'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

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
  LOGIN: 'text-blue-400',
  LOGOUT: 'text-gray-400',
  REGISTER: 'text-green-400',
  SECRET_CREATE: 'text-emerald-400',
  SECRET_READ: 'text-sky-400',
  SECRET_UPDATE: 'text-yellow-400',
  SECRET_DELETE: 'text-red-400',
  USER_CREATE: 'text-green-400',
  USER_UPDATE: 'text-yellow-400',
  USER_SUSPEND: 'text-red-400',
  PASSWORD_CHANGE: 'text-orange-400',
  MFA_ENABLE: 'text-purple-400',
  PERMISSION_GRANT: 'text-teal-400',
  PERMISSION_REVOKE: 'text-rose-400',
  AUDIT_EXPORT: 'text-indigo-400',
};

const ACTION_ICONS: Record<string, string> = {
  LOGIN: '🔑',
  LOGOUT: '🚪',
  REGISTER: '📝',
  SECRET_CREATE: '➕',
  SECRET_READ: '👁️',
  SECRET_UPDATE: '✏️',
  SECRET_DELETE: '🗑️',
  USER_CREATE: '👤',
  USER_UPDATE: '👤',
  USER_SUSPEND: '🚫',
  PASSWORD_CHANGE: '🔒',
  MFA_ENABLE: '📱',
  PERMISSION_GRANT: '✅',
  PERMISSION_REVOKE: '❌',
  AUDIT_EXPORT: '📤',
};

export default function AuditPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Filters
  const [actionFilter, setActionFilter] = useState('');
  const [resourceFilter, setResourceFilter] = useState('');
  const [page, setPage] = useState(1);
  const [actions, setActions] = useState<{ value: string; name: string }[]>([]);

  const getToken = () => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('access_token');
    }
    return null;
  };

  useEffect(() => {
    fetchActions();
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [page, actionFilter, resourceFilter]);

  const fetchActions = async () => {
    const token = getToken();
    if (!token) return;

    try {
      const res = await fetch(`${API_URL}/audit/actions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setActions(data.actions);
      }
    } catch (err) {
      // non-critical
    }
  };

  const fetchLogs = async () => {
    const token = getToken();
    if (!token) {
      router.push('/login');
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('per_page', '25');
      if (actionFilter) params.set('action', actionFilter);
      if (resourceFilter) params.set('resource_type', resourceFilter);

      const res = await fetch(`${API_URL}/audit/logs?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        router.push('/login');
        return;
      }

      if (res.ok) {
        const data = await res.json();
        setLogs(data.data);
        setPagination(data.pagination);
      } else {
        setError('Failed to load audit logs');
      }
    } catch (err) {
      setError('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format: 'json' | 'csv') => {
    const token = getToken();
    if (!token) return;

    try {
      const res = await fetch(`${API_URL}/audit/logs/export?format=${format}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit_logs.${format}`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      setError('Export failed');
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatAction = (action: string) => {
    return action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">📋 Audit Logs</h1>
            <p className="text-gray-400 text-sm">Track all access and operations for compliance</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => router.push('/dashboard')}
              className="px-4 py-2 text-gray-300 hover:text-white transition"
            >
              ← Dashboard
            </button>
            <div className="relative group">
              <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg font-medium transition">
                📤 Export
              </button>
              <div className="hidden group-hover:block absolute right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-10 min-w-[120px]">
                <button
                  onClick={() => handleExport('json')}
                  className="block w-full text-left px-4 py-2 hover:bg-gray-700 rounded-t-lg text-sm"
                >
                  Export JSON
                </button>
                <button
                  onClick={() => handleExport('csv')}
                  className="block w-full text-left px-4 py-2 hover:bg-gray-700 rounded-b-lg text-sm"
                >
                  Export CSV
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-6">
        {error && (
          <div className="mb-4 p-4 bg-red-900/50 border border-red-500 rounded-lg text-red-200 flex justify-between items-center">
            <span>{error}</span>
            <button onClick={() => setError('')} className="text-red-400 hover:text-red-200">✕</button>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6">
          <select
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
            className="px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 transition min-w-[180px]"
          >
            <option value="">All Actions</option>
            {actions.map((a) => (
              <option key={a.value} value={a.value}>
                {formatAction(a.value)}
              </option>
            ))}
          </select>
          <select
            value={resourceFilter}
            onChange={(e) => { setResourceFilter(e.target.value); setPage(1); }}
            className="px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 transition min-w-[180px]"
          >
            <option value="">All Resources</option>
            <option value="user">User</option>
            <option value="credential">Credential</option>
            <option value="vault">Vault</option>
            <option value="session">Session</option>
          </select>
          {pagination && (
            <div className="ml-auto text-gray-400 text-sm self-center">
              Showing {logs.length} of {pagination.total} entries
            </div>
          )}
        </div>

        {/* Logs Table */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="ml-3 text-gray-400">Loading logs...</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="text-lg mb-2">No audit logs found</p>
              <p className="text-sm">Actions performed in the system will appear here</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-700/50">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-300 w-[180px]">Timestamp</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-300">Action</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-300">Actor</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-300">Resource</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-300">IP Address</th>
                  <th className="text-center px-4 py-3 text-sm font-medium text-gray-300 w-[60px]">Info</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/50">
                {logs.map((log) => (
                  <>
                    <tr key={log.id} className="hover:bg-gray-700/30 transition cursor-pointer" onClick={() => setExpandedRow(expandedRow === log.id ? null : log.id)}>
                      <td className="px-4 py-3 text-sm text-gray-400 font-mono">
                        {formatDate(log.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`font-medium text-sm ${ACTION_COLORS[log.action] || 'text-gray-300'}`}>
                          {ACTION_ICONS[log.action] || '•'} {formatAction(log.action)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {log.actor_email || <span className="text-gray-600">System</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-400">
                        {log.resource_type && (
                          <span className="bg-gray-700 px-2 py-0.5 rounded text-xs">
                            {log.resource_type}
                          </span>
                        )}
                        {log.resource_id && (
                          <span className="ml-1 text-xs text-gray-500">{log.resource_id.slice(0, 8)}...</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 font-mono">
                        {log.ip_address || '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-gray-400 transition transform ${expandedRow === log.id ? 'inline-block rotate-90' : ''}`}>
                          ▶
                        </span>
                      </td>
                    </tr>
                    {expandedRow === log.id && log.details && (
                      <tr key={`${log.id}-details`}>
                        <td colSpan={6} className="px-6 py-3 bg-gray-750">
                          <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700">
                            <p className="text-xs text-gray-400 font-medium mb-2">Details:</p>
                            <pre className="text-xs text-gray-300 overflow-x-auto whitespace-pre-wrap">
                              {JSON.stringify(log.details, null, 2)}
                            </pre>
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
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg disabled:opacity-40 hover:bg-gray-700 transition"
            >
              ← Previous
            </button>
            <span className="text-gray-400 text-sm">
              Page {pagination.page} of {pagination.total_pages}
            </span>
            <button
              onClick={() => setPage(Math.min(pagination.total_pages, page + 1))}
              disabled={page >= pagination.total_pages}
              className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg disabled:opacity-40 hover:bg-gray-700 transition"
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
