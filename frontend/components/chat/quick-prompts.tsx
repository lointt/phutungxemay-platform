'use client';

// ============================================================
// components/chat/quick-prompts.tsx — Thanh gợi ý câu hỏi nhanh
// Thiết kế dạng tag cuộn ngang mượt mà, nổi bật nút "Liên hệ nhân viên"
// ============================================================

import { cn } from '@/lib/utils';
import { DEFAULT_QUICK_PROMPTS } from '@/types/chat';

interface QuickPromptsProps {
  onSelectPrompt: (message: string) => void;
  disabled?: boolean;
}

const EXTENDED_PROMPTS = [
  {
    id: 'qp-contact-staff',
    label: 'Liên hệ nhân viên',
    message: 'Liên hệ nhân viên',
  },
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
    <div className="py-1 px-1">
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth">
        {EXTENDED_PROMPTS.map((item) => {
          const isContact = item.id === 'qp-contact-staff';
          return (
            <button
              key={item.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelectPrompt(item.message)}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium whitespace-nowrap transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97] flex-shrink-0 shadow-xs',
                isContact
                  ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-sm hover:from-orange-600 hover:to-amber-600 font-semibold ring-1 ring-orange-400/50'
                  : 'bg-slate-100 hover:bg-orange-50 text-slate-700 hover:text-orange-600 border border-slate-200/80 hover:border-orange-200',
              )}
            >
              {isContact ? (
                <svg className="w-3 h-3 text-white flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              ) : (
                <span className="w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0" />
              )}
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
