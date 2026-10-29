// ============================================================
// types/chat.ts — Chatbot AI & WebSocket domain types
// ============================================================

import type { ProductSummary } from './product';

export type MessageRole = 'user' | 'model';

export type ConnectionStatus = 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'RECONNECTING';

export interface ChatMessage {
  id: string;                          // UUID để làm React key
  role: MessageRole;
  content: string;                     // Markdown text
  timestamp: number;                   // Unix ms
  embeddedProduct?: ProductSummary;    // Phụ tùng AI gợi ý từ RAG tool calling
  isStreaming?: boolean;               // Đang nhận stream từ AI
}

/** Payload gửi lên WebSocket API Gateway */
export interface WebSocketPayload {
  action: 'sendMessage';
  message: string;
  session_id: string;  // Format: "USER#<user_id hoặc guest_id>"
}

/** Payload nhận về từ WebSocket API Gateway (Lambda response) */
export interface WebSocketResponse {
  response: string;              // Câu trả lời Markdown từ AI
  product?: ProductSummary;      // Phụ tùng gợi ý từ RAG k-NN (nếu có)
  session_id?: string;
}

/** State của hook useWebSocketChat */
export interface ChatState {
  connectionStatus: ConnectionStatus;
  messages: ChatMessage[];
  isThinking: boolean;  // AI đang xử lý (hiển thị typing indicator)
}

/** Quick prompts gợi ý câu hỏi phổ biến */
export interface QuickPrompt {
  id: string;
  label: string;   // Nhãn ngắn hiển thị trên button
  message: string; // Nội dung đầy đủ gửi lên AI
}

export const DEFAULT_QUICK_PROMPTS: QuickPrompt[] = [
  {
    id: 'qp-1',
    label: '🔊 Kêu cụp cụp',
    message: 'Xe qua gờ giảm tốc kêu cụp cụp là bị gì? Cách sửa như thế nào?',
  },
  {
    id: 'qp-2',
    label: '🛢️ Tư vấn nhớt',
    message: 'Tư vấn nhớt máy phù hợp cho xe đi phượt đường dài',
  },
  {
    id: 'qp-3',
    label: '🔧 Bảo dưỡng định kỳ',
    message: 'Xe máy nên bảo dưỡng định kỳ những gì và bao lâu một lần?',
  },
  {
    id: 'qp-4',
    label: '💡 Đèn yếu',
    message: 'Đèn xe máy bị yếu, tối hơn bình thường là do đâu?',
  },
];
