// ============================================================
// app/(customer)/products/[id]/page.tsx — Chi tiết sản phẩm + SEO
// ============================================================

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { getProductById, getProducts } from '@/lib/server-api';
import { formatCurrencyVND, getCategoryLabel, getImageUrl } from '@/lib/utils';
import { AddToCartSection } from './add-to-cart-section';

// params là runtime data → block prerendering theo Next.js 16 cacheComponents mode
export const instant = false;

interface Props {
  params: Promise<{ id: string }>;
}

// ─── SEO: generateMetadata ────────────────────────────────────────────────────

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const product = await getProductById(id);

  if (!product) {
    return { title: 'Sản phẩm không tìm thấy' };
  }

  const imageUrl = product.image_urls[0] ? getImageUrl(product.image_urls[0]) : undefined;
  const compatibleText = (product.compatible_vehicles ?? [])
    .slice(0, 3)
    .map((v) => `${v.brand} ${v.model}`)
    .join(', ');

  return {
    title: `${product.name} | Phụ Tùng Xe Máy`,
    description: `${product.description.slice(0, 150)}. Tương thích: ${compatibleText}. Giá: ${formatCurrencyVND(product.price)}.`,
    openGraph: {
      title: product.name,
      description: product.description.slice(0, 150),
      images: imageUrl ? [{ url: imageUrl, alt: product.name, width: 800, height: 800 }] : [],
      type: 'website',
    },
    // Schema.org Product structured data
    other: {
      'product:price:amount': String(product.price),
      'product:price:currency': 'VND',
    },
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ProductDetailPage({ params }: Props) {
  const { id } = await params;
  const product = await getProductById(id);

  if (!product) notFound();

  const images = (product.image_urls ?? []).length > 0
    ? product.image_urls.map(getImageUrl)
    : ['/placeholder-product.png'];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/" className="hover:text-orange-500 transition-colors">Trang chủ</Link>
        <span>/</span>
        <Link href="/products" className="hover:text-orange-500 transition-colors">Sản phẩm</Link>
        <span>/</span>
        <Link href={`/products?category=${product.category}`} className="hover:text-orange-500 transition-colors">
          {getCategoryLabel(product.category)}
        </Link>
        <span>/</span>
        <span className="text-gray-800 font-medium truncate max-w-xs">{product.name}</span>
      </nav>

      <div className="grid md:grid-cols-2 gap-10 lg:gap-16">
        {/* ── Thư viện ảnh ─────────────────────────────────────────────────── */}
        <div className="space-y-3">
          {/* Main image */}
          <div className="relative aspect-square bg-gray-100 rounded-2xl overflow-hidden">
            <Image
              src={images[0]}
              alt={product.name}
              fill
              className="object-cover"
              priority
              sizes="(max-width: 768px) 100vw, 50vw"
            />
            {product.stock === 0 && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <span className="bg-white text-gray-800 font-semibold px-6 py-3 rounded-full text-lg">Hết hàng</span>
              </div>
            )}
          </div>

          {/* Thumbnail strip */}
          {images.length > 1 && (
            <div className="grid grid-cols-5 gap-2">
              {images.slice(1, 6).map((img, idx) => (
                <div key={idx} className="relative aspect-square bg-gray-100 rounded-xl overflow-hidden border-2 border-transparent hover:border-orange-400 cursor-pointer transition-colors">
                  <Image src={img} alt={`${product.name} ${idx + 2}`} fill className="object-cover" sizes="80px" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Thông tin sản phẩm ───────────────────────────────────────────── */}
        <div className="flex flex-col gap-5">
          {/* Category + Name */}
          <div>
            <span className="inline-block px-3 py-1 bg-orange-100 text-orange-700 text-xs font-semibold rounded-full mb-3">
              {getCategoryLabel(product.category)}
            </span>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 leading-tight">{product.name}</h1>
            <p className="text-sm text-gray-500 mt-2">SKU: {product.sku} | Thương hiệu: <span className="font-medium text-gray-700">{product.brand}</span></p>
          </div>

          {/* Price + Stock */}
          <div className="flex items-end gap-4">
            <p className="text-3xl font-extrabold text-orange-600">{formatCurrencyVND(product.price)}</p>
            <div className={`flex items-center gap-1.5 text-sm font-medium ${product.stock > 0 ? 'text-green-600' : 'text-red-500'}`}>
              <div className={`w-2 h-2 rounded-full ${product.stock > 0 ? 'bg-green-500' : 'bg-red-500'}`} />
              {product.stock > 0 ? `Còn ${product.stock} sản phẩm` : 'Hết hàng'}
            </div>
          </div>

          {/* Add to Cart — Client Component */}
          <AddToCartSection product={product} />

          {/* Description */}
          {product.description && (
            <div className="pt-4 border-t border-gray-100">
              <h3 className="font-semibold text-gray-800 mb-2">Mô tả sản phẩm</h3>
              <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-wrap">{product.description}</p>
            </div>
          )}

          {/* Compatible vehicles table */}
          {product.compatible_vehicles.length > 0 && (
            <div className="pt-4 border-t border-gray-100">
              <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <span>🏍️</span> Xe tương thích
              </h3>
              <div className="overflow-hidden rounded-xl border border-gray-200">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-2.5 font-medium text-gray-600">Hãng</th>
                      <th className="text-left px-4 py-2.5 font-medium text-gray-600">Model</th>
                      <th className="text-left px-4 py-2.5 font-medium text-gray-600">Đời xe</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {product.compatible_vehicles.map((v, idx) => (
                      <tr key={idx} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-2.5 text-gray-700 font-medium">{v.brand}</td>
                        <td className="px-4 py-2.5 text-gray-700">{v.model}</td>
                        <td className="px-4 py-2.5 text-gray-500">
                          {v.year_from === v.year_to ? v.year_from : `${v.year_from} – ${v.year_to}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Trust badges */}
          <div className="grid grid-cols-3 gap-3 pt-4 border-t border-gray-100">
            {[
              { icon: '✅', label: 'Chính hãng 100%' },
              { icon: '🔄', label: 'Đổi trả 7 ngày' },
              { icon: '🚚', label: 'Giao nhanh 2-3 ngày' },
            ].map((b) => (
              <div key={b.label} className="flex flex-col items-center text-center p-3 bg-gray-50 rounded-xl">
                <span className="text-xl mb-1">{b.icon}</span>
                <p className="text-xs text-gray-600 font-medium leading-tight">{b.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
