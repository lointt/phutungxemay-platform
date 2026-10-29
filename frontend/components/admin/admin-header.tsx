'use client';

// ============================================================
// components/admin/admin-header.tsx — Thanh tiêu đề Admin
// ============================================================

import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';

interface AdminHeaderProps {
  onMenuToggle: () => void;
  title?: string;
}

export function AdminHeader({ onMenuToggle, title }: AdminHeaderProps) {
  const router = useRouter();
  const { user, signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    router.push('/login');
  };

  return (
    <header className="h-16 bg-white border-b border-gray-200 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs">
      <div className="flex items-center gap-3">
        {/* Mobile menu hamburger */}
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-2 text-gray-600 hover:text-gray-900 rounded-xl hover:bg-gray-100 transition-colors"
          aria-label="Mở menu"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {title && (
          <h1 className="text-base sm:text-lg font-extrabold text-gray-900 tracking-tight">
            {title}
          </h1>
        )}
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Environment / System Pill */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-green-50 border border-green-200 rounded-full text-[11px] font-bold text-green-700">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span>Hệ thống Live</span>
        </div>

        {/* User Info & Role badge */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-orange-500 to-amber-500 text-white font-bold text-xs flex items-center justify-center shadow-sm">
            {user?.name ? user.name.slice(0, 1).toUpperCase() : 'A'}
          </div>

          <div className="hidden md:block text-left">
            <p className="text-xs font-bold text-gray-900 line-clamp-1 leading-tight">
              {user?.name || 'Quản trị viên'}
            </p>
            <p className="text-[10px] font-bold text-orange-600 uppercase tracking-wider">
              {user?.groups?.includes('Admins') ? 'Super Admin' : 'Admin'}
            </p>
          </div>
        </div>

        {/* Logout CTA */}
        <button
          onClick={handleLogout}
          className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
          title="Đăng xuất"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>
    </header>
  );
}
