'use client';

// ============================================================
// app/(admin)/admin/orders/page.tsx — Quản lý Đơn hàng & Vận đơn
// ============================================================

import { useEffect, useState } from 'react';
import { getLocalOrders } from '@/lib/order-storage';
import { updateOrderStatusInStorage } from '@/lib/admin-storage';
import apiClient from '@/lib/api-client';
import { normalizeDynamoOrder } from '@/lib/order-normalizer';
import { formatCurrencyVND, formatDate } from '@/lib/utils';
import type { Order, OrderStatus } from '@/types/order';

const STATUS_TABS: { label: string; value: OrderStatus | 'ALL' }[] = [
  { label: 'Tất cả', value: 'ALL' },
  { label: 'Chờ duyệt', value: 'PLACED' },
  { label: 'Đang đóng gói', value: 'PROCESSING' },
  { label: 'Đang giao hàng', value: 'SHIPPED' },
  { label: 'Đã hoàn thành', value: 'DELIVERED' },
  { label: 'Đã hủy', value: 'CANCELLED' },
];

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Edit Tracking Modal
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [shippingPartner, setShippingPartner] = useState('Giao Hàng Nhanh (GHN)');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function loadOrders() {
      setIsLoading(true);
      const local = getLocalOrders();
      let allOrders = [...local];

      try {
        const res = await apiClient.get<{ orders?: Record<string, unknown>[]; items?: Record<string, unknown>[] }>('/api/orders');
        const rawOrders = res?.orders || res?.items || [];
        if (Array.isArray(rawOrders) && rawOrders.length > 0) {
          const map = new Map<string, Order>();
          local.forEach((o) => map.set(o.order_id, o));
          rawOrders.forEach((raw) => {
            const normalized = normalizeDynamoOrder(raw);
            if (normalized.order_id) {
              map.set(normalized.order_id, normalized);
            }
          });
          allOrders = Array.from(map.values());
        }
      } catch {
        // use local fallback
      }

      setOrders(allOrders);
      setIsLoading(false);
    }

    void loadOrders();
  }, []);

  const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
    // 1. Cập nhật local storage
    updateOrderStatusInStorage(orderId, newStatus);

    // 2. Cập nhật state
    setOrders((prev) =>
      prev.map((o) =>
        o.order_id === orderId
          ? { ...o, order_status: newStatus, updated_at: new Date().toISOString() }
          : o,
      ),
    );

    // 3. Cập nhật trực tiếp lên DynamoDB Orders table qua PUT /api/orders/{id}
    try {
      await apiClient.put(`/api/orders/${orderId}`, {
        order_status: newStatus,
      });
    } catch (err) {
      console.warn('Lỗi cập nhật trạng thái đơn lên DynamoDB:', err);
    }
  };

  const openTrackingModal = (order: Order) => {
    setSelectedOrder(order);
    setTrackingNumber(order.tracking_number || `GHN${Math.floor(100000000 + Math.random() * 900000000)}VN`);
    setShippingPartner(order.shipping_partner || 'Giao Hàng Nhanh (GHN)');
  };

  const handleSaveTracking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;

    setIsSaving(true);
    const orderId = selectedOrder.order_id;
    updateOrderStatusInStorage(orderId, selectedOrder.order_status, trackingNumber, shippingPartner);

    try {
      await apiClient.put(`/api/orders/${orderId}`, {
        order_status: selectedOrder.order_status,
        tracking_number: trackingNumber,
        shipping_partner: shippingPartner,
      });
    } catch {
      // ignore
    }

    setOrders((prev) =>
      prev.map((o) =>
        o.order_id === orderId
          ? { ...o, tracking_number: trackingNumber, shipping_partner: shippingPartner }
          : o,
      ),
    );

    setIsSaving(false);
    setSelectedOrder(null);
  };

  const filteredOrders = orders.filter((o) => {
    const matchStatus = selectedStatus === 'ALL' || o.order_status === selectedStatus;
    const matchSearch =
      !search.trim() ||
      o.order_id.toLowerCase().includes(search.toLowerCase()) ||
      o.shipping_address.full_name.toLowerCase().includes(search.toLowerCase()) ||
      o.shipping_address.phone.includes(search) ||
      (o.tracking_number && o.tracking_number.toLowerCase().includes(search.toLowerCase()));

    return matchStatus && matchSearch;
  });

  return (
    <div className="space-y-6">
      {/* ── Top Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">
            Quản lý Đơn hàng & Vận đơn
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Tổng cộng {orders.length} đơn hàng trong hệ thống.
          </p>
        </div>
      </div>

      {/* ── Status Tabs & Search ────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-xs space-y-4">
        {/* Status Tab buttons */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-gray-100">
          {STATUS_TABS.map((tab) => {
            const count =
              tab.value === 'ALL'
                ? orders.length
                : orders.filter((o) => o.order_status === tab.value).length;

            const isSelected = selectedStatus === tab.value;

            return (
              <button
                key={tab.value}
                onClick={() => setSelectedStatus(tab.value)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                  isSelected
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    isSelected ? 'bg-orange-600 text-white' : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search input */}
        <div className="relative">
          <input
            type="text"
            placeholder="Tìm theo mã đơn (ORD_...), tên người nhận, SĐT, mã vận đơn..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
          <span className="absolute left-3 top-2.5 text-gray-400 text-xs">🔍</span>
        </div>
      </div>

      {/* ── Orders Table ────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-gray-400 animate-pulse">
            Đang tải dữ liệu đơn hàng...
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <span className="text-4xl">📦</span>
            <p className="text-sm font-bold text-gray-700">Không có đơn hàng nào phù hợp</p>
            <p className="text-xs text-gray-400">Không tìm thấy đơn hàng thỏa mãn điều kiện lọc.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-500 border-b border-gray-100 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Mã đơn & Ngày đặt</th>
                  <th className="py-3 px-4">Khách hàng & Địa chỉ</th>
                  <th className="py-3 px-4">Sản phẩm</th>
                  <th className="py-3 px-4">Tổng tiền & TT</th>
                  <th className="py-3 px-4">Vận chuyển (Tracking)</th>
                  <th className="py-3 px-4">Trạng thái đơn</th>
                  <th className="py-3 px-4 text-right">Cập nhật</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredOrders.map((order) => {
                  const addr = order.shipping_address;

                  return (
                    <tr key={order.order_id} className="hover:bg-gray-50/70 transition-colors">
                      {/* Order ID & Date */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <p className="font-mono font-bold text-gray-900">
                          #{order.order_id}
                        </p>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          {formatDate(order.created_at)}
                        </p>
                      </td>

                      {/* Customer */}
                      <td className="py-3 px-4 max-w-xs">
                        <p className="font-bold text-gray-900">{addr.full_name}</p>
                        <p className="text-gray-500 text-[11px]">{addr.phone}</p>
                        <p className="text-gray-400 text-[10px] line-clamp-1 mt-0.5">
                          {addr.street}, {addr.district}, {addr.province}
                        </p>
                      </td>

                      {/* Items */}
                      <td className="py-3 px-4 max-w-xs text-[11px]">
                        <p className="font-bold text-gray-800 line-clamp-1">
                          {order.items[0]?.name}
                          {order.items.length > 1 && ` (+${order.items.length - 1} món)`}
                        </p>
                        <p className="text-gray-400 text-[10px]">
                          Tổng x{order.items.reduce((s, i) => s + i.quantity, 0)} sản phẩm
                        </p>
                      </td>

                      {/* Amount & Payment */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <p className="font-bold text-orange-600">
                          {formatCurrencyVND(order.total_amount)}
                        </p>
                        <span className="inline-block mt-0.5 px-1.5 py-0.5 bg-gray-100 rounded text-[10px] font-mono text-gray-600">
                          {order.payment_method} • {order.payment_status === 'PAID' ? 'Đã TT' : 'Chưa TT'}
                        </span>
                      </td>

                      {/* Shipping / Tracking */}
                      <td className="py-3 px-4 whitespace-nowrap text-[11px]">
                        <p className="font-mono text-gray-800">
                          {order.tracking_number || <span className="text-gray-400 italic">Chưa tạo mã</span>}
                        </p>
                        <button
                          onClick={() => openTrackingModal(order)}
                          className="text-[10px] text-orange-600 hover:underline font-bold mt-0.5 cursor-pointer block"
                        >
                          Sửa mã vận đơn →
                        </button>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <select
                          value={order.order_status}
                          onChange={(e) =>
                            handleStatusChange(order.order_id, e.target.value as OrderStatus)
                          }
                          className={`px-2.5 py-1 text-xs font-bold rounded-xl border focus:outline-none focus:ring-2 focus:ring-orange-400 cursor-pointer ${
                            order.order_status === 'DELIVERED'
                              ? 'bg-green-50 text-green-700 border-green-200'
                              : order.order_status === 'SHIPPED'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : order.order_status === 'PROCESSING'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : order.order_status === 'CANCELLED'
                              ? 'bg-red-50 text-red-700 border-red-200'
                              : 'bg-orange-50 text-orange-700 border-orange-200'
                          }`}
                        >
                          <option value="PLACED">🟠 Chờ duyệt (PLACED)</option>
                          <option value="PROCESSING">🟡 Đang đóng gói (PROCESSING)</option>
                          <option value="SHIPPED">🚚 Đang giao (SHIPPED)</option>
                          <option value="DELIVERED">✅ Đã giao (DELIVERED)</option>
                          <option value="CANCELLED">❌ Đã hủy (CANCELLED)</option>
                        </select>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <a
                          href={`/orders/${order.order_id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-xs transition-colors inline-block"
                        >
                          Xem chi tiết
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Tracking Modal ──────────────────────────────────────────────────── */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-black text-gray-900 text-sm">
                Cập nhật vận đơn #{selectedOrder.order_id}
              </h3>
              <button
                onClick={() => setSelectedOrder(null)}
                className="text-gray-400 hover:text-gray-700 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveTracking} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Đơn vị vận chuyển</label>
                <select
                  value={shippingPartner}
                  onChange={(e) => setShippingPartner(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
                >
                  <option value="Giao Hàng Nhanh (GHN)">Giao Hàng Nhanh (GHN)</option>
                  <option value="Giao Hàng Tiết Kiệm (GHTK)">Giao Hàng Tiết Kiệm (GHTK)</option>
                  <option value="Viettel Post">Viettel Post</option>
                  <option value="Ahamove (Giao Hỏa Tốc)">Ahamove (Giao Hỏa Tốc)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Mã vận đơn (Tracking Code)</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: GHN88291039VN"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl font-mono text-xs focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-orange-500 hover:bg-orange-400 text-white rounded-xl font-bold shadow-md shadow-orange-500/25 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? 'Đang lưu...' : 'Lưu vận đơn'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
