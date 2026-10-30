'use client';

// ============================================================
// components/customer/product-sort.tsx — Dropdown sắp xếp sản phẩm
// ============================================================

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

const SORT_OPTIONS = [
  { value: 'popular', label: 'Phổ biến nhất' },
  { value: 'price_asc', label: 'Giá tăng dần' },
  { value: 'price_desc', label: 'Giá giảm dần' },
  { value: 'newest', label: 'Mới nhất' },
] as const;

export function ProductSort() {
  return (
    <Suspense
      fallback={
        <select
          disabled
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700"
        >
          <option>Phổ biến nhất</option>
        </select>
      }
    >
      <ProductSortContent />
    </Suspense>
  );
}

function ProductSortContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentSort = searchParams.get('sort') || 'popular';

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    const params = new URLSearchParams(searchParams.toString());
    if (val && val !== 'popular') {
      params.set('sort', val);
    } else {
      params.delete('sort');
    }
    params.delete('page');
    const qs = params.toString();
    router.push(`/products${qs ? `?${qs}` : ''}`);
  }

  return (
    <select
      value={currentSort}
      onChange={handleChange}
      aria-label="Sắp xếp sản phẩm"
      className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 text-gray-700 cursor-pointer"
    >
      {SORT_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

