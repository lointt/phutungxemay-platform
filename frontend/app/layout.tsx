import type { Metadata } from "next";
import { Be_Vietnam_Pro, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/auth-context";

// Font hỗ trợ đầy đủ dấu tiếng Việt
const beVietnamPro = Be_Vietnam_Pro({
  variable: "--font-be-vietnam-pro",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
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
    process.env.NEXT_PUBLIC_CDN_BASE_URL ?? "https://d1yvm1htsd670r.cloudfront.net"
  ),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="vi"
      className={`${beVietnamPro.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
