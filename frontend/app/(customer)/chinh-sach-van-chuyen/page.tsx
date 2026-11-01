import { PolicyViewer } from '@/components/customer/policy-viewer';

export const metadata = {
  title: 'Chính sách Vận chuyển & Giao hàng — Phụ Tùng Xe Máy',
  description: 'Chi tiết đối tác vận chuyển GHN Express, miễn phí ship cho đơn từ 500.000đ và thời gian giao hàng toàn quốc.',
};

export default function ShippingPolicyPage() {
  return <PolicyViewer slug="chinh-sach-van-chuyen" defaultTitle="Chính sách Vận chuyển & Giao hàng" />;
}
