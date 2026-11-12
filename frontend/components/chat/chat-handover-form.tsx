'use client';

// ============================================================
// components/chat/chat-handover-form.tsx
// Form thu thập thông tin khách hàng khi yêu cầu gặp nhân viên
// ============================================================

import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';

interface ChatHandoverFormProps {
  onSubmit: (data: { name: string; phone: string; reason: string }) => void;
  disabled?: boolean;
}

export function ChatHandoverForm({ onSubmit, disabled = false }: ChatHandoverFormProps) {
  const { user } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(disabled);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitted) return;

    const trimmedName = name.trim();
    const trimmedPhone = phone.trim().replace(/[\s.-]/g, '');
    const trimmedReason = reason.trim();

    if (!trimmedName) {
      setError('Vui lòng nhập họ và tên của bạn.');
      return;
    }

    if (!trimmedPhone || !/^(0|\+84)[3|5|7|8|9][0-9]{8}$/.test(trimmedPhone)) {
      setError('Vui lòng nhập số điện thoại hợp lệ (10 chữ số).');
      return;
    }

    if (!trimmedReason) {
      setError('Vui lòng nhập nguyên nhân hoặc nội dung cần hỗ trợ.');
      return;
    }

    setError(null);
    setIsSubmitted(true);
    onSubmit({
      name: trimmedName,
      phone: trimmedPhone,
      reason: trimmedReason,
    });
  };

  if (isSubmitted) {
    return (
      <div className="mt-3 p-3.5 bg-green-50/90 border border-green-200 rounded-xl text-left shadow-sm">
        <div className="flex items-center gap-2 text-green-700 font-bold text-xs">
          <span>✅</span>
          <span>Đã gửi thông tin đến nhân viên hỗ trợ</span>
        </div>
        <p className="text-[11.5px] text-green-800 mt-1">
          Họ tên: <strong>{name}</strong> • SĐT: <strong>{phone}</strong>
        </p>
        <p className="text-[11px] text-green-700/90 mt-0.5">
          Chuyên viên sẽ liên hệ lại qua số điện thoại này trong vòng 24h.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-3 p-3.5 bg-gradient-to-b from-orange-50/70 to-slate-50 border border-orange-200/90 rounded-2xl shadow-sm text-left space-y-2.5"
    >
      <div className="flex items-center gap-1.5 pb-1.5 border-b border-orange-100">
        <span className="text-base">📋</span>
        <span className="font-bold text-xs text-orange-950">Thông tin liên hệ nhân viên</span>
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
          Họ và tên <span className="text-rose-500">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ví dụ: Nguyễn Văn A"
          className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500 text-slate-800 placeholder-slate-400"
        />
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
          Số điện thoại liên hệ <span className="text-rose-500">*</span>
        </label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Ví dụ: 0912345678"
          className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500 text-slate-800 placeholder-slate-400 font-mono"
        />
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
          Nguyên nhân / Vấn đề cần hỗ trợ <span className="text-rose-500">*</span>
        </label>
        <textarea
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Mô tả sự cố xe, tình trạng đơn hàng hoặc phụ tùng cần tư vấn..."
          className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500 text-slate-800 placeholder-slate-400 resize-none"
        />
      </div>

      {error && (
        <p className="text-[11px] text-rose-600 font-medium bg-rose-50 px-2 py-1 rounded border border-rose-200">
          ⚠️ {error}
        </p>
      )}

      <button
        type="submit"
        className="w-full py-2 px-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-orange-500/20 active:scale-[0.98] cursor-pointer"
      >
        Gửi yêu cầu cho nhân viên (24h)
      </button>
    </form>
  );
}
