// ============================================================
// lib/api-client.ts — Configured fetch client with auth interceptors
// ============================================================

import Cookies from 'js-cookie';
import { getCurrentSession } from '@/lib/cognito';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'https://d1ksuy3hfmko20.cloudfront.net';

/** Kiểm tra xem JWT Token có bị hết hạn hay không */
export function isTokenExpired(token: string | null | undefined): boolean {
  if (!token) return true;
  try {
    const payloadB64 = token.split('.')[1];
    if (!payloadB64) return true;
    const base64 = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
    const binStr = atob(base64);
    const bytes = Uint8Array.from(binStr, (c) => c.charCodeAt(0));
    const jsonStr = new TextDecoder('utf-8').decode(bytes);
    const parsed = JSON.parse(jsonStr) as { exp?: number };
    if (parsed.exp) {
      // Coi như hết hạn sớm hơn 30 giây để tránh chênh lệch clock
      return Date.now() >= (parsed.exp - 30) * 1000;
    }
    return false;
  } catch {
    return true;
  }
}

/** Lấy số giây còn hiệu lực của token */
export function getTokenRemainingSeconds(token: string | null | undefined): number {
  if (!token) return 0;
  try {
    const payloadB64 = token.split('.')[1];
    if (!payloadB64) return 0;
    const base64 = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
    const binStr = atob(base64);
    const bytes = Uint8Array.from(binStr, (c) => c.charCodeAt(0));
    const jsonStr = new TextDecoder('utf-8').decode(bytes);
    const parsed = JSON.parse(jsonStr) as { exp?: number };
    if (parsed.exp) {
      return Math.max(0, Math.floor(parsed.exp - Date.now() / 1000));
    }
    return 0;
  } catch {
    return 0;
  }
}

/** Lấy idToken từ in-memory store (được set bởi AuthContext) */
let _idToken: string | null = null;
let _userId: string | null = null;

/** Được gọi bởi AuthContext sau khi đăng nhập thành công */
export function setAuthTokens(idToken: string | null, userId: string | null): void {
  _idToken = idToken;
  _userId = userId;
  if (typeof window !== 'undefined' && idToken) {
    window.localStorage.setItem('admin_id_token', idToken);
    Cookies.set('idToken', idToken, { expires: 1, sameSite: 'lax' });
  }
}

/** Lấy ID Token còn hạn từ bộ nhớ, Cookie, hoặc LocalStorage */
export function getIdToken(): string | null {
  // 1. In-memory
  if (_idToken && !isTokenExpired(_idToken)) return _idToken;

  if (typeof window === 'undefined') return null;

  // 2. Cookie idToken
  const cookieToken = Cookies.get('idToken');
  if (cookieToken && !isTokenExpired(cookieToken)) return cookieToken;

  // 3. Token lưu thủ công
  const adminToken = window.localStorage.getItem('admin_id_token');
  if (adminToken && !isTokenExpired(adminToken)) return adminToken;

  // 4. Quét Cognito LocalStorage keys
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (key && key.endsWith('.idToken')) {
      const val = window.localStorage.getItem(key);
      if (val && !isTokenExpired(val)) return val;
    }
  }

  return null;
}

/** Lấy guest_id từ localStorage (chỉ chạy phía client) */
function getGuestId(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('guest_cart_id');
}

/** Lấy UserID tương thích với Token đang dùng */
export function getUserId(): string | null {
  if (_userId) return _userId;
  if (typeof window === 'undefined') return '19eac5ec-5011-70f9-71f8-aa640a5b69f5';

  const token = getIdToken();
  if (token) {
    try {
      const payloadB64 = token.split('.')[1];
      if (payloadB64) {
        const base64 = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
        const binStr = atob(base64);
        const bytes = Uint8Array.from(binStr, (c) => c.charCodeAt(0));
        const jsonStr = new TextDecoder('utf-8').decode(bytes);
        const parsed = JSON.parse(jsonStr) as { sub?: string };
        if (parsed.sub) return parsed.sub;
      }
    } catch {}
  }

  return getGuestId() ?? '19eac5ec-5011-70f9-71f8-aa640a5b69f5';
}

// ─── Request/Response Types ───────────────────────────────────────────────────

export interface ApiError {
  message: string;
  statusCode: number;
  code?: string;
}

export class ApiRequestError extends Error {
  public readonly statusCode: number;
  public readonly code?: string;

  constructor(error: ApiError) {
    super(error.message);
    this.name = 'ApiRequestError';
    this.statusCode = error.statusCode;
    this.code = error.code;
  }
}

// ─── Core Fetch Helper ────────────────────────────────────────────────────────

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Nếu true, không gắn Authorization header (dùng cho public endpoints) */
  skipAuth?: boolean;
  /** Dùng cho endpoint custom (không qua CloudFront /api/*) */
  baseUrl?: string;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, skipAuth = false, baseUrl, ...fetchOptions } = options;

  const headers = new Headers(fetchOptions.headers);

  // Content-Type mặc định JSON
  if (body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  // Gắn Authorization Bearer token nếu có token còn hạn (hoặc tự động refresh session nếu cần)
  let token = getIdToken();
  if (!token && !skipAuth && typeof window !== 'undefined') {
    try {
      const session = await getCurrentSession();
      if (session?.idToken && !isTokenExpired(session.idToken)) {
        token = session.idToken;
        setAuthTokens(token, session.userId);
      }
    } catch {}
  }
  if (!skipAuth && token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // Lấy userId: dùng Cognito sub nếu đã login, ngược lại dùng guest_id
  const userId = getUserId();
  // Lưu ý: Không gắn custom header 'x-user-id' vào request vì API Gateway CORS chỉ cho phép Content-Type và Authorization.
  // UserID được chuyển tiếp an toàn qua Query Parameters (?userId=...) và Body.

  // CloudFront đôi khi chặn custom headers (như x-user-id), nhưng luôn chuyển tiếp Query Parameters.
  // Tự động bổ sung ?userId=... cho /api/cart, /api/orders, /api/users
  let finalPath = path;
  if (userId && (path.startsWith('/api/cart') || path.startsWith('/api/orders') || path.startsWith('/api/users'))) {
    const separator = finalPath.includes('?') ? '&' : '?';
    if (!finalPath.includes('userId=')) {
      finalPath = `${finalPath}${separator}userId=${encodeURIComponent(userId)}`;
    }
  }

  let finalBody = body;
  if (userId && typeof body === 'object' && body !== null && !Array.isArray(body)) {
    finalBody = { ...body, userId };
  }

  const url = `${baseUrl ?? API_BASE}${finalPath}`;

  const response = await fetch(url, {
    ...fetchOptions,
    headers,
    body: finalBody !== undefined ? JSON.stringify(finalBody) : undefined,
  });

  if (!response.ok) {
    // Cố gắng parse error body từ backend
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    let errorCode: string | undefined;
    try {
      const errorBody = await response.json() as { message?: string; error?: string; code?: string };
      errorMessage = errorBody.message ?? errorBody.error ?? errorMessage;
      errorCode = errorBody.code;
    } catch {
      // Bỏ qua nếu body không phải JSON
    }
    throw new ApiRequestError({ message: errorMessage, statusCode: response.status, code: errorCode });
  }

  // Xử lý response rỗng (204 No Content)
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

// ─── Public API Methods ───────────────────────────────────────────────────────

const apiClient = {
  /**
   * GET request
   * @example const products = await apiClient.get<ProductListResponse>('/api/products?category=brake')
   */
  get<T>(path: string, options?: Omit<RequestOptions, 'body' | 'method'>): Promise<T> {
    return request<T>(path, { ...options, method: 'GET' });
  },

  /**
   * POST request
   * @example await apiClient.post('/api/cart', { product_id: '...', quantity: 1 })
   */
  post<T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'body' | 'method'>): Promise<T> {
    return request<T>(path, { ...options, method: 'POST', body });
  },

  /**
   * PUT request
   * @example await apiClient.put('/api/orders/ORD_123', { order_status: 'SHIPPED' })
   */
  put<T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'body' | 'method'>): Promise<T> {
    return request<T>(path, { ...options, method: 'PUT', body });
  },

  /**
   * DELETE request
   * @example await apiClient.delete('/api/cart')
   */
  delete<T>(path: string, options?: Omit<RequestOptions, 'body' | 'method'>): Promise<T> {
    return request<T>(path, { ...options, method: 'DELETE' });
  },
};

export default apiClient;
