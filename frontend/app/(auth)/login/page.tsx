'use client';

// ============================================================
// app/(auth)/login/page.tsx — Trang đăng nhập
// ============================================================

import { Suspense, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginSkeleton />}>
      <LoginContent />
    </Suspense>
  );
}

function LoginSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 bg-white/10 rounded-lg w-1/2" />
      <div className="h-4 bg-white/10 rounded w-3/4" />
      <div className="h-12 bg-white/10 rounded-xl mt-6" />
      <div className="h-12 bg-white/10 rounded-xl" />
      <div className="h-12 bg-white/10 rounded-xl mt-2" />
    </div>
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lấy redirect path nếu có (ví dụ: user bị redirect từ /account)
  const redirectPath = searchParams.get('redirect') ?? '/';
  const authError = searchParams.get('error');
  const resetSuccess = searchParams.get('reset') === '1';

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await signIn(email, password);
      router.push(redirectPath);
      router.refresh(); // Cập nhật server state sau khi đăng nhập
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đã xảy ra lỗi. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Đăng nhập</h1>
        <p className="text-slate-300 text-sm mt-1">Chào mừng trở lại! Nhập thông tin để tiếp tục.</p>
      </div>

      {/* Thông báo khi đặt lại mật khẩu thành công */}
      {resetSuccess && (
        <div className="mb-4 p-3 bg-green-500/20 border border-green-400/30 rounded-lg">
          <p className="text-green-200 text-sm">✅ Đặt lại mật khẩu thành công! Vui lòng đăng nhập với mật khẩu mới.</p>
        </div>
      )}

      {/* Cảnh báo khi bị chặn từ middleware */}
      {authError === 'auth_required' && (
        <div className="mb-4 p-3 bg-yellow-500/20 border border-yellow-400/30 rounded-lg">
          <p className="text-yellow-200 text-sm">⚠️ Bạn cần đăng nhập để truy cập trang này.</p>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="mb-4 p-3 bg-red-500/20 border border-red-400/30 rounded-lg">
          <p className="text-red-200 text-sm">❌ {error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {/* Email */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-200 mb-1.5">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="example@gmail.com"
            className={cn(
              'w-full px-4 py-2.5 rounded-xl text-white placeholder-slate-400',
              'bg-white/10 border border-white/20 focus:border-orange-400',
              'focus:outline-none focus:ring-2 focus:ring-orange-400/30',
              'transition-colors text-sm',
            )}
          />
        </div>

        {/* Password */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label htmlFor="password" className="block text-sm font-medium text-slate-200">
              Mật khẩu
            </label>
            <Link
              href={email.trim() ? `/forgot-password?email=${encodeURIComponent(email.trim())}` : '/forgot-password'}
              className="text-xs text-orange-300 hover:text-orange-200 transition-colors"
            >
              Quên mật khẩu?
            </Link>
          </div>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={cn(
                'w-full px-4 py-2.5 pr-11 rounded-xl text-white placeholder-slate-400',
                'bg-white/10 border border-white/20 focus:border-orange-400',
                'focus:outline-none focus:ring-2 focus:ring-orange-400/30',
                'transition-colors text-sm',
              )}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            >
              {showPassword ? (
                <EyeOffIcon className="w-5 h-5" />
              ) : (
                <EyeIcon className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isLoading || !email || !password}
          className={cn(
            'w-full py-3 rounded-xl font-semibold text-sm transition-all',
            'bg-orange-500 hover:bg-orange-400 text-white shadow-lg shadow-orange-500/25',
            'disabled:opacity-60 disabled:cursor-not-allowed',
            'focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2 focus:ring-offset-transparent',
          )}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <SpinnerIcon className="w-4 h-4 animate-spin" />
              Đang đăng nhập...
            </span>
          ) : (
            'Đăng nhập'
          )}
        </button>
      </form>

      {/* Register Link */}
      <p className="text-center text-slate-300 text-sm mt-6">
        Chưa có tài khoản?{' '}
        <Link href="/register" className="text-orange-300 hover:text-orange-200 font-medium transition-colors">
          Đăng ký ngay
        </Link>
      </p>
    </>
  );
}

// ─── Inline Icons (không cần thêm icon library) ──────────────────────────────

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}

function EyeOffIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  );
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
