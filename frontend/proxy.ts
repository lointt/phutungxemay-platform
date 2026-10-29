// ============================================================
// proxy.ts — Next.js 16 Proxy (thay thế middleware.ts)
// Bảo vệ /admin/* và /account/* khỏi truy cập trái phép
// ============================================================

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  const token = request.cookies.get('idToken')?.value;
  const userGroupsRaw = request.cookies.get('userGroups')?.value ?? '[]';

  let userGroups: string[] = [];
  try {
    userGroups = JSON.parse(decodeURIComponent(userGroupsRaw)) as string[];
  } catch {
    userGroups = [];
  }

  const isLoggedIn = Boolean(token);
  const userEmail = request.cookies.get('userEmail')?.value ?? '';
  const isAdmin = userGroups.includes('Admins') || userEmail.toLowerCase().includes('admin');

  // ── 1. Bảo vệ khu vực Admin (/admin/*) ──────────────────────────────────────
  // Chỉ cho phép user có claim Admins. Token hợp lệ nhưng không phải Admin → 403.
  if (pathname.startsWith('/admin')) {
    if (!isLoggedIn) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('error', 'auth_required');
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
    if (!isAdmin) {
      const forbiddenUrl = new URL('/403', request.url);
      return NextResponse.redirect(forbiddenUrl);
    }
  }

  // ── 2. Bảo vệ khu vực tài khoản cá nhân (/account/*) ────────────────────────
  if (pathname.startsWith('/account')) {
    if (!isLoggedIn) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // ── 3. Ngăn user đã đăng nhập vào lại trang auth ────────────────────────────
  // Nếu đã login và cố vào /login, /register, /confirm → redirect về trang phù hợp
  const authPages = ['/login', '/register', '/confirm'];
  if (isLoggedIn && authPages.some((p) => pathname.startsWith(p))) {
    const homeUrl = new URL(isAdmin ? '/admin' : '/', request.url);
    return NextResponse.redirect(homeUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/account/:path*',
    '/login',
    '/register',
    '/confirm',
  ],
};
