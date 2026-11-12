'use client';

// ============================================================
// components/chat/quick-prompts.tsx — Thanh gợi ý nút nhanh
// Chỉ hiển thị duy nhất nút "Liên hệ nhân viên" theo yêu cầu
// ============================================================

interface QuickPromptsProps {
  onSelectPrompt: (message: string) => void;
  disabled?: boolean;
}

export function QuickPrompts({ onSelectPrompt, disabled }: QuickPromptsProps) {
  return (
    <div className="py-1 px-1">
      <div className="flex items-center">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onSelectPrompt('Liên hệ nhân viên')}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97] shadow-xs bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white ring-1 ring-orange-400/50"
        >
          <svg className="w-3.5 h-3.5 text-white flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
          <span>Liên hệ nhân viên</span>
        </button>
      </div>
    </div>
  );
}
