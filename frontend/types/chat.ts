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
  embeddedProduct?: ProductSummary;    // Phụ tùng đơn lẻ (tương thích ngược)
  embeddedProducts?: ProductSummary[]; // Danh sách phụ tùng AI gợi ý từ RAG
  sources?: string[];                  // Trích dẫn tài liệu KB (chính sách, hướng dẫn)
  handoverTicket?: string | null;      // Mã ticket chuyển nhân viên tư vấn
  cartUpdated?: boolean;               // Cờ giỏ hàng được cập nhật tự động
  isStreaming?: boolean;               // Đang nhận stream từ AI
}

/** Thông tin sản phẩm trả về từ Lambda RAG */
export interface ChatbotProductItem {
  ProductID?: string;
  product_id?: string;
  name: string;
  price: number;
  stock?: number;
  image_url?: string;
}

/** Payload gửi lên WebSocket API Gateway */
export interface WebSocketPayload {
  action: 'sendMessage';
  question: string;                    // Câu hỏi gửi vào orchestrator v2
  session_id: string;                  // UUID phiên chat
  user_id?: string;                    // Cognito Sub hoặc Guest ID
  message?: string;                    // Tương thích ngược
}

/** Payload nhận về từ WebSocket API Gateway (Lambda RAG response) */
export interface WebSocketResponse {
  answer?: string;                     // Câu trả lời chính từ Gemini RAG
  sources?: string[];                  // Danh sách file KB tham chiếu
  products?: ChatbotProductItem[];     // Danh sách sản phẩm gợi ý
  low_confidence?: boolean;            // Độ tin cậy thấp
  degraded?: boolean;                  // Chế độ fallback khi Gemini bận
  cart_updated?: boolean;              // Thao tác giỏ hàng thành công
  handover_ticket?: string | null;     // Mã ticket CSKH (ví dụ: HO_...)
  rate_limited?: boolean;              // Bị chặn tần suất
  error?: boolean;                     // Lỗi hệ thống
  // Tương thích ngược:
  response?: string;
  product?: ProductSummary;
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
