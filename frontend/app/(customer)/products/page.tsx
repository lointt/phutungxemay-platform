// ============================================================
// app/(customer)/products/page.tsx — Trang danh mục & lọc sản phẩm
// ============================================================

import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ProductCard, ProductCardSkeleton } from '@/components/customer/product-card';
import ProductFilters from '@/components/customer/product-filters';
import { getProducts } from '@/lib/server-api';
import { getCategoryLabel } from '@/lib/utils';
import type { ProductCategory } from '@/types/product';

// searchParams là runtime data → block prerendering theo Next.js 16 cacheComponents mode
export const instant = false;

interface SearchParams {
  category?: string;
  search?: string;
  min_price?: string;
  max_price?: string;
  in_stock?: string;
  compatible_brand?: string;
  compatible_model?: string;
  page?: string;
}

interface Props {
  searchParams: Promise<SearchParams>;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = await searchParams;
  const category = params.category as ProductCategory | undefined;
  const search = params.search;

  const title = search
    ? `Tìm kiếm "${search}" | Phụ Tùng Xe Máy`
    : category
    ? `${getCategoryLabel(category)} | Phụ Tùng Xe Máy`
    : 'Tất Cả Phụ Tùng | Phụ Tùng Xe Máy';

  return {
    title,
    description: `Mua ${category ? getCategoryLabel(category) : 'phụ tùng xe máy'} chính hãng giá tốt. Giao hàng toàn quốc nhanh chóng.`,
  };
}

export default async function ProductsPage({ searchParams }: Props) {
  const params = await searchParams;
  const category = params.category as ProductCategory | undefined;

  const data = await getProducts({
    category,
    search: params.search,
    min_price: params.min_price ? Number(params.min_price) : undefined,
    max_price: params.max_price ? Number(params.max_price) : undefined,
    in_stock: params.in_stock === 'true',
    compatible_brand: params.compatible_brand,
    compatible_model: params.compatible_model,
  });

  const pageTitle = params.search
    ? `Kết quả tìm kiếm cho "${params.search}"`
    : category
    ? getCategoryLabel(category)
    : 'Tất cả sản phẩm';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <a href="/" className="hover:text-orange-500 transition-colors">Trang chủ</a>
        <span>/</span>
        <span className="text-gray-800 font-medium">{pageTitle}</span>
      </nav>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar Filters */}
        <aside className="lg:w-64 flex-shrink-0">
          <div className="sticky top-20 bg-white rounded-xl border border-gray-200 p-4">
            <Suspense fallback={<FilterSidebarSkeleton />}>
              <ProductFilters />
            </Suspense>
          </div>
        </aside>

        {/* Products Grid */}
        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <h1 className="text-xl font-bold text-gray-900">{pageTitle}</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {data.total > 0 ? `${data.total} sản phẩm` : 'Không tìm thấy sản phẩm nào'}
              </p>
            </div>
            {/* Sort (UI only, Phase 4 sẽ kết nối API) */}
            <select className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 text-gray-700">
              <option>Phổ biến nhất</option>
              <option>Giá tăng dần</option>
              <option>Giá giảm dần</option>
              <option>Mới nhất</option>
            </select>
          </div>

          {/* Compatible vehicle banner */}
          {params.compatible_brand && (
            <div className="flex items-center gap-3 mb-5 p-3 bg-orange-50 border border-orange-200 rounded-xl">
              <span className="text-xl">🏍️</span>
              <p className="text-sm text-orange-800">
                Đang hiển thị phụ tùng tương thích với{' '}
                <strong>{params.compatible_brand}{params.compatible_model ? ` ${params.compatible_model}` : ''}</strong>
              </p>
              <a href="/products" className="ml-auto text-xs text-orange-600 hover:underline flex-shrink-0">Xóa lọc</a>
            </div>
          )}

          {/* Grid */}
          {data.items.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
              {data.items.map((product) => (
                <ProductCard key={product.product_id} product={product} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="text-5xl mb-4">🔍</div>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">Không tìm thấy sản phẩm</h3>
              <p className="text-gray-500 text-sm mb-6">Thử thay đổi bộ lọc hoặc tìm kiếm với từ khóa khác</p>
              <a href="/products" className="px-5 py-2.5 bg-orange-500 hover:bg-orange-400 text-white text-sm font-semibold rounded-xl transition-colors">
                Xem tất cả sản phẩm
              </a>
            </div>
          )}

          {/* Pagination placeholder */}
          {data.has_next && (
            <div className="flex justify-center mt-8">
              <button className="px-6 py-3 border border-gray-200 text-sm font-medium text-gray-700 rounded-xl hover:bg-gray-50 transition-colors">
                Xem thêm sản phẩm
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterSidebarSkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="h-8 bg-gray-100 rounded-lg" />
      ))}
    </div>
  );
}
