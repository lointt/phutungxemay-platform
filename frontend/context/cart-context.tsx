'use client';

// ============================================================
// context/cart-context.tsx — Giỏ hàng đa năng (Hybrid Identity)
// Đồng bộ API AWS Lambda CartServiceHandler & fallback LocalStorage
// ============================================================

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '@/hooks/use-auth';
import { generateGuestId } from '@/lib/utils';
import apiClient from '@/lib/api-client';
import type { CartItem } from '@/types/cart';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CartApiResponse {
  CartID?: string;
  items?: CartItem[];
  subtotal?: number;
  message?: string;
  cart?: {
    CartID?: string;
    items?: CartItem[];
    subtotal?: number;
  };
}

interface CartContextValue {
  items: CartItem[];
  subtotal: number;
  itemCount: number;
  isLoading: boolean;
  isLoaded: boolean;
  addToCart: (productId: string, quantity?: number, productDetails?: Partial<CartItem>) => Promise<void>;
  updateQuantity: (productId: string, quantity: number) => Promise<void>;
  removeFromCart: (productId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  refreshCart: () => Promise<void>;
}

const CartContext = createContext<CartContextValue | null>(null);

function getCartStorageKey(userId?: string | null): string {
  if (userId) {
    return `phutung_cart_${userId}`;
  }
  const guestId = typeof window !== 'undefined' ? window.localStorage.getItem('guest_cart_id') : '';
  return guestId ? `phutung_cart_guest_${guestId}` : 'phutung_cart_guest';
}

function getOrCreateGuestId(): string {
  if (typeof window === 'undefined') return '';
  let id = window.localStorage.getItem('guest_cart_id');
  if (!id) {
    id = generateGuestId();
    window.localStorage.setItem('guest_cart_id', id);
  }
  return id;
}

function parseItemsFromResponse(data: CartApiResponse): CartItem[] {
  const rawList = Array.isArray(data.cart?.items)
    ? data.cart!.items
    : Array.isArray(data.items)
    ? data.items
    : [];

  return rawList.map((item) => ({
    product_id: String(item.product_id || ''),
    name: String(item.name || 'Phụ tùng xe máy'),
    price: Number(item.price || 0),
    quantity: Number(item.quantity || 1),
    stock: Number(item.stock ?? 99),
    image_url: String(item.image_url || '/placeholder-product.png'),
    compatible_vehicles_label: item.compatible_vehicles_label,
  }));
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function CartProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // 1. Lưu giỏ hàng vào localStorage theo userId độc lập
  const updateItems = useCallback((newItems: CartItem[]) => {
    setItems(newItems);
    try {
      const key = getCartStorageKey(user?.userId);
      window.localStorage.setItem(key, JSON.stringify(newItems));
    } catch {
      // ignore
    }
  }, [user?.userId]);

  // 2. Lấy giỏ hàng từ Backend API (cập nhật cả khi rỗng để phản ánh đúng user hiện tại)
  const refreshCart = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiClient.get<CartApiResponse>('/api/cart');
      const apiItems = parseItemsFromResponse(data);
      updateItems(apiItems);
    } catch {
      // Nếu API tạm thời lỗi, nạp lại từ localStorage của chính user đó
      const key = getCartStorageKey(user?.userId);
      try {
        const saved = window.localStorage.getItem(key);
        if (saved) {
          const parsed = JSON.parse(saved);
          setItems(Array.isArray(parsed) ? parsed : []);
        }
      } catch {}
    } finally {
      setIsLoading(false);
      setIsLoaded(true);
    }
  }, [updateItems, user?.userId]);

  // 3. Đồng bộ khi auth state thay đổi (chuyển đổi giữa Customer, Admin, hoặc Guest)
  useEffect(() => {
    getOrCreateGuestId();
    // Chuyển ngay state sang giỏ hàng của user hiện tại
    const key = getCartStorageKey(user?.userId);
    try {
      const saved = window.localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        setItems(Array.isArray(parsed) ? parsed : []);
      } else {
        setItems([]);
      }
    } catch {
      setItems([]);
    }
    void refreshCart();
  }, [isAuthenticated, user?.userId, refreshCart]);

  // ── Actions ─────────────────────────────────────────────────────────────────

  const addToCart = useCallback(
    async (productId: string, quantity = 1, productDetails?: Partial<CartItem>) => {
      setIsLoading(true);

      // Optimistic update UI ngay lập tức
      let optimisticItems: CartItem[] = [];
      setItems((prev) => {
        const existing = prev.find((item) => item.product_id === productId);
        let updated: CartItem[];
        if (existing) {
          updated = prev.map((item) =>
            item.product_id === productId
              ? { ...item, quantity: item.quantity + quantity }
              : item,
          );
        } else {
          const newItem: CartItem = {
            product_id: productId,
            name: productDetails?.name ?? 'Phụ tùng xe máy',
            price: productDetails?.price ?? 0,
            quantity,
            stock: productDetails?.stock ?? 100,
            image_url: productDetails?.image_url ?? '/placeholder-product.png',
          };
          updated = [...prev, newItem];
        }
        optimisticItems = updated;
        return updated;
      });

      // Lưu vào storage của đúng user
      const key = getCartStorageKey(user?.userId);
      try {
        window.localStorage.setItem(key, JSON.stringify(optimisticItems));
      } catch {}

      // Gọi API ngầm
      try {
        const data = await apiClient.post<CartApiResponse>('/api/cart', {
          product_id: productId,
          quantity,
        });
        const serverItems = parseItemsFromResponse(data);
        if (serverItems.length > 0) {
          updateItems(serverItems);
        }
      } catch {
        // Backend lỗi vẫn giữ optimistic state
      } finally {
        setIsLoading(false);
      }
    },
    [updateItems, user?.userId],
  );

  const updateQuantity = useCallback(
    async (productId: string, quantity: number) => {
      // Optimistic UI
      const prevItems = items;
      const updated =
        quantity <= 0
          ? prevItems.filter((i) => i.product_id !== productId)
          : prevItems.map((i) =>
              i.product_id === productId ? { ...i, quantity } : i,
            );

      updateItems(updated);

      try {
        const data = await apiClient.put<CartApiResponse>('/api/cart', {
          product_id: productId,
          quantity,
        });
        const serverItems = parseItemsFromResponse(data);
        if (serverItems.length > 0) {
          updateItems(serverItems);
        }
      } catch {
        // Giữ optimistic update
      }
    },
    [items, updateItems],
  );

  const removeFromCart = useCallback(
    async (productId: string) => {
      await updateQuantity(productId, 0);
    },
    [updateQuantity],
  );

  const clearCart = useCallback(async () => {
    updateItems([]);
    try {
      await apiClient.delete('/api/cart');
    } catch {
      // ignore
    }
  }, [updateItems]);

  // ── Computed ─────────────────────────────────────────────────────────────────

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        subtotal,
        itemCount,
        isLoading,
        isLoaded,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        refreshCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart phải được dùng trong <CartProvider>');
  return ctx;
}

export { CartContext };
