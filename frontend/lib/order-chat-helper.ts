// ============================================================
// lib/order-chat-helper.ts — Tra cứu đơn hàng thông minh cho Chatbot AI
// Trích xuất mã đơn và tạo phản hồi chi tiết về tiến độ vận đơn
// ============================================================

import { getLocalOrderById, getLocalOrders } from '@/lib/order-storage';
import apiClient from '@/lib/api-client';
import { formatCurrencyVND, formatDate } from '@/lib/utils';
import type { Order, OrderStatus } from '@/types/order';

function getStatusBadge(status: OrderStatus): string {
  switch (status) {
    case 'PLACED':
      return 'Đã đặt hàng (Đang chờ xác nhận)';
    case 'PROCESSING':
      return 'Đang đóng gói & chuẩn bị hàng tại kho';
    case 'SHIPPED':
      return 'Đang vận chuyển trên đường giao';
    case 'DELIVERED':
      return 'Giao hàng thành công';
    case 'CANCELLED':
      return 'Đã hủy';
    default:
      return 'Đang xử lý';
  }
}

function formatOrderDetailsMarkdown(order: Order): string {
  const itemsList = order.items
    .map(
      (item) =>
        `- **${item.name}** x${item.quantity} — **${formatCurrencyVND(item.price * item.quantity)}**`,
    )
    .join('\n');

  const addr = order.shipping_address;
  const addressStr = `${addr.street}, ${addr.ward ? addr.ward + ', ' : ''}${addr.district}, ${addr.province}`;
  const paymentMethodStr =
    order.payment_method === 'COD'
      ? 'Tiền mặt khi nhận hàng (COD)'
      : order.payment_method;

  const paymentStatusStr =
    order.payment_status === 'PAID' ? 'Đã thanh toán' : 'Chờ thanh toán khi nhận hàng';

  return `### Thông tin đơn hàng #${order.order_id}

- **Trạng thái:** ${getStatusBadge(order.order_status)}
- **Thời gian đặt:** ${formatDate(order.created_at)}
- **Dự kiến giao hàng:** ${order.estimated_delivery ? formatDate(order.estimated_delivery) : '2 - 3 ngày làm việc'}
- **Đơn vị giao nhận:** ${order.shipping_partner || 'Giao Hàng Nhanh (GHN)'}
- **Mã vận đơn:** ${order.tracking_number || 'GHN' + order.order_id.slice(-6) + 'VN'}

### Thông tin người nhận
- **Người nhận:** **${addr.full_name}** (${addr.phone})
- **Địa chỉ giao:** ${addressStr}
- **Thanh toán:** ${paymentMethodStr} (${paymentStatusStr})

### Danh sách phụ tùng (${order.items.length} sản phẩm)
${itemsList}

- **Tạm tính:** ${formatCurrencyVND(order.subtotal)}
- **Phí vận chuyển:** ${order.shipping_fee === 0 ? 'Miễn phí' : formatCurrencyVND(order.shipping_fee)}
- **Tổng thanh toán:** **${formatCurrencyVND(order.total_amount)}**`;
}

/**
 * Phân tích tin nhắn người dùng xem có phải câu hỏi tra cứu đơn hàng không.
 * Nếu có mã đơn hàng, trả về chuỗi Markdown chi tiết về tình trạng đơn.
 */
export async function checkOrderInChat(text: string): Promise<string | null> {
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  // 1. Tìm mã đơn hàng dạng ORD_... hoặc chuỗi mã đơn
  const orderIdMatch = trimmed.match(/ORD[_-]?[A-Za-z0-9_-]+/i);

  if (orderIdMatch) {
    const rawId = orderIdMatch[0];
    let order = getLocalOrderById(rawId);

    if (!order) {
      const all = getLocalOrders();
      order = all.find((o) => o.order_id.toLowerCase() === rawId.toLowerCase()) ?? null;
    }

    if (!order) {
      try {
        const res = await apiClient.get<Order>(`/api/orders/${rawId}`);
        if (res?.order_id) {
          order = res;
        }
      } catch {
        // Backend có thể không có hoặc chưa sync
      }
    }

    if (order) {
      return formatOrderDetailsMarkdown(order);
    } else {
      return `### Không tìm thấy đơn hàng ${rawId}

Hệ thống chưa tìm thấy thông tin đơn hàng có mã **${rawId}**.

**Hướng dẫn kiểm tra:**
- Vui lòng kiểm tra lại chính xác các ký tự mã đơn hàng (định dạng chuẩn: **ORD_xxxxxx**).
- Bạn có thể truy cập mục **Đơn hàng của tôi** trên thanh tài khoản để xem danh sách đơn đã đặt.`;
    }
  }

  // 2. Kiểm tra xem người dùng có hỏi chung chung về đơn hàng không
  const isGenericOrderQuery =
    lower.includes('đơn hàng') ||
    lower.includes('don hang') ||
    lower.includes('kiểm tra đơn') ||
    lower.includes('kiem tra don') ||
    lower.includes('tra cứu đơn') ||
    lower.includes('tra cuu don') ||
    lower.includes('tình trạng đơn') ||
    lower.includes('tiến độ đơn');

  if (isGenericOrderQuery) {
    const all = getLocalOrders();
    if (all.length > 0) {
      const recentList = all
        .slice(0, 3)
        .map(
          (o, idx) =>
            `${idx + 1}. **Mã đơn ${o.order_id}** — ${getStatusBadge(o.order_status)} (${formatCurrencyVND(o.total_amount)})`,
        )
        .join('\n');

      return `### Đơn hàng gần đây của bạn

${recentList}

Bạn vui lòng nhập mã đơn (ví dụ: **${all[0].order_id}**) để xem chi tiết lộ trình giao nhận và danh sách phụ tùng.`;
    } else {
      return `### Tra cứu trạng thái đơn hàng

Hiện tại chưa có đơn hàng nào được lưu trên phiên trình duyệt này.

Nếu bạn đã đặt hàng, vui lòng nhập trực tiếp **Mã đơn hàng** (ví dụ: **ORD_123456**) vào ô chat bên dưới để hệ thống kiểm tra chi tiết tiến độ giao hàng.`;
    }
  }

  return null;
}
