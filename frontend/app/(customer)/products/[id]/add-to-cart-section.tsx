'use client';

// ============================================================
// app/(customer)/products/[id]/add-to-cart-section.tsx
// Client component xử lý Add to Cart + quantity selector
// ============================================================

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCart } from '@/hooks/use-cart';
import { cn } from '@/lib/utils';
import type { Product } from '@/types/product';

interface AddToCartSectionProps {
  product: Product;
}

export function AddToCartSection({ product }: AddToCartSectionProps) {
  const router = useRouter();
  const { addToCart } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);
  const [added, setAdded] = useState(false);

  const maxQty = product.stock;
  const isOutOfStock = maxQty === 0;

  const productId = product.product_id || product.ProductID || '';
  const rawImg = product.image_urls?.[0] || product.image_url;

  function changeQty(delta: number) {
    setQuantity((q) => Math.max(1, Math.min(maxQty, q + delta)));
  }

  async function handleAddToCart() {
    if (isAdding || isOutOfStock || !productId) return;
    setIsAdding(true);
    try {
      await addToCart(productId, quantity, {
        name: product.name,
        price: product.price,
        stock: product.stock,
        image_url: rawImg || '/placeholder-product.png',
      });
      setAdded(true);
      setTimeout(() => setAdded(false), 2500);
    } finally {
      setIsAdding(false);
    }
  }

  async function handleBuyNow() {
    if (isOutOfStock) return;
    await handleAddToCart();
    router.push('/cart');
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Quantity Selector */}
      {!isOutOfStock && (
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-gray-700">Số lượng:</span>
          <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden">
            <button
              onClick={() => changeQty(-1)}
              disabled={quantity <= 1}
              className="w-10 h-10 flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="Giảm số lượng"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
              </svg>
            </button>
            <span className="w-12 text-center font-semibold text-gray-800 text-sm">{quantity}</span>
            <button
              onClick={() => changeQty(1)}
              disabled={quantity >= maxQty}
              className="w-10 h-10 flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="Tăng số lượng"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
          {quantity >= maxQty && (
            <span className="text-xs text-red-500">Đã đạt giới hạn tồn kho</span>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleAddToCart}
          disabled={isAdding || isOutOfStock}
          className={cn(
            'flex-1 py-3 text-sm font-semibold rounded-xl transition-all',
            'border-2 focus:outline-none focus:ring-2 focus:ring-orange-400',
            isOutOfStock
              ? 'border-gray-200 text-gray-400 cursor-not-allowed bg-gray-50'
              : added
              ? 'border-green-400 text-green-700 bg-green-50'
              : 'border-orange-400 text-orange-600 hover:bg-orange-50',
          )}
        >
          {isAdding ? (
            <span className="flex items-center justify-center gap-2">
              <SpinnerIcon className="w-4 h-4 animate-spin" />
              Đang thêm...
            </span>
          ) : added ? (
            '✓ Đã thêm vào giỏ!'
          ) : isOutOfStock ? (
            'Hết hàng'
          ) : (
            '🛒 Thêm vào giỏ hàng'
          )}
        </button>

        <button
          onClick={handleBuyNow}
          disabled={isOutOfStock}
          className={cn(
            'flex-1 py-3 text-sm font-semibold rounded-xl transition-all',
            'bg-orange-500 hover:bg-orange-400 text-white',
            'focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2',
            isOutOfStock && 'opacity-50 cursor-not-allowed',
          )}
        >
          Mua ngay →
        </button>
      </div>
    </div>
  );
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
