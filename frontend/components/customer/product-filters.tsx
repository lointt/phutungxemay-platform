'use client';

// ============================================================
// components/customer/product-filters.tsx — Bộ lọc sản phẩm
// ============================================================

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useState } from 'react';
import { cn } from '@/lib/utils';

const CATEGORIES: { value: string; label: string }[] = [
  { value: 'Truyền động', label: 'Truyền động' },
  { value: 'Động cơ', label: 'Động cơ' },
  { value: 'Giảm xóc', label: 'Giảm xóc' },
  { value: 'Hệ thống phanh', label: 'Hệ thống phanh' },
  { value: 'Điện - Đèn', label: 'Điện - Đèn' },
  { value: 'Nhớt - Lọc', label: 'Nhớt - Lọc' },
  { value: 'Lốp - Vỏ xe', label: 'Lốp - Vỏ xe' },
  { value: 'Phụ kiện - Pô xe', label: 'Phụ kiện - Pô xe' },
];

const PRICE_RANGES = [
  { label: 'Tất cả', min: undefined, max: undefined },
  { label: 'Dưới 100.000đ', min: undefined, max: 100000 },
  { label: '100.000 - 500.000đ', min: 100000, max: 500000 },
  { label: '500.000 - 2.000.000đ', min: 500000, max: 2000000 },
  { label: 'Trên 2.000.000đ', min: 2000000, max: undefined },
];

export default function ProductFilters() {
  return (
    <Suspense fallback={<FilterSkeleton />}>
      <ProductFiltersContent />
    </Suspense>
  );
}

function ProductFiltersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentCategory = searchParams.get('category');
  const currentMinPrice = searchParams.get('min_price');
  const currentMaxPrice = searchParams.get('max_price');
  const currentInStock = searchParams.get('in_stock') === 'true';

  const updateFilter = useCallback(
    (updates: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      }
      // Reset về trang 1 khi filter thay đổi
      params.delete('page');
      router.push(`/products?${params.toString()}`);
    },
    [router, searchParams],
  );

  const clearAllFilters = () => {
    const params = new URLSearchParams();
    const search = searchParams.get('search');
    if (search) params.set('search', search);
    router.push(`/products${params.toString() ? `?${params.toString()}` : ''}`);
  };

  const hasActiveFilters = currentCategory || currentMinPrice || currentMaxPrice || currentInStock;

  return (
    <aside className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-800 flex items-center gap-2">
          <svg className="w-4 h-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          Lọc sản phẩm
        </h2>
        {hasActiveFilters && (
          <button onClick={clearAllFilters} className="text-xs text-orange-500 hover:text-orange-400 font-medium transition-colors">
            Xóa bộ lọc
          </button>
        )}
      </div>

      {/* Danh mục */}
      <FilterSection title="Danh mục" defaultOpen>
        <div className="space-y-1">
          <button
            onClick={() => updateFilter({ category: undefined })}
            className={cn(
              'w-full text-left px-3 py-2 text-sm rounded-lg transition-colors',
              !currentCategory
                ? 'bg-orange-50 text-orange-600 font-medium'
                : 'text-gray-600 hover:bg-gray-50',
            )}
          >
            Tất cả danh mục
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => updateFilter({ category: cat.value })}
              className={cn(
                'w-full text-left px-3 py-2 text-sm rounded-lg transition-colors',
                currentCategory === cat.value
                  ? 'bg-orange-50 text-orange-600 font-medium'
                  : 'text-gray-600 hover:bg-gray-50',
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </FilterSection>

      {/* Khoảng giá */}
      <FilterSection title="Khoảng giá" defaultOpen>
        <div className="space-y-1">
          {PRICE_RANGES.map((range) => {
            const isActive =
              String(range.min ?? '') === (currentMinPrice ?? '') &&
              String(range.max ?? '') === (currentMaxPrice ?? '');
            return (
              <button
                key={range.label}
                onClick={() =>
                  updateFilter({
                    min_price: range.min ? String(range.min) : undefined,
                    max_price: range.max ? String(range.max) : undefined,
                  })
                }
                className={cn(
                  'w-full text-left px-3 py-2 text-sm rounded-lg transition-colors',
                  isActive
                    ? 'bg-orange-50 text-orange-600 font-medium'
                    : 'text-gray-600 hover:bg-gray-50',
                )}
              >
                {range.label}
              </button>
            );
          })}
        </div>
      </FilterSection>

      {/* Tình trạng kho */}
      <FilterSection title="Tình trạng" defaultOpen>
        <label className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50 rounded-lg transition-colors">
          <input
            type="checkbox"
            checked={currentInStock}
            onChange={(e) =>
              updateFilter({ in_stock: e.target.checked ? 'true' : undefined })
            }
            className="w-4 h-4 text-orange-500 border-gray-300 rounded focus:ring-orange-400"
          />
          <span className="text-sm text-gray-700">Chỉ còn hàng</span>
        </label>
      </FilterSection>
    </aside>
  );
}

// ─── Accordion Section ────────────────────────────────────────────────────────

function FilterSection({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-gray-100 pt-4 mt-4">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between w-full mb-3 text-sm font-semibold text-gray-700"
      >
        {title}
        <svg className={cn('w-4 h-4 text-gray-400 transition-transform', open && 'rotate-180')} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && children}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function FilterSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-5 bg-gray-200 rounded w-1/2" />
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-9 bg-gray-100 rounded-lg" />
      ))}
    </div>
  );
}
