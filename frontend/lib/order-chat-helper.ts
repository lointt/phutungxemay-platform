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
      return '🟠 Đã đặt hàng (Đang chờ xác nhận)';
    case 'PROCESSING':
      return '🟡 Đang đóng gói & chuẩn bị hàng tại kho';
    case 'SHIPPED':
      return '🚚 Đang vận chuyển trên đường giao';
    case 'DELIVERED':
      return '✅ Giao hàng thành công';
    case 'CANCELLED':
      return '❌ Đã hủy';
    default:
      return '📦 Đang xử lý';
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

  return `### 📦 Thông tin tra cứu đơn hàng #${order.order_id}

- **Trạng thái:** ${getStatusBadge(order.order_status)}
- **Thời gian đặt:** ${formatDate(order.created_at)}
- **Dự kiến giao hàng:** ${order.estimated_delivery ? formatDate(order.estimated_delivery) : '2 - 3 ngày làm việc'}
- **Đơn vị giao nhận:** ${order.shipping_partner || 'Giao Hàng Nhanh (GHN)'}
- **Mã vận đơn (Tracking):** \`${order.tracking_number || 'GHN' + order.order_id.slice(-6) + 'VN'}\`

#### 📍 Thông tin người nhận:
- **Người nhận:** **${addr.full_name}** (${addr.phone})
- **Địa chỉ giao:** ${addressStr}
- **Thanh toán:** ${paymentMethodStr} (${paymentStatusStr})

#### 🛒 Phụ tùng đã đặt (${order.items.length} món):
${itemsList}

---
- **Tạm tính tiền hàng:** ${formatCurrencyVND(order.subtotal)}
- **Phí giao hàng:** ${order.shipping_fee === 0 ? 'Miễn phí' : formatCurrencyVND(order.shipping_fee)}
- **Tổng thanh toán:** **${formatCurrencyVND(order.total_amount)}**

---
👉 Bạn có thể xem giao diện vận đơn tại: [Chi tiết đơn hàng #${order.order_id}](/orders/${order.order_id})
💡 *Cần thắc mắc về cách lắp ráp bất kỳ phụ tùng nào trong đơn này, hãy nhắn tên phụ tùng để Kỹ Sư AI hướng dẫn chi tiết nhé!*`;
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
    // Tìm trong localStorage
    let order = getLocalOrderById(rawId);

    // Nếu không khớp chính xác hoa thường, thử tìm không phân biệt chữ hoa chữ thường
    if (!order) {
      const all = getLocalOrders();
      order = all.find((o) => o.order_id.toLowerCase() === rawId.toLowerCase()) ?? null;
    }

    // Nếu chưa thấy trong localStorage, thử gọi API Backend
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
      return `### 🔍 Không tìm thấy đơn hàng \`${rawId}\`

Kỹ Sư AI đã tra cứu hệ thống nhưng không tìm thấy đơn hàng có mã **"${rawId}"**.

**Gợi ý kiểm tra:**
- Vui lòng kiểm tra lại chính xác các ký tự mã đơn hàng (thường có dạng \`ORD_xxxxxx\`).
- Bạn có thể vào mục [Đơn hàng của tôi](/account/orders) để xem lại danh sách đơn đã đặt.
- Nếu bạn vừa đặt hàng, đơn hàng có thể đang được hệ thống xử lý cập nhật.`;
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
            `${idx + 1}. Mã đơn: \`${o.order_id}\`\n   - **Trạng thái:** ${getStatusBadge(o.order_status)}\n   - **Ngày đặt:** ${formatDate(o.created_at)}\n   - **Tổng tiền:** ${formatCurrencyVND(o.total_amount)}`,
        )
        .join('\n\n');

      return `### 📋 Danh sách đơn hàng gần đây của bạn:

${recentList}

---
👉 Bạn hãy gửi lại mã đơn (ví dụ: \`${all[0].order_id}\`) để Kỹ Sư AI tra cứu chi tiết tiến trình vận chuyển và thông tin linh kiện nhé!`;
    } else {
      return `### 📦 Tra cứu đơn hàng

Hiện tại trên thiết bị này chưa ghi nhận đơn hàng nào.

👉 Nếu bạn đã có mã đơn hàng (ví dụ: \`ORD_xxxxxx\`), vui lòng gửi mã để Kỹ Sư AI kiểm tra tiến độ giao hàng và thông tin phụ tùng cho bạn nhé!`;
    }
  }

  return null;
}
