// ============================================================
// lib/server-api.ts — Server-side API helpers (Server Components only)
// Chuẩn hóa dữ liệu từ backend DynamoDB & hỗ trợ lọc linh hoạt
// ============================================================

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'https://d1ksuy3hfmko20.cloudfront.net';

import type { Product, ProductListResponse, ProductFilter, CompatibleVehicle } from '@/types/product';
import type { Order } from '@/types/order';

// ─── Category Mapping Helper ──────────────────────────────────────────────────
export const CATEGORY_MAP: Record<string, string> = {
  brake: 'Hệ thống phanh',
  transmission: 'Hệ thống truyền động',
  oil_filter: 'Dầu nhớt & Phụ gia',
  suspension: 'Giảm xóc sau',
  fork: 'Hệ thống giảm xóc & Lái',
  engine: 'Động cơ',
  electrical: 'Điện - Đèn',
  body: 'Nhựa - Tem - Yên xe',
  other: 'Khác',
};

// ─── Normalizer ───────────────────────────────────────────────────────────────

export function normalizeProduct(raw: Record<string, unknown>): Product {
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
        return { brand, model, year_from: 2015, year_to: 2024 };
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

// ─── Catalog ─────────────────────────────────────────────────────────────────

/**
 * Lấy danh sách sản phẩm với bộ lọc thông minh (kết hợp API + in-memory matching).
 */
export async function getProducts(filter?: ProductFilter): Promise<ProductListResponse> {
  try {
    // 1. Gọi backend API (không dùng cache để tồn kho luôn chính xác từ DynamoDB)
    const res = await fetch(`${API_BASE}/api/products`, {
      cache: 'no-store',
    });

    if (!res.ok) {
      return { items: [], total: 0, page: 1, page_size: 20, has_next: false };
    }

    const data = (await res.json()) as { items?: Record<string, unknown>[] };
    let items = (data.items ?? []).map(normalizeProduct);

    // 2. Lọc theo category (hỗ trợ cả slug tiếng Anh và tên tiếng Việt)
    if (filter?.category) {
      const targetCategory = (
        CATEGORY_MAP[filter.category.toLowerCase()] ?? filter.category
      ).toLowerCase();

      items = items.filter((item) => {
        const itemCat = item.category.toLowerCase();
        return (
          itemCat === targetCategory ||
          itemCat.includes(targetCategory) ||
          targetCategory.includes(itemCat)
        );
      });
    }

    // 3. Lọc theo tìm kiếm từ khóa (Search: tên, mã sku, thương hiệu, mô tả, đời xe)
    if (filter?.search && filter.search.trim()) {
      const kw = filter.search.trim().toLowerCase();
      items = items.filter((item) => {
        const matchName = item.name.toLowerCase().includes(kw);
        const matchSku = item.sku.toLowerCase().includes(kw);
        const matchBrand = item.brand.toLowerCase().includes(kw);
        const matchDesc = item.description.toLowerCase().includes(kw);
        const matchModels = item.compatible_models?.some((m) => m.toLowerCase().includes(kw));
        return matchName || matchSku || matchBrand || matchDesc || matchModels;
      });
    }

    // 4. Lọc theo Xe (Hãng xe & Dòng xe)
    if (filter?.compatible_brand) {
      const brand = filter.compatible_brand.toLowerCase();
      items = items.filter((item) => {
        return (
          item.compatible_models?.some((m) => m.toLowerCase().includes(brand)) ||
          item.compatible_vehicles.some((v) => v.brand.toLowerCase().includes(brand)) ||
          item.description.toLowerCase().includes(brand)
        );
      });
    }

    if (filter?.compatible_model) {
      const model = filter.compatible_model.toLowerCase();
      items = items.filter((item) => {
        return (
          item.compatible_models?.some((m) => m.toLowerCase().includes(model)) ||
          item.compatible_vehicles.some((v) => v.model.toLowerCase().includes(model)) ||
          item.name.toLowerCase().includes(model)
        );
      });
    }

    // 5. Lọc theo khoảng giá
    if (filter?.min_price !== undefined) {
      items = items.filter((item) => item.price >= filter.min_price!);
    }
    if (filter?.max_price !== undefined) {
      items = items.filter((item) => item.price <= filter.max_price!);
    }

    // 6. Lọc chỉ còn hàng
    if (filter?.in_stock) {
      items = items.filter((item) => item.stock > 0);
    }

    return {
      items,
      total: items.length,
      page: 1,
      page_size: items.length,
      has_next: false,
    };
  } catch {
    return { items: [], total: 0, page: 1, page_size: 20, has_next: false };
  }
}

/**
 * Lấy sản phẩm nổi bật cho trang chủ.
 */
export async function getFeaturedProducts(): Promise<Product[]> {
  const data = await getProducts();
  return data.items.slice(0, 8);
}

/**
 * Lấy chi tiết 1 sản phẩm theo ID.
 */
export async function getProductById(id: string): Promise<Product | null> {
  try {
    const res = await fetch(`${API_BASE}/api/products/${id}`, {
      cache: 'no-store',
    });

    if (!res.ok) {
      // Fallback: tìm trong danh sách products nếu direct ID bị lệch
      const all = await getProducts();
      return all.items.find((p) => p.product_id === id || p.ProductID === id) ?? null;
    }

    const raw = (await res.json()) as Record<string, unknown>;
    return normalizeProduct(raw);
  } catch {
    return null;
  }
}

/**
 * Lấy chi tiết đơn hàng.
 */
export async function getOrderById(id: string, token: string): Promise<Order | null> {
  try {
    const res = await fetch(`${API_BASE}/api/orders/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });

    if (!res.ok) return null;
    return (await res.json()) as Order;
  } catch {
    return null;
  }
}
