'use client';

// ============================================================
// components/customer/header.tsx — Customer Navigation Header
// ============================================================

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useCart } from '@/hooks/use-cart';
import { cn } from '@/lib/utils';

export const HEADER_CATEGORIES = [
  { label: 'Tất cả sản phẩm', value: '' },
  { label: 'Hệ thống phanh', value: 'Hệ thống phanh' },
  { label: 'Hệ thống truyền động', value: 'Hệ thống truyền động' },
  { label: 'Dầu nhớt & Phụ gia', value: 'Dầu nhớt & Phụ gia' },
  { label: 'Giảm xóc sau', value: 'Giảm xóc sau' },
  { label: 'Hệ thống giảm xóc & Lái', value: 'Hệ thống giảm xóc & Lái' },
  { label: 'Động cơ', value: 'Động cơ' },
  { label: 'Điện - Đèn', value: 'Điện - Đèn' },
];

export function CustomerHeader() {
  const router = useRouter();
  const { user, isAuthenticated, isAdmin, signOut } = useAuth();
  const { itemCount } = useCart();

  const [searchQuery, setSearchQuery] = useState('');
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const accountRef = useRef<HTMLDivElement>(null);
  const categoryRef = useRef<HTMLDivElement>(null);

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setIsAccountOpen(false);
      }
      if (categoryRef.current && !categoryRef.current.contains(e.target as Node)) {
        setIsCategoryOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleSearchSubmit(e?: FormEvent) {
    if (e) e.preventDefault();
    const q = searchQuery.trim();
    if (q) {
      router.push(`/products?search=${encodeURIComponent(q)}`);
    } else {
      router.push('/products');
    }
  }

  async function handleSignOut() {
    await signOut();
    setIsAccountOpen(false);
    router.push('/');
    router.refresh();
  }

  // Lấy chữ cái đầu an toàn cho Unicode tiếng Việt
  const initialLetter = user?.name
    ? Array.from(user.name.trim())[0]?.toUpperCase() ?? 'U'
    : 'U';

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center h-16 gap-4">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 flex-shrink-0 group">
            <div className="w-10 h-10 bg-gradient-to-tr from-orange-600 to-amber-500 rounded-xl flex items-center justify-center shadow-md shadow-orange-500/20 group-hover:scale-105 transition-transform">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </div>
            <span className="hidden sm:block font-bold text-gray-900 text-sm leading-tight">
              Phụ Tùng<br />
              <span className="text-orange-500">Xe Máy</span>
            </span>
          </Link>

          {/* Category Dropdown */}
          <div className="relative hidden md:block" ref={categoryRef}>
            <button
              onClick={() => setIsCategoryOpen((v) => !v)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-xl transition-all',
                isCategoryOpen
                  ? 'bg-orange-50 text-orange-600'
                  : 'text-gray-700 hover:text-orange-600 hover:bg-orange-50/60',
              )}
            >
              <svg className="w-4 h-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              Danh mục
              <svg className={cn('w-3.5 h-3.5 transition-transform duration-200', isCategoryOpen && 'rotate-180')} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isCategoryOpen && (
              <div className="absolute top-full left-0 mt-1.5 w-60 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                {HEADER_CATEGORIES.map((cat) => (
                  <Link
                    key={cat.label}
                    href={cat.value ? `/products?category=${encodeURIComponent(cat.value)}` : '/products'}
                    onClick={() => setIsCategoryOpen(false)}
                    className="flex items-center px-4 py-2.5 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-600 font-medium transition-colors"
                  >
                    {cat.label}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Search Bar */}
          <div className="flex-1 max-w-xl">
            <form onSubmit={handleSearchSubmit} className="relative">
              <input
                type="text"
                placeholder="Tìm phụ tùng, thương hiệu, dòng xe..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-10 py-2 text-sm bg-gray-100/90 border border-transparent rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 focus:bg-white focus:border-orange-300 transition-all placeholder-gray-400 text-gray-800"
              />
              <button
                type="submit"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-orange-500 transition-colors"
                aria-label="Tìm kiếm"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
                >
                  ✕
                </button>
              )}
            </form>
          </div>

          {/* Right: Cart + Account */}
          <div className="flex items-center gap-2 flex-shrink-0">

            {/* Cart Button with Realtime Badge */}
            <Link
              href="/cart"
              className="relative p-2.5 text-gray-700 hover:text-orange-600 hover:bg-orange-50 rounded-xl transition-all"
              aria-label={`Giỏ hàng (${itemCount} sản phẩm)`}
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              {itemCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[20px] h-5 px-1 bg-orange-500 text-white text-xs font-extrabold rounded-full flex items-center justify-center shadow-md shadow-orange-500/40 animate-pulse">
                  {itemCount > 99 ? '99+' : itemCount}
                </span>
              )}
            </Link>

            {/* Account Dropdown */}
            <div className="relative" ref={accountRef}>
              {isAuthenticated ? (
                <>
                  <button
                    onClick={() => setIsAccountOpen((v) => !v)}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 hover:text-orange-600 hover:bg-orange-50 rounded-xl transition-colors border border-gray-200"
                  >
                    <div className="w-7 h-7 bg-orange-500 text-white rounded-full flex items-center justify-center font-bold text-xs shadow-sm">
                      {initialLetter}
                    </div>
                    <span className="hidden lg:block max-w-[120px] truncate font-semibold text-gray-800">
                      {user?.name || user?.email}
                    </span>
                    <svg className={cn('w-3.5 h-3.5 text-gray-400 transition-transform duration-150', isAccountOpen && 'rotate-180')} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {isAccountOpen && (
                    <div className="absolute top-full right-0 mt-2 w-60 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                      <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50/60 rounded-t-xl">
                        <p className="text-sm font-bold text-gray-800 truncate">{user?.name || 'Khách hàng'}</p>
                        <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                        {isAdmin && (
                          <span className="inline-flex items-center mt-1.5 px-2 py-0.5 bg-purple-100 text-purple-700 text-[11px] rounded-md font-semibold">
                            🛡️ Quản trị viên
                          </span>
                        )}
                      </div>

                      {isAdmin && (
                        <Link
                          href="/admin"
                          onClick={() => setIsAccountOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-purple-600 hover:bg-purple-50 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                          </svg>
                          Trang Quản trị Admin
                        </Link>
                      )}

                      <Link
                        href="/account"
                        onClick={() => setIsAccountOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-orange-50 hover:text-orange-600 transition-colors"
                      >
                        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        Hồ sơ cá nhân & Garage xe
                      </Link>

                      <Link
                        href="/account/orders"
                        onClick={() => setIsAccountOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-orange-50 hover:text-orange-600 transition-colors"
                      >
                        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        Đơn hàng của tôi
                      </Link>

                      <div className="border-t border-gray-100 mt-1 pt-1">
                        <button
                          onClick={handleSignOut}
                          className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                          </svg>
                          Đăng xuất
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <Link
                    href="/login"
                    className="px-3 py-2 text-sm font-medium text-gray-700 hover:text-orange-600 transition-colors"
                  >
                    Đăng nhập
                  </Link>
                  <Link
                    href="/register"
                    className="px-3.5 py-2 text-sm font-semibold text-white bg-orange-500 hover:bg-orange-400 rounded-xl transition-colors shadow-sm shadow-orange-500/20"
                  >
                    Đăng ký
                  </Link>
                </div>
              )}
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setIsMobileMenuOpen((v) => !v)}
              className="md:hidden p-2 text-gray-600 hover:text-orange-600 rounded-lg"
              aria-label="Menu"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d={isMobileMenuOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-gray-100 py-3 space-y-1">
            <p className="px-4 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">Danh mục</p>
            {HEADER_CATEGORIES.map((cat) => (
              <Link
                key={cat.label}
                href={cat.value ? `/products?category=${encodeURIComponent(cat.value)}` : '/products'}
                onClick={() => setIsMobileMenuOpen(false)}
                className="block px-4 py-2 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-600 rounded-lg transition-colors font-medium"
              >
                {cat.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}
