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

  // Focus ô nhập khi mở
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

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
    if (!inputVal.trim()) return;

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
        'flex flex-col bg-slate-50 overflow-hidden transition-all',
        isStandalone
          ? 'w-full h-full rounded-2xl border border-gray-200 shadow-sm'
          : 'w-[calc(100vw-32px)] max-w-[420px] h-[560px] max-h-[82vh] rounded-3xl border border-gray-200 fixed bottom-20 right-4 sm:right-6 z-50 shadow-2xl animate-in fade-in slide-in-from-bottom-5 duration-200',
      )}
    >
      {/* ── Chat Header ─────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-orange-600 via-orange-500 to-amber-500 text-white p-3.5 sm:p-4 flex items-center justify-between shadow-sm flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-lg font-bold shadow-inner">
              🤖
            </div>
            {/* Status dot */}
            <span
              className={cn(
                'absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-orange-600 transition-colors duration-300',
                isOnline
                  ? 'bg-green-400'
                  : isConnecting || isReconnecting
                  ? 'bg-amber-300'
                  : 'bg-emerald-300',
              )}
            />
          </div>

          <div>
            <h3 className="font-bold text-sm leading-tight">Kỹ Sư AI Phụ Tùng</h3>
            <div className="flex items-center gap-1.5 text-[10px] text-orange-100">
              <span>
                {isOnline
                  ? 'Trực tuyến 24/7'
                  : isConnecting
                  ? 'Đang kết nối...'
                  : isReconnecting
                  ? 'Đang đồng bộ...'
                  : 'Sẵn sàng chẩn đoán'}
              </span>
              {!isOnline && (
                <button
                  type="button"
                  onClick={reconnect}
                  className="underline hover:text-white font-bold ml-1 cursor-pointer"
                >
                  Kết nối lại
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={clearChat}
            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors text-white/80 hover:text-white cursor-pointer"
            title="Làm mới hội thoại"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 hover:bg-white/20 rounded-lg transition-colors text-white/80 hover:text-white ml-0.5 cursor-pointer"
              title="Đóng cửa sổ chat"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* ── Messages List ───────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}

        {/* AI Typing Indicator */}
        {isThinking && (
          <div className="flex gap-2 items-center text-xs text-orange-600 bg-orange-50/80 p-3 rounded-2xl w-fit border border-orange-100 animate-pulse my-2">
            <div className="w-2 h-2 rounded-full bg-orange-500 animate-ping" />
            <span className="font-semibold text-[11px]">
              Kỹ Sư AI đang chẩn đoán và tra cứu phụ tùng...
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Quick Prompts ───────────────────────────────────────────────────── */}
      <div className="bg-white/90 border-t border-gray-100 px-3 py-1 flex-shrink-0">
        <QuickPrompts onSelectPrompt={handleSelectPrompt} disabled={isThinking} />
      </div>

      {/* ── Input Box Form ──────────────────────────────────────────────────── */}
      <form onSubmit={handleSend} className="p-3 bg-white border-t border-gray-200 flex items-center gap-2 flex-shrink-0">
        <input
          ref={inputRef}
          type="text"
          placeholder="Mô tả triệu chứng xe hoặc hỏi phụ tùng..."
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          className="flex-1 px-3.5 py-2.5 bg-gray-100/80 border border-transparent rounded-xl text-xs text-gray-800 placeholder-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-300 transition-all"
        />

        <button
          type="submit"
          disabled={!inputVal.trim() || isThinking}
          className="p-2.5 bg-orange-500 hover:bg-orange-400 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl transition-all shadow-md shadow-orange-500/20 flex-shrink-0 cursor-pointer"
          aria-label="Gửi tin nhắn"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </form>
    </div>
  );
}
