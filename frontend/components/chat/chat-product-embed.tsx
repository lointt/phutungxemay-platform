'use client';

// ============================================================
// components/chat/chat-product-embed.tsx
// Card phụ tùng gợi ý nhúng trực tiếp trong bóng chat AI
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

export function ChatProductEmbed({ product }: ChatProductEmbedProps) {
  const { addToCart } = useCart();
  const [isAdding, setIsAdding] = useState(false);
  const [added, setAdded] = useState(false);

  const imageUrl = product.image_url ? getImageUrl(product.image_url) : '';

  async function handleAddToCart(e: React.MouseEvent) {
    e.preventDefault();
    if (isAdding) return;

    setIsAdding(true);
    try {
      await addToCart(product.product_id, 1, {
        name: product.name,
        price: product.price,
        stock: product.stock,
        image_url: product.image_url,
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
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={product.name}
              fill
              className="object-cover"
              sizes="64px"
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
