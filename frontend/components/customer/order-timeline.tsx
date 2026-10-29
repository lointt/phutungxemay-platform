'use client';

// ============================================================
// components/customer/order-timeline.tsx — Thanh tiến trình đơn hàng
// ============================================================

import { cn, formatDate } from '@/lib/utils';
import type { OrderStatus } from '@/types/order';

interface OrderTimelineProps {
  status: OrderStatus;
  createdAt?: string;
  updatedAt?: string;
  estimatedDelivery?: string;
}

const STEPS: { status: OrderStatus; label: string; description: string; icon: string }[] = [
  {
    status: 'PLACED',
    label: 'Đặt hàng thành công',
    description: 'Hệ thống đã ghi nhận đơn hàng',
    icon: '📝',
  },
  {
    status: 'PROCESSING',
    label: 'Đang chuẩn bị hàng',
    description: 'Kho đang kiểm tra và đóng gói phụ tùng',
    icon: '📦',
  },
  {
    status: 'SHIPPED',
    label: 'Đang vận chuyển',
    description: 'Đơn vị vận chuyển đang giao hàng',
    icon: '🚚',
  },
  {
    status: 'DELIVERED',
    label: 'Giao hàng thành công',
    description: 'Khách hàng đã nhận phụ tùng',
    icon: '✅',
  },
];

const STATUS_ORDER: Record<OrderStatus, number> = {
  PLACED: 0,
  PROCESSING: 1,
  SHIPPED: 2,
  DELIVERED: 3,
  CANCELLED: -1,
};

export function OrderTimeline({ status, createdAt, updatedAt, estimatedDelivery }: OrderTimelineProps) {
  if (status === 'CANCELLED') {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3 text-red-800">
        <span className="text-2xl">❌</span>
        <div>
          <h4 className="font-bold text-sm">Đơn hàng đã bị hủy</h4>
          <p className="text-xs text-red-600 mt-0.5">
            Đơn hàng đã được hoàn kho và hủy theo yêu cầu. Liên hệ hỗ trợ nếu cần thêm thông tin.
          </p>
        </div>
      </div>
    );
  }

  const currentStepIndex = STATUS_ORDER[status] ?? 0;

  return (
    <div className="w-full py-4">
      {/* Desktop & Tablet Progress Bar */}
      <div className="hidden sm:grid grid-cols-4 gap-2 relative">
        {/* Background Connecting Line */}
        <div className="absolute top-5 left-[12.5%] right-[12.5%] h-1 bg-gray-200 -z-0">
          <div
            className="h-full bg-orange-500 transition-all duration-500"
            style={{
              width: `${(currentStepIndex / (STEPS.length - 1)) * 100}%`,
            }}
          />
        </div>

        {STEPS.map((step, idx) => {
          const isCompleted = idx <= currentStepIndex;
          const isCurrent = idx === currentStepIndex;

          return (
            <div key={step.status} className="flex flex-col items-center text-center relative z-10">
              <div
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all',
                  isCompleted
                    ? 'bg-orange-500 border-orange-500 text-white shadow-md shadow-orange-500/30'
                    : 'bg-white border-gray-300 text-gray-400',
                  isCurrent && 'ring-4 ring-orange-200 animate-pulse',
                )}
              >
                {isCompleted ? step.icon : idx + 1}
              </div>

              <h4
                className={cn(
                  'text-xs font-bold mt-2.5',
                  isCompleted ? 'text-gray-900' : 'text-gray-400',
                )}
              >
                {step.label}
              </h4>

              <p className="text-[11px] text-gray-500 max-w-[130px] mt-0.5 leading-tight">
                {step.description}
              </p>

              {idx === 0 && createdAt && (
                <span className="text-[10px] text-gray-400 mt-1">{formatDate(createdAt)}</span>
              )}
              {idx === 2 && estimatedDelivery && (
                <span className="text-[10px] text-orange-600 font-semibold mt-1">
                  Dự kiến: {formatDate(estimatedDelivery)}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile Vertical Stepper */}
      <div className="sm:hidden space-y-4 relative pl-6 border-l-2 border-gray-200 ml-3">
        {STEPS.map((step, idx) => {
          const isCompleted = idx <= currentStepIndex;
          const isCurrent = idx === currentStepIndex;

          return (
            <div key={step.status} className="relative">
              <div
                className={cn(
                  'absolute -left-[31px] top-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border',
                  isCompleted
                    ? 'bg-orange-500 border-orange-500 text-white'
                    : 'bg-white border-gray-300 text-gray-400',
                  isCurrent && 'ring-2 ring-orange-300',
                )}
              >
                {isCompleted ? '✓' : idx + 1}
              </div>

              <div>
                <h4
                  className={cn(
                    'text-xs font-bold',
                    isCompleted ? 'text-gray-900' : 'text-gray-400',
                  )}
                >
                  {step.label}
                </h4>
                <p className="text-[11px] text-gray-500 mt-0.5">{step.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
