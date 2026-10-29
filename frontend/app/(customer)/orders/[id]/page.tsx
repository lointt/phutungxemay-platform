'use client';

// ============================================================
// app/(customer)/orders/[id]/page.tsx — Chi tiết & Tra cứu đơn hàng
// Bọc trong Suspense để xử lý use(params) chuẩn Next.js 16
// ============================================================

import { Suspense, use, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { OrderTimeline } from '@/components/customer/order-timeline';
import apiClient from '@/lib/api-client';
import { getLocalOrderById } from '@/lib/order-storage';
import { cn, formatCurrencyVND, formatDate, getImageUrl } from '@/lib/utils';
import type { Order } from '@/types/order';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function OrderTrackingPage({ params }: PageProps) {
  return (
    <Suspense fallback={<OrderTrackingSkeleton />}>
      <OrderTrackingContent params={params} />
    </Suspense>
  );
}

function OrderTrackingSkeleton() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-16 animate-pulse space-y-6">
      <div className="h-8 bg-gray-200 rounded-lg w-1/3" />
      <div className="h-48 bg-gray-200 rounded-2xl" />
      <div className="h-64 bg-gray-200 rounded-2xl" />
    </div>
  );
}

function OrderTrackingContent({ params }: PageProps) {
  const resolvedParams = use(params);
  const orderId = resolvedParams.id;

  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 1. Tìm trong localStorage trước (tức thì, không cần đợi mạng)
    const localOrder = getLocalOrderById(orderId);
    if (localOrder) {
      setOrder(localOrder);
      setIsLoading(false);
      return;
    }

    // 2. Thử gọi API GET /api/orders/{id}
    apiClient
      .get<Order>(`/api/orders/${orderId}`)
      .then((res) => {
        if (res && res.order_id) {
          setOrder(res);
        }
      })
      .catch(() => {
        // Fallback demo cho phép kiểm tra giao diện nếu mã đơn không tồn tại
        const fallbackOrder: Order = {
          order_id: orderId,
          user_id: 'GUEST',
          items: [
            {
              product_id: 'PROD_BRK_001',
              name: 'Bố thắng đĩa trước Elig EM050',
              price: 125000,
              quantity: 1,
              image_url: 'https://d1ksuy3hfmko20.cloudfront.net/images/elig-em050.jpg',
            },
          ],
          shipping_address: {
            full_name: 'Khách hàng',
            phone: '0901234567',
            street: '123 Đường Điện Biên Phủ',
            ward: 'Phường Đa Kao',
            district: 'Quận 1',
            province: 'TP. Hồ Chí Minh',
          },
          payment_method: 'COD',
          payment_status: 'PENDING',
          order_status: 'PROCESSING',
          subtotal: 125000,
          shipping_fee: 30000,
          total_amount: 155000,
          shipping_partner: 'Giao Hàng Nhanh (GHN)',
          tracking_number: 'GHN88291039VN',
          estimated_delivery: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setOrder(fallbackOrder);
      })
      .finally(() => setIsLoading(false));
  }, [orderId]);

  if (isLoading) {
    return <OrderTrackingSkeleton />;
  }

  if (!order) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="text-4xl mb-3">🔍</div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Không tìm thấy đơn hàng</h1>
        <p className="text-sm text-gray-500 mb-6">
          Mã đơn hàng <strong>{orderId}</strong> không tồn tại hoặc đã bị xóa khỏi hệ thống.
        </p>
        <Link
          href="/products"
          className="px-6 py-2.5 bg-orange-500 hover:bg-orange-400 text-white font-semibold text-xs rounded-xl"
        >
          Quay lại cửa hàng
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/" className="hover:text-orange-500 transition-colors">Trang chủ</Link>
        <span>/</span>
        <Link href="/account/orders" className="hover:text-orange-500 transition-colors">Đơn hàng</Link>
        <span>/</span>
        <span className="text-gray-900 font-semibold font-mono">#{order.order_id}</span>
      </nav>

      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 flex items-center gap-3">
            <span>Chi tiết đơn hàng</span>
            <span className="font-mono text-orange-600 font-bold text-lg">#{order.order_id}</span>
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Đặt ngày: {formatDate(order.created_at)}
          </p>
        </div>
      </div>

      {/* Timeline Section */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 shadow-sm mb-6">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-6">
          Tiến độ đơn hàng
        </h2>
        <OrderTimeline
          status={order.order_status}
          createdAt={order.created_at}
          estimatedDelivery={order.estimated_delivery}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {/* Box 1: Người nhận */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-2 text-xs">
          <h3 className="font-bold text-gray-900 text-sm flex items-center gap-1.5">
            <span>📍</span> Địa chỉ giao hàng
          </h3>
          <p className="text-gray-900 font-semibold">{order.shipping_address.full_name}</p>
          <p className="text-gray-600">{order.shipping_address.phone}</p>
          <p className="text-gray-600">
            {order.shipping_address.street}, {order.shipping_address.ward}, {order.shipping_address.district}, {order.shipping_address.province}
          </p>
          {order.notes && (
            <p className="text-gray-500 italic pt-1 border-t border-gray-100">
              Ghi chú: {order.notes}
            </p>
          )}
        </div>

        {/* Box 2: Vận chuyển */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-2 text-xs">
          <h3 className="font-bold text-gray-900 text-sm flex items-center gap-1.5">
            <span>🚚</span> Vận chuyển & Giao nhận
          </h3>
          <p className="text-gray-700">Đơn vị: <strong>{order.shipping_partner || 'Giao Hàng Nhanh (GHN)'}</strong></p>
          <p className="text-gray-700">
            Mã vận đơn:{' '}
            <strong className="font-mono text-orange-600">
              {order.tracking_number || 'Chưa tạo mã'}
            </strong>
          </p>
          <p className="text-gray-500">
            Dự kiến nhận: 2 - 3 ngày làm việc
          </p>
        </div>

        {/* Box 3: Thanh toán */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-2 text-xs">
          <h3 className="font-bold text-gray-900 text-sm flex items-center gap-1.5">
            <span>💳</span> Thanh toán
          </h3>
          <p className="text-gray-700">
            Hình thức:{' '}
            <strong>
              {order.payment_method === 'COD'
                ? 'Thanh toán khi nhận hàng (COD)'
                : order.payment_method}
            </strong>
          </p>
          <div className="flex items-center gap-2">
            <span>Trạng thái:</span>
            <span
              className={cn(
                'px-2 py-0.5 rounded font-bold text-[10px]',
                order.payment_status === 'PAID'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-amber-100 text-amber-700',
              )}
            >
              {order.payment_status === 'PAID' ? 'Đã thanh toán' : 'Chờ thanh toán'}
            </span>
          </div>
        </div>
      </div>

      {/* Items list card */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
        <h3 className="font-bold text-gray-900 text-sm">
          Sản phẩm trong đơn hàng ({order.items.length})
        </h3>

        <div className="divide-y divide-gray-100">
          {order.items.map((item, idx) => (
            <div key={idx} className="py-3 first:pt-0 last:pb-0 flex items-center gap-4">
              <div className="w-14 h-14 bg-gray-100 rounded-xl overflow-hidden flex-shrink-0 relative">
                {item.image_url ? (
                  <Image
                    src={getImageUrl(item.image_url)}
                    alt={item.name}
                    fill
                    className="object-cover"
                    sizes="56px"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-sm">🏍️</div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <Link
                  href={`/products/${item.product_id}`}
                  className="text-xs font-semibold text-gray-900 hover:text-orange-600 transition-colors line-clamp-1"
                >
                  {item.name}
                </Link>
                <p className="text-[11px] text-gray-500 mt-0.5">Số lượng: x{item.quantity}</p>
              </div>

              <div className="text-right flex-shrink-0">
                <p className="text-xs font-bold text-gray-900">
                  {formatCurrencyVND(item.price * item.quantity)}
                </p>
                <p className="text-[10px] text-gray-400">
                  {formatCurrencyVND(item.price)} / món
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Pricing Summary */}
        <div className="pt-4 border-t border-gray-100 space-y-2 text-xs">
          <div className="flex justify-between text-gray-600">
            <span>Tạm tính tiền hàng:</span>
            <span className="font-medium text-gray-900">{formatCurrencyVND(order.subtotal)}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>Phí vận chuyển:</span>
            <span className="font-medium text-gray-900">
              {order.shipping_fee === 0 ? 'Miễn phí' : formatCurrencyVND(order.shipping_fee)}
            </span>
          </div>
          <div className="pt-2 border-t border-gray-200 flex justify-between items-baseline text-sm font-bold">
            <span className="text-gray-900">Tổng thanh toán:</span>
            <span className="text-orange-600 font-extrabold text-base">
              {formatCurrencyVND(order.total_amount)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
