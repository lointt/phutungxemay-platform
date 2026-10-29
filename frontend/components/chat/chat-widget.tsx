'use client';

// ============================================================
// components/chat/chat-widget.tsx — Nút Chatbot duy nhất ở góc dưới cùng bên phải
// ============================================================

import { useState } from 'react';
import { ChatWindow } from './chat-window';

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Floating Toggle Button — Cố định góc dưới cùng bên phải */}
      <div className="fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-40">
        {!isOpen && (
          <button
            onClick={() => setIsOpen(true)}
            className="group relative flex items-center gap-2.5 px-4 py-3 bg-gradient-to-r from-orange-500 via-orange-600 to-amber-500 text-white font-bold text-xs rounded-full shadow-xl shadow-orange-500/40 hover:shadow-orange-500/60 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
            aria-label="Hỏi Kỹ Sư AI"
          >
            {/* Pulse ping effect */}
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-300 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-400" />
            </span>

            <span className="text-base">🤖</span>
            <span className="hidden sm:inline font-extrabold tracking-wide">
              Hỏi Kỹ Sư AI
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
