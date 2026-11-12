// ============================================================
// lib/order-chat-helper.ts — Tra cứu đơn hàng thông minh cho Chatbot AI
// Trích xuất mã đơn và tạo phản hồi chi tiết về tiến độ vận đơn
// ============================================================

import { getLocalOrderById, getLocalOrders, saveLocalOrder } from '@/lib/order-storage';
import { normalizeDynamoOrder } from '@/lib/order-normalizer';
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

  const trackingStr =
    order.tracking_number && order.tracking_number.trim()
      ? order.tracking_number
      : order.order_status === 'PLACED'
      ? 'Đang liên kết GHN tạo mã...'
      : 'Đang cập nhật';

  const calculatedItemsTotal = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const subtotal =
    calculatedItemsTotal > 0
      ? calculatedItemsTotal
      : order.subtotal > 0
      ? order.subtotal
      : order.total_amount;
  const shippingFee =
    order.shipping_fee !== undefined
      ? order.shipping_fee
      : subtotal >= 500000
      ? 0
      : 30000;
  // Luôn đảm bảo nguyên tắc toán học: Tổng thanh toán = Tạm tính + Phí vận chuyển
  const finalTotal = subtotal + shippingFee;

  return `### Thông tin đơn hàng #${order.order_id}

- **Trạng thái:** ${getStatusBadge(order.order_status)}
- **Thời gian đặt:** ${formatDate(order.created_at)}
- **Dự kiến giao hàng:** ${order.estimated_delivery ? formatDate(order.estimated_delivery) : '2 - 3 ngày làm việc'}
- **Đơn vị giao nhận:** ${order.shipping_partner || 'Giao Hàng Nhanh (GHN Express)'}
- **Mã vận đơn:** ${trackingStr}

### Thông tin người nhận
- **Người nhận:** **${addr.full_name}** (${addr.phone})
- **Địa chỉ giao:** ${addressStr}
- **Thanh toán:** ${paymentMethodStr} (${paymentStatusStr})

### Danh sách phụ tùng (${order.items.length} sản phẩm)
${itemsList}

- **Tạm tính:** ${formatCurrencyVND(subtotal)}
- **Phí vận chuyển:** ${shippingFee === 0 ? 'Miễn phí' : formatCurrencyVND(shippingFee)}
- **Tổng thanh toán:** **${formatCurrencyVND(finalTotal)}**`;
}

/**
 * Phân tích tin nhắn người dùng xem có phải câu hỏi tra cứu đơn hàng không.
 * Nếu có mã đơn hàng, trả về chuỗi Markdown chi tiết về tình trạng đơn.
 */
export async function checkOrderInChat(text: string): Promise<string | null> {
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  // 0. BỎ QUA NGAY NẾU LÀ CÂU HỎI CHUYỂN NHÂN VIÊN HOẶC CHÍNH SÁCH / PHÍ SHIP / BẢO HÀNH / KHIẾU NẠI
  // Các câu này bắt buộc phải để AI Backend (Gemini RAG + Tool request_human_agent) xử lý
  const isAgentOrPolicyQuery =
    lower.includes('nhân viên') ||
    lower.includes('người thật') ||
    lower.includes('chăm sóc khách hàng') ||
    lower.includes('cskh') ||
    lower.includes('khiếu nại') ||
    lower.includes('sai sản phẩm') ||
    lower.includes('giao sai') ||
    lower.includes('hỏng') ||
    lower.includes('lỗi') ||
    lower.includes('bao nhiêu') ||
    lower.includes('miễn phí') ||
    lower.includes('freeship') ||
    lower.includes('phí ship') ||
    lower.includes('vận chuyển') ||
    lower.includes('chính sách') ||
    lower.includes('hủy đơn') ||
    lower.includes('huỷ đơn') ||
    lower.includes('đổi trả') ||
    lower.includes('bảo hành') ||
    lower.includes('tại sao') ||
    lower.includes('làm sao');

  if (isAgentOrPolicyQuery) {
    return null;
  }

  // 1. Tìm mã đơn hàng dạng ORD_... hoặc chuỗi mã đơn
  const orderIdMatch = trimmed.match(/ORD[_-]?[A-Za-z0-9_-]+/i);

  if (orderIdMatch) {
    const rawId = orderIdMatch[0];
    let order = getLocalOrderById(rawId);

    if (!order) {
      const all = getLocalOrders();
      order = all.find((o) => o.order_id.toLowerCase() === rawId.toLowerCase()) ?? null;
    }

    // Luôn ưu tiên truy vấn Backend DynamoDB để lấy mã vận đơn GHN thật và trạng thái mới nhất
    try {
      const res = await apiClient.get<Record<string, unknown>>(`/api/orders/${rawId}`);
      if (res && (res.OrderID || res.order_id)) {
        const backendOrder = normalizeDynamoOrder(res);
        order = {
          ...(order || {}),
          ...backendOrder,
          tracking_number: backendOrder.tracking_number || order?.tracking_number,
          order_status: backendOrder.order_status || order?.order_status,
          shipping_status: backendOrder.shipping_status || order?.shipping_status,
          estimated_delivery: backendOrder.estimated_delivery || order?.estimated_delivery,
        } as Order;
        saveLocalOrder(order);
      }
    } catch {
      // Backend có thể offline hoặc mạng chậm, dùng tạm order từ local
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

  // 2. Chỉ hiển thị danh sách đơn gần đây khi người dùng THỰC SỰ muốn kiểm tra đơn của mình
  const explicitOrderCheckPhrases = [
    'kiểm tra đơn hàng của tôi',
    'kiem tra don hang cua toi',
    'tra cứu đơn hàng của tôi',
    'tra cuu don hang cua toi',
    'xem đơn hàng của tôi',
    'xem don hang cua toi',
    'tình trạng đơn hàng của tôi',
    'tiến độ đơn hàng của tôi',
    'danh sách đơn hàng của tôi',
    'đơn hàng của tôi đâu',
    'đơn của tôi đâu',
    'đơn của tôi đang ở đâu',
    'đơn hàng gần đây của tôi',
  ];

  const isExplicitOrderQuery =
    explicitOrderCheckPhrases.some((phrase) => lower.includes(phrase)) ||
    lower === 'kiểm tra đơn hàng' ||
    lower === 'tra cứu đơn hàng' ||
    lower === 'xem đơn hàng' ||
    lower === 'đơn hàng của tôi';

  if (isExplicitOrderQuery) {
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
