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
    <div className="mt-3 bg-white rounded-xl border border-orange-200/80 p-3 shadow-sm hover:shadow-md transition-all text-gray-900">
      <div className="flex items-center gap-3">
        {/* Product Thumbnail */}
        <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden relative flex-shrink-0 border border-gray-100">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={product.name}
              fill
              className="object-cover"
              sizes="64px"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-orange-400 bg-orange-50 text-xl">
              🏍️
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <span className="text-[10px] font-bold text-orange-600 uppercase tracking-wider block">
            ⭐ Gợi ý từ Kỹ Sư AI
          </span>
          <Link
            href={`/products/${product.product_id}`}
            className="font-bold text-xs text-gray-900 hover:text-orange-600 line-clamp-2 transition-colors leading-snug mt-0.5"
          >
            {product.name}
          </Link>
          <p className="text-orange-600 font-extrabold text-sm mt-1">
            {formatCurrencyVND(product.price)}
          </p>
        </div>
      </div>

      {/* Buttons */}
      <div className="mt-3 flex gap-2 pt-2 border-t border-gray-100">
        <Link
          href={`/products/${product.product_id}`}
          className="flex-1 py-1.5 px-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs rounded-lg text-center transition-colors"
        >
          Xem chi tiết
        </Link>
        <button
          onClick={handleAddToCart}
          disabled={isAdding}
          className={`flex-1 py-1.5 px-2 font-bold text-xs rounded-lg transition-all flex items-center justify-center gap-1 shadow-sm ${
            added
              ? 'bg-green-500 text-white'
              : 'bg-orange-500 hover:bg-orange-400 text-white shadow-orange-500/25'
          }`}
        >
          {added ? '✓ Đã thêm vào giỏ' : '🛒 Thêm vào giỏ'}
        </button>
      </div>
    </div>
  );
}
