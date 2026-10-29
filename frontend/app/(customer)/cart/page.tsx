'use client';

// ============================================================
// app/(customer)/cart/page.tsx — Trang giỏ hàng người dùng
// Đồng bộ realtime với CartContext, Optimistic UI & tồn kho
// ============================================================

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useCart } from '@/hooks/use-cart';
import { cn, formatCurrencyVND, getImageUrl } from '@/lib/utils';

export default function CartPage() {
  const router = useRouter();
  const { items, subtotal, itemCount, updateQuantity, removeFromCart, clearCart } = useCart();

  const [voucherCode, setVoucherCode] = useState('');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [voucherMessage, setVoucherMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Phí vận chuyển: Miễn phí nếu đơn >= 500k, ngược lại 30.000đ
  const shippingFee = subtotal >= 500000 || subtotal === 0 ? 0 : 30000;
  const finalTotal = Math.max(0, subtotal + shippingFee - discountAmount);

  function handleApplyVoucher(e: React.FormEvent) {
    e.preventDefault();
    const code = voucherCode.trim().toUpperCase();
    if (!code) return;

    if (code === 'PHUTUNG50') {
      setDiscountAmount(50000);
      setVoucherMessage({ type: 'success', text: 'Đã áp dụng mã giảm giá 50.000đ!' });
    } else if (code === 'FREESHIP') {
      setDiscountAmount(shippingFee);
      setVoucherMessage({ type: 'success', text: 'Đã áp dụng mã miễn phí vận chuyển!' });
    } else {
      setVoucherMessage({ type: 'error', text: 'Mã giảm giá không hợp lệ hoặc đã hết hạn.' });
    }
  }

  if (items.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="w-24 h-24 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl shadow-inner">
          🛒
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Giỏ hàng của bạn đang trống</h1>
        <p className="text-sm text-gray-500 max-w-md mx-auto mb-8">
          Bạn chưa chọn món phụ tùng nào. Hãy khám phá ngay các sản phẩm phụ tùng xe máy chính hãng chất lượng cao!
        </p>
        <Link
          href="/products"
          className="inline-flex items-center gap-2 px-8 py-3.5 bg-orange-500 hover:bg-orange-400 text-white font-bold rounded-xl transition-all shadow-lg shadow-orange-500/25"
        >
          Khám phá phụ tùng ngay →
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/" className="hover:text-orange-500 transition-colors">Trang chủ</Link>
        <span>/</span>
        <span className="text-gray-900 font-semibold">Giỏ hàng ({itemCount})</span>
      </nav>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Cột trái: Danh sách phụ tùng trong giỏ */}
        <div className="flex-1 min-w-0">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h1 className="font-bold text-gray-900 text-lg">
                Giỏ hàng của bạn <span className="text-gray-400 font-normal text-sm">({itemCount} món)</span>
              </h1>
              <button
                onClick={clearCart}
                className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors flex items-center gap-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Xóa tất cả
              </button>
            </div>

            <div className="divide-y divide-gray-100">
              {items.map((item) => {
                const isOverStock = item.stock > 0 && item.quantity > item.stock;

                return (
                  <div
                    key={item.product_id}
                    className={cn(
                      'p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-colors',
                      isOverStock && 'bg-red-50/50',
                    )}
                  >
                    {/* Image & Title */}
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="w-20 h-20 bg-gray-100 rounded-xl overflow-hidden flex-shrink-0 relative border border-gray-100">
                        {item.image_url ? (
                          <Image
                            src={getImageUrl(item.image_url)}
                            alt={item.name}
                            fill
                            className="object-cover"
                            sizes="80px"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-orange-400 bg-orange-50">
                            🏍️
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/products/${item.product_id}`}
                          className="font-bold text-gray-900 text-sm hover:text-orange-600 transition-colors line-clamp-2"
                        >
                          {item.name}
                        </Link>
                        <p className="text-orange-600 font-extrabold text-sm mt-1">
                          {formatCurrencyVND(item.price)}
                        </p>
                        {isOverStock && (
                          <p className="text-xs text-red-600 font-medium mt-1">
                            ⚠️ Vượt quá tồn kho thực tế (kho còn {item.stock})
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Quantity & Total */}
                    <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-0 border-gray-100">
                      {/* Quantity Selector */}
                      <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
                        <button
                          onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                          className="w-9 h-9 flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors"
                          aria-label="Giảm"
                        >
                          -
                        </button>
                        <span className="w-10 text-center font-bold text-sm text-gray-800">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                          disabled={item.stock > 0 && item.quantity >= item.stock}
                          className="w-9 h-9 flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-40 transition-colors"
                          aria-label="Tăng"
                        >
                          +
                        </button>
                      </div>

                      {/* Item Total */}
                      <div className="text-right min-w-[100px]">
                        <p className="font-extrabold text-gray-900 text-base">
                          {formatCurrencyVND(item.price * item.quantity)}
                        </p>
                      </div>

                      {/* Remove */}
                      <button
                        onClick={() => removeFromCart(item.product_id)}
                        className="text-gray-400 hover:text-red-500 p-1.5 rounded-lg transition-colors"
                        title="Xóa món này"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Cột phải: Tóm tắt đơn hàng & Checkout */}
        <div className="w-full lg:w-96 flex-shrink-0">
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm sticky top-24 space-y-5">
            <h2 className="font-bold text-gray-900 text-base">Tóm tắt đơn hàng</h2>

            {/* Voucher Form */}
            <form onSubmit={handleApplyVoucher} className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Mã voucher (VD: PHUTUNG50)"
                  value={voucherCode}
                  onChange={(e) => setVoucherCode(e.target.value)}
                  className="flex-1 px-3.5 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 uppercase font-mono"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-xs font-semibold rounded-xl transition-colors"
                >
                  Áp dụng
                </button>
              </div>
              {voucherMessage && (
                <p
                  className={cn(
                    'text-[11px] font-medium',
                    voucherMessage.type === 'success' ? 'text-green-600' : 'text-red-500',
                  )}
                >
                  {voucherMessage.text}
                </p>
              )}
            </form>

            <div className="space-y-3 pt-3 border-t border-gray-100 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Tạm tính tiền hàng:</span>
                <span className="font-medium text-gray-900">{formatCurrencyVND(subtotal)}</span>
              </div>

              <div className="flex justify-between text-gray-600">
                <span>Phí vận chuyển dự kiến:</span>
                <span className="font-medium text-gray-900">
                  {shippingFee === 0 ? (
                    <span className="text-green-600 font-bold">Miễn phí</span>
                  ) : (
                    formatCurrencyVND(shippingFee)
                  )}
                </span>
              </div>

              {discountAmount > 0 && (
                <div className="flex justify-between text-green-600 font-semibold">
                  <span>Giảm giá voucher:</span>
                  <span>-{formatCurrencyVND(discountAmount)}</span>
                </div>
              )}

              {subtotal < 500000 && (
                <p className="text-[11px] text-orange-600 bg-orange-50 p-2 rounded-lg">
                  💡 Mua thêm <strong>{formatCurrencyVND(500000 - subtotal)}</strong> để được <strong>MIỄN PHÍ VẬN CHUYỂN</strong> toàn quốc!
                </p>
              )}

              <div className="pt-3 border-t border-gray-200 flex justify-between items-baseline">
                <span className="font-bold text-gray-900 text-base">Tổng thanh toán:</span>
                <span className="font-extrabold text-orange-600 text-xl">
                  {formatCurrencyVND(finalTotal)}
                </span>
              </div>
            </div>

            <button
              onClick={() => router.push('/checkout')}
              className="w-full py-3.5 bg-orange-500 hover:bg-orange-400 text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2"
            >
              Tiến hành thanh toán →
            </button>

            <div className="pt-2 text-center">
              <Link href="/products" className="text-xs text-gray-500 hover:text-orange-600 transition-colors">
                ← Tiếp tục tìm mua phụ tùng khác
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
