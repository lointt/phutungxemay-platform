'use client';

// ============================================================
// app/(auth)/register/page.tsx — Trang đăng ký tài khoản
// ============================================================

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';

interface FormData {
  name: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
}

export default function RegisterPage() {
  const router = useRouter();
  const { signUp } = useAuth();

  const [form, setForm] = useState<FormData>({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  function handleChange(key: keyof FormData) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [key]: e.target.value }));
      // Xóa lỗi field khi user bắt đầu nhập
      if (fieldErrors[key]) {
        setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
      }
    };
  }

  function validate(): boolean {
    const errors: Partial<Record<keyof FormData, string>> = {};

    if (!form.name.trim()) errors.name = 'Vui lòng nhập họ tên.';
    if (!form.email.trim()) {
      errors.email = 'Vui lòng nhập email.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errors.email = 'Email không đúng định dạng.';
    }
    const cleanPhone = form.phone.replace(/[\s.-]/g, '');
    if (cleanPhone && !/^0[0-9]{9}$/.test(cleanPhone)) {
      errors.phone = 'Số điện thoại phải gồm 10 chữ số và bắt đầu bằng số 0 (VD: 0901234567).';
    }
    if (!form.password) {
      errors.password = 'Vui lòng nhập mật khẩu.';
    } else if (form.password.length < 8) {
      errors.password = 'Mật khẩu phải có ít nhất 8 ký tự.';
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(form.password)) {
      errors.password = 'Mật khẩu phải có chữ hoa, chữ thường và số.';
    }
    if (form.password !== form.confirmPassword) {
      errors.confirmPassword = 'Mật khẩu xác nhận không khớp.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!validate()) return;

    setIsLoading(true);
    try {
      await signUp({
        email: form.email,
        password: form.password,
        name: form.name,
        phone: form.phone.trim() || undefined,
      });
      // Chuyển sang trang xác thực OTP, truyền email qua query
      router.push(`/confirm?email=${encodeURIComponent(form.email)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đã xảy ra lỗi. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Tạo tài khoản</h1>
        <p className="text-slate-300 text-sm mt-1">Đăng ký để mua sắm và nhận tư vấn phụ tùng 24/7.</p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-500/20 border border-red-400/30 rounded-lg">
          <p className="text-red-200 text-sm">❌ {error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {/* Họ tên */}
        <Field
          id="name"
          label="Họ và tên"
          required
          type="text"
          autoComplete="name"
          placeholder="Nguyễn Văn A"
          value={form.name}
          onChange={handleChange('name')}
          error={fieldErrors.name}
        />

        {/* Email */}
        <Field
          id="email"
          label="Email"
          required
          type="email"
          autoComplete="email"
          placeholder="example@gmail.com"
          value={form.email}
          onChange={handleChange('email')}
          error={fieldErrors.email}
        />

        {/* Số điện thoại */}
        <Field
          id="phone"
          label="Số điện thoại (tuỳ chọn)"
          type="tel"
          autoComplete="tel"
          placeholder="0901234567"
          value={form.phone}
          onChange={handleChange('phone')}
          error={fieldErrors.phone}
        />

        {/* Mật khẩu */}
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-slate-200 mb-1.5">
            Mật khẩu <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              required
              placeholder="Tối thiểu 8 ký tự"
              value={form.password}
              onChange={handleChange('password')}
              className={cn(
                'w-full px-4 py-2.5 pr-11 rounded-xl text-white placeholder-slate-400 text-sm',
                'bg-white/10 border focus:outline-none focus:ring-2 transition-colors',
                fieldErrors.password
                  ? 'border-red-400/60 focus:border-red-400 focus:ring-red-400/30'
                  : 'border-white/20 focus:border-orange-400 focus:ring-orange-400/30',
              )}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            >
              {showPassword ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
            </button>
          </div>
          {fieldErrors.password && (
            <p className="mt-1 text-xs text-red-300">{fieldErrors.password}</p>
          )}
        </div>

        {/* Xác nhận mật khẩu (có icon mắt ẩn/hiện) */}
        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-200 mb-1.5">
            Xác nhận mật khẩu <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <input
              id="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              autoComplete="new-password"
              required
              placeholder="Nhập lại mật khẩu"
              value={form.confirmPassword}
              onChange={handleChange('confirmPassword')}
              className={cn(
                'w-full px-4 py-2.5 pr-11 rounded-xl text-white placeholder-slate-400 text-sm',
                'bg-white/10 border focus:outline-none focus:ring-2 transition-colors',
                fieldErrors.confirmPassword
                  ? 'border-red-400/60 focus:border-red-400 focus:ring-red-400/30'
                  : 'border-white/20 focus:border-orange-400 focus:ring-orange-400/30',
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
          {fieldErrors.confirmPassword && (
            <p className="mt-1 text-xs text-red-300">{fieldErrors.confirmPassword}</p>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isLoading}
          className={cn(
            'w-full py-3 rounded-xl font-semibold text-sm transition-all mt-2',
            'bg-orange-500 hover:bg-orange-400 text-white shadow-lg shadow-orange-500/25',
            'disabled:opacity-60 disabled:cursor-not-allowed',
            'focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2 focus:ring-offset-transparent',
          )}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <SpinnerIcon className="w-4 h-4 animate-spin" />
              Đang đăng ký...
            </span>
          ) : (
            'Đăng ký tài khoản'
          )}
        </button>
      </form>

      <p className="text-center text-slate-300 text-sm mt-6">
        Đã có tài khoản?{' '}
        <Link href="/login" className="text-orange-300 hover:text-orange-200 font-medium transition-colors">
          Đăng nhập
        </Link>
      </p>
    </>
  );
}

// ─── Reusable Field Component ─────────────────────────────────────────────────

interface FieldProps {
  id: string;
  label: string;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
  required?: boolean;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
}

function Field({ id, label, type = 'text', autoComplete, placeholder, required, value, onChange, error }: FieldProps) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-200 mb-1.5">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      <input
        id={id}
        type={type}
        autoComplete={autoComplete}
        required={required}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className={cn(
          'w-full px-4 py-2.5 rounded-xl text-white placeholder-slate-400 text-sm',
          'bg-white/10 border focus:outline-none focus:ring-2 transition-colors',
          error
            ? 'border-red-400/60 focus:border-red-400 focus:ring-red-400/30'
            : 'border-white/20 focus:border-orange-400 focus:ring-orange-400/30',
        )}
      />
      {error && <p className="mt-1 text-xs text-red-300">{error}</p>}
    </div>
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
