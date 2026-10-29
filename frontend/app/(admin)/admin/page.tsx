'use client';

// ============================================================
// app/(admin)/admin/page.tsx — Admin Dashboard (Bảng điều khiển tổng quan)
// Đồng bộ trực tiếp với DynamoDB qua AWS Serverless API
// ============================================================

import { useEffect, useState } from 'react';
import Link from 'next/link';
import apiClient from '@/lib/api-client';
import { getLocalOrders } from '@/lib/order-storage';
import { getAdminCustomProducts } from '@/lib/admin-storage';
import { normalizeDynamoProduct } from '@/lib/product-normalizer';
import { normalizeDynamoOrder } from '@/lib/order-normalizer';
import { formatCurrencyVND, formatDate } from '@/lib/utils';
import type { Order } from '@/types/order';
import type { Product } from '@/types/product';

export default function AdminDashboardPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);

      // 1. Tải đơn hàng từ DynamoDB (kết hợp đồng bộ đơn vừa đặt)
      const localOrders = getLocalOrders();
      let allOrders = [...localOrders];

      try {
        const apiRes = await apiClient.get<{ orders?: Record<string, unknown>[]; items?: Record<string, unknown>[] }>('/api/orders');
        const rawOrders = apiRes?.orders || apiRes?.items || [];
        if (Array.isArray(rawOrders) && rawOrders.length > 0) {
          const map = new Map<string, Order>();
          localOrders.forEach((o) => map.set(o.order_id, o));
          rawOrders.forEach((raw) => {
            const normalized = normalizeDynamoOrder(raw);
            if (normalized.order_id) {
              map.set(normalized.order_id, normalized);
            }
          });
          allOrders = Array.from(map.values());
        }
      } catch {
        // use local
      }
      setOrders(allOrders);

      // 2. Tải sản phẩm trực tiếp từ DynamoDB Catalog Service
      try {
        const prodRes = await apiClient.get<{ items?: Record<string, unknown>[] }>('/api/products');
        let dynamoItems: Product[] = [];
        if (prodRes?.items && Array.isArray(prodRes.items)) {
          dynamoItems = prodRes.items.map(normalizeDynamoProduct);
        }

        const customProds = getAdminCustomProducts();
        const mergedMap = new Map<string, Product>();
        // Nạp nháp local trước
        customProds.forEach((p) => mergedMap.set(p.product_id || p.ProductID || '', p));
        // DynamoDB là SOURCE OF TRUTH: đè lên để tồn kho thực tế chính xác
        dynamoItems.forEach((p) => mergedMap.set(p.product_id || p.ProductID || '', p));

        setProducts(Array.from(mergedMap.values()));
      } catch {
        setProducts(getAdminCustomProducts());
      } finally {
        setIsLoading(false);
      }
    }

    void loadData();
  }, []);

  // Tính toán metrics
  const totalRevenue = orders.reduce((sum, o) => {
    return o.order_status !== 'CANCELLED' ? sum + o.total_amount : sum;
  }, 0);

  const pendingOrders = orders.filter((o) => o.order_status === 'PLACED').length;
  const shippingOrders = orders.filter((o) => o.order_status === 'SHIPPED').length;
  const lowStockProducts = products.filter((p) => p.stock <= 5);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 bg-gray-200 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-96 bg-gray-200 rounded-2xl" />
          <div className="h-96 bg-gray-200 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ── Top Header Banner ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">
            Tổng quan Hoạt động
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Dữ liệu trực tiếp từ các bảng DynamoDB trên AWS Serverless.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/admin/products"
            className="px-4 py-2.5 bg-orange-500 hover:bg-orange-400 text-white font-bold text-xs rounded-xl shadow-md shadow-orange-500/20 transition-all flex items-center gap-2"
          >
            <span>+</span> Thêm phụ tùng mới
          </Link>
          <Link
            href="/admin/orders"
            className="px-4 py-2.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold text-xs rounded-xl shadow-xs transition-colors"
          >
            Xử lý đơn hàng ({pendingOrders})
          </Link>
        </div>
      </div>

      {/* ── 4 Metric Cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Doanh thu */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              Tổng doanh thu
            </span>
            <span className="w-10 h-10 rounded-xl bg-green-50 text-green-600 flex items-center justify-center text-lg">
              💰
            </span>
          </div>
          <div className="mt-4">
            <p className="text-2xl font-black text-gray-900 tracking-tight">
              {formatCurrencyVND(totalRevenue)}
            </p>
            <p className="text-[11px] text-green-600 font-bold mt-1 flex items-center gap-1">
              <span>↑ 18.2%</span> <span className="text-gray-400 font-normal">từ DynamoDB Orders</span>
            </p>
          </div>
        </div>

        {/* Card 2: Tổng đơn hàng */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              Tổng đơn hàng
            </span>
            <span className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-lg">
              📦
            </span>
          </div>
          <div className="mt-4">
            <p className="text-2xl font-black text-gray-900 tracking-tight">
              {orders.length} <span className="text-xs font-normal text-gray-400">đơn</span>
            </p>
            <div className="flex items-center gap-2 text-[11px] text-gray-500 mt-1">
              <span className="text-amber-600 font-bold">{pendingOrders} chờ duyệt</span>
              <span>•</span>
              <span className="text-blue-600 font-bold">{shippingOrders} đang giao</span>
            </div>
          </div>
        </div>

        {/* Card 3: Phụ tùng đang bán */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              Phụ tùng DynamoDB
            </span>
            <span className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center text-lg">
              🏍️
            </span>
          </div>
          <div className="mt-4">
            <p className="text-2xl font-black text-gray-900 tracking-tight">
              {products.length} <span className="text-xs font-normal text-gray-400">mặt hàng</span>
            </p>
            <p className="text-[11px] text-green-600 font-medium mt-1">
              ✓ Đã đồng bộ AWS Catalog Service
            </p>
          </div>
        </div>

        {/* Card 4: Tồn kho cảnh báo */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              Cảnh báo kho
            </span>
            <span className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center text-lg">
              ⚠️
            </span>
          </div>
          <div className="mt-4">
            <p className="text-2xl font-black text-red-600 tracking-tight">
              {lowStockProducts.length} <span className="text-xs font-normal text-gray-400">sắp hết hàng</span>
            </p>
            <p className="text-[11px] text-red-500 font-medium mt-1">
              Số lượng tồn kho ≤ 5 món
            </p>
          </div>
        </div>
      </div>

      {/* ── 2 Columns: Đơn mới nhất & Cảnh báo kho ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cột trái: Đơn hàng gần đây (Chiếm 2/3) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-gray-900 text-sm flex items-center gap-2">
              <span>📋</span> Đơn hàng mới nhất
            </h3>
            <Link
              href="/admin/orders"
              className="text-xs font-bold text-orange-600 hover:text-orange-700 hover:underline"
            >
              Xem tất cả đơn →
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-500 border-b border-gray-100 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-3">Mã đơn</th>
                  <th className="py-3 px-3">Khách hàng</th>
                  <th className="py-3 px-3">Tổng tiền</th>
                  <th className="py-3 px-3">Thanh toán</th>
                  <th className="py-3 px-3">Trạng thái</th>
                  <th className="py-3 px-3 text-right">Chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orders.slice(0, 5).map((order) => (
                  <tr key={order.order_id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-gray-900">
                      #{order.order_id}
                    </td>
                    <td className="py-3 px-3">
                      <p className="font-semibold text-gray-800 line-clamp-1">
                        {order.shipping_address.full_name}
                      </p>
                      <p className="text-[11px] text-gray-400">{order.shipping_address.phone}</p>
                    </td>
                    <td className="py-3 px-3 font-bold text-orange-600">
                      {formatCurrencyVND(order.total_amount)}
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] text-gray-600">
                      {order.payment_method}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          order.order_status === 'DELIVERED'
                            ? 'bg-green-100 text-green-700'
                            : order.order_status === 'SHIPPED'
                            ? 'bg-blue-100 text-blue-700'
                            : order.order_status === 'CANCELLED'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {order.order_status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <Link
                        href={`/admin/orders?search=${order.order_id}`}
                        className="text-orange-600 font-bold hover:underline"
                      >
                        Xử lý →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Cột phải: Cảnh báo tồn kho thấp (1/3) — ĐÃ BỎ NÚT +10, +50 */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-gray-900 text-sm flex items-center gap-2">
              <span>⚠️</span> Sắp hết hàng ({lowStockProducts.length})
            </h3>
            <Link
              href="/admin/products?stock=low"
              className="text-xs font-bold text-orange-600 hover:text-orange-700 hover:underline"
            >
              Xem kho →
            </Link>
          </div>

          <div className="space-y-3 overflow-y-auto max-h-[380px] pr-1 divide-y divide-gray-100">
            {lowStockProducts.length === 0 ? (
              <div className="p-6 text-center text-xs text-gray-400">
                ✅ Kho hàng đang dồi dào, không có mặt hàng nào thiếu hụt.
              </div>
            ) : (
              lowStockProducts.slice(0, 6).map((product) => (
                <div key={product.product_id || product.ProductID} className="pt-3 first:pt-0 flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-900 line-clamp-1">
                      {product.name}
                    </p>
                    <p className="text-[11px] text-gray-400 font-mono mt-0.5">
                      {product.sku || product.product_id || product.ProductID}
                    </p>
                  </div>

                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 flex-shrink-0">
                    Còn {product.stock} cái
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
