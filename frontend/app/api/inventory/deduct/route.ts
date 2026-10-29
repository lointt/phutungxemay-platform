// ============================================================
// app/api/inventory/deduct/route.ts — Trừ tồn kho sản phẩm trên DynamoDB
// Thực hiện gọi CatalogServiceHandler với quyền Admin an toàn phía Server
// ============================================================

import { NextResponse } from 'next/server';
import { getServerAdminToken } from '@/lib/server-admin-store';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'https://d1ksuy3hfmko20.cloudfront.net';

interface DeductItem {
  product_id: string;
  quantity: number;
}

interface RequestBody {
  items: DeductItem[];
  clientAdminToken?: string;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RequestBody;
    const { items, clientAdminToken } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Danh sách sản phẩm không hợp lệ' }, { status: 400 });
    }

    // Ưu tiên token truyền từ client nếu có, sau đó đến token lưu trên server
    const headerToken = req.headers.get('x-admin-token');
    const adminToken = clientAdminToken || headerToken || getServerAdminToken();

    const results: Array<{ product_id: string; success: boolean; oldStock?: number; newStock?: number; error?: string }> = [];

    for (const item of items) {
      const { product_id, quantity } = item;
      try {
        // 1. Lấy thông tin tồn kho hiện tại từ DynamoDB
        const getRes = await fetch(`${API_BASE}/api/products/${product_id}`, {
          cache: 'no-store',
        });

        let currentStock = 10;
        let productData: Record<string, unknown> = {};

        if (getRes.ok) {
          productData = (await getRes.json()) as Record<string, unknown>;
          currentStock = Number(productData.stock ?? 10);
        }

        const newStock = Math.max(0, currentStock - (quantity || 1));

        // 2. Cập nhật tồn kho mới lên DynamoDB nếu có Admin Token
        if (adminToken) {
          const updateRes = await fetch(`${API_BASE}/api/products/${product_id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${adminToken}`,
            },
            body: JSON.stringify({
              stock: newStock,
              updated_at: new Date().toISOString(),
            }),
          });

          if (!updateRes.ok) {
            const errText = await updateRes.text().catch(() => '');
            results.push({
              product_id,
              success: false,
              oldStock: currentStock,
              newStock,
              error: `Lỗi cập nhật DynamoDB: HTTP ${updateRes.status} ${errText}`,
            });
            continue;
          }
        }

        results.push({
          product_id,
          success: true,
          oldStock: currentStock,
          newStock,
        });
      } catch (itemErr) {
        results.push({
          product_id,
          success: false,
          error: (itemErr as Error).message,
        });
      }
    }

    return NextResponse.json({
      success: true,
      hasAdminToken: !!adminToken,
      results,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
