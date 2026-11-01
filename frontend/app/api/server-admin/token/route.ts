// ============================================================
// app/api/server-admin/token/route.ts — Lưu & quản lý Admin Token phía Server
// ============================================================

import { NextResponse } from 'next/server';
import { getServerAdminToken, setServerAdminToken, readTokenFromFile } from '@/lib/server-admin-store';
import { serverAdminTokenSchema } from '@/lib/validators';

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
    const rawBody: unknown = await req.json().catch(() => null);
    
    // Kiểm tra & xác thực Zod
    const validationResult = serverAdminTokenSchema.safeParse(rawBody);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Dữ liệu token không hợp lệ',
          details: validationResult.error.format(),
        },
        { status: 400 },
      );
    }

    const { idToken, email } = validationResult.data;
    setServerAdminToken(idToken, email);
    return NextResponse.json({ success: true, message: 'Admin token saved successfully' });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
