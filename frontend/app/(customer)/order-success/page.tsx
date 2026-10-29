'use client';

// ============================================================
// app/(customer)/order-success/page.tsx — Trang kết quả đặt hàng
// Hiển thị mã đơn hàng, timeline trạng thái, thông tin vận đơn
// ============================================================

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { OrderTimeline } from '@/components/customer/order-timeline';
import { getLocalOrderById, getLocalOrders } from '@/lib/order-storage';
import { formatCurrencyVND } from '@/lib/utils';
import type { Order } from '@/types/order';

export default function OrderSuccessPage() {
  return (
    <Suspense fallback={<OrderSuccessSkeleton />}>
      <OrderSuccessContent />
    </Suspense>
  );
}

function OrderSuccessSkeleton() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-16 animate-pulse space-y-6">
      <div className="w-16 h-16 bg-gray-200 rounded-full mx-auto" />
      <div className="h-6 bg-gray-200 rounded w-1/2 mx-auto" />
      <div className="h-32 bg-gray-200 rounded-2xl" />
    </div>
  );
}

function OrderSuccessContent() {
  const searchParams = useSearchParams();
  const vnpTxnRef = searchParams.get('vnp_TxnRef');
  const vnpResponseCode = searchParams.get('vnp_ResponseCode');
  const vnpTransactionNo = searchParams.get('vnp_TransactionNo');

  const rawId = searchParams.get('order_id') || vnpTxnRef;
  const method = searchParams.get('method') || (vnpTxnRef ? 'VNPAY' : 'COD');
  const isVnpayPaid = vnpResponseCode === '00';
  const isVnpayFailed = Boolean(vnpResponseCode && vnpResponseCode !== '00');

  const [order, setOrder] = useState<Order | null>(null);

  useEffect(() => {
    // 1. Tìm đơn hàng sơ bộ từ localStorage để hiển thị tức thì không bị giật màn hình
    if (rawId) {
      const found = getLocalOrderById(rawId);
      if (found) {
        if (isVnpayPaid && found.payment_status !== 'PAID') {
          found.payment_status = 'PAID';
        }
        setOrder(found);
      }
    } else {
      const all = getLocalOrders();
      if (all.length > 0) {
        const latest = all[0];
        if (isVnpayPaid && latest.payment_status !== 'PAID') {
          latest.payment_status = 'PAID';
        }
        setOrder(latest);
      }
    }

    // 2. Truy vấn trực tiếp Backend DynamoDB để lấy mã vận đơn GHN thật
    const targetOrderId = rawId || (getLocalOrders().length > 0 ? getLocalOrders()[0].order_id : null);
    if (!targetOrderId) return;

    let pollAttempts = 0;
    const fetchBackendOrder = () => {
      fetch(`/api/orders/${targetOrderId}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((backendOrder) => {
          if (!backendOrder) return;
          const tracking = backendOrder.tracking_number;
          setOrder((prev) => {
            const merged = {
              ...(prev || {}),
              ...backendOrder,
              order_id: backendOrder.OrderID || backendOrder.order_id || targetOrderId,
              tracking_number: tracking || prev?.tracking_number,
              shipping_partner: backendOrder.shipping_partner || prev?.shipping_partner,
              shipping_status: backendOrder.shipping_status || prev?.shipping_status,
              estimated_delivery: backendOrder.estimated_delivery || prev?.estimated_delivery,
            };
            return merged as Order;
          });

          // Nếu mã tracking chưa về (worker đang gọi GHN trong 1-2s đầu), thử fetch lại
          if (!tracking || tracking.includes('kết nối') || tracking.startsWith('GHN')) {
            if (pollAttempts < 3) {
              pollAttempts++;
              setTimeout(fetchBackendOrder, 2000);
            }
          }
        })
        .catch(() => {});
    };

    fetchBackendOrder();
  }, [rawId, isVnpayPaid]);

  const displayOrderId = order?.order_id || rawId || `ORD_${Date.now().toString().slice(-8)}`;

  // Tự động gọi backend IPN để đồng bộ trạng thái PAID ngay khi VNPay chuyển hướng khách về trang kết quả
  useEffect(() => {
    if (vnpTxnRef && isVnpayPaid) {
      const search = typeof window !== 'undefined' ? window.location.search : '';
      fetch(`/api/payments/vnpay/ipn${search}`)
        .then((res) => res.json())
        .then((data) => {
          console.log('[VNPAY_RETURN] Đã tự động đồng bộ IPN thành công:', data);
        })
        .catch((err) => {
          console.warn('[VNPAY_RETURN] Lỗi đồng bộ IPN:', err);
        });
    }
  }, [vnpTxnRef, isVnpayPaid]);

  const displayShippingFee = order?.shipping_fee ?? 30000;
  const displayFinalAmount = (order?.final_amount ?? (order?.total_amount ? order.total_amount + displayShippingFee : 0)) || order?.total_amount || 0;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Success Badge & Header */}
      <div className="text-center mb-8">
        <div className={`w-16 h-16 ${isVnpayFailed ? 'bg-amber-100' : 'bg-green-100'} rounded-full flex items-center justify-center mx-auto mb-4 text-3xl shadow-sm`}>
          {isVnpayFailed ? '⚠️' : '✅'}
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">
          {isVnpayFailed ? 'Đặt hàng đã ghi nhận (Chờ thanh toán lại)' : 'Đặt hàng thành công!'}
        </h1>
        <p className="text-sm text-gray-500 mt-2">
          {isVnpayFailed
            ? 'Đơn hàng của bạn đã được hệ thống lưu lại nhưng giao dịch thanh toán trực tuyến chưa hoàn tất.'
            : 'Cảm ơn bạn đã tin tưởng mua phụ tùng tại Phụ Tùng Xe Máy.'}
        </p>

        <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-orange-50 border border-orange-200 rounded-full text-xs text-orange-800">
            <span>Mã đơn hàng:</span>
            <strong className="font-mono">{displayOrderId}</strong>
          </div>

          {isVnpayPaid && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-xs text-emerald-800 font-semibold">
              <span>💳</span> Đã thanh toán qua VNPay {vnpTransactionNo ? `(Mã GD: ${vnpTransactionNo})` : ''}
            </div>
          )}

          {isVnpayFailed && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 border border-rose-200 rounded-full text-xs text-rose-800 font-semibold">
              <span>⚠️</span> Thanh toán không thành công (Mã lỗi: {vnpResponseCode})
            </div>
          )}
        </div>
      </div>

      {/* Main Card */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 shadow-sm space-y-8">
        {/* Timeline */}
        <div>
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
            Tiến trình vận đơn
          </h2>
          <OrderTimeline
            status={order?.order_status || 'PLACED'}
            createdAt={order?.created_at || new Date().toISOString()}
            estimatedDelivery={order?.estimated_delivery}
          />
        </div>

        {/* Shipping & Delivery Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6 border-t border-gray-100 text-xs">
          <div className="space-y-2">
            <h3 className="font-bold text-gray-900 text-sm flex items-center gap-1.5">
              <span>🚚</span> Đơn vị giao nhận
            </h3>
            <p className="text-gray-700">
              Đối tác vận chuyển: <strong>{order?.shipping_partner || 'Giao Hàng Nhanh (GHN)'}</strong>
            </p>
            <p className="text-gray-700">
              Mã vận đơn (Tracking):{' '}
              <strong className="font-mono text-orange-600 bg-orange-50 px-2 py-0.5 rounded border border-orange-200">
                {order?.tracking_number || 'Đang kết nối GHN...'}
              </strong>
            </p>
            <p className="text-gray-500">
              Thời gian giao dự kiến: 2 - 3 ngày làm việc (trừ Chủ nhật)
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="font-bold text-gray-900 text-sm flex items-center gap-1.5">
              <span>📍</span> Địa chỉ nhận hàng
            </h3>
            <p className="text-gray-800 font-medium">
              {order?.shipping_address.full_name || 'Khách hàng'} • {order?.shipping_address.phone || '090xxxxxxx'}
            </p>
            <p className="text-gray-600">
              {order?.shipping_address.street || 'Địa chỉ giao hàng'}, {order?.shipping_address.ward || ''},{' '}
              {order?.shipping_address.district || ''}, {order?.shipping_address.province || 'Việt Nam'}
            </p>
            <p className="text-gray-500">
              Phương thức thanh toán: <strong>{method === 'COD' ? 'Tiền mặt khi nhận hàng (COD)' : method}</strong>
            </p>
          </div>
        </div>

        {/* Order items preview if available */}
        {order?.items && order.items.length > 0 && (
          <div className="pt-6 border-t border-gray-100">
            <h3 className="font-bold text-gray-900 text-xs uppercase tracking-wider mb-3">
              Danh sách phụ tùng đã đặt
            </h3>
            <div className="divide-y divide-gray-100">
              {order.items.map((item, i) => (
                <div key={i} className="py-2.5 flex items-center justify-between text-xs">
                  <span className="font-medium text-gray-800 line-clamp-1">{item.name} x{item.quantity}</span>
                  <span className="font-bold text-gray-900">{formatCurrencyVND(item.price * item.quantity)}</span>
                </div>
              ))}
              <div className="pt-3 flex items-center justify-between text-xs text-gray-500">
                <span>Tiền hàng (Tạm tính):</span>
                <span className="font-semibold text-gray-700">{formatCurrencyVND(order.total_amount)}</span>
              </div>
              <div className="pt-1.5 flex items-center justify-between text-xs text-gray-500">
                <span>Phí vận chuyển:</span>
                <span className="font-semibold text-gray-700">{formatCurrencyVND(displayShippingFee)}</span>
              </div>
              <div className="pt-3 flex items-center justify-between text-sm font-bold text-gray-900 border-t border-dashed border-gray-200 mt-2">
                <span>Tổng thanh toán:</span>
                <span className="text-orange-600 font-extrabold text-base">
                  {formatCurrencyVND(displayFinalAmount)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="pt-6 border-t border-gray-100 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href={`/orders/${displayOrderId}`}
            className="px-6 py-3 bg-orange-500 hover:bg-orange-400 text-white font-bold text-xs rounded-xl text-center transition-all shadow-md shadow-orange-500/25"
          >
            Theo dõi chi tiết đơn hàng #{displayOrderId}
          </Link>

          <Link
            href="/products"
            className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium text-xs rounded-xl text-center transition-colors"
          >
            Tiếp tục mua hàng
          </Link>
        </div>
      </div>
    </div>
  );
}
