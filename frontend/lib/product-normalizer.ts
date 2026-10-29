// ============================================================
// lib/product-normalizer.ts — Chuẩn hóa dữ liệu sản phẩm từ DynamoDB
// Dùng được cho cả Client Component và Server Component
// ============================================================

import type { Product, CompatibleVehicle } from '@/types/product';

export function normalizeDynamoProduct(raw: Record<string, unknown>): Product {
  const productId = String(raw.ProductID ?? raw.product_id ?? raw.id ?? '');
  const rawImage = typeof raw.image_url === 'string' ? raw.image_url : undefined;
  const rawImages = Array.isArray(raw.image_urls) ? (raw.image_urls as string[]) : [];
  const imageUrls = rawImages.length > 0 ? rawImages : rawImage ? [rawImage] : [];

  const rawModels = Array.isArray(raw.compatible_models)
    ? (raw.compatible_models as string[])
    : Array.isArray(raw.compatible_vehicles)
    ? (raw.compatible_vehicles as CompatibleVehicle[]).map((v) => `${v.brand} ${v.model}`)
    : [];

  const compatibleVehicles: CompatibleVehicle[] = Array.isArray(raw.compatible_vehicles)
    ? (raw.compatible_vehicles as CompatibleVehicle[])
    : rawModels.map((m) => {
        const parts = m.split(' ');
        const brand = parts[0] ?? '';
        const model = parts.slice(1).join(' ');
        return { brand, model, year_from: 2015, year_to: 2025 };
      });

  return {
    product_id: productId,
    ProductID: productId,
    name: String(raw.name ?? 'Phụ tùng xe máy'),
    description: String(raw.description ?? ''),
    category: String(raw.category ?? 'Khác'),
    price: Number(raw.price ?? 0),
    stock: Number(raw.stock ?? 0),
    image_urls: imageUrls,
    image_url: imageUrls[0],
    compatible_vehicles: compatibleVehicles,
    compatible_models: rawModels,
    sku: String(raw.sku ?? productId),
    brand: String(raw.brand ?? 'Chính hãng'),
    specs: (raw.specs as Record<string, string>) ?? {},
    status: String(raw.status ?? 'ACTIVE'),
    is_active: raw.status !== 'INACTIVE',
    created_at: String(raw.created_at ?? '2026-01-01T00:00:00.000Z'),
    updated_at: String(raw.updated_at ?? '2026-01-01T00:00:00.000Z'),
  };
}
