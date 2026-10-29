// ============================================================
// app/(customer)/layout.tsx — Customer Portal Layout
// Bao gồm Header, Footer, và CartProvider
// ============================================================

import type { ReactNode } from 'react';
import { CustomerHeader } from '@/components/customer/header';
import { CustomerFooter } from '@/components/customer/footer';
import { CartProvider } from '@/context/cart-context';
import { ChatWidget } from '@/components/chat/chat-widget';

export default function CustomerLayout({ children }: { children: ReactNode }) {
  return (
    <CartProvider>
      <div className="flex min-h-screen flex-col bg-gray-50">
        <CustomerHeader />
        <main className="flex-1">{children}</main>
        <CustomerFooter />
        <ChatWidget />
      </div>
    </CartProvider>
  );
}
