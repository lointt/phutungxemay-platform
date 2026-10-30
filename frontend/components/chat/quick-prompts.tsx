'use client';

// ============================================================
// components/chat/quick-prompts.tsx — Thanh gợi ý câu hỏi nhanh
// Thiết kế dạng tag gói gọn (flex-wrap), không bị cắt chữ ở mép
// ============================================================

import { DEFAULT_QUICK_PROMPTS } from '@/types/chat';

interface QuickPromptsProps {
  onSelectPrompt: (message: string) => void;
  disabled?: boolean;
}

const EXTENDED_PROMPTS = [
  {
    id: 'qp-order',
    label: 'Tra cứu đơn hàng',
    message: 'Kiểm tra trạng thái đơn hàng của tôi',
  },
  ...DEFAULT_QUICK_PROMPTS,
  {
    id: 'qp-5',
    label: 'Phanh đĩa kêu rít',
    message: 'Thắng đĩa trước bị kêu rít và phanh không ăn là do nguyên nhân gì?',
  },
  {
    id: 'qp-6',
    label: 'Sên kêu lách cách',
    message: 'Sên xe máy kêu lách cách và hay bị chùng thì nên thay loại nhông sên dĩa nào?',
  },
];

export function QuickPrompts({ onSelectPrompt, disabled }: QuickPromptsProps) {
  return (
    <div className="py-2 px-1">
      <div className="flex items-center justify-between mb-1.5 px-0.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Chủ đề phổ biến
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {EXTENDED_PROMPTS.map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={disabled}
            onClick={() => onSelectPrompt(item.message)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-slate-50 hover:bg-orange-50 text-slate-700 hover:text-orange-600 border border-slate-200/90 hover:border-orange-300 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0" />
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
