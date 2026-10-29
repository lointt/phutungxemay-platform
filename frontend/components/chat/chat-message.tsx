'use client';

// ============================================================
// components/chat/chat-message.tsx — Hiển thị bong bóng tin nhắn
// Hỗ trợ định dạng Markdown, danh sách dấu dòng, và sản phẩm nhúng
// ============================================================

import { cn } from '@/lib/utils';
import type { ChatMessage as ChatMessageType } from '@/types/chat';
import { ChatProductEmbed } from './chat-product-embed';

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div
      className={cn(
        'flex gap-2.5 my-3 animate-in fade-in slide-in-from-bottom-2 duration-200',
        isUser ? 'flex-row-reverse' : 'flex-row',
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 shadow-sm',
          isUser
            ? 'bg-gray-800 text-white'
            : 'bg-gradient-to-tr from-orange-500 to-amber-500 text-white',
        )}
      >
        {isUser ? 'Bạn' : 'AI'}
      </div>

      {/* Message Content */}
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed shadow-sm',
          isUser
            ? 'bg-orange-500 text-white rounded-tr-sm'
            : 'bg-white text-gray-800 border border-gray-100 rounded-tl-sm shadow-gray-200/50',
        )}
      >
        <div className="space-y-1.5 whitespace-pre-wrap font-sans">
          {renderMarkdownContent(message.content, isUser)}
        </div>

        {/* Embedded Recommended Product from RAG */}
        {message.embeddedProduct && (
          <ChatProductEmbed product={message.embeddedProduct} />
        )}

        {/* Time */}
        <p
          className={cn(
            'text-[9px] mt-1.5 text-right font-mono',
            isUser ? 'text-orange-100' : 'text-gray-400',
          )}
        >
          {new Date(message.timestamp).toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>
    </div>
  );
}

/**
 * Trình biên dịch Markdown cơ bản và an toàn cho chat (không cần cài thêm bundle cồng kềnh)
 */
function renderMarkdownContent(text: string, isUser: boolean) {
  const lines = text.split('\n');

  return lines.map((line, idx) => {
    // Tiêu đề ###
    if (line.startsWith('### ')) {
      return (
        <h4
          key={idx}
          className={cn(
            'font-bold text-sm mt-1 mb-1',
            isUser ? 'text-white' : 'text-orange-600',
          )}
        >
          {line.replace('### ', '')}
        </h4>
      );
    }

    // Danh sách dấu đầu dòng - hoặc *
    if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      const content = line.trim().substring(2);
      return (
        <div key={idx} className="flex items-start gap-1.5 pl-1 my-0.5">
          <span className={cn('text-xs mt-0.5', isUser ? 'text-orange-200' : 'text-orange-500')}>
            •
          </span>
          <span>{renderInlineFormatting(content)}</span>
        </div>
      );
    }

    // Danh sách số 1. 2.
    const numMatch = line.trim().match(/^(\d+)\.\s+(.*)/);
    if (numMatch) {
      return (
        <div key={idx} className="flex items-start gap-1.5 pl-1 my-0.5">
          <span className={cn('font-bold text-[10px] mt-0.5', isUser ? 'text-orange-200' : 'text-orange-500')}>
            {numMatch[1]}.
          </span>
          <span>{renderInlineFormatting(numMatch[2])}</span>
        </div>
      );
    }

    // Dòng trống
    if (!line.trim()) {
      return <div key={idx} className="h-1.5" />;
    }

    // Đoạn văn thường
    return <p key={idx}>{renderInlineFormatting(line)}</p>;
  });
}

function renderInlineFormatting(str: string) {
  // Thay thế **in đậm**
  const parts = str.split(/(\*\*.*?\*\*)/g);

  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-extrabold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}
