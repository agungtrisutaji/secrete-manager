'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';

interface User {
  id: string;
  email: string;
  full_name: string;
}

interface UserRole {
  user_id: string;
  role: string;
  email?: string;
}

interface CategoryPermission {
  id: string;
  user_id: string;
  category_id: string;
  category_name: string;
  permission_type: string;
  granted_by: string | null;
  created_at: string;
  is_active: boolean;
}

interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

const CATEGORIES: Category[] = [
  { id: 'email', name: 'Email Accounts', icon: '📧', color: '#4285F4' },
  { id: 'social', name: 'Social Media', icon: '📱', color: '#1DA1F2' },
  { id: 'banking', name: 'Banking & Finance', icon: '💳', color: '#00C853' },
  { id: 'work', name: 'Work & Business', icon: '💼', color: '#FF6D00' },
  { id: 'cloud', name: 'Cloud Services', icon: '☁️', color: '#9C27B0' },
  { id: 'development', name: 'Development', icon: '💻', color: '#607D8B' },
  { id: 'shopping', name: 'Shopping', icon: '🛒', color: '#E91E63' },
  { id: 'entertainment', name: 'Entertainment', icon: '🎬', color: '#FF5722' },
  { id: 'other', name: 'Other', icon: '📁', color: '#9E9E9E' },
];

function AdminRolesContent() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [myPermissions, setMyPermissions] = useState<any>(null);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [permissions, setPermissions] = useState<CategoryPermission[]>([]);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showPermModal, setShowPermModal] = useState(false);
  const [roleForm, setRoleForm] = useState({ user_id: '', role: 'user' });
  const [permForm, setPermForm] = useState({ user_id: '', category_id: 'email', permission_type: 'view' });

  const getToken = () => {
    if (typeof window !== 'undefined') return localStorage.getItem('access_token');
    return null;
  };

  useEffect(() => { checkAccess(); }, []);

  const checkAccess = async () => {
    const token = getToken();
    if (!token) { router.push('/login'); return; }
    try {
      const res = await fetch(`${API_URL}/credentials/my-permissions`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401) { router.push('/login'); return; }
      const data = await res.json();
      setMyPermissions(data);
      if (!data.is_admin) { setError('Access denied. Admin privileges required.'); setLoading(false); return; }
      await fetchData();
    } catch { setError('Failed to check access'); setLoading(false); }
  };

  const fetchData = async () => {
    const token = getToken();
    if (!token) return;
    try {
      const rolesRes = await fetch(`${API_URL}/credentials/admin/roles`, { headers: { Authorization: `Bearer ${token}` } });
      if (rolesRes.ok) setRoles(await rolesRes.json());
      const permsRes = await fetch(`${API_URL}/credentials/admin/category-permissions`, { headers: { Authorization: `Bearer ${token}` } });
      if (permsRes.ok) setPermissions(await permsRes.json());
      setLoading(false);
    } catch { setError('Failed to load data'); setLoading(false); }
  };

  const handleSetRole = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/credentials/admin/roles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(roleForm),
      });
      if (res.ok) { setSuccess('Role updated successfully'); setShowRoleModal(false); setRoleForm({ user_id: '', role: 'user' }); await fetchData(); }
      else { const err = await res.json(); setError(err.detail || 'Failed to set role'); }
    } catch { setError('Failed to set role'); }
  };

  const handleGrantPermission = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/credentials/admin/category-permissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(permForm),
      });
      if (res.ok) { setSuccess('Permission granted successfully'); setShowPermModal(false); setPermForm({ user_id: '', category_id: 'email', permission_type: 'view' }); await fetchData(); }
      else { const err = await res.json(); setError(err.detail || 'Failed to grant permission'); }
    } catch { setError('Failed to grant permission'); }
  };

  const handleRevokePermission = async (permissionId: string) => {
    if (!confirm('Are you sure you want to revoke this permission?')) return;
    const token = getToken();
    if (!token) return;
    try {
      await fetch(`${API_URL}/credentials/admin/category-permissions/${permissionId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      setSuccess('Permission revoked');
      await fetchData();
    } catch { setError('Failed to revoke permission'); }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'super_admin': return 'bg-red-600/20 text-red-400';
      case 'admin': return 'bg-purple-600/20 text-purple-400';
      default: return 'bg-gray-600/20 text-gray-400';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error && !myPermissions?.is_admin) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-500 mb-4">🚫 Access Denied</h1>
          <p className="text-gray-400 mb-6">{error}</p>
          <button onClick={() => router.push('/credentials')} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg">Back to Credentials</button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {error && (
        <div className="mb-4 p-4 bg-red-900/50 border border-red-500 rounded-lg text-red-200 flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-200">✕</button>
        </div>
      )}
      {success && (
        <div className="mb-4 p-4 bg-green-900/50 border border-green-500 rounded-lg text-green-200 flex justify-between">
          <span>{success}</span>
          <button onClick={() => setSuccess('')} className="text-green-400 hover:text-green-200">✕</button>
        </div>
      )}

      {/* Current User */}
      <div className="mb-6 p-4 bg-gray-900 rounded-xl border border-gray-800">
        <h3 className="text-xs text-gray-500 mb-2 uppercase tracking-wider">Logged in as</h3>
        <div className="flex items-center gap-3">
          <span className="text-lg font-medium text-white">{myPermissions?.email}</span>
          <span className={`px-2.5 py-1 rounded text-xs font-medium ${getRoleBadgeColor(myPermissions?.role)}`}>
            {myPermissions?.role?.toUpperCase()}
          </span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* User Roles */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-white">👤 User Roles</h2>
            {myPermissions?.role === 'super_admin' && (
              <button onClick={() => setShowRoleModal(true)} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm text-white transition">+ Set Role</button>
            )}
          </div>
          {roles.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No custom roles assigned yet</p>
          ) : (
            <div className="space-y-2">
              {roles.map((r) => (
                <div key={r.user_id} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                  <div>
                    <p className="font-medium text-white">{r.email || r.user_id.slice(0, 8) + '...'}</p>
                    <p className="text-xs text-gray-500">ID: {r.user_id.slice(0, 8)}...</p>
                  </div>
                  <span className={`px-2.5 py-1 rounded text-xs font-medium ${getRoleBadgeColor(r.role)}`}>{r.role}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Category Permissions */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-white">🏷️ Category Permissions</h2>
            <button onClick={() => setShowPermModal(true)} className="px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded-lg text-sm text-white transition">+ Grant</button>
          </div>
          {permissions.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No category permissions assigned</p>
          ) : (
            <div className="space-y-2">
              {permissions.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                  <div>
                    <p className="font-medium text-white">{p.category_name}</p>
                    <p className="text-xs text-gray-500">User: {p.user_id.slice(0, 8)}... • {p.permission_type}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs ${p.is_active ? 'bg-green-600/20 text-green-400' : 'bg-gray-600/20 text-gray-400'}`}>
                      {p.is_active ? 'Active' : 'Inactive'}
                    </span>
                    <button onClick={() => handleRevokePermission(p.id)} className="text-red-400 hover:text-red-300 transition" title="Revoke">🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Categories */}
      <div className="mt-6 bg-gray-900 rounded-xl border border-gray-800 p-6">
        <h2 className="text-lg font-bold mb-4 text-white">📂 Available Categories</h2>
        <div className="grid gap-3 md:grid-cols-3">
          {CATEGORIES.map((cat) => (
            <div key={cat.id} className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg" style={{ borderLeft: `4px solid ${cat.color}` }}>
              <span className="text-2xl">{cat.icon}</span>
              <div>
                <p className="font-medium text-white">{cat.name}</p>
                <p className="text-xs text-gray-500">ID: {cat.id}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Set Role Modal */}
      {showRoleModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4 text-white">Set User Role</h2>
            <form onSubmit={handleSetRole} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">User ID *</label>
                <input type="text" value={roleForm.user_id} onChange={(e) => setRoleForm({ ...roleForm, user_id: e.target.value })} required placeholder="Enter user UUID" className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 text-white" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Role *</label>
                <select value={roleForm.role} onChange={(e) => setRoleForm({ ...roleForm, role: e.target.value })} className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 text-white">
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowRoleModal(false)} className="flex-1 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-white transition">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium text-white transition">Set Role</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Grant Permission Modal */}
      {showPermModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4 text-white">Grant Category Permission</h2>
            <form onSubmit={handleGrantPermission} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">User ID *</label>
                <input type="text" value={permForm.user_id} onChange={(e) => setPermForm({ ...permForm, user_id: e.target.value })} required placeholder="Enter user UUID" className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 text-white" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Category *</label>
                <select value={permForm.category_id} onChange={(e) => setPermForm({ ...permForm, category_id: e.target.value })} className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 text-white">
                  {CATEGORIES.map((cat) => <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Permission Type *</label>
                <select value={permForm.permission_type} onChange={(e) => setPermForm({ ...permForm, permission_type: e.target.value })} className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 text-white">
                  <option value="view">View Only</option>
                  <option value="edit">Edit</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowPermModal(false)} className="flex-1 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-white transition">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-700 rounded-lg font-medium text-white transition">Grant</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminRolesPage() {
  return (
    <AppShell title="Roles & Permissions" subtitle="Manage user access to credentials">
      <AdminRolesContent />
    </AppShell>
  );
}
