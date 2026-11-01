import { PolicyViewer } from '@/components/customer/policy-viewer';

export const metadata = {
  title: 'Chính sách Bảo hành Phụ tùng — Phụ Tùng Xe Máy',
  description: 'Quy định thời hạn bảo hành chính hãng từ 1 đến 6 tháng cho từng nhóm phụ tùng máy, giảm xóc, điện tử.',
};

export default function WarrantyPolicyPage() {
  return <PolicyViewer slug="chinh-sach-bao-hanh" defaultTitle="Chính sách Bảo hành Phụ tùng" />;
}
