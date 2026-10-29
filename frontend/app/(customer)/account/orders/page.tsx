'use client';

// ============================================================
// app/(customer)/account/orders/page.tsx — Đơn hàng của tôi
// ============================================================

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import apiClient from '@/lib/api-client';
import { getLocalOrders } from '@/lib/order-storage';
import { cn, formatCurrencyVND, formatDate } from '@/lib/utils';
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

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login?redirect=/account/orders');
      return;
    }

    if (user) {
      const local = getLocalOrders();

      const sampleOrders: Order[] = [
        {
          order_id: 'ORD_20261015_001',
          user_id: user.userId,
          items: [
            {
              product_id: 'PROD_BRK_001',
              name: 'Bố thắng đĩa trước Elig EM050',
              price: 125000,
              quantity: 1,
              image_url: 'https://d1ksuy3hfmko20.cloudfront.net/images/elig-em050.jpg',
            },
            {
              product_id: 'PROD_OIL_003',
              name: 'Dầu nhớt Motul 7100 4T 10W40 1L',
              price: 265000,
              quantity: 2,
              image_url: 'https://d1ksuy3hfmko20.cloudfront.net/images/motul-7100-10w40.jpg',
            },
          ],
          shipping_address: {
            full_name: user.name || 'Khách hàng',
            phone: '0901234567',
            street: '123 Nguyễn Thị Minh Khai',
            ward: 'Phường Bến Nghé',
            district: 'Quận 1',
            province: 'TP. Hồ Chí Minh',
          },
          payment_method: 'COD',
          payment_status: 'PENDING',
          order_status: 'SHIPPED',
          subtotal: 655000,
          shipping_fee: 30000,
          total_amount: 685000,
          shipping_partner: 'Giao Hàng Nhanh (GHN)',
          tracking_number: 'GHN88291039VN',
          estimated_delivery: '2026-10-22T10:00:00Z',
          created_at: '2026-10-18T08:30:00Z',
          updated_at: '2026-10-19T14:20:00Z',
        },
      ];

      // Gọi API GET /api/orders
      apiClient
        .get<{ items?: Order[] }>('/api/orders')
        .then((res) => {
          const apiItems = res?.items || [];
          const mergedMap = new Map<string, Order>();
          // Thêm các đơn hàng local đã đặt
          local.forEach((o) => mergedMap.set(o.order_id, o));
          // Thêm các đơn hàng từ API backend
          apiItems.forEach((o) => mergedMap.set(o.order_id, o));

          const merged = Array.from(mergedMap.values());
          if (merged.length > 0) {
            setOrders(merged);
          } else {
            setOrders(sampleOrders);
          }
        })
        .catch(() => {
          if (local.length > 0) {
            setOrders(local);
          } else {
            setOrders(sampleOrders);
          }
        })
        .finally(() => setIsLoading(false));
    }
  }, [user, isAuthenticated, authLoading, router]);

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
              'px-4 py-2 text-xs font-semibold rounded-xl whitespace-nowrap transition-all',
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
          <h3 className="text-lg font-bold text-gray-800 mb-1">Chưa có đơn hàng nào</h3>
          <p className="text-sm text-gray-500 mb-6">
            Bạn chưa có đơn hàng nào trong trạng thái này. Khám phá các phụ tùng xe máy chính hãng ngay!
          </p>
          <Link
            href="/products"
            className="px-6 py-2.5 bg-orange-500 hover:bg-orange-400 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            Khám phá phụ tùng ngay
          </Link>
        </div>
      ) : (
        <div className="space-y-5">
          {filteredOrders.map((order) => (
            <div
              key={order.order_id}
              className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:border-orange-200 transition-all"
            >
              {/* Card Header */}
              <div className="bg-gray-50/70 px-5 py-3.5 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-gray-800 text-sm">
                    #{order.order_id}
                  </span>
                  <span className="text-gray-400">•</span>
                  <span className="text-gray-500">
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
                    <div className="w-14 h-14 bg-gray-100 rounded-xl flex items-center justify-center text-orange-500 flex-shrink-0">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                      </svg>
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
                  {order.tracking_number && (
                    <p className="flex items-center gap-1.5 text-gray-700">
                      <span>🚚</span>
                      <span>
                        Vận đơn: <strong>{order.tracking_number}</strong> ({order.shipping_partner})
                      </span>
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

                  <Link
                    href={`/orders/${order.order_id}`}
                    className="px-3.5 py-1.5 bg-orange-500 hover:bg-orange-400 text-white rounded-xl text-xs font-bold transition-colors shadow-sm"
                  >
                    Xem chi tiết
                  </Link>
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
        <span className="px-2.5 py-0.5 bg-green-100 text-green-700 font-bold rounded-full text-[11px]">
          Đã giao thành công
        </span>
      );
    case 'CANCELLED':
      return (
        <span className="px-2.5 py-0.5 bg-red-100 text-red-700 font-bold rounded-full text-[11px]">
          Đã hủy
        </span>
      );
    default:
      return null;
  }
}
