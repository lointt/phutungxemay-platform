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
      <div className="flex min-h-screen w-full max-w-[100vw] overflow-x-hidden flex-col bg-gray-50">
        <CustomerHeader />
        <main className="flex-1 w-full min-w-0">{children}</main>
        <CustomerFooter />
        <ChatWidget />
      </div>
    </CartProvider>
  );
}
