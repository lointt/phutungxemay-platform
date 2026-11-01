'use client';

// ============================================================
// app/(customer)/account/orders/page.tsx — Đơn hàng của tôi
// Đồng bộ trực tiếp mã vận đơn GHN thật từ DynamoDB backend
// Hỗ trợ hủy đơn hàng trực tiếp cho trạng thái PLACED & PROCESSING
// Tự động phân tách đơn hàng theo UserID và khử trùng lặp
// ============================================================

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import apiClient from '@/lib/api-client';
import { getLocalOrders, saveLocalOrder, updateLocalOrderStatus } from '@/lib/order-storage';
import { cn, formatCurrencyVND, formatDate, getImageUrl } from '@/lib/utils';
import type { Order, OrderStatus } from '@/types/order';

const STATUS_TABS: { label: string; value: OrderStatus | 'ALL' }[] = [
  { label: 'Tất cả', value: 'ALL' },
  { label: 'Chờ xử lý', value: 'PLACED' },
  { label: 'Đang chuẩn bị', value: 'PROCESSING' },
  { label: 'Đang giao', value: 'SHIPPED' },
  { label: 'Đã giao', value: 'DELIVERED' },
  { label: 'Đã hủy', value: 'CANCELLED' },
];

export default function CustomerOrdersPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | 'ALL'>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login?redirect=/account/orders');
      return;
    }

    if (user) {
      // 1. Chỉ lấy đơn hàng thuộc về đúng User ID hiện tại
      const local = getLocalOrders(user.userId);

      // 2. Gọi API GET /api/orders?scope=me để backend DynamoDB lọc theo user_id
      apiClient
        .get<{ items?: Order[]; orders?: Order[] }>('/api/orders?scope=me')
        .then((res) => {
          const apiItems = res?.orders || res?.items || (Array.isArray(res) ? (res as Order[]) : []);
          
          // Lọc lại chặt chẽ theo user_id nếu backend trả về
          const userApiItems = apiItems.filter((o) => {
            const uid = o.user_id || (o as unknown as { UserID?: string }).UserID;
            return !uid || uid === user.userId || uid === 'GUEST';
          });

          const mergedMap = new Map<string, Order>();
          local.forEach((o) => mergedMap.set(o.order_id, o));
          userApiItems.forEach((o) => {
            const existing = mergedMap.get(o.order_id);
            mergedMap.set(o.order_id, {
              ...existing,
              ...o,
              tracking_number: o.tracking_number || existing?.tracking_number,
              shipping_partner: o.shipping_partner || existing?.shipping_partner || 'Giao Hàng Nhanh (GHN)',
            });
          });

          // Khử trùng lặp: nếu có 2 đơn có cùng sản phẩm và tổng tiền, ưu tiên đơn có mã server
          const rawMerged = Array.from(mergedMap.values());
          const seenSignatures = new Set<string>();
          const deduped: Order[] = [];

          for (const ord of rawMerged) {
            const sig = (ord.items || [])
              .map((i) => `${i.product_id}:${i.quantity}`)
              .sort()
              .join('|') + `_${ord.total_amount}`;

            if (seenSignatures.has(sig)) {
              const existingIdx = deduped.findIndex((d) => {
                const dSig = (d.items || [])
                  .map((i) => `${i.product_id}:${i.quantity}`)
                  .sort()
                  .join('|') + `_${d.total_amount}`;
                return dSig === sig;
              });

              if (existingIdx !== -1) {
                const existing = deduped[existingIdx];
                // Giữ đơn có mã dài hơn (mã server) hoặc có mã vận đơn
                if (
                  (ord.tracking_number && !existing.tracking_number) ||
                  (ord.order_id.includes('_') && ord.order_id.length > existing.order_id.length)
                ) {
                  deduped[existingIdx] = ord;
                }
              }
              continue;
            }

            seenSignatures.add(sig);
            deduped.push(ord);
          }

          setOrders(deduped);

          // 3. Đồng bộ mã vận đơn thật từ DynamoDB qua /api/orders/{id}
          deduped.forEach((ord) => {
            fetch(`/api/orders/${ord.order_id}`)
              .then((r) => (r.ok ? r.json() : null))
              .then((backendOrder) => {
                if (backendOrder && backendOrder.tracking_number && !backendOrder.tracking_number.includes('kết nối')) {
                  setOrders((prev) =>
                    prev.map((item) =>
                      item.order_id === ord.order_id
                        ? {
                            ...item,
                            tracking_number: backendOrder.tracking_number,
                            shipping_partner: backendOrder.shipping_partner || item.shipping_partner,
                            shipping_status: backendOrder.shipping_status || item.shipping_status,
                            order_status: backendOrder.order_status || item.order_status,
                          }
                        : item,
                    ),
                  );
                  saveLocalOrder({
                    ...ord,
                    tracking_number: backendOrder.tracking_number,
                    shipping_partner: backendOrder.shipping_partner || ord.shipping_partner,
                  });
                }
              })
              .catch(() => {});
          });
        })
        .catch(() => {
          setOrders(local);
        })
        .finally(() => setIsLoading(false));
    }
  }, [user, isAuthenticated, authLoading, router]);

  const handleCancelOrder = async (orderId: string) => {
    if (!confirm(`Bạn có chắc chắn muốn hủy đơn hàng #${orderId} không?`)) {
      return;
    }

    setCancellingId(orderId);
    try {
      // 1. Gọi API PUT /api/orders/{id} để cập nhật trạng thái hủy trên DynamoDB
      await apiClient.put(`/api/orders/${orderId}`, {
        order_status: 'CANCELLED',
      });

      // 2. Cập nhật localStorage
      updateLocalOrderStatus(orderId, 'CANCELLED');

      // 3. Cập nhật state UI
      setOrders((prev) =>
        prev.map((o) =>
          o.order_id === orderId ? { ...o, order_status: 'CANCELLED' } : o,
        ),
      );

      setToastMessage(`Đã hủy đơn hàng #${orderId} thành công!`);
      setTimeout(() => setToastMessage(null), 3500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi khi hủy đơn hàng';
      alert(`Không thể hủy đơn hàng: ${msg}`);
    } finally {
      setCancellingId(null);
    }
  };

  const filteredOrders =
    selectedStatus === 'ALL'
      ? orders
      : orders.filter((o) => o.order_status === selectedStatus);

  if (authLoading || isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12 animate-pulse space-y-6">
        <div className="h-8 bg-gray-200 rounded-lg w-1/4" />
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-40 bg-gray-200 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl border border-slate-700 flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Breadcrumb & Header */}
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/" className="hover:text-orange-500 transition-colors">Trang chủ</Link>
        <span>/</span>
        <Link href="/account" className="hover:text-orange-500 transition-colors">Tài khoản</Link>
        <span>/</span>
        <span className="text-gray-800 font-medium">Đơn hàng</span>
      </nav>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lịch sử đơn hàng</h1>
          <p className="text-sm text-gray-500 mt-1">
            Theo dõi hành trình vận chuyển và xem lại chi tiết các món phụ tùng đã đặt.
          </p>
        </div>
        <Link
          href="/products"
          className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-400 text-white rounded-xl text-sm font-semibold transition-all shadow-md shadow-orange-500/20"
        >
          Tiếp tục mua sắm →
        </Link>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-none">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setSelectedStatus(tab.value)}
            className={cn(
              'px-4 py-2 text-xs font-semibold rounded-xl whitespace-nowrap transition-all cursor-pointer',
              selectedStatus === tab.value
                ? 'bg-orange-500 text-white shadow-sm shadow-orange-500/30'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center shadow-sm">
          <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
            📦
          </div>
          <h3 className="font-bold text-gray-800 text-lg mb-1">Chưa có đơn hàng nào</h3>
          <p className="text-sm text-gray-500 mb-6">
            Bạn chưa có đơn hàng nào trong mục này.
          </p>
          <Link
            href="/products"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-400 text-white rounded-xl font-semibold text-sm transition-all shadow-md shadow-orange-500/20"
          >
            Khám phá phụ tùng ngay
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => (
            <div
              key={order.order_id}
              className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden hover:border-gray-300 transition-all"
            >
              {/* Card Header */}
              <div className="p-5 border-b border-gray-100 flex flex-wrap items-center justify-between gap-4 bg-gray-50/50">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-gray-900 text-sm">
                    #{order.order_id}
                  </span>
                  <span className="text-xs text-gray-400">•</span>
                  <span className="text-xs text-gray-500">
                    {formatDate(order.created_at)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <StatusBadge status={order.order_status} />
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-[11px] font-medium">
                    {order.payment_method}
                  </span>
                </div>
              </div>

              {/* Items */}
              <div className="p-5 divide-y divide-gray-100">
                {order.items.map((item, idx) => (
                  <div key={idx} className="py-3 first:pt-0 last:pb-0 flex items-center gap-4">
                    <div className="w-14 h-14 bg-gray-100 rounded-xl overflow-hidden relative flex items-center justify-center flex-shrink-0 border border-gray-100">
                      {item.image_url ? (
                        <Image
                          src={getImageUrl(item.image_url)}
                          alt={item.name}
                          fill
                          unoptimized
                          className="object-cover"
                          sizes="56px"
                        />
                      ) : (
                        <svg className="w-6 h-6 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                        </svg>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/products/${item.product_id}`}
                        className="font-semibold text-gray-800 text-sm hover:text-orange-600 transition-colors line-clamp-1"
                      >
                        {item.name}
                      </Link>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Số lượng: x{item.quantity} • Đơn giá: {formatCurrencyVND(item.price)}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="font-bold text-gray-900 text-sm">
                        {formatCurrencyVND(item.price * item.quantity)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Card Footer */}
              <div className="bg-gray-50/40 px-5 py-4 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="text-xs text-gray-600">
                  {order.tracking_number && !order.tracking_number.includes('kết nối') ? (
                    <p className="flex items-center gap-1.5 text-gray-700">
                      <span>🚚</span>
                      <span>
                        Vận đơn: <strong className="font-mono text-orange-600 bg-orange-50 px-2 py-0.5 rounded border border-orange-200">{order.tracking_number}</strong> ({order.shipping_partner || 'Giao Hàng Nhanh (GHN)'})
                      </span>
                    </p>
                  ) : (
                    <p className="flex items-center gap-1.5 text-gray-500 text-xs">
                      <span>🚚</span>
                      <span>Vận đơn: Đang đồng bộ từ Giao Hàng Nhanh (GHN)...</span>
                    </p>
                  )}
                  <p className="text-gray-500 mt-0.5">
                    Giao tới: {order.shipping_address.street}, {order.shipping_address.ward}, {order.shipping_address.district}
                  </p>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4">
                  <div className="text-right">
                    <span className="text-xs text-gray-500">Tổng thanh toán: </span>
                    <span className="text-base font-extrabold text-orange-600">
                      {formatCurrencyVND(order.total_amount)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Nút Hủy đơn chỉ hiển thị cho trạng thái Chờ xử lý hoặc Đang chuẩn bị */}
                    {(order.order_status === 'PLACED' || order.order_status === 'PROCESSING') && (
                      <button
                        type="button"
                        disabled={cancellingId === order.order_id}
                        onClick={() => handleCancelOrder(order.order_id)}
                        className="px-3.5 py-1.5 border border-rose-200 hover:bg-rose-50 text-rose-600 rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {cancellingId === order.order_id ? 'Đang hủy...' : 'Hủy đơn'}
                      </button>
                    )}

                    <Link
                      href={`/orders/${order.order_id}`}
                      className="px-3.5 py-1.5 bg-orange-500 hover:bg-orange-400 text-white rounded-xl text-xs font-bold transition-colors shadow-sm"
                    >
                      Xem chi tiết
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: OrderStatus }) {
  switch (status) {
    case 'PLACED':
      return (
        <span className="px-2.5 py-0.5 bg-blue-100 text-blue-700 font-bold rounded-full text-[11px]">
          Chờ xử lý
        </span>
      );
    case 'PROCESSING':
      return (
        <span className="px-2.5 py-0.5 bg-amber-100 text-amber-700 font-bold rounded-full text-[11px]">
          Đang chuẩn bị hàng
        </span>
      );
    case 'SHIPPED':
      return (
        <span className="px-2.5 py-0.5 bg-purple-100 text-purple-700 font-bold rounded-full text-[11px]">
          Đang giao hàng
        </span>
      );
    case 'DELIVERED':
      return (
        <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-700 font-bold rounded-full text-[11px]">
          Đã giao hàng
        </span>
      );
    case 'CANCELLED':
      return (
        <span className="px-2.5 py-0.5 bg-rose-100 text-rose-700 font-bold rounded-full text-[11px]">
          Đã hủy
        </span>
      );
    default:
      return null;
  }
}
