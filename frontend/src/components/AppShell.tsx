'use client';

import { useState, useEffect, createContext, useContext } from 'react';
import { useRouter, usePathname } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

// ============================================================
// Auth Context — shared user/role state across the app
// ============================================================
interface AuthState {
  email: string;
  role: string;
  mfa_enabled: boolean;
  isAdmin: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthState>({
  email: '',
  role: 'user',
  mfa_enabled: false,
  isAdmin: false,
  loading: true,
});

export function useAuth() {
  return useContext(AuthContext);
}

// ============================================================
// Navigation items
// ============================================================
interface NavItem {
  label: string;
  href: string;
  icon: string;
  adminOnly?: boolean;
  match?: string; // regex or prefix for active detection
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: '🏠', match: '/dashboard' },
  { label: 'Credentials', href: '/credentials', icon: '🔑', match: '/credentials' },
  { label: 'Audit Logs', href: '/audit', icon: '📋', match: '/audit' },
  { label: 'MFA Security', href: '/mfa-setup', icon: '📱', match: '/mfa' },
  { label: 'Settings', href: '/settings', icon: '⚙️', match: '/settings' },
];

const ADMIN_ITEMS: NavItem[] = [
  { label: 'Roles & Permissions', href: '/credentials/admin', icon: '🛡️', adminOnly: true, match: '/credentials/admin' },
  { label: 'User Management', href: '/credentials/admin/users', icon: '👥', adminOnly: true, match: '/credentials/admin/users' },
];

// ============================================================
// AppShell — wraps authenticated pages with sidebar + header
// ============================================================
export default function AppShell({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [auth, setAuth] = useState<AuthState>({
    email: '',
    role: 'user',
    mfa_enabled: false,
    isAdmin: false,
    loading: true,
  });

  useEffect(() => {
    fetchAuth();
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const fetchAuth = async () => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      // Fetch user profile
      const userRes = await fetch(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (userRes.status === 401) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        router.push('/login');
        return;
      }

      const userData = await userRes.json();

      // Fetch role/permissions
      let role = 'user';
      try {
        const permRes = await fetch(`${API_URL}/credentials/my-permissions`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (permRes.ok) {
          const permData = await permRes.json();
          role = permData.role || 'user';
        }
      } catch {}

      setAuth({
        email: userData.email,
        role,
        mfa_enabled: userData.mfa_enabled,
        isAdmin: role === 'admin' || role === 'super_admin',
        loading: false,
      });
    } catch {
      setAuth((prev) => ({ ...prev, loading: false }));
    }
  };

  const handleLogout = async () => {
    const token = localStorage.getItem('access_token');
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {}
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    router.push('/login');
  };

  const isActive = (item: NavItem) => {
    if (!item.match) return pathname === item.href;
    // For admin sub-pages, match exactly to avoid both "admin" items highlighting
    if (item.href === '/credentials/admin/users') return pathname.startsWith('/credentials/admin/users');
    if (item.href === '/credentials/admin') return pathname === '/credentials/admin';
    if (item.href === '/credentials') return pathname === '/credentials';
    return pathname.startsWith(item.match);
  };

  const getRoleBadge = () => {
    const styles: Record<string, string> = {
      super_admin: 'bg-red-500/20 text-red-400 border-red-500/30',
      admin: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      user: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    };
    const labels: Record<string, string> = {
      super_admin: 'Super Admin',
      admin: 'Admin',
      user: 'User',
    };
    return (
      <span className={`px-2 py-0.5 rounded border text-[10px] font-semibold uppercase tracking-wider ${styles[auth.role] || styles.user}`}>
        {labels[auth.role] || auth.role}
      </span>
    );
  };

  if (auth.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-gray-400 text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  const allItems = [...NAV_ITEMS, ...(auth.isAdmin ? ADMIN_ITEMS : [])];

  return (
    <AuthContext.Provider value={auth}>
      <div className="min-h-screen bg-gray-950 flex">
        {/* ===== SIDEBAR ===== */}
        {/* Mobile overlay */}
        {mobileOpen && (
          <div
            className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
        )}

        <aside
          className={`
            fixed lg:sticky top-0 left-0 z-50 h-screen
            bg-gray-900 border-r border-gray-800
            flex flex-col
            transition-all duration-300 ease-in-out
            ${collapsed ? 'w-[68px]' : 'w-64'}
            ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          `}
        >
          {/* Logo */}
          <div className="flex items-center gap-3 px-4 py-5 border-b border-gray-800">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-500/20">
              <span className="text-white font-bold text-sm">SM</span>
            </div>
            {!collapsed && (
              <span className="text-white font-semibold text-sm whitespace-nowrap overflow-hidden">
                Secrets Manager
              </span>
            )}
          </div>

          {/* Nav items */}
          <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
            {/* Main section */}
            {!collapsed && (
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider px-3 mb-2">
                Main
              </p>
            )}
            {NAV_ITEMS.map((item) => (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                title={collapsed ? item.label : undefined}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                  transition-all duration-150
                  ${isActive(item)
                    ? 'bg-blue-600/15 text-blue-400 shadow-sm'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }
                  ${collapsed ? 'justify-center' : ''}
                `}
              >
                <span className="text-lg flex-shrink-0 w-6 text-center">{item.icon}</span>
                {!collapsed && <span className="truncate">{item.label}</span>}
                {isActive(item) && !collapsed && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-400" />
                )}
              </button>
            ))}

            {/* Admin section */}
            {auth.isAdmin && (
              <>
                <div className={`my-3 border-t border-gray-800 ${collapsed ? 'mx-1' : 'mx-2'}`} />
                {!collapsed && (
                  <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider px-3 mb-2">
                    Administration
                  </p>
                )}
                {ADMIN_ITEMS.map((item) => (
                  <button
                    key={item.href}
                    onClick={() => router.push(item.href)}
                    title={collapsed ? item.label : undefined}
                    className={`
                      w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                      transition-all duration-150
                      ${isActive(item)
                        ? 'bg-orange-600/15 text-orange-400 shadow-sm'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800'
                      }
                      ${collapsed ? 'justify-center' : ''}
                    `}
                  >
                    <span className="text-lg flex-shrink-0 w-6 text-center">{item.icon}</span>
                    {!collapsed && <span className="truncate">{item.label}</span>}
                    {isActive(item) && !collapsed && (
                      <div className="ml-auto w-1.5 h-1.5 rounded-full bg-orange-400" />
                    )}
                  </button>
                ))}
              </>
            )}
          </nav>

          {/* User section at bottom */}
          <div className="border-t border-gray-800 p-3">
            {collapsed ? (
              <button
                onClick={handleLogout}
                title="Sign Out"
                className="w-full flex items-center justify-center p-2.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-gray-800 transition"
              >
                <span className="text-lg">🚪</span>
              </button>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-3 px-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-gray-600 to-gray-700 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-xs text-white font-semibold">
                      {auth.email.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white truncate">{auth.email}</p>
                    {getRoleBadge()}
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-red-400 hover:bg-gray-800 transition"
                >
                  <span className="text-lg w-6 text-center">🚪</span>
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>

          {/* Collapse toggle (desktop only) */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex items-center justify-center py-3 border-t border-gray-800 text-gray-500 hover:text-gray-300 transition"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <svg
              className={`w-4 h-4 transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
        </aside>

        {/* ===== MAIN CONTENT ===== */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top bar */}
          <header className="sticky top-0 z-30 bg-gray-950/80 backdrop-blur-md border-b border-gray-800">
            <div className="flex items-center justify-between px-6 py-3">
              <div className="flex items-center gap-4">
                {/* Mobile menu button */}
                <button
                  onClick={() => setMobileOpen(true)}
                  className="lg:hidden p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
                {title && (
                  <div>
                    <h1 className="text-lg font-semibold text-white">{title}</h1>
                    {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
                  </div>
                )}
              </div>

              {/* Right side — breadcrumb-style path */}
              <div className="hidden sm:flex items-center gap-2 text-sm text-gray-500">
                {pathname.split('/').filter(Boolean).map((segment, i, arr) => (
                  <span key={i} className="flex items-center gap-2">
                    {i > 0 && <span className="text-gray-700">/</span>}
                    <span className={i === arr.length - 1 ? 'text-gray-300' : ''}>
                      {segment.charAt(0).toUpperCase() + segment.slice(1).replace('-', ' ')}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </AuthContext.Provider>
  );
}
