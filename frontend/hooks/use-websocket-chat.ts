'use client';

// ============================================================
// hooks/use-websocket-chat.ts — Hook điều khiển kết nối WebSocket AI
// Endpoint: wss://9trjqwwev1.execute-api.ap-southeast-1.amazonaws.com/production
// Hỗ trợ tự động reconnect ổn định, keepalive ping, và lưu trữ phiên
// ============================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { generateGuestId } from '@/lib/utils';
import { checkOrderInChat } from '@/lib/order-chat-helper';
import type { ChatMessage, ConnectionStatus, WebSocketPayload, WebSocketResponse } from '@/types/chat';
import type { ProductSummary } from '@/types/product';

const WS_URL =
  process.env.NEXT_PUBLIC_WEBSOCKET_URL ??
  'wss://9trjqwwev1.execute-api.ap-southeast-1.amazonaws.com/production';

const STORAGE_CHAT_KEY = 'phutung_chat_history';

// Mẫu kiến thức chẩn đoán thông minh dự phòng khi socket phản hồi chậm hoặc đang kết nối lại
const KNOWLEDGE_BASE: {
  keywords: string[];
  reply: string;
  product?: ProductSummary;
}[] = [
  {
    keywords: ['cụp cụp', 'gờ giảm tốc', 'chén cổ', 'cổ kêu', 'kêu lụp cụp'],
    reply:
      '### 🔍 Chẩn đoán từ Kỹ Sư AI:\n\nHiện tượng xe đi qua gờ giảm tốc hoặc ổ gà phát ra tiếng **"cụp cụp"** ở phần đầu xe thường do **bộ chén cổ (bạc đạn cổ lái)** bị mòn khuyết bi, rơ lỏng hoặc khô mỡ bôi trơn sau thời gian dài vận hành.\n\n**Khắc phục đề xuất:**\n1. Kiểm tra siết lại ốc siết chén cổ theo đúng lực tiêu chuẩn.\n2. Nếu bi chén cổ đã lún thành rãnh, cần thay thế bộ chén cổ mới (nên dùng chén cổ bạc đạn đũa côn để chịu lực tốt hơn bi tròn thông thường).\n3. Kiểm tra nhớt phuộc trước xem có bị xì phốt hay thiếu nhớt không.',
    product: {
      product_id: 'PROD_FORK_001',
      name: 'Bộ chén cổ bạc đạn đũa và chén bi cao cấp',
      price: 185000,
      image_url: 'https://d1ksuy3hfmko20.cloudfront.net/images/chen-co.jpg',
      stock: 50,
      category: 'Hệ thống giảm xóc & Lái',
    },
  },
  {
    keywords: ['nhớt', 'dầu máy', 'motul', 'phượt', 'thay nhớt', 'nhớt máy'],
    reply:
      '### 🛢️ Tư vấn dầu nhớt từ Kỹ Sư AI:\n\nKhi di chuyển đường dài hoặc đi phượt, động cơ xe máy sinh nhiệt rất lớn. Bạn nên chọn dầu nhớt **tổng hợp toàn phần 100% (Fully Synthetic)** có cấp độ nhớt **10W40** hoặc **10W50** cùng tiêu chuẩn **JASO MA2 / API SP** để bảo vệ bộ nồi côn tay không bị trượt và giúp máy mát êm suốt hành trình.\n\n**Dòng nhớt khuyến nghị hàng đầu:**\n- **Motul 7100 4T 10W40**: Công nghệ Ester cao cấp giúp sang số mượt, bốc máy và duy trì màng dầu bảo vệ bền bỉ khi đi tua xa.',
    product: {
      product_id: 'PROD_OIL_003',
      name: 'Dầu nhớt Motul 7100 4T 10W40 1L',
      price: 265000,
      image_url: 'https://d1ksuy3hfmko20.cloudfront.net/images/motul-7100-10w40.jpg',
      stock: 60,
      category: 'Dầu nhớt & Phụ gia',
    },
  },
  {
    keywords: ['bố thắng', 'thắng đĩa', 'phanh', 'kêu rít', 'má phanh', 'bố đĩa'],
    reply:
      '### 🛑 Chẩn đoán hệ thống phanh:\n\nTiếng kêu rít hoặc phanh bị chai trượt có thể do má phanh đã mòn chạm kim loại xương bố, dính đất cát hoặc bị chai lì do nhiệt độ cao khi rà thắng liên tục.\n\n**Giải pháp:**\n- Thay thế má phanh hợp kim gốm ceramic không amiăng để hạn chế mòn đĩa thắng và phanh êm ái kể cả khi trời mưa.\n- Vệ sinh sạch bụi bẩn trong heo dầu piston.',
    product: {
      product_id: 'PROD_BRK_001',
      name: 'Bố thắng đĩa trước Elig EM050',
      price: 125000,
      image_url: 'https://d1ksuy3hfmko20.cloudfront.net/images/elig-em050.jpg',
      stock: 100,
      category: 'Hệ thống phanh',
    },
  },
  {
    keywords: ['sên', 'nhông sên dĩa', 'nhông xích', 'chùng sên', 'giật sên', 'did'],
    reply:
      '### ⚙️ Tư vấn hệ thống truyền động:\n\nHiện tượng xe chạy có tiếng lách cách ở gắp sau hoặc sang số bị giật cục là dấu hiệu sên đã bị dão không đều (nhảy sên) hoặc răng nhông dĩa đã mòn nhọn.\n\n**Khuyến nghị:**\n- Nên thay trọn bộ **Nhông Sên Dĩa DID 428 HDS vàng** độ bền cao, mắt sên dày chịu tải kéo cực tốt cho các dòng xe số và xe côn tay 150cc.',
    product: {
      product_id: 'PROD_DRV_002',
      name: 'Bộ nhông sên dĩa DID HDS 428 vàng',
      price: 380000,
      image_url: 'https://d1ksuy3hfmko20.cloudfront.net/images/did-hds-428.jpg',
      stock: 45,
      category: 'Hệ thống truyền động',
    },
  },
  {
    keywords: ['phuộc', 'giảm xóc', 'sóc', 'êm', 'nhún'],
    reply:
      '### 🛠️ Tư vấn giảm xóc & phuộc sau:\n\nNếu phuộc sau zin quá cứng khi đi một mình hoặc quá mềm bồng bềnh khi chở tải nặng, bạn nên nâng cấp phuộc sau có bình dầu phụ CNC với núm xoay Rebound điều chỉnh tốc độ hồi dầu theo nhu cầu chở tải.',
    product: {
      product_id: 'PROD_SHOCK_002',
      name: 'Phuộc sau bình dầu nhôm CNC đi êm',
      price: 850000,
      image_url: 'https://d1ksuy3hfmko20.cloudfront.net/images/phuoc-sau.jpg',
      stock: 20,
      category: 'Giảm xóc sau',
    },
  },
];

export function useWebSocketChat() {
  const { user } = useAuth();

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('CONNECTING');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isManuallyClosedRef = useRef(false);

  // Tạo hoặc lấy session_id ổn định
  const getSessionId = useCallback(() => {
    if (typeof window === 'undefined') return 'USER#guest';
    if (user?.userId) return `USER#${user.userId}`;
    let guestId = window.localStorage.getItem('guest_chat_session_id');
    if (!guestId) {
      guestId = generateGuestId();
      window.localStorage.setItem('guest_chat_session_id', guestId);
    }
    return `USER#${guestId}`;
  }, [user?.userId]);

  // Khôi phục tin nhắn từ LocalStorage khi mount
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_CHAT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
          return;
        }
      }
    } catch {
      // ignore
    }

    // Tin nhắn chào mừng ban đầu từ Kỹ Sư AI
    const welcomeMsg: ChatMessage = {
      id: 'welcome-msg',
      role: 'model',
      content:
        '👋 Xin chào bạn! Tôi là **Kỹ Sư AI** của Phụ Tùng Xe Máy.\n\nTôi có thể giúp bạn:\n- 🔍 **Bắt bệnh tiếng kêu lạ & chẩn đoán sự cố xe**\n- 🛢️ **Tư vấn dầu nhớt & phụ tùng tương thích chính xác theo đời xe**\n- 📦 **Kiểm tra tiến độ đơn hàng và hướng dẫn lắp ráp**\n\nBạn đang cần tư vấn cho dòng xe nào hoặc phụ tùng nào?',
      timestamp: Date.now(),
    };
    setMessages([welcomeMsg]);
  }, []);

  // Lưu tin nhắn vào LocalStorage khi messages thay đổi
  useEffect(() => {
    if (messages.length > 0) {
      try {
        window.localStorage.setItem(STORAGE_CHAT_KEY, JSON.stringify(messages));
      } catch {
        // ignore
      }
    }
  }, [messages]);

  // Đóng an toàn socket cũ mà KHÔNG kích hoạt sự kiện onclose dây chuyền
  const safelyCloseOldSocket = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (socketRef.current) {
      socketRef.current.onopen = null;
      socketRef.current.onmessage = null;
      socketRef.current.onerror = null;
      socketRef.current.onclose = null;
      try {
        socketRef.current.close();
      } catch {}
      socketRef.current = null;
    }
  }, []);

  // Kết nối WebSocket
  const connectWebSocket = useCallback(() => {
    if (typeof window === 'undefined') return;

    safelyCloseOldSocket();

    try {
      setConnectionStatus('CONNECTING');
      const ws = new WebSocket(WS_URL);
      socketRef.current = ws;

      ws.onopen = () => {
        setConnectionStatus('CONNECTED');
        reconnectAttemptsRef.current = 0;

        // Bắt đầu gửi ping định kỳ 25s để giữ kết nối không bị timeout bởi CloudFront/API Gateway
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            try {
              ws.send(JSON.stringify({ action: 'ping' }));
            } catch {}
          }
        }, 25000);
      };

      ws.onmessage = (event) => {
        setIsThinking(false);
        try {
          const data = JSON.parse(event.data) as WebSocketResponse;
          if (data.response) {
            const aiMsg: ChatMessage = {
              id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              role: 'model',
              content: data.response,
              timestamp: Date.now(),
              embeddedProduct: data.product,
            };
            setMessages((prev) => [...prev, aiMsg]);
          }
        } catch {
          // Tin nhắn văn bản thô
          if (typeof event.data === 'string' && event.data.trim()) {
            const aiMsg: ChatMessage = {
              id: `msg-${Date.now()}`,
              role: 'model',
              content: event.data,
              timestamp: Date.now(),
            };
            setMessages((prev) => [...prev, aiMsg]);
          }
        }
      };

      ws.onerror = () => {
        // Không đổi status chớp nháy liên tục ở đây, để onclose quyết định
      };

      ws.onclose = () => {
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }

        if (isManuallyClosedRef.current) {
          setConnectionStatus('DISCONNECTED');
          return;
        }

        // Nếu đã thử quá 5 lần thì dừng hẳn, không chớp nháy nữa
        if (reconnectAttemptsRef.current >= 5) {
          setConnectionStatus('DISCONNECTED');
          return;
        }

        // Tăng delay nhẹ nhàng (3s, 5s, 8s, 12s, 15s) để chống chớp nháy
        const backoffDelays = [3000, 5000, 8000, 12000, 15000];
        const delay = backoffDelays[reconnectAttemptsRef.current] || 15000;
        reconnectAttemptsRef.current += 1;

        setConnectionStatus('RECONNECTING');

        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSocket();
        }, delay);
      };
    } catch {
      setConnectionStatus('DISCONNECTED');
    }
  }, [safelyCloseOldSocket]);

  useEffect(() => {
    isManuallyClosedRef.current = false;
    connectWebSocket();

    return () => {
      isManuallyClosedRef.current = true;
      safelyCloseOldSocket();
    };
  }, [connectWebSocket, safelyCloseOldSocket]);

  // Gửi tin nhắn
  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: trimmed,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setIsThinking(true);

      // 1. Kiểm tra ưu tiên: Tra cứu thông tin/tiến độ đơn hàng theo mã đơn hoặc yêu cầu
      try {
        const orderMarkdown = await checkOrderInChat(trimmed);
        if (orderMarkdown) {
          setIsThinking(false);
          const aiOrderMsg: ChatMessage = {
            id: `ai-order-${Date.now()}`,
            role: 'model',
            content: orderMarkdown,
            timestamp: Date.now(),
          };
          setMessages((prev) => [...prev, aiOrderMsg]);
          return;
        }
      } catch (err) {
        console.error('Lỗi check đơn hàng:', err);
      }

      // 2. Nếu không phải tra cứu đơn hàng, gửi qua WebSocket AI
      const payload: WebSocketPayload = {
        action: 'sendMessage',
        message: trimmed,
        session_id: getSessionId(),
      };

      let sent = false;
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        try {
          socketRef.current.send(JSON.stringify(payload));
          sent = true;
        } catch {
          sent = false;
        }
      }

      // Xử lý thông minh: Dự phòng chuyên gia Kỹ Sư AI trả lời sau 2.5s nếu socket không phản hồi
      const lower = trimmed.toLowerCase();
      const matched = KNOWLEDGE_BASE.find((k) =>
        k.keywords.some((kw) => lower.includes(kw)),
      );

      const fallbackTimer = setTimeout(() => {
        setIsThinking(false);
        if (matched) {
          const fallbackMsg: ChatMessage = {
            id: `ai-kb-${Date.now()}`,
            role: 'model',
            content: matched.reply,
            timestamp: Date.now(),
            embeddedProduct: matched.product,
          };
          setMessages((prev) => [...prev, fallbackMsg]);
        } else if (!sent) {
          const defaultReply: ChatMessage = {
            id: `ai-gen-${Date.now()}`,
            role: 'model',
            content: `Cảm ơn bạn đã hỏi về: **"${trimmed}"**.\n\nKỹ Sư AI đã ghi nhận câu hỏi. Bạn có thể cho biết thêm **hãng xe và đời xe** bạn đang sử dụng (ví dụ: *Honda Wave Alpha 2021*, *Yamaha Exciter 150 2019*, *Honda SH 150i*,...) hoặc mã phụ tùng để tôi kiểm tra chính xác nhé!`,
            timestamp: Date.now(),
          };
          setMessages((prev) => [...prev, defaultReply]);
        }
      }, 2500);

      return () => clearTimeout(fallbackTimer);
    },
    [getSessionId],
  );

  const clearChat = useCallback(() => {
    const resetMsg: ChatMessage = {
      id: `welcome-${Date.now()}`,
      role: 'model',
      content: '🧹 Lịch sử trò chuyện đã được làm mới. Kỹ Sư AI có thể giúp gì cho xe máy của bạn hôm nay?',
      timestamp: Date.now(),
    };
    setMessages([resetMsg]);
    try {
      window.localStorage.removeItem(STORAGE_CHAT_KEY);
    } catch {
      // ignore
    }
  }, []);

  return {
    connectionStatus,
    messages,
    isThinking,
    sendMessage,
    clearChat,
    reconnect: connectWebSocket,
  };
}
