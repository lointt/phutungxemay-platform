import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/auth-context";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    template: "%s | Phụ Tùng Xe Máy",
    default: "Phụ Tùng Xe Máy - Chính Hãng, Giá Tốt, Giao Nhanh",
  },
  description:
    "Mua phụ tùng xe máy chính hãng giá tốt. Tư vấn kỹ thuật bởi Kỹ Sư AI. Giao hàng toàn quốc.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_CDN_BASE_URL ?? "https://d1ksuy3hfmko20.cloudfront.net"
  ),
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="vi"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
