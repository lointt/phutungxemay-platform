// ============================================================
// types/product.ts — Core domain types for the Catalog Service
// ============================================================

export interface Product {
  product_id: string;         // SKU / Partition Key in DynamoDB
  ProductID?: string;         // Backend DynamoDB field alias
  name: string;               // Tên phụ tùng
  description: string;        // Mô tả chi tiết
  category: string;           // Danh mục sản phẩm (VD: "Truyền động", "Động cơ", "Giảm xóc", "Hệ thống phanh", "Điện - Đèn", "Nhớt - Lọc")
  category_key?: ProductCategory; // Alias key dạng slug
  price: number;              // Giá bán (VND, lưu dạng số nguyên)
  stock: number;              // Số lượng tồn kho
  image_urls: string[];       // CDN paths hoặc URLs
  image_url?: string;         // Backend field alias
  compatible_vehicles: CompatibleVehicle[]; // Danh sách xe tương thích
  compatible_models?: string[]; // Backend field: mảng string tên xe
  sku: string;                // Mã SKU hiển thị
  brand: string;              // Thương hiệu phụ tùng
  specs?: Record<string, string>; // Chi tiết kỹ thuật từ backend
  status?: string;            // 'ACTIVE'
  weight_gram?: number;       // Khối lượng (gram) — dùng tính phí vận chuyển
  is_active: boolean;         // Hiển thị / ẩn trên storefront
  created_at: string;         // ISO 8601
  updated_at: string;         // ISO 8601
}

/** Phụ tùng gợi ý trong chat (tập con của Product để giảm payload) */
export interface ProductSummary {
  product_id: string;
  name: string;
  price: number;
  image_url: string;  // ảnh đầu tiên
  stock: number;
  category: string;
}

export interface CompatibleVehicle {
  brand: string;   // Ví dụ: "Yamaha"
  model: string;   // Ví dụ: "Exciter 150"
  year_from: number;
  year_to: number;
}

export const PRODUCT_CATEGORIES = [
  'Truyền động',
  'Động cơ',
  'Giảm xóc',
  'Hệ thống phanh',
  'Điện - Đèn',
  'Nhớt - Lọc',
  'Lốp - Vỏ xe',
  'Phụ kiện - Pô xe',
] as const;

export type ProductCategory =
  | (typeof PRODUCT_CATEGORIES)[number]
  | 'transmission'    // Truyền động
  | 'brake'           // Hệ thống phanh
  | 'engine'          // Động cơ
  | 'electrical'      // Điện - Đèn
  | 'suspension'      // Giảm xóc
  | 'body'            // Nhựa - Tem - Yên xe
  | 'oil_filter'      // Nhớt - Lọc
  | 'other'           // Khác
  | string;           // Cho phép custom category string từ backend

export interface ProductFilter {
  category?: string;
  min_price?: number;
  max_price?: number;
  in_stock?: boolean;         // Lọc còn hàng
  compatible_brand?: string;  // Lọc theo hãng xe
  compatible_model?: string;  // Lọc theo model xe
  search?: string;            // Từ khoá tìm kiếm
  sort?: string;              // Sắp xếp: 'popular' | 'price_asc' | 'price_desc' | 'newest'
}

/** Response từ GET /api/products */
export interface ProductListResponse {
  items: Product[];
  total: number;
  page: number;
  page_size: number;
  has_next: boolean;
}
