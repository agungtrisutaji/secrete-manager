'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  id: string;
  email: string;
  role: string;
  status: string;
  mfa_enabled: boolean;
  created_at: string;
  last_login: string | null;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export default function UsersManagementPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [myRole, setMyRole] = useState('user');
  const [search, setSearch] = useState('');
  
  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  
  // Form state
  const [createForm, setCreateForm] = useState({
    email: '',
    password: '',
    role: 'user',
  });
  const [editForm, setEditForm] = useState({
    role: 'user',
    status: 'active',
  });
  const [newPassword, setNewPassword] = useState('');

  const getToken = () => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('access_token');
    }
    return null;
  };

  useEffect(() => {
    checkAccessAndLoad();
  }, []);

  const checkAccessAndLoad = async () => {
    const token = getToken();
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const permRes = await fetch(`${API_URL}/credentials/my-permissions`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (permRes.status === 401) {
        router.push('/login');
        return;
      }

      const permData = await permRes.json();
      setMyRole(permData.role);

      if (!permData.is_admin) {
        setError('Access denied. Admin privileges required.');
        setLoading(false);
        return;
      }

      await fetchUsers();
    } catch (err) {
      setError('Failed to check access');
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    const token = getToken();
    if (!token) return;

    try {
      let url = `${API_URL}/users`;
      if (search) url += `?search=${encodeURIComponent(search)}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setUsers(data.users);
      } else {
        setError('Failed to load users');
      }
      setLoading(false);
    } catch (err) {
      setError('Failed to load users');
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!loading && myRole !== 'user') {
      const debounce = setTimeout(() => fetchUsers(), 300);
      return () => clearTimeout(debounce);
    }
  }, [search]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getToken();
    if (!token) return;

    try {
      const res = await fetch(`${API_URL}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(createForm),
      });

      if (res.ok) {
        setSuccess('User created successfully!');
        setShowCreateModal(false);
        setCreateForm({ email: '', password: '', role: 'user' });
        await fetchUsers();
        setTimeout(() => setSuccess(''), 3000);
      } else {
        const err = await res.json();
        setError(err.detail || 'Failed to create user');
      }
    } catch (err) {
      setError('Failed to create user');
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    
    const token = getToken();
    if (!token) return;

    try {
      const res = await fetch(`${API_URL}/users/${selectedUser.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(editForm),
      });

      if (res.ok) {
        setSuccess('User updated successfully!');
        setShowEditModal(false);
        setSelectedUser(null);
        await fetchUsers();
        setTimeout(() => setSuccess(''), 3000);
      } else {
        const err = await res.json();
        setError(err.detail || 'Failed to update user');
      }
    } catch (err) {
      setError('Failed to update user');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    
    const token = getToken();
    if (!token) return;

    try {
      const res = await fetch(`${API_URL}/users/${selectedUser.id}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ new_password: newPassword }),
      });

      if (res.ok || res.status === 204) {
        setSuccess('Password reset successfully!');
        setShowPasswordModal(false);
        setSelectedUser(null);
        setNewPassword('');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        const err = await res.json();
        setError(err.detail || 'Failed to reset password');
      }
    } catch (err) {
      setError('Failed to reset password');
    }
  };

  const handleDeactivate = async (userId: string) => {
    if (!confirm('Are you sure you want to suspend this user?')) return;
    
    const token = getToken();
    if (!token) return;

    try {
      const res = await fetch(`${API_URL}/users/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok || res.status === 204) {
        setSuccess('User suspended');
        await fetchUsers();
        setTimeout(() => setSuccess(''), 3000);
      } else {
        const err = await res.json();
        setError(err.detail || 'Failed to suspend user');
      }
    } catch (err) {
      setError('Failed to suspend user');
    }
  };

  const openEditModal = (user: User) => {
    setSelectedUser(user);
    setEditForm({
      role: user.role,
      status: user.status,
    });
    setShowEditModal(true);
  };

  const openPasswordModal = (user: User) => {
    setSelectedUser(user);
    setNewPassword('');
    setShowPasswordModal(true);
  };

  const getRoleBadge = (role: string) => {
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
      <span className={`px-2 py-1 rounded text-xs font-medium ${styles[role] || styles.user}`}>
        {labels[role] || role}
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: 'bg-green-600/30 text-green-400',
      suspended: 'bg-red-600/30 text-red-400',
      offboarded: 'bg-gray-600/30 text-gray-400',
    };
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${styles[status] || styles.active}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <div className="text-white text-lg">Loading users...</div>
        </div>
      </div>
    );
  }

  if (error && myRole === 'user') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-500 mb-4">🚫 Access Denied</h1>
          <p className="text-gray-400 mb-6">{error}</p>
          <button
            onClick={() => router.push('/credentials')}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
          >
            Back to Credentials
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">👥 User Management</h1>
            <p className="text-gray-400 text-sm">Create and manage user accounts</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => router.push('/credentials/admin')}
              className="px-4 py-2 text-gray-300 hover:text-white transition"
            >
              ← Permissions
            </button>
            <button
              onClick={() => router.push('/credentials')}
              className="px-4 py-2 text-gray-300 hover:text-white transition"
            >
              🔐 Credentials
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition"
            >
              + Create User
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-6">
        {/* Messages */}
        {error && (
          <div className="mb-4 p-4 bg-red-900/50 border border-red-500 rounded-lg text-red-200 flex justify-between items-center">
            <span>{error}</span>
            <button onClick={() => setError('')} className="text-red-400 hover:text-red-200">✕</button>
          </div>
        )}
        {success && (
          <div className="mb-4 p-4 bg-green-900/50 border border-green-500 rounded-lg text-green-200 flex justify-between items-center">
            <span>{success}</span>
            <button onClick={() => setSuccess('')} className="text-green-400 hover:text-green-200">✕</button>
          </div>
        )}

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
            <p className="text-gray-400 text-sm">Total Users</p>
            <p className="text-2xl font-bold">{users.length}</p>
          </div>
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
            <p className="text-gray-400 text-sm">Active</p>
            <p className="text-2xl font-bold text-green-400">
              {users.filter(u => u.status === 'active').length}
            </p>
          </div>
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
            <p className="text-gray-400 text-sm">Suspended</p>
            <p className="text-2xl font-bold text-red-400">
              {users.filter(u => u.status === 'suspended').length}
            </p>
          </div>
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
            <p className="text-gray-400 text-sm">Admins</p>
            <p className="text-2xl font-bold text-purple-400">
              {users.filter(u => u.role === 'admin' || u.role === 'super_admin').length}
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search by email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-md px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 transition"
          />
        </div>

        {/* Users Table */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-700/50">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-300">Email</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-300">Role</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-300">Status</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-300">MFA</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-300">Last Login</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-300">Created</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/50">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                    <p className="text-lg mb-2">No users found</p>
                    <p className="text-sm">Create your first user by clicking the button above</p>
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-700/30 transition">
                    <td className="px-4 py-3">
                      <p className="font-medium">{u.email}</p>
                      <p className="text-xs text-gray-500">{u.id.slice(0, 8)}...</p>
                    </td>
                    <td className="px-4 py-3">{getRoleBadge(u.role)}</td>
                    <td className="px-4 py-3">{getStatusBadge(u.status)}</td>
                    <td className="px-4 py-3">
                      {u.mfa_enabled ? (
                        <span className="text-green-400 text-sm">✓ Enabled</span>
                      ) : (
                        <span className="text-gray-500 text-sm">Disabled</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {u.last_login 
                        ? new Date(u.last_login).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
                        : <span className="text-gray-600">Never</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {new Date(u.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => openEditModal(u)}
                          className="px-3 py-1 bg-blue-600/80 hover:bg-blue-600 rounded text-sm transition"
                          title="Edit user"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={() => openPasswordModal(u)}
                          className="px-3 py-1 bg-yellow-600/80 hover:bg-yellow-600 rounded text-sm transition"
                          title="Reset password"
                        >
                          🔑 Reset
                        </button>
                        {u.status === 'active' && (
                          <button
                            onClick={() => handleDeactivate(u.id)}
                            className="px-3 py-1 bg-red-600/80 hover:bg-red-600 rounded text-sm transition"
                            title="Suspend user"
                          >
                            🚫
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md border border-gray-700 shadow-2xl">
            <h2 className="text-xl font-bold mb-1">Create New User</h2>
            <p className="text-gray-400 text-sm mb-4">Add a new user to the organization</p>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Email Address *</label>
                <input
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  required
                  placeholder="user@company.com"
                  className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 transition"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Password *</label>
                <input
                  type="password"
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  required
                  minLength={8}
                  placeholder="Minimum 8 characters"
                  className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 transition"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Role *</label>
                <select
                  value={createForm.role}
                  onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 transition"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                  {myRole === 'super_admin' && (
                    <option value="super_admin">Super Admin</option>
                  )}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition"
                >
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md border border-gray-700 shadow-2xl">
            <h2 className="text-xl font-bold mb-1">Edit User</h2>
            <p className="text-gray-400 text-sm mb-4">{selectedUser.email}</p>
            <form onSubmit={handleUpdateUser} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Role</label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 transition"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                  {myRole === 'super_admin' && (
                    <option value="super_admin">Super Admin</option>
                  )}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Status</label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 transition"
                >
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="offboarded">Offboarded</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowEditModal(false); setSelectedUser(null); }}
                  className="flex-1 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showPasswordModal && selectedUser && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md border border-gray-700 shadow-2xl">
            <h2 className="text-xl font-bold mb-1">Reset Password</h2>
            <p className="text-gray-400 text-sm mb-4">{selectedUser.email}</p>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">New Password *</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder="Minimum 8 characters"
                  className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 transition"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowPasswordModal(false); setSelectedUser(null); }}
                  className="flex-1 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-yellow-600 hover:bg-yellow-700 rounded-lg font-medium transition"
                >
                  Reset Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
