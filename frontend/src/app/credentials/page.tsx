'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';

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

function CredentialsContent() {
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
    if (typeof window !== 'undefined') return localStorage.getItem('access_token');
    return null;
  };

  const fetchCredentials = async () => {
    const token = getToken();
    if (!token) { router.push('/login'); return; }

    try {
      let url = `${API_URL}/credentials`;
      const params = new URLSearchParams();
      if (selectedCategory) params.append('category', selectedCategory);
      if (searchQuery) params.append('search', searchQuery);
      if (params.toString()) url += `?${params.toString()}`;

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.status === 401) { router.push('/login'); return; }

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
        setFormData({ name: '', category: 'other', username: '', email: '', password: '', url: '', notes: '' });
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
  };

  const getCategoryColor = (categoryId: string) => {
    const cat = categories.find(c => c.id === categoryId);
    return cat?.color || '#9E9E9E';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
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

      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="Search credentials..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 w-64 text-white placeholder-gray-500"
          />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 text-white"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>
        <button
          onClick={() => {
            setEditingCredential(null);
            setFormData({ name: '', category: 'other', username: '', email: '', password: '', url: '', notes: '' });
            setShowAddModal(true);
          }}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium text-white transition"
        >
          + Add Credential
        </button>
      </div>

      {/* Category Pills */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setSelectedCategory('')}
          className={`px-3 py-1.5 rounded-full text-sm transition ${
            selectedCategory === '' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
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
              className={`px-3 py-1.5 rounded-full text-sm transition ${
                selectedCategory === cat.id ? 'text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
              style={{ backgroundColor: selectedCategory === cat.id ? cat.color : undefined }}
            >
              {cat.name} ({count})
            </button>
          );
        })}
      </div>

      {/* Credentials Grid */}
      {credentials.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg mb-2">No credentials found</p>
          <p className="text-sm">Click &quot;Add Credential&quot; to get started</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {credentials.map((cred) => (
            <div
              key={cred.id}
              className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition"
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-semibold text-lg text-white">{cred.name}</h3>
                  <span
                    className="inline-block px-2 py-0.5 rounded text-xs mt-1"
                    style={{ backgroundColor: getCategoryColor(cred.category) + '33', color: getCategoryColor(cred.category) }}
                  >
                    {cred.category_name}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleEdit(cred)} className="text-gray-500 hover:text-white transition" title="Edit">✏️</button>
                  <button onClick={() => handleDelete(cred.id)} className="text-gray-500 hover:text-red-500 transition" title="Delete">🗑️</button>
                </div>
              </div>

              {cred.email && (
                <div className="flex items-center gap-2 text-sm text-gray-300 mb-2">
                  <span className="text-gray-500 w-10">Email</span>
                  <span className="flex-1 truncate">{cred.email}</span>
                  <button onClick={() => copyToClipboard(cred.email!)} className="text-gray-600 hover:text-blue-400 transition" title="Copy">📋</button>
                </div>
              )}

              {cred.username && (
                <div className="flex items-center gap-2 text-sm text-gray-300 mb-2">
                  <span className="text-gray-500 w-10">User</span>
                  <span className="flex-1 truncate">{cred.username}</span>
                  <button onClick={() => copyToClipboard(cred.username!)} className="text-gray-600 hover:text-blue-400 transition" title="Copy">📋</button>
                </div>
              )}

              <div className="flex items-center gap-2 text-sm text-gray-300 mb-2">
                <span className="text-gray-500 w-10">Pass</span>
                <span className="flex-1 font-mono">{showPassword[cred.id] ? cred.password : '••••••••'}</span>
                <button onClick={() => togglePassword(cred.id)} className="text-gray-600 hover:text-blue-400 transition" title="Toggle">
                  {showPassword[cred.id] ? '🙈' : '👁️'}
                </button>
                <button onClick={() => copyToClipboard(cred.password)} className="text-gray-600 hover:text-blue-400 transition" title="Copy">📋</button>
              </div>

              {cred.url && (
                <div className="flex items-center gap-2 text-sm text-gray-300">
                  <span className="text-gray-500 w-10">URL</span>
                  <a href={cred.url} target="_blank" rel="noopener noreferrer" className="flex-1 truncate text-blue-400 hover:underline">
                    {cred.url}
                  </a>
                </div>
              )}

              {cred.notes && (
                <div className="mt-3 text-sm text-gray-500 border-t border-gray-800 pt-2">
                  {cred.notes}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4 text-white">
              {editingCredential ? 'Edit Credential' : 'Add New Credential'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Name *</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required placeholder="e.g., Gmail Work Account" className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 text-white" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Category</label>
                <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 text-white">
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Email</label>
                <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="email@example.com" className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 text-white" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Username</label>
                <input type="text" value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} placeholder="Optional username" className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 text-white" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Password *</label>
                <input type="text" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} required placeholder="Enter password" className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 font-mono text-white" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Website URL</label>
                <input type="url" value={formData.url} onChange={(e) => setFormData({ ...formData, url: e.target.value })} placeholder="https://example.com" className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 text-white" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Notes</label>
                <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={3} placeholder="Additional notes..." className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 text-white" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowAddModal(false); setEditingCredential(null); }} className="flex-1 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-white transition">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium text-white transition">{editingCredential ? 'Update' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CredentialsPage() {
  return (
    <AppShell title="Credentials" subtitle="Store and manage your accounts securely">
      <CredentialsContent />
    </AppShell>
  );
}
