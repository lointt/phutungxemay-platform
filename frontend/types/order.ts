// ============================================================
// types/order.ts — Order domain types for the Order Service
// ============================================================

export type OrderStatus =
  | 'PLACED'       // Đã đặt hàng (chờ xác nhận)
  | 'PROCESSING'   // Đã xác nhận / Đang chuẩn bị hàng
  | 'SHIPPED'      // Đang giao hàng
  | 'DELIVERED'    // Giao thành công
  | 'CANCELLED';   // Đã hủy

export type PaymentMethod = 'COD' | 'VNPAY' | 'MOMO';

export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';

export interface ShippingAddress {
  full_name: string;
  phone: string;
  street: string;       // Số nhà, tên đường
  ward: string;         // Phường / Xã
  district: string;     // Quận / Huyện
  province: string;     // Tỉnh / Thành phố
}

export interface OrderItem {
  product_id: string;
  name: string;
  price: number;        // Giá tại thời điểm đặt hàng (snapshot)
  quantity: number;
  image_url: string;
}

export interface Order {
  order_id: string;           // Ví dụ: "ORD_abc123"
  user_id: string;
  items: OrderItem[];
  shipping_address: ShippingAddress;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  order_status: OrderStatus;
  subtotal: number;
  shipping_fee: number;
  total_amount: number;
  final_amount?: number;
  tracking_number?: string;   // Mã vận đơn (GHN/GHTK)
  shipping_partner?: string;  // Ví dụ: "GHN"
  shipping_status?: string;
  estimated_delivery?: string; // ISO 8601
  payment_url?: string;       // URL redirect sang VNPay/MoMo
  transaction_id?: string;    // Mã giao dịch từ cổng thanh toán
  notes?: string;             // Ghi chú của khách
  created_at: string;
  updated_at: string;
}

/** Body gửi lên POST /api/orders */
export interface CreateOrderRequest {
  shipping_address: ShippingAddress;
  payment_method: PaymentMethod;
  notes?: string;
}

/** Body gửi lên PUT /api/orders/{id} — Admin only */
export interface UpdateOrderRequest {
  order_status: Extract<OrderStatus, 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'>;
  tracking_number?: string;
  shipping_partner?: string;
  estimated_delivery?: string;
}

/** Response từ POST /api/orders */
export interface CreateOrderResponse {
  order: Order;
  payment_url?: string; // Chỉ có khi payment_method là VNPAY hoặc MOMO
}

/** Response từ GET /api/orders */
export interface OrderListResponse {
  items: Order[];
  total: number;
}
