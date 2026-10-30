'use client';

// ============================================================
// components/chat/chat-window.tsx — Khung hội thoại Chatbot AI
// Điều khiển kết nối socket, hiển thị tin nhắn, và gợi ý nhanh
// Hỗ trợ tự động nạp initialPrompt từ các nút trên website
// ============================================================

import { useEffect, useRef, useState } from 'react';
import { useWebSocketChat } from '@/hooks/use-websocket-chat';
import { cn } from '@/lib/utils';
import { ChatMessage } from './chat-message';
import { QuickPrompts } from './quick-prompts';

interface ChatWindowProps {
  onClose?: () => void;
  isStandalone?: boolean; // True nếu hiển thị trên trang /chat toàn màn hình
  initialPrompt?: string; // Câu hỏi khởi động được truyền vào
}

export function ChatWindow({ onClose, isStandalone = false, initialPrompt }: ChatWindowProps) {
  const { connectionStatus, messages, isThinking, sendMessage, clearChat, reconnect } =
    useWebSocketChat();

  const [inputVal, setInputVal] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const promptSentRef = useRef<string | null>(null);

  // Cuộn xuống tin nhắn mới nhất
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isThinking]);

  // Tự động gửi câu hỏi khởi động nếu có
  useEffect(() => {
    if (initialPrompt && initialPrompt.trim() && promptSentRef.current !== initialPrompt) {
      promptSentRef.current = initialPrompt;
      const timer = setTimeout(() => {
        sendMessage(initialPrompt.trim());
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [initialPrompt, sendMessage]);

  function handleSend(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!inputVal.trim() || isThinking) return;

    sendMessage(inputVal);
    setInputVal('');
  }

  function handleSelectPrompt(prompt: string) {
    sendMessage(prompt);
  }

  const isOnline = connectionStatus === 'CONNECTED';
  const isConnecting = connectionStatus === 'CONNECTING';
  const isReconnecting = connectionStatus === 'RECONNECTING';

  return (
    <div
      className={cn(
        'flex flex-col bg-slate-50/95 overflow-hidden transition-all',
        isStandalone
          ? 'w-full h-full rounded-2xl border border-slate-200 shadow-sm'
          : 'fixed inset-x-3 bottom-3 top-[68px] sm:inset-auto sm:bottom-6 sm:right-6 sm:w-[410px] sm:h-[600px] sm:max-h-[calc(100dvh-48px)] rounded-2xl sm:rounded-3xl border border-slate-200/90 z-[60] shadow-[0_20px_50px_rgba(15,23,42,0.22)] animate-in fade-in slide-in-from-bottom-5 duration-200',
      )}
    >
      {/* ── Chat Header ─────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white px-4 py-3.5 flex items-center justify-between border-b border-slate-700/80 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative flex-shrink-0">
            <img
              src="/chatbot-avatar.png"
              alt="Chuyên viên tư vấn AI"
              className="w-10 h-10 rounded-full object-cover ring-2 ring-orange-500/80 shadow-md"
            />
            {/* Status dot */}
            <span
              className={cn(
                'absolute bottom-0 right-0 w-3 h-3 rounded-full ring-2 ring-slate-900 transition-colors duration-300',
                isOnline
                  ? 'bg-emerald-400'
                  : isConnecting || isReconnecting
                  ? 'bg-amber-400'
                  : 'bg-emerald-400',
              )}
            />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm text-white leading-tight truncate">
                Trợ Lý Tư Vấn Phụ Tùng
              </h3>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-orange-500/20 text-orange-300 border border-orange-500/30">
                AI 24/7
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-300 mt-0.5">
              <span className="truncate">
                {isOnline
                  ? 'Đang hoạt động • Tư vấn kỹ thuật'
                  : isConnecting
                  ? 'Đang kết nối máy chủ...'
                  : isReconnecting
                  ? 'Đang đồng bộ kết nối...'
                  : 'Sẵn sàng hỗ trợ trực tuyến'}
              </span>
              {!isOnline && !isConnecting && (
                <button
                  type="button"
                  onClick={reconnect}
                  className="text-orange-400 hover:text-orange-300 underline font-semibold ml-1 cursor-pointer flex-shrink-0"
                >
                  Kết nối lại
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={clearChat}
            className="p-2 hover:bg-white/10 rounded-xl transition-colors text-slate-300 hover:text-white cursor-pointer"
            title="Làm mới hội thoại"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-xl transition-colors text-slate-300 hover:text-white cursor-pointer"
              title="Đóng cửa sổ chat"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* ── Messages List ───────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-3.5 sm:px-4 py-3 space-y-1">
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}

        {/* AI Typing Indicator */}
        {isThinking && (
          <div className="flex items-center gap-2.5 my-2 animate-in fade-in duration-200">
            <img
              src="/chatbot-avatar.png"
              alt="Chuyên viên tư vấn"
              className="w-7 h-7 rounded-full object-cover border border-slate-200 flex-shrink-0"
            />
            <div className="flex items-center gap-2 text-xs text-slate-600 bg-white px-3.5 py-2.5 rounded-2xl rounded-tl-sm border border-slate-200/80 shadow-sm">
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-bounce" />
              </div>
              <span className="font-medium text-[11px] text-slate-500">
                Đang tra cứu thông số kỹ thuật...
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Quick Prompts ───────────────────────────────────────────────────── */}
      <div className="bg-white border-t border-slate-100 px-3 py-1.5 flex-shrink-0">
        <QuickPrompts onSelectPrompt={handleSelectPrompt} disabled={isThinking} />
      </div>

      {/* ── Input Box Form ──────────────────────────────────────────────────── */}
      <form
        onSubmit={handleSend}
        className="px-3 pb-3 pt-2 bg-white border-t border-slate-100 flex-shrink-0"
      >
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/90 focus-within:border-orange-500 focus-within:bg-white focus-within:ring-3 focus-within:ring-orange-500/10 rounded-2xl pl-3.5 pr-1.5 py-1.5 transition-all">
          <input
            ref={inputRef}
            type="text"
            placeholder="Nhập triệu chứng xe, tên phụ tùng hoặc mã đơn..."
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            className="flex-1 min-w-0 bg-transparent text-base sm:text-xs text-slate-800 placeholder-slate-400 focus:outline-none py-1"
          />

          <button
            type="submit"
            disabled={!inputVal.trim() || isThinking}
            className={cn(
              'w-8 h-8 rounded-xl flex items-center justify-center transition-all flex-shrink-0 cursor-pointer',
              inputVal.trim() && !isThinking
                ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-sm shadow-orange-500/25'
                : 'bg-slate-200/70 text-slate-400 cursor-not-allowed',
            )}
            aria-label="Gửi tin nhắn"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
}
