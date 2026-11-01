import { PolicyViewer } from '@/components/customer/policy-viewer';

export const metadata = {
  title: 'Hướng dẫn Chọn phụ tùng & Mua hàng — Phụ Tùng Xe Máy',
  description: 'Cẩm nang hướng dẫn kiểm tra đời xe, thông số kỹ thuật phụ tùng và cách đặt hàng nhanh chóng trực tuyến.',
};

export default function GuidePolicyPage() {
  return <PolicyViewer slug="huong-dan" defaultTitle="Hướng dẫn Chọn phụ tùng & Mua hàng" />;
}
