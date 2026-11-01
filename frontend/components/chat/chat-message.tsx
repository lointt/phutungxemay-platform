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
        'flex gap-2.5 my-3 w-full min-w-0 animate-in fade-in slide-in-from-bottom-2 duration-200',
        isUser ? 'flex-row-reverse' : 'flex-row',
      )}
    >
      {/* Avatar */}
      {isUser ? (
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 shadow-sm bg-slate-800 text-white mt-0.5">
          Bạn
        </div>
      ) : (
        <div className="relative flex-shrink-0 mt-0.5">
          <img
            src="/images/chatbot-avatar.png"
            alt="Chuyên viên tư vấn AI"
            className="w-8 h-8 rounded-full object-cover shadow-sm border border-slate-200"
          />
        </div>
      )}

      {/* Message Content */}
      <div className={cn('min-w-0 max-w-[84%] flex flex-col', isUser ? 'items-end' : 'items-start')}>
        {!isUser && (
          <span className="text-[10px] font-semibold text-slate-400 mb-1 px-1">
            Chuyên viên tư vấn
          </span>
        )}
        <div
          className={cn(
            'min-w-0 w-full rounded-2xl px-3.5 py-2.5 sm:px-4 sm:py-3 text-[12.5px] leading-relaxed break-words overflow-hidden',
            isUser
              ? 'bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-tr-sm shadow-sm shadow-orange-500/20'
              : 'bg-white text-slate-700 border border-slate-200/80 rounded-tl-sm shadow-[0_2px_10px_rgba(15,23,42,0.04)]',
          )}
        >
          <div className="space-y-1.5 whitespace-pre-wrap break-words font-sans">
            {renderMarkdownContent(message.content, isUser)}
          </div>

          {/* Embedded Recommended Product(s) from RAG */}
          {message.embeddedProducts && message.embeddedProducts.length > 0 ? (
            <div className="space-y-2 mt-2">
              {message.embeddedProducts.map((p, idx) => (
                <ChatProductEmbed key={`${p.product_id}-${idx}`} product={p} />
              ))}
            </div>
          ) : message.embeddedProduct ? (
            <ChatProductEmbed product={message.embeddedProduct} />
          ) : null}

          {/* Trích dẫn tài liệu tham chiếu (Sources) */}
          {message.sources && message.sources.length > 0 && (
            <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
              <span className="font-semibold text-slate-600">📚 Tham chiếu:</span>
              {message.sources.map((src, i) => (
                <span
                  key={i}
                  className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px]"
                >
                  {src}
                </span>
              ))}
            </div>
          )}

          {/* Ticket chuyển nhân viên CSKH (Human Handover) */}
          {message.handoverTicket && (
            <div className="mt-2.5 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
              <span className="text-base">🎫</span>
              <div>
                <p className="font-bold text-amber-950">Đã kết nối nhân viên CSKH</p>
                <p className="text-[11px] text-amber-800 mt-0.5">
                  Mã hỗ trợ:{' '}
                  <code className="font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-amber-300">
                    {message.handoverTicket}
                  </code>
                  . Nhân viên kỹ thuật sẽ kiểm tra và phản hồi sớm nhất.
                </p>
              </div>
            </div>
          )}

          {/* Thông báo cập nhật giỏ hàng */}
          {message.cartUpdated && (
            <div className="mt-2 p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-1.5 font-medium">
              <span>🛒</span> Giỏ hàng đã được cập nhật tự động!
            </div>
          )}

          {/* Time */}
          <p
            className={cn(
              'text-[10px] mt-1.5 text-right font-medium',
              isUser ? 'text-orange-100/90' : 'text-slate-400',
            )}
          >
            {new Date(message.timestamp).toLocaleTimeString('vi-VN', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Trình biên dịch Markdown cơ bản và an toàn cho chat
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
            'font-bold text-xs sm:text-[13px] mt-0.5 mb-1 pb-1 border-b',
            isUser
              ? 'text-white border-white/20'
              : 'text-slate-900 border-slate-100',
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
        <div key={idx} className="flex items-start gap-2 pl-0.5 my-1 min-w-0">
          <span
            className={cn(
              'w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0',
              isUser ? 'bg-orange-200' : 'bg-orange-500',
            )}
          />
          <span className="min-w-0 break-words">{renderInlineFormatting(content, isUser)}</span>
        </div>
      );
    }

    // Danh sách số 1. 2.
    const numMatch = line.trim().match(/^(\d+)\.\s+(.*)/);
    if (numMatch) {
      return (
        <div key={idx} className="flex items-start gap-2 pl-0.5 my-1 min-w-0">
          <span
            className={cn(
              'font-bold text-[11px] mt-0.5 flex-shrink-0',
              isUser ? 'text-orange-100' : 'text-orange-600',
            )}
          >
            {numMatch[1]}.
          </span>
          <span className="min-w-0 break-words">{renderInlineFormatting(numMatch[2], isUser)}</span>
        </div>
      );
    }

    // Dòng trống
    if (!line.trim()) {
      return <div key={idx} className="h-1" />;
    }

    // Đoạn văn thường
    return <p key={idx} className="break-words">{renderInlineFormatting(line, isUser)}</p>;
  });
}

function renderInlineFormatting(str: string, isUser: boolean) {
  // Thay thế **in đậm**
  const parts = str.split(/(\*\*.*?\*\*)/g);

  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong
          key={i}
          className={cn('font-bold', isUser ? 'text-white' : 'text-slate-900')}
        >
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}
