'use client';

// ============================================================
// components/chat/chat-widget.tsx — Nút Chatbot tròn cố định ở góc dưới cùng bên phải
// ============================================================

import { useState } from 'react';
import { ChatWindow } from './chat-window';

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Floating Toggle Button — Nút tròn góc dưới cùng bên phải */}
      <div className="fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-40">
        {!isOpen && (
          <button
            onClick={() => setIsOpen(true)}
            className="group relative w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white p-0.5 flex items-center justify-center shadow-[0_8px_28px_rgba(0,0,0,0.22)] hover:shadow-[0_10px_32px_rgba(249,115,22,0.4)] hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer ring-2 ring-white"
            aria-label="Mở trợ lý tư vấn trực tuyến"
            title="Chat tư vấn phụ tùng 24/7"
          >
            {/* Avatar tròn */}
            <img
              src="/chatbot-avatar.png"
              alt="Trợ lý tư vấn"
              className="w-full h-full rounded-full object-cover"
            />

            {/* Online indicator badge */}
            <span className="absolute bottom-0 right-0 flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-green-500 border-2 border-white" />
            </span>
          </button>
        )}
      </div>

      {/* Pop-up Chat Window */}
      {isOpen && (
        <ChatWindow onClose={() => setIsOpen(false)} />
      )}
    </>
  );
}
