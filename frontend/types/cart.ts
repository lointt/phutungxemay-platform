// ============================================================
// types/cart.ts — Cart domain types for the Cart Service
// ============================================================

export interface CartItem {
  product_id: string;
  name: string;
  price: number;              // Giá tại thời điểm thêm vào giỏ (snapshot)
  quantity: number;
  stock: number;              // Tồn kho thực tế (dùng để validate)
  image_url: string;          // CDN path ảnh đầu tiên
  compatible_vehicles_label?: string; // Ví dụ: "Honda Winner / Yamaha Exciter"
}

/** Response từ GET /api/cart */
export interface CartResponse {
  user_id: string;
  items: CartItem[];
  subtotal: number;           // Tổng tiền hàng (chưa phí vận chuyển)
  item_count: number;
  updated_at: string;
}

/** Body gửi lên POST /api/cart */
export interface AddToCartRequest {
  product_id: string;
  quantity: number;
}

/** Body gửi lên PUT /api/cart (quantity = 0 → xóa item) */
export interface UpdateCartRequest {
  product_id: string;
  quantity: number;
}
