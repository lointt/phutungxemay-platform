'use client';

// ============================================================
// components/chat/quick-prompts.tsx — Thanh gợi ý câu hỏi nhanh
// ============================================================

import { DEFAULT_QUICK_PROMPTS } from '@/types/chat';

interface QuickPromptsProps {
  onSelectPrompt: (message: string) => void;
  disabled?: boolean;
}

const EXTENDED_PROMPTS = [
  {
    id: 'qp-order',
    label: '📦 Tra cứu đơn hàng',
    message: 'Kiểm tra trạng thái đơn hàng của tôi',
  },
  ...DEFAULT_QUICK_PROMPTS,
  {
    id: 'qp-5',
    label: '🛑 Thắng bị rít',
    message: 'Thắng đĩa trước bị kêu rít và phanh không ăn là do nguyên nhân gì?',
  },
  {
    id: 'qp-6',
    label: '⚙️ Sên kêu lách cách',
    message: 'Sên xe máy kêu lách cách và hay bị chùng thì nên thay loại nhông sên dĩa nào?',
  },
];

export function QuickPrompts({ onSelectPrompt, disabled }: QuickPromptsProps) {
  return (
    <div className="py-2 overflow-x-auto scrollbar-none flex gap-2 px-1">
      {EXTENDED_PROMPTS.map((item) => (
        <button
          key={item.id}
          type="button"
          disabled={disabled}
          onClick={() => onSelectPrompt(item.message)}
          className="whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-semibold bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 transition-all flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02]"
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
