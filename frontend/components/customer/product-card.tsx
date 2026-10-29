'use client';

// ============================================================
// components/customer/product-card.tsx
// ============================================================

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useCart } from '@/hooks/use-cart';
import { cn, formatCurrencyVND, getCategoryLabel, getImageUrl } from '@/lib/utils';
import type { Product } from '@/types/product';

interface ProductCardProps {
  product: Product;
  /** Hiển thị dạng ngang (horizontal) trong trang chi tiết / cart */
  horizontal?: boolean;
}

export function ProductCard({ product, horizontal = false }: ProductCardProps) {
  const { addToCart } = useCart();
  const [isAdding, setIsAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [imgError, setImgError] = useState(false);

  const productId = product.product_id || product.ProductID || '';
  const rawImg = product.image_urls?.[0] || product.image_url;
  const imageUrl = rawImg ? getImageUrl(rawImg) : '';

  const modelsList =
    product.compatible_models && product.compatible_models.length > 0
      ? product.compatible_models
      : (product.compatible_vehicles ?? []).map((v) => `${v.brand} ${v.model}`);

  const compatibleLabel = modelsList.slice(0, 2).join(', ');
  const isOutOfStock = (product.stock ?? 0) === 0;

  async function handleAddToCart(e: React.MouseEvent) {
    e.preventDefault(); // Không navigate vào product detail
    if (isAdding || isOutOfStock || !productId) return;

    setIsAdding(true);
    try {
      await addToCart(productId, 1, {
        name: product.name,
        price: product.price,
        stock: product.stock,
        image_url: imageUrl || '/placeholder-product.png',
      });
      setAdded(true);
      setTimeout(() => setAdded(false), 2000);
    } catch {
      // ignore
    } finally {
      setIsAdding(false);
    }
  }

  if (horizontal) {
    return (
      <div className="flex gap-4 p-4 bg-white rounded-xl border border-gray-200 hover:border-orange-200 hover:shadow-md transition-all">
        <div className="relative w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
          {imageUrl && !imgError ? (
            <Image
              src={imageUrl}
              alt={product.name}
              fill
              className="object-cover"
              sizes="96px"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-orange-100 to-amber-50 flex items-center justify-center text-orange-400">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <Link href={`/products/${productId}`} className="font-semibold text-gray-800 hover:text-orange-600 line-clamp-2 transition-colors">
            {product.name}
          </Link>
          <p className="text-xs text-gray-500 mt-1">{getCategoryLabel(product.category)}</p>
          <p className="text-orange-600 font-bold mt-2">{formatCurrencyVND(product.price)}</p>
        </div>
      </div>
    );
  }

  return (
    <Link
      href={`/products/${productId}`}
      className="group flex flex-col bg-white rounded-xl border border-gray-200 hover:border-orange-200 hover:shadow-lg transition-all overflow-hidden"
    >
      {/* Product Image */}
      <div className="relative aspect-square bg-gray-100 overflow-hidden flex items-center justify-center">
        {imageUrl && !imgError ? (
          <Image
            src={imageUrl}
            alt={product.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-orange-50 via-amber-50 to-orange-100 flex flex-col items-center justify-center text-orange-400 p-4 text-center">
            <svg className="w-12 h-12 mb-2 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            <span className="text-[11px] font-medium text-gray-500 line-clamp-1">{product.brand || 'Phụ Tùng'}</span>
          </div>
        )}

        {isOutOfStock && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="bg-white text-gray-800 text-xs font-semibold px-3 py-1 rounded-full">Hết hàng</span>
          </div>
        )}
        {product.stock > 0 && product.stock <= 5 && (
          <div className="absolute top-2 right-2">
            <span className="bg-red-100 text-red-700 text-xs font-medium px-2 py-0.5 rounded-full">
              Còn {product.stock}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-3 gap-2">
        <div>
          <p className="text-xs text-orange-500 font-medium mb-1">{getCategoryLabel(product.category)}</p>
          <h3 className="text-sm font-semibold text-gray-800 line-clamp-2 group-hover:text-orange-600 transition-colors leading-snug">
            {product.name}
          </h3>
          {compatibleLabel && (
            <p className="text-xs text-gray-400 mt-1 line-clamp-1" title={compatibleLabel}>
              🏍️ {compatibleLabel}
              {modelsList.length > 2 && ` +${modelsList.length - 2}`}
            </p>
          )}
        </div>

        <div className="mt-auto flex items-center justify-between gap-2">
          <p className="text-orange-600 font-bold text-base">{formatCurrencyVND(product.price)}</p>
          <button
            onClick={handleAddToCart}
            disabled={isAdding || isOutOfStock}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex-shrink-0 cursor-pointer',
              isOutOfStock
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : added
                ? 'bg-green-500 text-white'
                : 'bg-orange-500 hover:bg-orange-400 text-white',
            )}
            aria-label={`Thêm ${product.name} vào giỏ hàng`}
          >
            {isAdding ? (
              <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : added ? (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            )}
            {added ? 'Đã thêm' : 'Thêm'}
          </button>
        </div>
      </div>
    </Link>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

export function ProductCardSkeleton() {
  return (
    <div className="flex flex-col bg-white rounded-xl border border-gray-200 overflow-hidden animate-pulse">
      <div className="aspect-square bg-gray-200" />
      <div className="p-3 space-y-2">
        <div className="h-3 bg-gray-200 rounded w-1/3" />
        <div className="h-4 bg-gray-200 rounded w-full" />
        <div className="h-4 bg-gray-200 rounded w-4/5" />
        <div className="h-3 bg-gray-200 rounded w-3/5 mt-1" />
        <div className="flex items-center justify-between mt-2">
          <div className="h-5 bg-gray-200 rounded w-24" />
          <div className="h-7 bg-gray-200 rounded w-16" />
        </div>
      </div>
    </div>
  );
}
