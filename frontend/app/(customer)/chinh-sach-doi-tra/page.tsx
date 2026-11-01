import { PolicyViewer } from '@/components/customer/policy-viewer';

export const metadata = {
  title: 'Chính sách Đổi trả & Hoàn tiền — Phụ Tùng Xe Máy',
  description: 'Quy định đổi trả hàng trong 7 ngày, điều kiện còn nguyên tem mác và quy trình hoàn tiền.',
};

export default function ReturnPolicyPage() {
  return <PolicyViewer slug="chinh-sach-doi-tra" defaultTitle="Chính sách Đổi trả & Hoàn tiền" />;
}
