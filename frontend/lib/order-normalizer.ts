// ============================================================
// lib/order-normalizer.ts — Chuẩn hóa dữ liệu đơn hàng từ DynamoDB
// ============================================================

import type { Order, ShippingAddress, OrderStatus, PaymentMethod, PaymentStatus } from '@/types/order';

export function normalizeDynamoOrder(raw: Record<string, unknown>): Order {
  const orderId = String(raw.order_id ?? raw.OrderID ?? raw.id ?? '');
  const userId = String(raw.user_id ?? raw.UserID ?? raw.userId ?? 'GUEST');

  const rawItems = Array.isArray(raw.items ?? raw.Items)
    ? ((raw.items ?? raw.Items) as Record<string, unknown>[])
    : [];

  const items = rawItems.map((i) => ({
    product_id: String(i.product_id ?? i.ProductID ?? ''),
    name: String(i.name ?? 'Phụ tùng xe máy'),
    price: Number(i.price ?? 0),
    quantity: Number(i.quantity ?? 1),
    image_url: String(i.image_url ?? ''),
  }));

  const rawAddr = ((raw.shipping_address ?? raw.ShippingAddress ?? {}) as Record<
    string,
    unknown
  >);

  const shippingAddress: ShippingAddress = {
    full_name: String(rawAddr.full_name ?? rawAddr.FullName ?? 'Khách hàng'),
    phone: String(rawAddr.phone ?? rawAddr.Phone ?? '090xxxxxxx'),
    street: String(rawAddr.street ?? rawAddr.Street ?? ''),
    ward: String(rawAddr.ward ?? rawAddr.Ward ?? ''),
    district: String(rawAddr.district ?? rawAddr.District ?? ''),
    province: String(rawAddr.province ?? rawAddr.Province ?? 'TP. Hồ Chí Minh'),
  };

  const calculatedItemsTotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const rawSubtotal = raw.subtotal ?? raw.Subtotal;
  const rawTotal = raw.total_amount ?? raw.TotalAmount;
  const rawShipping = raw.shipping_fee ?? raw.ShippingFee;

  // Tạm tính (tiền hàng): ưu tiên tính chuẩn từ danh sách items, nếu không có thì lấy subtotal/total_amount từ backend
  const subtotal = Number(
    calculatedItemsTotal > 0
      ? calculatedItemsTotal
      : rawSubtotal !== undefined && Number(rawSubtotal) > 0
      ? rawSubtotal
      : rawTotal !== undefined && Number(rawTotal) > 0
      ? rawTotal
      : 0
  );

  const shippingFee = Number(
    rawShipping !== undefined
      ? rawShipping
      : subtotal >= 500000 || subtotal === 0
      ? 0
      : 30000
  );

  // Tổng thanh toán: Luôn bảo toàn tính nhất quán tuyệt đối = subtotal + shippingFee
  const finalAmount = subtotal > 0 ? subtotal + shippingFee : 0;

  return {
    order_id: orderId,
    user_id: userId,
    items,
    shipping_address: shippingAddress,
    payment_method: (raw.payment_method ?? raw.PaymentMethod ?? 'COD') as PaymentMethod,
    payment_status: (raw.payment_status ?? raw.PaymentStatus ?? 'PENDING') as PaymentStatus,
    order_status: (raw.order_status ?? raw.OrderStatus ?? 'PLACED') as OrderStatus,
    subtotal: subtotal,
    shipping_fee: shippingFee,
    total_amount: subtotal,
    final_amount: finalAmount,
    tracking_number: raw.tracking_number ? String(raw.tracking_number) : undefined,
    shipping_partner: raw.shipping_partner
      ? String(raw.shipping_partner)
      : 'Giao Hàng Nhanh (GHN)',
    estimated_delivery: raw.estimated_delivery ? String(raw.estimated_delivery) : undefined,
    notes: raw.notes ? String(raw.notes) : undefined,
    created_at: String(raw.created_at ?? raw.CreatedAt ?? new Date().toISOString()),
    updated_at: String(raw.updated_at ?? raw.UpdatedAt ?? new Date().toISOString()),
  };
}
