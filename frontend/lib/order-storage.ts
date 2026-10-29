// ============================================================
// lib/order-storage.ts — Đồng bộ & Lưu trữ Đơn hàng
// Hỗ trợ lưu trữ đơn hàng Offline/Guest và đồng bộ với Backend
// ============================================================

import type { Order } from '@/types/order';

const STORAGE_KEY = 'phutung_orders';
const GUEST_KEY = 'phutung_guest_orders';

export function saveLocalOrder(order: Order): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const orders: Order[] = raw ? JSON.parse(raw) : [];
    const filtered = orders.filter((o) => o.order_id !== order.order_id);
    filtered.unshift(order);
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
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.error('Lỗi khi đọc đơn hàng từ localStorage:', err);
  }
  return [];
}

export function getLocalOrderById(orderId: string): Order | null {
  const orders = getLocalOrders();
  return orders.find((o) => o.order_id === orderId) ?? null;
}
