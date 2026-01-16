'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Credential {
  id: string;
  name: string;
  category: string;
  category_name: string;
  username: string | null;
  email: string | null;
  password: string;
  url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export default function CredentialsPage() {
  const router = useRouter();
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});
  const [editingCredential, setEditingCredential] = useState<Credential | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    category: 'other',
    username: '',
    email: '',
    password: '',
    url: '',
    notes: '',
  });

  useEffect(() => {
    fetchCredentials();
  }, [selectedCategory, searchQuery]);

  const getToken = () => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('access_token');
    }
    return null;
  };

  const fetchCredentials = async () => {
    const token = getToken();
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      let url = `${API_URL}/credentials`;
      const params = new URLSearchParams();
      if (selectedCategory) params.append('category', selectedCategory);
      if (searchQuery) params.append('search', searchQuery);
      if (params.toString()) url += `?${params.toString()}`;

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.status === 401) {
        router.push('/login');
        return;
      }

      const data = await response.json();
      setCredentials(data.credentials || []);
      setCategories(data.categories || []);
      setLoading(false);
    } catch (err) {
      setError('Failed to load credentials');
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getToken();
    if (!token) return;

    try {
      const url = editingCredential
        ? `${API_URL}/credentials/${editingCredential.id}`
        : `${API_URL}/credentials`;
      
      const method = editingCredential ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setShowAddModal(false);
        setEditingCredential(null);
        setFormData({
          name: '',
          category: 'other',
          username: '',
          email: '',
          password: '',
          url: '',
          notes: '',
        });
        fetchCredentials();
      } else {
        const err = await response.json();
        setError(err.detail || 'Failed to save credential');
      }
    } catch (err) {
      setError('Failed to save credential');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this credential?')) return;
    
    const token = getToken();
    if (!token) return;

    try {
      await fetch(`${API_URL}/credentials/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchCredentials();
    } catch (err) {
      setError('Failed to delete credential');
    }
  };

  const handleEdit = (credential: Credential) => {
    setEditingCredential(credential);
    setFormData({
      name: credential.name,
      category: credential.category,
      username: credential.username || '',
      email: credential.email || '',
      password: credential.password,
      url: credential.url || '',
      notes: credential.notes || '',
    });
    setShowAddModal(true);
  };

  const togglePassword = (id: string) => {
    setShowPassword(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Could add a toast notification here
  };

  const getCategoryColor = (categoryId: string) => {
    const cat = categories.find(c => c.id === categoryId);
    return cat?.color || '#9E9E9E';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-white text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">🔐 Credential Manager</h1>
            <p className="text-gray-400 text-sm">Store and manage your accounts securely</p>
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => router.push('/credentials/admin')}
              className="px-4 py-2 text-gray-300 hover:text-white"
            >
              ⚙️ Admin
            </button>
            <button
              onClick={() => router.push('/dashboard')}
              className="px-4 py-2 text-gray-300 hover:text-white"
            >
              Dashboard
            </button>
            <button
              onClick={() => {
                setEditingCredential(null);
                setFormData({
                  name: '',
                  category: 'other',
                  username: '',
                  email: '',
                  password: '',
                  url: '',
                  notes: '',
                });
                setShowAddModal(true);
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium"
            >
              + Add Credential
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-6">
        {error && (
          <div className="mb-4 p-4 bg-red-900/50 border border-red-500 rounded-lg text-red-200">
            {error}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6">
          <input
            type="text"
            placeholder="Search credentials..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 w-64"
          />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setSelectedCategory('')}
            className={`px-3 py-1 rounded-full text-sm ${
              selectedCategory === ''
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            All ({credentials.length})
          </button>
          {categories.map((cat) => {
            const count = credentials.filter(c => c.category === cat.id).length;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1 rounded-full text-sm ${
                  selectedCategory === cat.id
                    ? 'text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
                style={{
                  backgroundColor: selectedCategory === cat.id ? cat.color : undefined,
                }}
              >
                {cat.name} ({count})
              </button>
            );
          })}
        </div>

        {/* Credentials Grid */}
        {credentials.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p className="text-lg">No credentials found</p>
            <p className="text-sm mt-2">Click "Add Credential" to get started</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {credentials.map((cred) => (
              <div
                key={cred.id}
                className="bg-gray-800 border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition"
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-semibold text-lg">{cred.name}</h3>
                    <span
                      className="inline-block px-2 py-0.5 rounded text-xs mt-1"
                      style={{ backgroundColor: getCategoryColor(cred.category) + '33', color: getCategoryColor(cred.category) }}
                    >
                      {cred.category_name}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(cred)}
                      className="text-gray-400 hover:text-white"
                      title="Edit"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDelete(cred.id)}
                      className="text-gray-400 hover:text-red-500"
                      title="Delete"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                {cred.email && (
                  <div className="flex items-center gap-2 text-sm text-gray-300 mb-2">
                    <span className="text-gray-500">Email:</span>
                    <span className="flex-1 truncate">{cred.email}</span>
                    <button
                      onClick={() => copyToClipboard(cred.email!)}
                      className="text-gray-500 hover:text-blue-400"
                      title="Copy"
                    >
                      📋
                    </button>
                  </div>
                )}

                {cred.username && (
                  <div className="flex items-center gap-2 text-sm text-gray-300 mb-2">
                    <span className="text-gray-500">User:</span>
                    <span className="flex-1 truncate">{cred.username}</span>
                    <button
                      onClick={() => copyToClipboard(cred.username!)}
                      className="text-gray-500 hover:text-blue-400"
                      title="Copy"
                    >
                      📋
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-2 text-sm text-gray-300 mb-2">
                  <span className="text-gray-500">Pass:</span>
                  <span className="flex-1 font-mono">
                    {showPassword[cred.id] ? cred.password : '••••••••'}
                  </span>
                  <button
                    onClick={() => togglePassword(cred.id)}
                    className="text-gray-500 hover:text-blue-400"
                    title="Toggle visibility"
                  >
                    {showPassword[cred.id] ? '🙈' : '👁️'}
                  </button>
                  <button
                    onClick={() => copyToClipboard(cred.password)}
                    className="text-gray-500 hover:text-blue-400"
                    title="Copy"
                  >
                    📋
                  </button>
                </div>

                {cred.url && (
                  <div className="flex items-center gap-2 text-sm text-gray-300">
                    <span className="text-gray-500">URL:</span>
                    <a
                      href={cred.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 truncate text-blue-400 hover:underline"
                    >
                      {cred.url}
                    </a>
                  </div>
                )}

                {cred.notes && (
                  <div className="mt-3 text-sm text-gray-400 border-t border-gray-700 pt-2">
                    {cred.notes}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">
              {editingCredential ? 'Edit Credential' : 'Add New Credential'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder="e.g., Gmail Work Account"
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
                >
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@example.com"
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Username</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="Optional username"
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Password *</label>
                <input
                  type="text"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  placeholder="Enter password"
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Website URL</label>
                <input
                  type="url"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  placeholder="https://example.com"
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  placeholder="Additional notes..."
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingCredential(null);
                  }}
                  className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium"
                >
                  {editingCredential ? 'Update' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
