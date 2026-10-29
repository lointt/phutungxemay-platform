'use client';

// ============================================================
// app/(customer)/checkout/page.tsx — Trang đặt hàng & thanh toán
// Hỗ trợ COD, VNPay, MoMo, tự động điền hồ sơ khách hàng
// Lưu trữ đơn hàng tin cậy, không bị kẹt nút hay redirect sai
// ============================================================

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/hooks/use-auth';
import { useCart } from '@/hooks/use-cart';
import apiClient from '@/lib/api-client';
import { saveLocalOrder } from '@/lib/order-storage';
import { getAdminCustomProducts, updateProductStockInStorage } from '@/lib/admin-storage';
import { cn, formatCurrencyVND, getImageUrl } from '@/lib/utils';
import type { PaymentMethod, ShippingAddress, Order } from '@/types/order';
import type { Product } from '@/types/product';

export default function CheckoutPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { items, subtotal, clearCart, isLoaded } = useCart();

  // Form inputs
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [street, setStreet] = useState('');
  const [ward, setWard] = useState('');
  const [district, setDistrict] = useState('');
  const [province, setProvince] = useState('TP. Hồ Chí Minh');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('COD');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Đánh dấu đã xác nhận đặt hàng thành công để không bị redirect về /cart khi giỏ hàng xóa rỗng
  const isOrderPlacedRef = useRef(false);

  // Phí ship: miễn phí nếu >= 500k
  const shippingFee = subtotal >= 500000 ? 0 : 30000;
  const totalAmount = subtotal + shippingFee;

  // Tự động điền thông tin nếu user đã đăng nhập
  useEffect(() => {
    if (user) {
      if (user.name) setFullName(user.name);
      if (user.email) setEmail(user.email);
      if (user.phone) setPhone(user.phone);

      apiClient
        .get<{ default_shipping_address?: ShippingAddress }>('/api/users/me')
        .then((res) => {
          if (res?.default_shipping_address) {
            const addr = res.default_shipping_address;
            if (addr.street) setStreet(addr.street);
            if (addr.ward) setWard(addr.ward);
            if (addr.district) setDistrict(addr.district);
            if (addr.province) setProvince(addr.province);
          }
        })
        .catch(() => {});
    }
  }, [user]);

  // Nếu giỏ hàng trống sau khi đã load xong và không trong quá trình đặt hàng -> chuyển về giỏ
  useEffect(() => {
    if (isLoaded && items.length === 0 && !isSubmitting && !isOrderPlacedRef.current) {
      router.replace('/cart');
    }
  }, [isLoaded, items.length, isSubmitting, router]);

  async function handleSubmitOrder(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitting || items.length === 0) return;

    if (!fullName.trim() || !phone.trim() || !street.trim() || !district.trim()) {
      setErrorMessage('Vui lòng điền đầy đủ: Họ tên, Số điện thoại, Địa chỉ nhận hàng và Quận/Huyện.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    isOrderPlacedRef.current = true;

    const fullAddrString = `${street.trim()}, ${ward.trim() || ''}, ${district.trim()}, ${province.trim() || 'TP. Hồ Chí Minh'}`;
    const shippingAddress: ShippingAddress = {
      full_name: fullName.trim(),
      phone: phone.trim(),
      street: street.trim(),
      ward: ward.trim() || 'Phường trung tâm',
      district: district.trim(),
      province: province.trim() || 'TP. Hồ Chí Minh',
    };

    const shippingAddressPayload = {
      ...shippingAddress,
      recipient_name: fullName.trim(),
      address: fullAddrString,
    };

    const orderPayload = {
      shipping_address: shippingAddressPayload,
      payment_method: paymentMethod,
      notes: notes.trim() || undefined,
      items: items.map((i) => ({
        product_id: i.product_id,
        name: i.name,
        price: i.price,
        quantity: i.quantity,
        image_url: i.image_url,
      })),
      subtotal,
      shipping_fee: shippingFee,
      total_amount: totalAmount,
    };

    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    const orderId = `ORD_${Date.now().toString().slice(-6)}${randomSuffix.toString().slice(-2)}`;
    const trackingCode = 'Đang kết nối GHN...';

    const newOrder: Order = {
      order_id: orderId,
      user_id: user?.userId || 'GUEST',
      items: items.map((i) => ({
        product_id: i.product_id,
        name: i.name,
        price: i.price,
        quantity: i.quantity,
        image_url: i.image_url,
      })),
      shipping_address: shippingAddress,
      payment_method: paymentMethod,
      payment_status: paymentMethod === 'COD' ? 'PENDING' : 'PAID',
      order_status: 'PLACED',
      subtotal,
      shipping_fee: shippingFee,
      total_amount: totalAmount,
      shipping_partner: 'Giao Hàng Nhanh (GHN)',
      tracking_number: trackingCode,
      estimated_delivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      notes: notes.trim() || undefined,
    };

    // 1. Lưu ngay đơn hàng vào LocalStorage để đảm bảo 100% không bị mất dù có sự cố mạng
    saveLocalOrder(newOrder);

    let finalOrderId = orderId;
    let paymentUrl: string | undefined;

    // 2. Đồng bộ giỏ hàng lên DynamoDB Carts table trước khi tạo đơn
    // Reset giỏ trước để tránh cộng dồn số lượng vượt tồn kho
    try {
      await apiClient.delete('/api/cart');
    } catch {
      // ignore
    }
    for (const it of items) {
      try {
        await apiClient.post('/api/cart', {
          product_id: it.product_id,
          quantity: it.quantity,
        });
      } catch (cartErr) {
        console.warn('Lỗi đồng bộ sản phẩm vào DynamoDB Cart:', it.product_id, cartErr);
      }
    }

    // 3. Gọi API Backend POST /api/orders tạo đơn hàng trực tiếp trong bảng Orders trên DynamoDB
    try {
      const res = await apiClient.post<{ order?: Order & { OrderID?: string }; order_id?: string; OrderID?: string; payment_url?: string }>(
        '/api/orders',
        {
          shipping_address: shippingAddressPayload,
          payment_method: paymentMethod,
          shipping_fee: shippingFee,
          subtotal: subtotal,
          total_amount: totalAmount,
          items: items,
        },
      );

      const serverOrderId = res?.order?.order_id || res?.order?.OrderID || res?.order_id || res?.OrderID;
      if (serverOrderId) {
        finalOrderId = serverOrderId;
        newOrder.order_id = finalOrderId;
        saveLocalOrder(newOrder);
      }
      if (res?.payment_url) {
        paymentUrl = res.payment_url;
      }
    } catch (err) {
      console.log('Order created locally, backend sync note:', err);
    }

    // 4. Đồng bộ trừ tồn kho trực tiếp trên bảng Products của DynamoDB (qua route server-side bảo mật)
    try {
      const clientAdminToken =
        (typeof window !== 'undefined' && window.localStorage.getItem('persistent_admin_token')) ||
        (typeof window !== 'undefined' && window.localStorage.getItem('admin_id_token')) ||
        undefined;

      await fetch('/api/inventory/deduct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
          clientAdminToken: clientAdminToken || undefined,
        }),
      });
    } catch (stockErr) {
      console.warn('Lỗi trừ kho server-side:', stockErr);
    }

    // Cập nhật tồn kho trong bộ nhớ local cho sản phẩm tương ứng
    for (const it of items) {
      try {
        const customList = getAdminCustomProducts();
        const target = customList.find((p) => (p.product_id || p.ProductID) === it.product_id);
        if (target) {
          updateProductStockInStorage(it.product_id, Math.max(0, target.stock - it.quantity));
        }
      } catch {}
    }

    // 5. Xóa giỏ hàng
    try {
      await clearCart();
    } catch {
      // ignore
    }

    // 6. Chuyển hướng
    if (paymentUrl) {
      window.location.href = paymentUrl;
    } else {
      router.push(`/order-success?order_id=${encodeURIComponent(finalOrderId)}&method=${paymentMethod}`);
    }
  }

  if (!isLoaded) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 animate-pulse space-y-6">
        <div className="h-6 bg-gray-200 rounded w-1/4" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 h-96 bg-gray-200 rounded-2xl" />
          <div className="h-96 bg-gray-200 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/" className="hover:text-orange-500 transition-colors">Trang chủ</Link>
        <span>/</span>
        <Link href="/cart" className="hover:text-orange-500 transition-colors">Giỏ hàng</Link>
        <span>/</span>
        <span className="text-gray-900 font-semibold">Thanh toán</span>
      </nav>

      <form onSubmit={handleSubmitOrder}>
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Cột trái: Thông tin nhận hàng & Phương thức thanh toán */}
          <div className="flex-1 space-y-6">
            {/* Box 1: Địa chỉ giao hàng */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <h2 className="font-bold text-gray-900 text-lg mb-4 flex items-center gap-2">
                <span>📍</span> Thông tin giao hàng
              </h2>

              {errorMessage && (
                <div className="mb-4 p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2 font-medium">
                  <span>⚠️</span> {errorMessage}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    Họ và tên người nhận <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Nguyễn Văn A"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    Số điện thoại nhận hàng <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="0901234567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    Email nhận thông báo đơn hàng
                  </label>
                  <input
                    type="email"
                    placeholder="example@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    Địa chỉ cụ thể (Số nhà, tên đường, ngõ) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: 123 Đường Điện Biên Phủ"
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    Phường / Xã
                  </label>
                  <input
                    type="text"
                    placeholder="Phường Đa Kao"
                    value={ward}
                    onChange={(e) => setWard(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    Quận / Huyện <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Quận 1"
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    Tỉnh / Thành phố <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="TP. Hồ Chí Minh"
                    value={province}
                    onChange={(e) => setProvince(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    Ghi chú đóng gói / giao hàng
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Giao giờ hành chính, gọi trước khi giao..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Box 2: Phương thức thanh toán */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <h2 className="font-bold text-gray-900 text-lg mb-4 flex items-center gap-2">
                <span>💳</span> Phương thức thanh toán
              </h2>

              <div className="space-y-3">
                {/* Option 1: COD */}
                <label
                  className={cn(
                    'flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all',
                    paymentMethod === 'COD'
                      ? 'border-orange-500 bg-orange-50/60 shadow-sm'
                      : 'border-gray-200 hover:bg-gray-50',
                  )}
                >
                  <input
                    type="radio"
                    name="payment_method"
                    value="COD"
                    checked={paymentMethod === 'COD'}
                    onChange={() => setPaymentMethod('COD')}
                    className="w-4 h-4 text-orange-500 border-gray-300 focus:ring-orange-400"
                  />
                  <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-lg flex-shrink-0">
                    💵
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-sm text-gray-900">Thanh toán khi nhận hàng (Ship COD)</p>
                    <p className="text-xs text-gray-500">Khách được kiểm tra hàng trước khi thanh toán tiền mặt cho shipper.</p>
                  </div>
                </label>

                {/* Option 2: VNPay */}
                <label
                  className={cn(
                    'flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all',
                    paymentMethod === 'VNPAY'
                      ? 'border-blue-500 bg-blue-50/60 shadow-sm'
                      : 'border-gray-200 hover:bg-gray-50',
                  )}
                >
                  <input
                    type="radio"
                    name="payment_method"
                    value="VNPAY"
                    checked={paymentMethod === 'VNPAY'}
                    onChange={() => setPaymentMethod('VNPAY')}
                    className="w-4 h-4 text-blue-500 border-gray-300 focus:ring-blue-400"
                  />
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs flex-shrink-0">
                    VNPAY
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-sm text-gray-900">Cổng thanh toán VNPay</p>
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded">
                        QR Pay / ATM / Visa
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">Quét mã VNPAY-QR từ ứng dụng ngân hàng hoặc thẻ ATM nội địa.</p>
                  </div>
                </label>

                {/* Option 3: MoMo */}
                <label
                  className={cn(
                    'flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all',
                    paymentMethod === 'MOMO'
                      ? 'border-pink-500 bg-pink-50/60 shadow-sm'
                      : 'border-gray-200 hover:bg-gray-50',
                  )}
                >
                  <input
                    type="radio"
                    name="payment_method"
                    value="MOMO"
                    checked={paymentMethod === 'MOMO'}
                    onChange={() => setPaymentMethod('MOMO')}
                    className="w-4 h-4 text-pink-500 border-gray-300 focus:ring-pink-400"
                  />
                  <div className="w-10 h-10 rounded-xl bg-pink-100 text-pink-600 flex items-center justify-center font-bold text-xs flex-shrink-0">
                    MoMo
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-sm text-gray-900">Ví điện tử MoMo</p>
                      <span className="px-2 py-0.5 bg-pink-100 text-pink-700 text-[10px] font-bold rounded">
                        Ví MoMo
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">Quét mã QR từ ứng dụng MoMo để thanh toán tức thì.</p>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Cột phải: Tóm tắt đơn hàng & Nút Xác nhận */}
          <div className="w-full lg:w-96 flex-shrink-0">
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm sticky top-24 space-y-5">
              <h2 className="font-bold text-gray-900 text-base">Đơn hàng của bạn ({items.length} món)</h2>

              {/* Items List Mini */}
              <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto pr-1">
                {items.map((item) => (
                  <div key={item.product_id} className="py-3 first:pt-0 last:pb-0 flex items-center gap-3">
                    <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 relative">
                      {item.image_url ? (
                        <Image
                          src={getImageUrl(item.image_url)}
                          alt={item.name}
                          fill
                          className="object-cover"
                          sizes="48px"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs">🏍️</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-900 line-clamp-1">{item.name}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">Số lượng: x{item.quantity}</p>
                    </div>
                    <p className="text-xs font-bold text-gray-900 flex-shrink-0">
                      {formatCurrencyVND(item.price * item.quantity)}
                    </p>
                  </div>
                ))}
              </div>

              {/* Pricing breakdown */}
              <div className="space-y-2.5 pt-3 border-t border-gray-100 text-xs">
                <div className="flex justify-between text-gray-600">
                  <span>Tạm tính tiền hàng:</span>
                  <span className="font-medium text-gray-900">{formatCurrencyVND(subtotal)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Phí giao hàng:</span>
                  <span className="font-medium text-gray-900">
                    {shippingFee === 0 ? <span className="text-green-600 font-bold">Miễn phí</span> : formatCurrencyVND(shippingFee)}
                  </span>
                </div>
                <div className="pt-2 border-t border-gray-200 flex justify-between items-baseline">
                  <span className="font-bold text-gray-900 text-sm">Tổng thanh toán:</span>
                  <span className="font-extrabold text-orange-600 text-lg">
                    {formatCurrencyVND(totalAmount)}
                  </span>
                </div>
              </div>

              {/* Submit CTA Button */}
              <button
                type="submit"
                disabled={isSubmitting || items.length === 0}
                className="w-full py-3.5 bg-orange-500 hover:bg-orange-400 text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Đang khởi tạo đơn hàng...
                  </span>
                ) : (
                  'Xác nhận đặt hàng →'
                )}
              </button>

              <div className="p-3 bg-gray-50 rounded-xl text-[11px] text-gray-500 space-y-1">
                <p>🔒 Cam kết bảo mật thông tin đơn hàng 100%.</p>
                <p>🔄 Đổi trả miễn phí trong vòng 7 ngày nếu lỗi do nhà sản xuất.</p>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
