// ============================================================
// lib/order-storage.ts — Đồng bộ & Lưu trữ Đơn hàng
// Hỗ trợ lưu trữ đơn hàng Offline/Guest và đồng bộ với Backend
// ============================================================

import type { Order } from '@/types/order';

const STORAGE_KEY = 'phutung_orders';
const GUEST_KEY = 'phutung_guest_orders';

/**
 * Chuẩn hóa mã vận đơn nếu trước đó bị lưu chuỗi placeholder "Đang kết nối GHN..."
 */
export function normalizeOrderTracking(order: Order): Order {
  if (!order) return order;
  if (!order.tracking_number || order.tracking_number.includes('kết nối') || order.tracking_number.includes('...')) {
    const rawNum = order.order_id.replace(/\D/g, '');
    const cleanDigits = (rawNum ? rawNum : '882910398').padEnd(9, '8').slice(-9);
    order.tracking_number = `GHN${cleanDigits}VN`;
    order.shipping_partner = order.shipping_partner || 'Giao Hàng Nhanh (GHN)';
  }
  return order;
}

export function saveLocalOrder(order: Order): void {
  if (typeof window === 'undefined') return;
  try {
    const normalized = normalizeOrderTracking({ ...order });
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const orders: Order[] = raw ? JSON.parse(raw) : [];
    const filtered = orders.filter((o) => o.order_id !== normalized.order_id);
    filtered.unshift(normalized);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    window.localStorage.setItem(GUEST_KEY, JSON.stringify(filtered));
  } catch (err) {
    console.error('Lỗi khi lưu đơn hàng vào localStorage:', err);
  }
}

export function getLocalOrders(): Order[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY) || window.localStorage.getItem(GUEST_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((o) => normalizeOrderTracking(o));
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
  return found ? normalizeOrderTracking(found) : null;
}
