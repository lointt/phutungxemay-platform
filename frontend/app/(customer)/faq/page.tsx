import { PolicyViewer } from '@/components/customer/policy-viewer';

export const metadata = {
  title: 'Câu hỏi thường gặp (FAQ) — Phụ Tùng Xe Máy',
  description: 'Giải đáp các câu hỏi thắc mắc phổ biến về sản phẩm chính hãng, kiểm tra đơn hàng và thông tin hỗ trợ kỹ thuật.',
};

export default function FAQPolicyPage() {
  return <PolicyViewer slug="faq" defaultTitle="Câu hỏi thường gặp (FAQ) & CSKH" />;
}
