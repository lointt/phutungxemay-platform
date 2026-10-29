'use client';

// ============================================================
// app/403/page.tsx — Trang 403 Forbidden (Từ chối truy cập)
// Hiển thị khi người dùng không thuộc nhóm Admins
// ============================================================

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';

export default function ForbiddenPage() {
  const router = useRouter();
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full bg-white rounded-3xl border border-gray-200 p-8 shadow-xl text-center space-y-6">
        <div className="w-20 h-20 bg-red-100 text-red-600 rounded-3xl flex items-center justify-center text-4xl mx-auto shadow-inner">
          🚫
        </div>

        <div>
          <span className="inline-block px-3 py-1 bg-red-50 text-red-700 text-xs font-bold rounded-full mb-3">
            Lỗi 403 — Không có quyền truy cập
          </span>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">
            Khu vực Quản trị viên
          </h1>
          <p className="text-xs text-gray-500 mt-2 leading-relaxed">
            Tài khoản <strong>{user?.email || 'hiện tại'}</strong> không thuộc nhóm quyền <strong>Admins</strong> trên hệ thống Cognito.
          </p>
        </div>

        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-left text-xs text-amber-900 space-y-1.5">
          <p className="font-bold flex items-center gap-1.5">
            <span>💡</span> Dành cho Quản trị viên:
          </p>
          <p className="text-[11px] text-amber-800">
            Nếu bạn là kỹ thuật viên hoặc quản trị hệ thống, hãy đăng nhập bằng tài khoản có nhóm quyền <code>Admins</code>.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href="/"
            className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold rounded-xl transition-colors text-center"
          >
            ← Về trang chủ
          </Link>
          <button
            type="button"
            onClick={async () => {
              await signOut();
              router.push('/login?redirect=/admin');
            }}
            className="flex-1 py-3 bg-orange-500 hover:bg-orange-400 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-orange-500/25 cursor-pointer"
          >
            Đổi tài khoản
          </button>
        </div>
      </div>
    </div>
  );
}
