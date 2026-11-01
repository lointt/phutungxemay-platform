'use client';

// ============================================================
// components/chat/chat-product-embed.tsx
// Card phụ tùng gợi ý nhúng trực tiếp trong bóng chat AI
// Tự động đối chiếu mã ảnh thực tế và hiển thị fallback mượt mà
// ============================================================

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useCart } from '@/hooks/use-cart';
import { formatCurrencyVND, getImageUrl } from '@/lib/utils';
import type { ProductSummary } from '@/types/product';

interface ChatProductEmbedProps {
  product: ProductSummary;
}

// Bảng đối chiếu ảnh thực tế khi bot trả mã giả lập từ RAG cũ
const MOCK_IMAGE_FALLBACKS: Record<string, string> = {
  PROD_SPARK_001: '/images/bugi-ngk-iridium-real.jpg',
  PROD_SPARK_002: '/images/bugi-ngk-iridium-real.jpg',
  PROD_OIL_001: '/images/motul-300v-real.jpg',
  PROD_OIL_002: '/images/liqui-moly-scooter-real.jpg',
  PROD_OIL_003: '/images/motul-300v-real.jpg',
  PROD_BRAKE_001: '/images/elig-em050-real.jpg',
  PROD_BRAKE_002: '/images/heo-dau-brembo-real.jpg',
  PROD_BRAKE_003: '/images/dia-thang-rcb-real.jpg',
  PROD_DRIVE_001: '/images/did-428hds-real.jpg',
  PROD_DRIVE_002: '/images/nhong-sen-did-real.jpg',
  PROD_DRIVE_003: '/images/day-curoa-bando-real.jpg',
  PROD_SUSP_001: '/images/phuoc-yss-real.jpg',
  PROD_SUSP_002: '/images/phuoc-rcb-vd-real.jpg',
  PROD_TYRE_001: '/images/lop-michelin-pilot-real.jpg',
  PROD_TYRE_002: '/images/lop-maxxis-khong-ruot-real.jpg',
  PROD_BATT_001: '/images/ac-quy-globe-real.jpg',
  PROD_LIGHT_001: '/images/den-led-osram-real.jpg',
  PROD_EXHAUST_001: '/images/po-akrapovic-carbon-real.jpg',
  PROD_FILTER_001: '/images/loc-gio-k-n-real.jpg',
  PROD_ACC_001: '/images/kinh-hau-cnc-rcb-real.jpg',
};

export function ChatProductEmbed({ product }: ChatProductEmbedProps) {
  const { addToCart } = useCart();
  const [isAdding, setIsAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [fallbackAttempted, setFallbackAttempted] = useState(false);

  const pid = product.product_id || (product as unknown as Record<string, string>).ProductID || '';
  const initialUrl = product.image_url ? getImageUrl(product.image_url) : '';
  const fallbackUrl = MOCK_IMAGE_FALLBACKS[pid] ? getImageUrl(MOCK_IMAGE_FALLBACKS[pid]) : '';
  const displayUrl = fallbackAttempted ? fallbackUrl : (initialUrl || fallbackUrl);

  async function handleAddToCart(e: React.MouseEvent) {
    e.preventDefault();
    if (isAdding) return;

    setIsAdding(true);
    try {
      await addToCart(product.product_id, 1, {
        name: product.name,
        price: product.price,
        stock: product.stock,
        image_url: displayUrl || product.image_url,
      });
      setAdded(true);
      setTimeout(() => setAdded(false), 2500);
    } finally {
      setIsAdding(false);
    }
  }

  return (
    <div className="mt-3 bg-slate-50/80 rounded-xl border border-slate-200 p-3 shadow-sm hover:border-orange-300 transition-all text-slate-900">
      <div className="flex items-center gap-3">
        {/* Product Thumbnail */}
        <div className="w-16 h-16 bg-white rounded-lg overflow-hidden relative flex-shrink-0 border border-slate-200/80">
          {displayUrl ? (
            <Image
              src={displayUrl}
              alt={product.name}
              fill
              unoptimized
              className="object-cover"
              sizes="64px"
              onError={() => {
                if (!fallbackAttempted && fallbackUrl && fallbackUrl !== initialUrl) {
                  setFallbackAttempted(true);
                }
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-orange-500 bg-orange-50">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <span className="text-[10px] font-bold text-orange-600 uppercase tracking-wider block">
            Sản phẩm đề xuất
          </span>
          <Link
            href={`/products/${product.product_id}`}
            className="font-bold text-xs text-slate-900 hover:text-orange-600 line-clamp-2 transition-colors leading-snug mt-0.5 block"
          >
            {product.name}
          </Link>
          <p className="text-orange-600 font-extrabold text-sm mt-1">
            {formatCurrencyVND(product.price)}
          </p>
        </div>
      </div>

      {/* Buttons */}
      <div className="mt-2.5 flex gap-2 pt-2.5 border-t border-slate-200/70">
        <Link
          href={`/products/${product.product_id}`}
          className="flex-1 py-1.5 px-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-semibold text-xs rounded-lg text-center transition-colors"
        >
          Chi tiết
        </Link>
        <button
          type="button"
          onClick={handleAddToCart}
          disabled={isAdding}
          className={`flex-1 py-1.5 px-2.5 font-bold text-xs rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer ${
            added
              ? 'bg-emerald-600 text-white'
              : 'bg-orange-500 hover:bg-orange-600 text-white shadow-orange-500/20'
          }`}
        >
          {added ? 'Đã thêm vào giỏ' : 'Thêm vào giỏ'}
        </button>
      </div>
    </div>
  );
}
