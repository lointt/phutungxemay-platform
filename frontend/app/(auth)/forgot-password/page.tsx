'use client';

// ============================================================
// app/(auth)/forgot-password/page.tsx — Trang Quên mật khẩu & Đặt lại mật khẩu
// Kết nối trực tiếp với AWS Cognito (forgotPassword & confirmPassword)
// ============================================================

import { Suspense, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { forgotPassword, confirmForgotPassword } from '@/lib/cognito';
import { cn } from '@/lib/utils';

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 60; // giây

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<ForgotPasswordSkeleton />}>
      <ForgotPasswordContent />
    </Suspense>
  );
}

function ForgotPasswordSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 bg-white/10 rounded-lg w-2/3" />
      <div className="h-4 bg-white/10 rounded w-full" />
      <div className="h-12 bg-white/10 rounded-xl mt-6" />
      <div className="h-12 bg-white/10 rounded-xl mt-2" />
    </div>
  );
}

function ForgotPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialEmail = searchParams.get('email') ?? '';

  // Step 1: REQUEST_CODE | Step 2: RESET_PASSWORD | Step 3: SUCCESS
  const [step, setStep] = useState<'REQUEST_CODE' | 'RESET_PASSWORD' | 'SUCCESS'>('REQUEST_CODE');
  const [email, setEmail] = useState(initialEmail);

  // OTP 6 chữ số
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Mật khẩu mới
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  // Đếm ngược gửi lại mã OTP
  const [countdown, setCountdown] = useState(0);
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown((v) => v - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  // ─── Bước 1: Gửi mã xác thực về Email ───────────────────────────────────────

  async function handleRequestCode(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Vui lòng nhập địa chỉ email của bạn.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Email không đúng định dạng.');
      return;
    }

    setIsLoading(true);
    try {
      await forgotPassword(trimmedEmail);
      setStep('RESET_PASSWORD');
      setCountdown(RESEND_COOLDOWN);
      setInfoMessage(`Mã xác thực 6 chữ số đã được gửi tới ${trimmedEmail}.`);
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể gửi mã đặt lại mật khẩu. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  }

  // ─── Xử lý nhập 6 ô OTP ─────────────────────────────────────────────────────

  function handleOtpChange(index: number, value: string) {
    const digit = value.replace(/\D/g, '').slice(-1);
    const nextOtp = [...otp];
    nextOtp[index] = digit;
    setOtp(nextOtp);

    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleOtpKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      if (otp[index]) {
        const nextOtp = [...otp];
        nextOtp[index] = '';
        setOtp(nextOtp);
      } else if (index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    }
    if (e.key === 'ArrowLeft' && index > 0) inputRefs.current[index - 1]?.focus();
    if (e.key === 'ArrowRight' && index < OTP_LENGTH - 1) inputRefs.current[index + 1]?.focus();
  }

  function handleOtpPaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    const nextOtp = Array(OTP_LENGTH).fill('');
    pasted.split('').forEach((char, i) => {
      nextOtp[i] = char;
    });
    setOtp(nextOtp);
    const lastIndex = Math.min(pasted.length, OTP_LENGTH - 1);
    inputRefs.current[lastIndex]?.focus();
  }

  async function handleResendCode() {
    if (countdown > 0 || isResending) return;
    setIsResending(true);
    setError(null);
    setInfoMessage(null);

    try {
      await forgotPassword(email.trim());
      setInfoMessage('✅ Đã gửi lại mã xác thực mới vào email của bạn.');
      setCountdown(RESEND_COOLDOWN);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể gửi lại mã. Vui lòng thử lại.');
    } finally {
      setIsResending(false);
    }
  }

  // ─── Bước 2: Xác nhận OTP & Đặt lại mật khẩu mới ────────────────────────────

  async function handleResetPassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);

    const code = otp.join('');
    if (code.length !== OTP_LENGTH) {
      setError('Vui lòng nhập đầy đủ mã xác thực 6 chữ số từ email.');
      return;
    }
    if (!newPassword) {
      setError('Vui lòng nhập mật khẩu mới.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Mật khẩu mới phải có ít nhất 8 ký tự.');
      return;
    }
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
      setError('Mật khẩu mới phải bao gồm chữ hoa, chữ thường và chữ số.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }

    setIsLoading(true);
    try {
      await confirmForgotPassword(email.trim(), code, newPassword);
      setStep('SUCCESS');
      setTimeout(() => {
        router.push('/login?reset=1');
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đặt lại mật khẩu thất bại. Vui lòng kiểm tra lại mã OTP.');
    } finally {
      setIsLoading(false);
    }
  }

  // ─── Giao diện Hoàn tất (Step 3) ────────────────────────────────────────────

  if (step === 'SUCCESS') {
    return (
      <div className="text-center py-4">
        <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Đặt lại mật khẩu thành công!</h2>
        <p className="text-slate-300 text-sm mb-4">
          Mật khẩu của bạn đã được cập nhật. Đang chuyển hướng về trang đăng nhập...
        </p>
        <Link
          href="/login?reset=1"
          className="inline-flex items-center justify-center px-5 py-2.5 bg-orange-500 hover:bg-orange-400 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          Đăng nhập ngay →
        </Link>
      </div>
    );
  }

  // ─── Giao diện Bước 1: Nhập Email nhận mã ───────────────────────────────────

  if (step === 'REQUEST_CODE') {
    return (
      <>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Quên mật khẩu?</h1>
          <p className="text-slate-300 text-sm mt-1">
            Nhập email đã đăng ký tài khoản. Chúng tôi sẽ gửi mã xác thực gồm 6 chữ số để đặt lại mật khẩu.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-400/30 rounded-lg">
            <p className="text-red-200 text-sm">❌ {error}</p>
          </div>
        )}

        <form onSubmit={handleRequestCode} className="space-y-4" noValidate>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-200 mb-1.5">
              Email đăng ký <span className="text-red-400">*</span>
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
                'w-full px-4 py-2.5 rounded-xl text-white placeholder-slate-400 text-sm',
                'bg-white/10 border border-white/20 focus:border-orange-400',
                'focus:outline-none focus:ring-2 focus:ring-orange-400/30 transition-colors',
              )}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !email.trim()}
            className={cn(
              'w-full py-3 rounded-xl font-semibold text-sm transition-all cursor-pointer',
              'bg-orange-500 hover:bg-orange-400 text-white shadow-lg shadow-orange-500/25',
              'disabled:opacity-60 disabled:cursor-not-allowed',
              'focus:outline-none focus:ring-2 focus:ring-orange-400',
            )}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <SpinnerIcon className="w-4 h-4 animate-spin" />
                Đang gửi mã xác thực...
              </span>
            ) : (
              'Gửi mã đặt lại mật khẩu'
            )}
          </button>
        </form>

        <div className="text-center mt-6">
          <Link href="/login" className="text-slate-300 hover:text-orange-300 text-sm font-medium transition-colors">
            ← Quay lại đăng nhập
          </Link>
        </div>
      </>
    );
  }

  // ─── Giao diện Bước 2: Nhập OTP & Mật khẩu mới ──────────────────────────────

  return (
    <>
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-white">Đặt lại mật khẩu mới</h1>
        <p className="text-slate-300 text-sm mt-1">
          Nhập mã 6 chữ số đã gửi đến{' '}
          <span className="text-orange-300 font-medium break-all">{email}</span>
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-500/20 border border-red-400/30 rounded-lg">
          <p className="text-red-200 text-sm">❌ {error}</p>
        </div>
      )}

      {infoMessage && (
        <div className="mb-4 p-3 bg-green-500/20 border border-green-400/30 rounded-lg">
          <p className="text-green-200 text-sm">{infoMessage}</p>
        </div>
      )}

      <form onSubmit={handleResetPassword} className="space-y-4" noValidate>
        {/* 6 ô mã OTP */}
        <div>
          <label className="block text-sm font-medium text-slate-200 mb-2">
            Mã xác thực OTP <span className="text-red-400">*</span>
          </label>
          <div className="flex gap-2 justify-between sm:justify-center" onPaste={handleOtpPaste}>
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={(el) => {
                  inputRefs.current[index] = el;
                }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleOtpChange(index, e.target.value)}
                onKeyDown={(e) => handleOtpKeyDown(index, e)}
                aria-label={`Chữ số OTP thứ ${index + 1}`}
                className={cn(
                  'w-11 h-12 sm:w-12 sm:h-14 text-center text-lg sm:text-xl font-bold rounded-xl',
                  'bg-white/10 border-2 text-white transition-all',
                  'focus:outline-none focus:ring-2 focus:ring-orange-400/50',
                  digit
                    ? 'border-orange-400 bg-orange-400/10'
                    : 'border-white/20 focus:border-orange-400',
                )}
              />
            ))}
          </div>
        </div>

        {/* Mật khẩu mới */}
        <div>
          <label htmlFor="newPassword" className="block text-sm font-medium text-slate-200 mb-1.5">
            Mật khẩu mới <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <input
              id="newPassword"
              type={showNewPassword ? 'text' : 'password'}
              autoComplete="new-password"
              required
              placeholder="Tối thiểu 8 ký tự (chữ hoa, thường, số)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={cn(
                'w-full px-4 py-2.5 pr-11 rounded-xl text-white placeholder-slate-400 text-sm',
                'bg-white/10 border border-white/20 focus:border-orange-400',
                'focus:outline-none focus:ring-2 focus:ring-orange-400/30 transition-colors',
              )}
            />
            <button
              type="button"
              onClick={() => setShowNewPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              aria-label={showNewPassword ? 'Ẩn mật khẩu mới' : 'Hiện mật khẩu mới'}
            >
              {showNewPassword ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Xác nhận mật khẩu mới */}
        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-200 mb-1.5">
            Xác nhận mật khẩu mới <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <input
              id="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              autoComplete="new-password"
              required
              placeholder="Nhập lại mật khẩu mới"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={cn(
                'w-full px-4 py-2.5 pr-11 rounded-xl text-white placeholder-slate-400 text-sm',
                'bg-white/10 border border-white/20 focus:border-orange-400',
                'focus:outline-none focus:ring-2 focus:ring-orange-400/30 transition-colors',
              )}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              aria-label={showConfirmPassword ? 'Ẩn mật khẩu xác nhận' : 'Hiện mật khẩu xác nhận'}
            >
              {showConfirmPassword ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading || otp.join('').length !== OTP_LENGTH || !newPassword || !confirmPassword}
          className={cn(
            'w-full py-3 rounded-xl font-semibold text-sm transition-all cursor-pointer mt-2',
            'bg-orange-500 hover:bg-orange-400 text-white shadow-lg shadow-orange-500/25',
            'disabled:opacity-60 disabled:cursor-not-allowed',
            'focus:outline-none focus:ring-2 focus:ring-orange-400',
          )}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <SpinnerIcon className="w-4 h-4 animate-spin" />
              Đang cập nhật mật khẩu...
            </span>
          ) : (
            'Xác nhận đặt lại mật khẩu'
          )}
        </button>
      </form>

      {/* Gửi lại mã hoặc đổi email */}
      <div className="flex items-center justify-between text-xs mt-5 pt-4 border-t border-white/10">
        <button
          type="button"
          onClick={() => {
            setStep('REQUEST_CODE');
            setError(null);
            setInfoMessage(null);
          }}
          className="text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
        >
          ← Đổi email khác
        </button>

        <button
          type="button"
          onClick={handleResendCode}
          disabled={countdown > 0 || isResending}
          className={cn(
            'font-medium transition-colors',
            countdown > 0 || isResending
              ? 'text-slate-500 cursor-not-allowed'
              : 'text-orange-300 hover:text-orange-200 cursor-pointer',
          )}
        >
          {isResending
            ? 'Đang gửi...'
            : countdown > 0
            ? `Gửi lại mã (${countdown}s)`
            : 'Gửi lại mã OTP'}
        </button>
      </div>
    </>
  );
}

// ─── Inline Icons ─────────────────────────────────────────────────────────────

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

