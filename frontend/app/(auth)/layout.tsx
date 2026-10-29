// ============================================================
// app/(auth)/layout.tsx — Shared layout cho các trang Auth
// ============================================================

import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: {
    template: '%s | Phụ Tùng Xe Máy',
    default: 'Đăng nhập | Phụ Tùng Xe Máy',
  },
};

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-orange-900 flex items-center justify-center p-4">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <a href="/" className="inline-flex items-center gap-3 group">
            <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center shadow-lg group-hover:bg-orange-400 transition-colors">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </div>
            <div className="text-left">
              <p className="text-white font-bold text-xl leading-tight">Phụ Tùng Xe Máy</p>
              <p className="text-orange-300 text-xs">phutungxemay.store</p>
            </div>
          </a>
        </div>

        {/* Card */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-2xl border border-white/20 p-8">
          {children}
        </div>

        {/* Footer */}
        <p className="text-center text-slate-400 text-xs mt-6">
          © 2024 Phụ Tùng Xe Máy. Tất cả quyền được bảo lưu.
        </p>
      </div>
    </div>
  );
}
