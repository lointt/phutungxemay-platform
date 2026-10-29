// ============================================================
// app/api/server-admin/token/route.ts — Lưu & quản lý Admin Token phía Server
// ============================================================

import { NextResponse } from 'next/server';
import { getServerAdminToken, setServerAdminToken, readTokenFromFile } from '@/lib/server-admin-store';

export async function GET() {
  const token = getServerAdminToken();
  const info = readTokenFromFile();
  return NextResponse.json({
    hasToken: !!token,
    email: info?.email,
    savedAt: info?.savedAt,
  });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { idToken?: string; email?: string };
    if (!body?.idToken) {
      return NextResponse.json({ error: 'idToken is required' }, { status: 400 });
    }

    setServerAdminToken(body.idToken, body.email);
    return NextResponse.json({ success: true, message: 'Admin token saved successfully' });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
