// ============================================================
// lib/order-storage.ts — Đồng bộ & Lưu trữ Đơn hàng
// Hỗ trợ lưu trữ đơn hàng Offline/Guest và đồng bộ với Backend
// Tự động phân tách đơn hàng theo UserID và khử trùng lặp (Deduplicate)
// ============================================================

import type { Order, OrderStatus } from '@/types/order';

const STORAGE_KEY = 'phutung_orders';
const GUEST_KEY = 'phutung_guest_orders';

/**
 * Tự động lọc bỏ các đơn hàng trùng lặp do lưu tạm client ID trước khi nhận server ID
 */
function deduplicateOrders(orders: Order[]): Order[] {
  const result: Order[] = [];
  const seenSignatures = new Set<string>();

  for (const o of orders) {
    // Tạo chữ ký nhận diện đơn: cùng danh sách sản phẩm, số lượng và tổng tiền
    const itemSig = (o.items || [])
      .map((i) => `${i.product_id}:${i.quantity}`)
      .sort()
      .join('|');
    const signature = `${itemSig}_${o.total_amount}`;

    // Nếu đã có 1 đơn giống hệt: ưu tiên giữ đơn có mã server (có dấu gạch dưới như ORD_179... hoặc có tracking)
    if (seenSignatures.has(signature)) {
      const existingIdx = result.findIndex((r) => {
        const rSig = (r.items || [])
          .map((i) => `${i.product_id}:${i.quantity}`)
          .sort()
          .join('|') + `_${r.total_amount}`;
        return rSig === signature;
      });

      if (existingIdx !== -1) {
        const existing = result[existingIdx];
        const isCurrentBetter =
          (o.tracking_number && !existing.tracking_number) ||
          (o.order_id.includes('_') && o.order_id.length > existing.order_id.length);

        if (isCurrentBetter) {
          result[existingIdx] = o;
        }
      }
      continue;
    }

    seenSignatures.add(signature);
    result.push(o);
  }

  return result;
}

export function saveLocalOrder(order: Order): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const orders: Order[] = raw ? JSON.parse(raw) : [];
    const filtered = orders.filter((o) => o.order_id !== order.order_id);
    filtered.unshift(order);
    const cleaned = deduplicateOrders(filtered);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
    window.localStorage.setItem(GUEST_KEY, JSON.stringify(cleaned));
  } catch (err) {
    console.error('Lỗi khi lưu đơn hàng vào localStorage:', err);
  }
}

export function getLocalOrders(currentUserId?: string): Order[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY) || window.localStorage.getItem(GUEST_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const cleaned = deduplicateOrders(parsed);
        // Lưu lại danh sách đã khử trùng lặp
        if (cleaned.length !== parsed.length) {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
          window.localStorage.setItem(GUEST_KEY, JSON.stringify(cleaned));
        }

        // Lọc theo người dùng hiện tại nếu có
        if (currentUserId) {
          return cleaned.filter((o) => {
            const uid = o.user_id || (o as unknown as { UserID?: string }).UserID;
            return uid === currentUserId;
          });
        }
        return cleaned;
      }
    }
  } catch (err) {
    console.error('Lỗi khi đọc đơn hàng từ localStorage:', err);
  }
  return [];
}

export function getLocalOrderById(orderId: string): Order | null {
  const orders = getLocalOrders();
  const found = orders.find((o) => o.order_id === orderId);
  return found ?? null;
}

export function updateLocalOrderStatus(orderId: string, newStatus: OrderStatus): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const orders: Order[] = raw ? JSON.parse(raw) : [];
    const target = orders.find((o) => o.order_id === orderId);
    if (target) {
      target.order_status = newStatus;
      target.updated_at = new Date().toISOString();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
      window.localStorage.setItem(GUEST_KEY, JSON.stringify(orders));
    }
  } catch (err) {
    console.error('Lỗi khi cập nhật trạng thái đơn hàng trong localStorage:', err);
  }
}
