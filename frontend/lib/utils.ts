// ============================================================
// lib/utils.ts — Shared helper utilities
// ============================================================

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind CSS class names safely, resolving conflicts.
 * Usage: cn('px-4 py-2', isActive && 'bg-blue-500', className)
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Định dạng số thành tiền VND.
 * Ví dụ: formatCurrencyVND(125000) → "125.000 đ"
 */
export function formatCurrencyVND(amount: number): string {
  return (
    new Intl.NumberFormat('vi-VN', {
      style: 'decimal',
      maximumFractionDigits: 0,
    }).format(amount) + ' đ'
  );
}

/**
 * Định dạng chuỗi ISO 8601 thành ngày giờ tiếng Việt.
 * Ví dụ: formatDate('2024-12-25T10:00:00Z') → "25/12/2024, 17:00"
 */
export function formatDate(isoString: string, options?: Intl.DateTimeFormatOptions): string {
  const defaultOptions: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
    ...options,
  };
  return new Date(isoString).toLocaleString('vi-VN', defaultOptions);
}

/**
 * Định dạng ngày (không có giờ).
 * Ví dụ: formatDateOnly('2024-12-25') → "25/12/2024"
 */
export function formatDateOnly(isoString: string): string {
  return formatDate(isoString, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: undefined,
    minute: undefined,
  });
}

/**
 * Sinh guest ID duy nhất dựa trên crypto.randomUUID().
 * Format: "USR_<8 ký tự đầu của UUID>"
 */
export function generateGuestId(): string {
  const uuid =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).substring(2, 10);
  return `USR_${uuid.replace(/-/g, '').slice(0, 8)}`;
}

/**
 * Lấy CDN URL đầy đủ từ image path (key từ S3).
 * Ví dụ: getImageUrl('/images/sp-001.jpg') → 'https://d1ksuy3hfmko20.cloudfront.net/images/sp-001.jpg'
 */
export function getImageUrl(imagePath: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_CDN_BASE_URL ?? 'https://d1ksuy3hfmko20.cloudfront.net';
  if (imagePath.startsWith('http')) return imagePath;
  const cleanPath = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
  return `${baseUrl}${cleanPath}`;
}

/**
 * Trả về nhãn tiếng Việt cho danh mục sản phẩm.
 */
export function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    transmission: 'Truyền động',
    brake: 'Hệ thống phanh',
    engine: 'Động cơ',
    electrical: 'Điện - Đèn',
    suspension: 'Giảm xóc',
    body: 'Nhựa - Tem - Yên xe',
    oil_filter: 'Nhớt - Lọc',
    other: 'Khác',
  };
  return labels[category] ?? category;
}

/**
 * Truncate chuỗi dài kèm dấu "…"
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return `${str.slice(0, maxLength - 1)}…`;
}
