'use client';

// ============================================================
// components/customer/product-image-gallery.tsx
// Slider / Carousel xem ảnh sản phẩm với vuốt ngang & mũi tên
// ============================================================

import { useState, useRef, TouchEvent } from 'react';
import Image from 'next/image';
import { getImageUrl } from '@/lib/utils';

interface ProductImageGalleryProps {
  images: string[];
  productName: string;
  isOutOfStock?: boolean;
}

export function ProductImageGallery({
  images,
  productName,
  isOutOfStock = false,
}: ProductImageGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  const cleanImages = images.length > 0
    ? images
    : ['https://d1yvm1htsd670r.cloudfront.net/images/elig-em050.jpg'];

  const hasMultiple = cleanImages.length > 1;

  const goToPrev = () => {
    setCurrentIndex((prev) => (prev === 0 ? cleanImages.length - 1 : prev - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev === cleanImages.length - 1 ? 0 : prev + 1));
  };

  // Xử lý vuốt ngang (Touch Swipe) trên điện thoại và máy tính bảng
  const handleTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: TouchEvent<HTMLDivElement>) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    const distance = touchStartX.current - touchEndX.current;
    const minSwipeDistance = 40; // Pixel tối thiểu để nhận diện vuốt

    if (distance > minSwipeDistance) {
      goToNext(); // Vuốt sang trái -> Xem ảnh tiếp theo
    } else if (distance < -minSwipeDistance) {
      goToPrev(); // Vuốt sang phải -> Xem ảnh trước
    }

    touchStartX.current = null;
    touchEndX.current = null;
  };

  return (
    <div className="w-full select-none">
      {/* Khung hiển thị ảnh dạng Slider 1:1 chuẩn */}
      <div
        className="relative aspect-square w-full bg-gray-50 rounded-2xl overflow-hidden border border-gray-200/80 shadow-xs group"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <Image
          key={currentIndex}
          src={getImageUrl(cleanImages[currentIndex])}
          alt={`${productName} - Ảnh ${currentIndex + 1}`}
          fill
          unoptimized
          priority={currentIndex === 0}
          className="object-cover transition-opacity duration-300 animate-in fade-in"
          sizes="(max-width: 768px) 100vw, 50vw"
        />

        {/* Badge Hết hàng */}
        {isOutOfStock && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-2xs flex items-center justify-center z-10">
            <span className="bg-white/95 text-gray-900 font-bold px-5 py-2.5 rounded-full text-base shadow-lg">
              Hết hàng
            </span>
          </div>
        )}

        {/* Nút mũi tên lùi (Prev) */}
        {hasMultiple && (
          <button
            type="button"
            onClick={goToPrev}
            aria-label="Ảnh trước đó"
            className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/85 hover:bg-white text-gray-800 shadow-md backdrop-blur-xs flex items-center justify-center transition-all opacity-80 group-hover:opacity-100 hover:scale-105 active:scale-95 cursor-pointer z-10"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}

        {/* Nút mũi tên tiến (Next) */}
        {hasMultiple && (
          <button
            type="button"
            onClick={goToNext}
            aria-label="Ảnh tiếp theo"
            className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/85 hover:bg-white text-gray-800 shadow-md backdrop-blur-xs flex items-center justify-center transition-all opacity-80 group-hover:opacity-100 hover:scale-105 active:scale-95 cursor-pointer z-10"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}

        {/* Badge đếm số lượng ảnh (1 / 3) */}
        {hasMultiple && (
          <div className="absolute top-3.5 right-3.5 bg-black/60 backdrop-blur-xs text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow-xs pointer-events-none z-10">
            {currentIndex + 1} / {cleanImages.length}
          </div>
        )}

        {/* Dải chấm tròn phân trang (Pagination Dots) */}
        {hasMultiple && (
          <div className="absolute bottom-3.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/35 backdrop-blur-xs z-10">
            {cleanImages.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                aria-label={`Xem ảnh ${idx + 1}`}
                className={`transition-all duration-300 rounded-full cursor-pointer ${
                  idx === currentIndex
                    ? 'w-5 h-1.5 bg-orange-500 shadow-xs'
                    : 'w-1.5 h-1.5 bg-white/60 hover:bg-white'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
