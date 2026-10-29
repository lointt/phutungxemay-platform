// ============================================================
// lib/admin-storage.ts — Quản lý dữ liệu quản trị viên (Admin Portal)
// Quản lý sản phẩm thêm mới/chỉnh sửa, tồn kho, và đồng bộ đơn hàng
// ============================================================

import type { Product } from '@/types/product';
import type { Order, OrderStatus } from '@/types/order';
import { getLocalOrders, saveLocalOrder } from '@/lib/order-storage';

const ADMIN_PRODUCTS_KEY = 'phutung_admin_custom_products';

export function getAdminCustomProducts(): Product[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(ADMIN_PRODUCTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

export function saveAdminProduct(product: Product): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = getAdminCustomProducts();
    const id = product.product_id || product.ProductID || '';
    const filtered = existing.filter((p) => (p.product_id || p.ProductID) !== id);
    filtered.unshift(product);
    window.localStorage.setItem(ADMIN_PRODUCTS_KEY, JSON.stringify(filtered));
  } catch (err) {
    console.error('Lỗi khi lưu sản phẩm admin:', err);
  }
}

export function deleteAdminProduct(productId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = getAdminCustomProducts();
    const filtered = existing.filter((p) => (p.product_id || p.ProductID) !== productId);
    window.localStorage.setItem(ADMIN_PRODUCTS_KEY, JSON.stringify(filtered));
  } catch (err) {
    console.error('Lỗi khi xóa sản phẩm admin:', err);
  }
}

export function updateProductStockInStorage(productId: string, newStock: number): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = getAdminCustomProducts();
    const target = existing.find((p) => (p.product_id || p.ProductID) === productId);
    if (target) {
      target.stock = newStock;
      target.updated_at = new Date().toISOString();
      window.localStorage.setItem(ADMIN_PRODUCTS_KEY, JSON.stringify(existing));
    }
  } catch {}
}

export function updateOrderStatusInStorage(
  orderId: string,
  newStatus: OrderStatus,
  trackingNumber?: string,
  shippingPartner?: string,
): Order | null {
  if (typeof window === 'undefined') return null;
  const orders = getLocalOrders();
  const target = orders.find((o) => o.order_id === orderId);
  if (!target) return null;

  target.order_status = newStatus;
  target.updated_at = new Date().toISOString();
  if (trackingNumber) target.tracking_number = trackingNumber;
  if (shippingPartner) target.shipping_partner = shippingPartner;

  saveLocalOrder(target);
  return target;
}
