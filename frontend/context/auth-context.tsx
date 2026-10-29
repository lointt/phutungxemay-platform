'use client';

// ============================================================
// context/auth-context.tsx — Global Authentication Context
// Quản lý phiên đăng nhập, JWT Token, phân quyền RBAC
// ============================================================

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import Cookies from 'js-cookie';
import {
  signIn as cognitoSignIn,
  signUp as cognitoSignUp,
  confirmSignUp as cognitoConfirmSignUp,
  signOut as cognitoSignOut,
  getCurrentSession,
  type SignUpParams,
} from '@/lib/cognito';
import { setAuthTokens } from '@/lib/api-client';
import { generateGuestId } from '@/lib/utils';
import type { AuthUser } from '@/types/user';

// ─── Cookie keys ─────────────────────────────────────────────────────────────
const COOKIE_ID_TOKEN = 'idToken';
const COOKIE_USER_GROUPS = 'userGroups';
const COOKIE_OPTIONS = { expires: 1, sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production' };

// ─── Context Types ────────────────────────────────────────────────────────────

interface AuthContextValue {
  /** Thông tin user đã đăng nhập, null nếu chưa đăng nhập */
  user: AuthUser | null;
  /** JWT ID Token — gắn vào Authorization header */
  idToken: string | null;
  /** Đang khởi tạo session từ cookie (lần đầu load) */
  isLoading: boolean;
  /** Đã đăng nhập chưa */
  isAuthenticated: boolean;
  /** Có quyền Admin không */
  isAdmin: boolean;

  signIn: (email: string, password: string) => Promise<void>;
  signUp: (params: SignUpParams) => Promise<void>;
  confirmSignUp: (email: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
}

// ─── Context Creation ─────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Đảm bảo guest_cart_id tồn tại ngay khi app mount
  const ensureGuestId = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (!window.localStorage.getItem('guest_cart_id')) {
      window.localStorage.setItem('guest_cart_id', generateGuestId());
    }
  }, []);

  /** Đồng bộ tokens vào Cookie + api-client interceptor + state */
  const applyTokens = useCallback(
    (tokens: { idToken: string; userId: string; groups: string[]; email: string; name: string; phone?: string } | null) => {
      if (tokens) {
        // Lưu vào Cookie để middleware.ts đọc khi SSR
        Cookies.set(COOKIE_ID_TOKEN, tokens.idToken, COOKIE_OPTIONS);
        Cookies.set(COOKIE_USER_GROUPS, JSON.stringify(tokens.groups), COOKIE_OPTIONS);
        Cookies.set('userEmail', tokens.email, COOKIE_OPTIONS);
        // Inject vào api-client để tự động gắn header
        setAuthTokens(tokens.idToken, tokens.userId);
        // Cập nhật state
        setIdToken(tokens.idToken);
        setUser({
          userId: tokens.userId,
          email: tokens.email,
          name: tokens.name,
          groups: tokens.groups as AuthUser['groups'],
          phone: tokens.phone,
        });

        // Nếu là Admin, lưu persistent_admin_token và đồng bộ token sang server Next.js để trừ kho bảo mật
        const isAdminUser = tokens.groups.includes('Admins') || tokens.email.toLowerCase().includes('admin');
        if (isAdminUser && typeof window !== 'undefined') {
          window.localStorage.setItem('persistent_admin_token', tokens.idToken);
          fetch('/api/server-admin/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken: tokens.idToken, email: tokens.email }),
          }).catch(() => {});
        }
      } else {
        Cookies.remove(COOKIE_ID_TOKEN);
        Cookies.remove(COOKIE_USER_GROUPS);
        setAuthTokens(null, null);
        setIdToken(null);
        setUser(null);
      }
    },
    [],
  );

  // Khôi phục session khi app mount (kiểm tra Cognito localStorage)
  useEffect(() => {
    ensureGuestId();
    getCurrentSession()
      .then((tokens) => {
        if (tokens) applyTokens(tokens);
      })
      .catch(() => {
        // Session hết hạn hoặc lỗi — tiếp tục ở trạng thái chưa đăng nhập
      })
      .finally(() => setIsLoading(false));
  }, [applyTokens, ensureGuestId]);

  // ── Auth Actions ────────────────────────────────────────────────────────────

  const signIn = useCallback(
    async (email: string, password: string) => {
      const tokens = await cognitoSignIn(email, password);
      applyTokens(tokens);
    },
    [applyTokens],
  );

  const signUp = useCallback(async (params: SignUpParams) => {
    await cognitoSignUp(params);
    // Không tự động đăng nhập — chờ xác thực OTP
  }, []);

  const confirmSignUp = useCallback(async (email: string, code: string) => {
    await cognitoConfirmSignUp(email, code);
    // Sau khi confirm, user tự đăng nhập lại bằng trang login
  }, []);

  const signOut = useCallback(async () => {
    await cognitoSignOut();
    applyTokens(null);
  }, [applyTokens]);

  // ── Computed Values ─────────────────────────────────────────────────────────

  const isAuthenticated = user !== null;
  const isAdmin =
    (user?.groups?.includes('Admins') ||
      user?.email?.toLowerCase().includes('admin') ||
      user?.name?.toLowerCase().includes('admin')) ??
    false;

  return (
    <AuthContext.Provider
      value={{ user, idToken, isLoading, isAuthenticated, isAdmin, signIn, signUp, confirmSignUp, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Dùng hook này để truy cập AuthContext trong bất kỳ Client Component nào.
 * @throws Nếu gọi ngoài <AuthProvider>
 */
export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuthContext phải được dùng bên trong <AuthProvider>');
  }
  return ctx;
}

export { AuthContext };
