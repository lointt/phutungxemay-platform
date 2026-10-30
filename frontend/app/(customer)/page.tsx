// ============================================================
// app/(customer)/page.tsx — Trang chủ (Server Component + SSR)
// ============================================================

import type { Metadata } from 'next';
import Link from 'next/link';
import { VehicleSelector } from '@/components/customer/vehicle-selector';
import { ProductCard, ProductCardSkeleton } from '@/components/customer/product-card';
import { getFeaturedProducts } from '@/lib/server-api';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Phụ Tùng Xe Máy - Chính Hãng, Giá Tốt, Giao Nhanh',
  description: 'Mua phụ tùng xe máy chính hãng giá tốt nhất. Tư vấn kỹ thuật trực tuyến 24/7. Giao hàng toàn quốc nhanh chóng.',
  openGraph: {
    title: 'Phụ Tùng Xe Máy - Chính Hãng, Giá Tốt, Giao Nhanh',
    description: 'Mua phụ tùng xe máy chính hãng giá tốt nhất. Tư vấn kỹ thuật trực tuyến 24/7.',
    type: 'website',
  },
};

export default async function HomePage() {
  const featuredProducts = await getFeaturedProducts();

  return (
    <div className="flex flex-col">
      {/* ── Hero Banner ─────────────────────────────────────────────────────── */}
      <section className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-orange-950 text-white overflow-hidden">
        {/* Decorative background */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl -translate-x-1/2 translate-y-1/2" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 md:py-24">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-orange-500/20 border border-orange-500/30 rounded-full px-3 py-1 text-xs sm:text-sm text-orange-300 mb-5 sm:mb-6">
                <span className="w-2 h-2 bg-orange-400 rounded-full animate-pulse" />
                Hỗ trợ tư vấn 24/7
              </div>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold leading-tight mb-5 sm:mb-6">
                Phụ Tùng{' '}
                <span className="text-orange-400 whitespace-nowrap">Chính Hãng</span>
                <br />
                Giá Tốt Nhất
              </h1>
              <p className="text-slate-300 text-base sm:text-lg mb-7 sm:mb-8 leading-relaxed">
                Hơn 10.000 phụ tùng xe máy các loại. Tư vấn miễn phí trực tuyến 24/7 — chẩn đoán bệnh xe, gợi ý linh kiện phù hợp.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/products"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-400 text-white font-semibold rounded-xl transition-colors shadow-lg shadow-orange-500/30"
                >
                  Mua sắm ngay
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </Link>
              </div>

              {/* Stats */}
              <div className="flex gap-6 sm:gap-8 mt-8 sm:mt-10 pt-6 sm:pt-8 border-t border-white/10">
                {[
                  { value: '10.000+', label: 'Sản phẩm' },
                  { value: '50.000+', label: 'Khách hàng' },
                  { value: '4.9 ⭐', label: 'Đánh giá' },
                ].map((stat) => (
                  <div key={stat.label}>
                    <p className="text-xl sm:text-2xl font-bold text-white">{stat.value}</p>
                    <p className="text-xs sm:text-sm text-slate-400">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Hero Logo & Emblem Illustration */}
            <div className="hidden md:flex justify-center">
              <div className="relative w-80 h-80 lg:w-96 lg:h-96 flex items-center justify-center">
                <div className="absolute inset-0 bg-gradient-to-tr from-orange-500/35 via-amber-500/20 to-transparent rounded-full blur-3xl" />
                <div className="relative w-72 h-72 lg:w-80 lg:h-80 rounded-[2rem] overflow-hidden border-2 border-orange-500/40 shadow-2xl shadow-orange-950/70 group">
                  <img
                    src="/brand-logo.png?v=2"
                    alt="Phụ Tùng Xe Máy Chính Hãng"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                {/* Floating badge */}
                <div className="absolute -bottom-3 -left-4 bg-slate-900/90 backdrop-blur-md border border-orange-500/30 rounded-2xl px-4 py-2.5 shadow-xl flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-xs font-bold text-white tracking-wide">Chính Hãng 100%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Vehicle Selector ────────────────────────────────────────────────── */}
      <section className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 -mt-6 relative z-10">
        <VehicleSelector />
      </section>

      {/* ── Features ────────────────────────────────────────────────────────── */}
      <section className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {[
            { icon: '🏷️', title: 'Chính hãng 100%', desc: 'Cam kết hàng chính hãng, có bảo hành' },
            { icon: '🚀', title: 'Giao hàng nhanh', desc: 'GHN/GHTK, giao trong 2-3 ngày' },
            { icon: '🔄', title: 'Đổi trả 7 ngày', desc: 'Hoàn tiền nếu hàng lỗi do NSX' },
            { icon: '🤖', title: 'Tư vấn AI 24/7', desc: 'Trợ lý AI chẩn đoán bệnh xe miễn phí' },
          ].map((f) => (
            <div key={f.title} className="flex flex-col items-center text-center p-4 sm:p-5 bg-white rounded-xl border border-gray-100 hover:border-orange-200 hover:shadow-md transition-all">
              <span className="text-2xl sm:text-3xl mb-2.5 sm:mb-3">{f.icon}</span>
              <h3 className="font-semibold text-gray-800 text-xs sm:text-sm mb-1">{f.title}</h3>
              <p className="text-[11px] sm:text-xs text-gray-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Featured Products ────────────────────────────────────────────────── */}
      <section className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Sản phẩm nổi bật</h2>
            <p className="text-gray-500 text-xs sm:text-sm mt-1">Phụ tùng được mua nhiều nhất</p>
          </div>
          <Link
            href="/products"
            className="text-sm font-medium text-orange-500 hover:text-orange-400 flex items-center gap-1 transition-colors"
          >
            Xem tất cả
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>

        {featuredProducts.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-4">
            {featuredProducts.map((product) => (
              <ProductCard key={product.product_id} product={product} />
            ))}
          </div>
        ) : (
          /* Skeleton khi chưa có data từ API (dev/staging) */
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
