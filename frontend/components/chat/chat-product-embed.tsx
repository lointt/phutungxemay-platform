'use client';

// ============================================================
// components/chat/chat-product-embed.tsx
// Card phụ tùng gợi ý nhúng trực tiếp trong bóng chat AI
// Tự động map sản phẩm giả lập từ RAG cũ sang sản phẩm thật 100%
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

interface RealProductInfo {
  product_id: string;
  name: string;
  price: number;
  stock: number;
  image_url: string;
}

// Bảng đối chiếu chính xác từ mã giả lập (RAG cũ) sang 32 sản phẩm thực tế đang bán trên website
const MOCK_TO_REAL_MAP: Record<string, RealProductInfo> = {
  // Bugi
  PROD_SPARK_001: {
    product_id: 'PROD_ELC_010',
    name: 'Bugi NGK Iridium CPR8EAIX-9 bạch kim đánh lửa mạnh',
    price: 240000,
    stock: 45,
    image_url: '/images/bugi-ngk-iridium-real.jpg',
  },
  PROD_SPARK_002: {
    product_id: 'PROD_ELC_010',
    name: 'Bugi NGK Iridium CPR8EAIX-9 bạch kim đánh lửa mạnh',
    price: 240000,
    stock: 45,
    image_url: '/images/bugi-ngk-iridium-real.jpg',
  },
  // Nhớt & Hóa chất
  PROD_OIL_001: {
    product_id: 'PROD_OIL_010',
    name: 'Nhớt Motul 300V Factory Line Road Racing 10W40 1L',
    price: 420000,
    stock: 40,
    image_url: '/images/motul-300v-real.jpg',
  },
  PROD_OIL_002: {
    product_id: 'PROD_OIL_011',
    name: 'Nhớt tay ga Liqui Moly Molygen Scooter 5W30 0.8L',
    price: 265000,
    stock: 35,
    image_url: '/images/liqui-moly-scooter-real.jpg',
  },
  PROD_OIL_003: {
    product_id: 'PROD_OIL_014',
    name: 'Nước làm mát két nước Motul Motocool Expert 1L',
    price: 175000,
    stock: 30,
    image_url: '/images/nuoc-lam-mat-motul-real.jpg',
  },
  // Phanh & Thắng
  PROD_BRAKE_001: {
    product_id: 'PROD_BRK_010',
    name: 'Bố thắng đĩa trước Elig EM050 Ceramic',
    price: 150000,
    stock: 60,
    image_url: '/images/elig-em050-real.jpg',
  },
  PROD_BRK_001: {
    product_id: 'PROD_BRK_010',
    name: 'Bố thắng đĩa trước Elig EM050 Ceramic',
    price: 150000,
    stock: 60,
    image_url: '/images/elig-em050-real.jpg',
  },
  PROD_BRAKE_002: {
    product_id: 'PROD_BRK_012',
    name: 'Đĩa thắng RCB lòng nhôm CNC 245mm',
    price: 650000,
    stock: 25,
    image_url: '/images/dia-thang-rcb-real.jpg',
  },
  PROD_BRAKE_003: {
    product_id: 'PROD_BRK_013',
    name: 'Tay thắng bình dầu RCB E2 chính hãng',
    price: 520000,
    stock: 20,
    image_url: '/images/tay-thang-rcb-real.jpg',
  },
  // Nhông sên dĩa & Truyền động
  PROD_DRIVE_001: {
    product_id: 'PROD_DRV_010',
    name: 'Bộ nhông sên dĩa DID 428HDS Vàng 10 ly',
    price: 480000,
    stock: 35,
    image_url: '/images/did-428hds-real.jpg',
  },
  PROD_DRV_002: {
    product_id: 'PROD_DRV_010',
    name: 'Bộ nhông sên dĩa DID 428HDS Vàng 10 ly',
    price: 480000,
    stock: 35,
    image_url: '/images/did-428hds-real.jpg',
  },
  PROD_DRIVE_002: {
    product_id: 'PROD_DRV_012',
    name: 'Dây curoa Bando chính hãng Nhật Bản',
    price: 390000,
    stock: 40,
    image_url: '/images/day-curoa-bando-real.jpg',
  },
  PROD_DRIVE_003: {
    product_id: 'PROD_DRV_013',
    name: 'Bộ bi nồi FCC chính hãng Honda',
    price: 180000,
    stock: 45,
    image_url: '/images/bi-noi-fcc-real.jpg',
  },
  // Lốp xe
  PROD_TYRE_001: {
    product_id: 'PROD_TYR_010',
    name: 'Lốp không ruột Michelin Pilot Street 2 120/70-17',
    price: 1180000,
    stock: 20,
    image_url: '/images/lop-michelin-pilot-real.jpg',
  },
  PROD_TYRE_002: {
    product_id: 'PROD_TYR_011',
    name: 'Cặp lốp không ruột Maxxis Kim Cương 3D cho xe tay ga',
    price: 920000,
    stock: 25,
    image_url: '/images/lop-maxxis-khong-ruot-real.jpg',
  },
  // Phuộc xe
  PROD_SUSP_001: {
    product_id: 'PROD_SUS_010',
    name: 'Phuộc sau YSS G-Series bình dầu chính hãng',
    price: 2450000,
    stock: 15,
    image_url: '/images/phuoc-yss-real.jpg',
  },
  PROD_SUSP_002: {
    product_id: 'PROD_SUS_011',
    name: 'Phuộc bình dầu RCB VD Series cao cấp',
    price: 3600000,
    stock: 10,
    image_url: '/images/phuoc-rcb-vd-real.jpg',
  },
  PROD_SHOCK_002: {
    product_id: 'PROD_SUS_010',
    name: 'Phuộc sau YSS G-Series bình dầu chính hãng',
    price: 2450000,
    stock: 15,
    image_url: '/images/phuoc-yss-real.jpg',
  },
  PROD_FORK_001: {
    product_id: 'PROD_SUS_013',
    name: 'Cặp ti phuộc trước mạ Chrome kèm phốt chắn bụi',
    price: 580000,
    stock: 30,
    image_url: '/images/ti-phuoc-truoc-zin-real.jpg',
  },
  // Lọc gió & Phụ tùng máy
  PROD_FILTER_001: {
    product_id: 'PROD_ENG_010',
    name: 'Lọc gió K&N chính hãng tăng lưu lượng khí nạp',
    price: 1150000,
    stock: 20,
    image_url: '/images/loc-gio-k-n-real.jpg',
  },
  // Điện & Bình ắc quy
  PROD_BATT_001: {
    product_id: 'PROD_ELC_011',
    name: 'Bình ắc quy Globe WTZ6V 12V-6Ah khô miễn bảo dưỡng',
    price: 360000,
    stock: 50,
    image_url: '/images/ac-quy-globe-real.jpg',
  },
  PROD_LIGHT_001: {
    product_id: 'PROD_ELC_013',
    name: 'Đèn trợ sáng Bi-LED Mini Kenzo chống nước IP68',
    price: 680000,
    stock: 30,
    image_url: '/images/den-tro-sang-biled-real.jpg',
  },
  // Pô & Kính kiểng
  PROD_EXHAUST_001: {
    product_id: 'PROD_ACC_010',
    name: 'Lon pô thể thao ốp Carbon kèm tiêu giảm thanh',
    price: 1650000,
    stock: 12,
    image_url: '/images/po-akrapovic-carbon-real.jpg',
  },
  PROD_ACC_001: {
    product_id: 'PROD_ACC_011',
    name: 'Cặp kính chiếu hậu nhôm CNC chống chói RCB',
    price: 420000,
    stock: 35,
    image_url: '/images/kinh-hau-cnc-rcb-real.jpg',
  },
};

export function ChatProductEmbed({ product }: ChatProductEmbedProps) {
  const { addToCart } = useCart();
  const [isAdding, setIsAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [fallbackAttempted, setFallbackAttempted] = useState(false);

  // Nhận diện mã sản phẩm từ bot (hỗ trợ cả ProductID lẫn product_id)
  const rawPid = product.product_id || (product as unknown as Record<string, string>).ProductID || '';
  const mapped = MOCK_TO_REAL_MAP[rawPid];

  // Sản phẩm thực tế để render và thêm giỏ hàng
  const actualProduct = mapped
    ? {
        product_id: mapped.product_id,
        name: mapped.name,
        price: mapped.price,
        stock: mapped.stock,
        image_url: mapped.image_url,
      }
    : {
        product_id: rawPid,
        name: product.name,
        price: product.price,
        stock: product.stock ?? 10,
        image_url: product.image_url,
      };

  const initialUrl = getImageUrl(actualProduct.image_url);
  const fallbackUrl = mapped ? getImageUrl(mapped.image_url) : '';
  const displayUrl = fallbackAttempted && fallbackUrl ? fallbackUrl : (initialUrl || fallbackUrl);

  async function handleAddToCart(e: React.MouseEvent) {
    e.preventDefault();
    if (isAdding) return;

    setIsAdding(true);
    try {
      await addToCart(actualProduct.product_id, 1, {
        name: actualProduct.name,
        price: actualProduct.price,
        stock: actualProduct.stock,
        image_url: displayUrl || actualProduct.image_url,
      });
      setAdded(true);
      setTimeout(() => setAdded(false), 2500);
    } finally {
      setIsAdding(false);
    }
  }

  return (
    <div className="mt-3 bg-slate-50/80 rounded-xl border border-slate-200 p-3 shadow-sm hover:border-orange-300 transition-all text-slate-900">
      <div className="flex items-center gap-3">
        {/* Product Thumbnail */}
        <div className="w-16 h-16 bg-white rounded-lg overflow-hidden relative flex-shrink-0 border border-slate-200/80">
          {displayUrl ? (
            <Image
              src={displayUrl}
              alt={actualProduct.name}
              fill
              unoptimized
              className="object-cover"
              sizes="64px"
              onError={() => {
                if (!fallbackAttempted && fallbackUrl && fallbackUrl !== initialUrl) {
                  setFallbackAttempted(true);
                }
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-orange-500 bg-orange-50">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <span className="text-[10px] font-bold text-orange-600 uppercase tracking-wider block">
            Sản phẩm đề xuất
          </span>
          <Link
            href={`/products/${actualProduct.product_id}`}
            className="font-bold text-xs text-slate-900 hover:text-orange-600 line-clamp-2 transition-colors leading-snug mt-0.5 block"
          >
            {actualProduct.name}
          </Link>
          <p className="text-orange-600 font-extrabold text-sm mt-1">
            {formatCurrencyVND(actualProduct.price)}
          </p>
        </div>
      </div>

      {/* Buttons */}
      <div className="mt-2.5 flex gap-2 pt-2.5 border-t border-slate-200/70">
        <Link
          href={`/products/${actualProduct.product_id}`}
          className="flex-1 py-1.5 px-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-semibold text-xs rounded-lg text-center transition-colors"
        >
          Chi tiết
        </Link>
        <button
          type="button"
          onClick={handleAddToCart}
          disabled={isAdding}
          className={`flex-1 py-1.5 px-2.5 font-bold text-xs rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer ${
            added
              ? 'bg-emerald-600 text-white'
              : 'bg-orange-500 hover:bg-orange-600 text-white shadow-orange-500/20'
          }`}
        >
          {added ? 'Đã thêm vào giỏ' : 'Thêm vào giỏ'}
        </button>
      </div>
    </div>
  );
}
