'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';

interface User {
  id: string; name: string; email: string; role: string; school_id: string;
}
interface School {
  id: string; name: string; address: string; logo_url?: string;
}

const navItems = [
  { href: '/dashboard', icon: '🏠', label: 'Dashboard', roles: ['superadmin','school_admin','teacher'] },
  { href: '/dashboard/schools', icon: '🏫', label: 'Schools', roles: ['superadmin'] },
  { href: '/dashboard/sessions', icon: '📅', label: 'Sessions', roles: ['superadmin','school_admin'] },
  { href: '/dashboard/classes', icon: '🏛️', label: 'Classes', roles: ['superadmin','school_admin'] },
  { href: '/dashboard/subjects', icon: '📚', label: 'Subjects', roles: ['superadmin','school_admin'] },
  { href: '/dashboard/teachers', icon: '👨‍🏫', label: 'Teachers', roles: ['superadmin','school_admin'] },
  { href: '/dashboard/students', icon: '👨‍🎓', label: 'Students', roles: ['superadmin','school_admin','teacher'] },
  { href: '/dashboard/scores', icon: '📝', label: 'Enter Scores', roles: ['superadmin','school_admin','teacher'] },
  { href: '/dashboard/reports', icon: '📊', label: 'Reports', roles: ['superadmin','school_admin','teacher'] },
  { href: '/dashboard/settings', icon: '⚙️', label: 'Settings', roles: ['superadmin','school_admin'] },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [school, setSchool] = useState<School | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/me').then(r => {
      if (!r.ok) { router.push('/login'); return null; }
      return r.json();
    }).then(data => {
      if (data) { setUser(data.user); setSchool(data.school); }
      setLoading(false);
    });
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  const filteredNav = navItems.filter(item => user && item.roles.includes(user.role));

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-30 w-64 bg-gradient-to-b from-blue-900 to-blue-800 text-white flex flex-col transform transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        {/* Logo */}
        <div className="p-5 border-b border-blue-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-blue-800 font-bold text-sm">HH</span>
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-sm truncate">{school?.name || 'School System'}</h1>
              <p className="text-blue-300 text-xs truncate">Report Management</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {filteredNav.map(item => {
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${isActive ? 'bg-white text-blue-900 shadow-sm' : 'text-blue-100 hover:bg-blue-700'}`}
              >
                <span className="text-base">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User info */}
        <div className="p-4 border-t border-blue-700">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-white font-semibold text-sm">{user?.name?.[0]?.toUpperCase()}</span>
            </div>
            <div className="min-w-0">
              <p className="text-white text-sm font-medium truncate">{user?.name}</p>
              <p className="text-blue-300 text-xs capitalize">{user?.role?.replace('_', ' ')}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-blue-200 hover:text-white hover:bg-blue-700 rounded-lg transition-colors">
            <span>🚪</span> <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm">
          <button className="lg:hidden p-2 rounded-lg hover:bg-gray-100" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <div className="w-5 h-0.5 bg-gray-600 mb-1"></div>
            <div className="w-5 h-0.5 bg-gray-600 mb-1"></div>
            <div className="w-5 h-0.5 bg-gray-600"></div>
          </button>
          <div className="flex-1 lg:flex-none">
            <h2 className="text-lg font-semibold text-gray-800 capitalize">
              {pathname.split('/').pop()?.replace('-', ' ') || 'Dashboard'}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="badge-primary capitalize">{user?.role?.replace('_', ' ')}</span>
            {school && <span className="hidden md:block text-xs text-gray-500">{school.name}</span>}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}