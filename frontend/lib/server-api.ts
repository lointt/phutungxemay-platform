// ============================================================
// lib/server-api.ts — Server-side API helpers (Server Components only)
// Chuẩn hóa dữ liệu từ backend DynamoDB & hỗ trợ lọc linh hoạt
// ============================================================

import dns from 'node:dns';
import net from 'node:net';

dns.setDefaultResultOrder('ipv4first');
if (typeof net.setDefaultAutoSelectFamily === 'function') {
  net.setDefaultAutoSelectFamily(false);
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'https://d1ksuy3hfmko20.cloudfront.net';

// Bộ nhớ đệm dự phòng trên Server để chống rớt mạng tạm thời
let cachedAllProducts: Product[] | null = null;

import type { Product, ProductListResponse, ProductFilter, CompatibleVehicle } from '@/types/product';
import type { Order } from '@/types/order';

// ─── Category Mapping Helper ──────────────────────────────────────────────────
export const CATEGORY_MAP: Record<string, string> = {
  brake: 'Hệ thống phanh',
  transmission: 'Truyền động',
  oil_filter: 'Nhớt - Lọc',
  suspension: 'Giảm xóc',
  fork: 'Giảm xóc',
  engine: 'Động cơ',
  electrical: 'Điện - Đèn',
  body: 'Nhựa - Tem - Yên xe',
  other: 'Khác',
};

const CATEGORY_ALIASES: Record<string, string[]> = {
  'truyền động': ['truyền động', 'hệ thống truyền động'],
  'động cơ': ['động cơ'],
  'giảm xóc': ['giảm xóc', 'giảm xóc sau', 'hệ thống giảm xóc & lái', 'phuộc'],
  'hệ thống phanh': ['hệ thống phanh', 'phanh', 'thắng'],
  'điện - đèn': ['điện - đèn', 'điện', 'đèn'],
  'nhớt - lọc': ['nhớt - lọc', 'dầu nhớt & phụ gia', 'nhớt', 'lọc'],
  'lốp - vỏ xe': ['lốp - vỏ xe', 'lốp', 'vỏ xe'],
  'phụ kiện - pô xe': ['phụ kiện - pô xe', 'phụ kiện', 'pô xe', 'dàn áo'],
};

// ─── Normalizer ───────────────────────────────────────────────────────────────

function inferVehicleBrand(modelStr: string): { brand: string; model: string } {
  const m = modelStr.trim();
  const lower = m.toLowerCase();
  if (lower.startsWith('yamaha ') || lower.startsWith('honda ') || lower.startsWith('suzuki ') || lower.startsWith('sym ')) {
    const parts = m.split(' ');
    return { brand: parts[0], model: parts.slice(1).join(' ') };
  }
  if (
    lower.includes('exciter') ||
    lower.includes('sirius') ||
    lower.includes('jupiter') ||
    lower.includes('nvx') ||
    lower.includes('grande') ||
    lower.includes('fz150') ||
    lower.includes('r15') ||
    lower.includes('mt-15')
  ) {
    return { brand: 'Yamaha', model: m };
  }
  if (
    lower.includes('winner') ||
    lower.includes('wave') ||
    lower.includes('future') ||
    lower.includes('air blade') ||
    lower.includes('vario') ||
    lower.includes('vision') ||
    lower.includes('sh') ||
    lower.includes('lead') ||
    lower.includes('sonic') ||
    lower.includes('pcx') ||
    lower.includes('cb150') ||
    lower.includes('adv')
  ) {
    return { brand: 'Honda', model: m };
  }
  if (lower.includes('raider') || lower.includes('satria') || lower.includes('gsx') || lower.includes('address')) {
    return { brand: 'Suzuki', model: m };
  }
  return { brand: 'Honda', model: m };
}

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
        const { brand, model } = inferVehicleBrand(m);
        return { brand, model, year_from: 2015, year_to: 2026 };
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
    let items: Product[] = [];

    try {
      const res = await fetch(`${API_BASE}/api/products`, {
        next: { revalidate: 15 },
      });

      if (res.ok) {
        const data = (await res.json()) as { items?: Record<string, unknown>[] };
        const normalized = (data.items ?? []).map(normalizeProduct);
        if (normalized.length > 0) {
          cachedAllProducts = normalized;
          items = [...normalized];
        }
      }
    } catch {
      // Sử dụng dữ liệu cache gần nhất nếu kết nối tạm thời gián đoạn
    }

    if (items.length === 0 && cachedAllProducts && cachedAllProducts.length > 0) {
      items = [...cachedAllProducts];
    }

    // 2. Lọc theo category (hỗ trợ cả slug tiếng Anh, tên chuẩn 6 danh mục và các biến thể cũ)
    if (filter?.category) {
      const targetCategory = (
        CATEGORY_MAP[filter.category.toLowerCase()] ?? filter.category
      ).toLowerCase();
      const aliases = CATEGORY_ALIASES[targetCategory] ?? [targetCategory];

      items = items.filter((item) => {
        const itemCat = item.category.toLowerCase();
        return aliases.some(
          (alias) =>
            itemCat === alias ||
            itemCat.includes(alias) ||
            alias.includes(itemCat),
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

    // 7. Sắp xếp (Sort: Phổ biến nhất, Giá tăng dần, Giá giảm dần, Mới nhất)
    if (filter?.sort === 'price_asc') {
      items = [...items].sort((a, b) => a.price - b.price);
    } else if (filter?.sort === 'price_desc') {
      items = [...items].sort((a, b) => b.price - a.price);
    } else if (filter?.sort === 'newest') {
      items = [...items].sort((a, b) => {
        const timeA = Date.parse(a.created_at) || 0;
        const timeB = Date.parse(b.created_at) || 0;
        if (timeB !== timeA) return timeB - timeA;
        return b.product_id.localeCompare(a.product_id);
      });
    } else {
      // Mặc định: Phổ biến nhất (ưu tiên sản phẩm chính chuẩn PROD_ và còn nhiều tồn kho)
      items = [...items].sort((a, b) => {
        const aIsStd = a.product_id.startsWith('PROD_') ? 1 : 0;
        const bIsStd = b.product_id.startsWith('PROD_') ? 1 : 0;
        if (bIsStd !== aIsStd) return bIsStd - aIsStd;
        return a.product_id.localeCompare(b.product_id);
      });
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
    const all = await getProducts();
    const found = all.items.find((p) => p.product_id === id || p.ProductID === id);
    if (found) return found;

    const res = await fetch(`${API_BASE}/api/products/${id}`, {
      next: { revalidate: 15 },
    });

    if (!res.ok) return null;

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
