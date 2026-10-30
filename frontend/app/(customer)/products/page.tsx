// ============================================================
// app/(customer)/products/page.tsx — Trang danh mục & lọc sản phẩm
// ============================================================

import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ProductsCatalog } from '@/components/customer/products-catalog';
import { ProductCardSkeleton } from '@/components/customer/product-card';
import { getProducts } from '@/lib/server-api';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Tất Cả Phụ Tùng | Phụ Tùng Xe Máy',
  description: 'Mua phụ tùng xe máy chính hãng giá tốt. Giao hàng toàn quốc nhanh chóng.',
};

async function ProductsInner() {
  const data = await getProducts();
  return <ProductsCatalog initialProducts={data.items} />;
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<ProductsPageSkeleton />}>
      <ProductsInner />
    </Suspense>
  );
}

function ProductsPageSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
