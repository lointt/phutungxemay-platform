'use client';

// ============================================================
// app/(auth)/confirm/page.tsx — Trang xác thực OTP qua email
// ============================================================

import { Suspense, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { resendConfirmationCode } from '@/lib/cognito';
import { cn } from '@/lib/utils';

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 60; // giây

// Bọc toàn bộ nội dung trang trong Suspense để fix lỗi Next.js 16 useSearchParams prerender.
export default function ConfirmPage() {
  return (
    <Suspense fallback={<ConfirmSkeleton />}>
      <ConfirmContent />
    </Suspense>
  );
}

function ConfirmSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 bg-white/10 rounded-lg w-3/4" />
      <div className="h-4 bg-white/10 rounded w-full" />
      <div className="flex gap-2 justify-center mt-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="w-12 h-14 bg-white/10 rounded-xl" />
        ))}
      </div>
      <div className="h-12 bg-white/10 rounded-xl mt-4" />
    </div>
  );
}

function ConfirmContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { confirmSignUp } = useAuth();

  const email = searchParams.get('email') ?? '';

  // OTP chia thành 6 ô riêng biệt để UX tốt hơn
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Countdown để gửi lại OTP
  const [countdown, setCountdown] = useState(RESEND_COOLDOWN);
  const [isResending, setIsResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  // Đếm ngược cooldown
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown((v) => v - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  // Focus ô đầu tiên khi mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // Không có email → redirect về register
  useEffect(() => {
    if (!email) router.replace('/register');
  }, [email, router]);

  // ─── OTP Input Handlers ──────────────────────────────────────────────────────

  function handleOtpChange(index: number, value: string) {
    // Chỉ nhận chữ số
    const digit = value.replace(/\D/g, '').slice(-1);
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);

    // Auto-advance sang ô tiếp theo
    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleOtpKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      if (otp[index]) {
        const newOtp = [...otp];
        newOtp[index] = '';
        setOtp(newOtp);
      } else if (index > 0) {
        // Quay lại ô trước nếu ô hiện tại rỗng
        inputRefs.current[index - 1]?.focus();
      }
    }
    if (e.key === 'ArrowLeft' && index > 0) inputRefs.current[index - 1]?.focus();
    if (e.key === 'ArrowRight' && index < OTP_LENGTH - 1) inputRefs.current[index + 1]?.focus();
  }

  function handleOtpPaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    const newOtp = Array(OTP_LENGTH).fill('');
    pasted.split('').forEach((char, i) => { newOtp[i] = char; });
    setOtp(newOtp);
    // Focus ô cuối của dãy paste
    const lastIndex = Math.min(pasted.length, OTP_LENGTH - 1);
    inputRefs.current[lastIndex]?.focus();
  }

  // ─── Submit ──────────────────────────────────────────────────────────────────

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const code = otp.join('');
    if (code.length !== OTP_LENGTH) return;

    setError(null);
    setIsLoading(true);

    try {
      await confirmSignUp(email, code);
      setSuccess(true);
      // Chuyển về login sau 2 giây
      setTimeout(() => router.push('/login?verified=1'), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Mã xác thực không đúng. Vui lòng thử lại.');
      // Reset OTP để nhập lại
      setOtp(Array(OTP_LENGTH).fill(''));
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } finally {
      setIsLoading(false);
    }
  }

  // ─── Resend OTP ───────────────────────────────────────────────────────────────

  async function handleResend() {
    if (countdown > 0 || isResending) return;
    setIsResending(true);
    setResendMessage(null);
    setError(null);

    try {
      await resendConfirmationCode(email);
      setResendMessage('✅ Đã gửi lại mã xác thực về email của bạn.');
      setCountdown(RESEND_COOLDOWN);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể gửi lại mã. Vui lòng thử lại.');
    } finally {
      setIsResending(false);
    }
  }

  const otpCode = otp.join('');
  const isComplete = otpCode.length === OTP_LENGTH;

  // ─── Success State ────────────────────────────────────────────────────────────

  if (success) {
    return (
      <div className="text-center py-4">
        <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Xác thực thành công!</h2>
        <p className="text-slate-300 text-sm">Tài khoản của bạn đã được kích hoạt. Đang chuyển về trang đăng nhập...</p>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Xác thực tài khoản</h1>
        <p className="text-slate-300 text-sm mt-1">
          Nhập mã 6 chữ số đã được gửi đến{' '}
          <span className="text-orange-300 font-medium">{email || 'email của bạn'}</span>
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-500/20 border border-red-400/30 rounded-lg">
          <p className="text-red-200 text-sm">❌ {error}</p>
        </div>
      )}
      {resendMessage && (
        <div className="mb-4 p-3 bg-green-500/20 border border-green-400/30 rounded-lg">
          <p className="text-green-200 text-sm">{resendMessage}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* OTP Input Grid */}
        <div className="flex gap-2 justify-center" onPaste={handleOtpPaste}>
          {otp.map((digit, index) => (
            <input
              key={index}
              ref={(el) => { inputRefs.current[index] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleOtpChange(index, e.target.value)}
              onKeyDown={(e) => handleOtpKeyDown(index, e)}
              aria-label={`Chữ số thứ ${index + 1}`}
              className={cn(
                'w-12 h-14 text-center text-xl font-bold rounded-xl',
                'bg-white/10 border-2 text-white transition-all',
                'focus:outline-none focus:ring-2 focus:ring-orange-400/50',
                digit
                  ? 'border-orange-400 bg-orange-400/10'
                  : 'border-white/20 focus:border-orange-400',
              )}
            />
          ))}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={!isComplete || isLoading}
          className={cn(
            'w-full py-3 rounded-xl font-semibold text-sm transition-all',
            'bg-orange-500 hover:bg-orange-400 text-white shadow-lg shadow-orange-500/25',
            'disabled:opacity-60 disabled:cursor-not-allowed',
            'focus:outline-none focus:ring-2 focus:ring-orange-400',
          )}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <SpinnerIcon className="w-4 h-4 animate-spin" />
              Đang xác thực...
            </span>
          ) : (
            'Xác thực tài khoản'
          )}
        </button>
      </form>

      {/* Resend OTP */}
      <div className="text-center mt-6 space-y-2">
        <p className="text-slate-400 text-sm">Không nhận được mã?</p>
        <button
          onClick={handleResend}
          disabled={countdown > 0 || isResending}
          className={cn(
            'text-sm font-medium transition-colors',
            countdown > 0 || isResending
              ? 'text-slate-500 cursor-not-allowed'
              : 'text-orange-300 hover:text-orange-200',
          )}
        >
          {isResending
            ? 'Đang gửi...'
            : countdown > 0
            ? `Gửi lại sau ${countdown}s`
            : 'Gửi lại mã xác thực'}
        </button>
      </div>

      <div className="text-center mt-4">
        <Link href="/register" className="text-slate-400 hover:text-slate-300 text-sm transition-colors">
          ← Quay lại đăng ký
        </Link>
      </div>
    </>
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
