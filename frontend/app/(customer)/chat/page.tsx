import { redirect } from 'next/navigation';

// ============================================================
// app/(customer)/chat/page.tsx
// Chuyển hướng về trang chủ - Chatbot tích hợp duy nhất 1 nút góc dưới bên phải
// ============================================================

export default function ChatPage() {
  redirect('/');
}
