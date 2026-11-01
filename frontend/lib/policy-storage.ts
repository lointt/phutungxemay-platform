// ============================================================
// lib/policy-storage.ts — Quản lý & Đồng bộ Chính sách Cửa hàng
// Cung cấp dữ liệu chính sách cho:
// 1. Giao diện người dùng (Footer links: Đổi trả, Bảo hành, Vận chuyển, FAQ, Hướng dẫn)
// 2. Chatbot AI RAG (Đồng bộ vào DynamoDB StorePolicies_Replica & S3 kb.json)
// ============================================================

export interface StorePolicy {
  policy_id: string; // e.g. "POL_RETURN", "POL_WARRANTY", "POL_SHIPPING", "POL_GUIDE", "POL_FAQ"
  title: string;
  category: 'CHINH_SACH' | 'HUONG_DAN' | 'HO_TRO';
  slug: string; // e.g. "chinh-sach-doi-tra"
  content: string; // Markdown text
  summary: string;
  updated_at: string;
}

export const DEFAULT_STORE_POLICIES: StorePolicy[] = [
  {
    policy_id: 'POL_RETURN',
    title: 'Chính sách Đổi trả & Hoàn tiền',
    category: 'CHINH_SACH',
    slug: 'chinh-sach-doi-tra',
    summary: 'Quy định đổi trả hàng trong 7 ngày, điều kiện còn nguyên tem mác và hướng dẫn hoàn tiền qua VNPAY/COD.',
    updated_at: '2026-11-01T08:00:00Z',
    content: `# CHÍNH SÁCH ĐỔI TRẢ VÀ HOÀN TIỀN

### 1. Thời gian và điều kiện áp dụng đổi trả
- **Thời hạn đổi trả:** Trong vòng **07 ngày** kể từ ngày khách hàng nhận được kiện hàng từ đơn vị vận chuyển (GHN/GHTK).
- **Tình trạng sản phẩm:**
  * Sản phẩm còn nguyên vẹn 100%, chưa qua lắp ráp thử lên xe, không trầy xước, dính dầu nhớt.
  * Còn đầy đủ bao bì, hộp đựng gốc, tem niêm phong, phụ kiện đi kèm và hóa đơn/phiếu xuất kho.
  * Đối với phụ tùng điện tử (IC, Bugi, sạc, đèn LED): Còn nguyên vẹn tem bảo hành và chưa đấu nối thử dây điện.

### 2. Các trường hợp được đổi trả miễn phí (100% phí ship cửa hàng chịu)
- Sản phẩm giao sai mã hàng, sai chủng loại hoặc không đúng với mô tả trên website.
- Sản phẩm bị nứt, bể, gãy do lỗi của quá trình vận chuyển (yêu cầu quay video lúc khui hộp đồng kiểm).
- Sản phẩm bị lỗi kỹ thuật xuất phát từ nhà sản xuất (DID, Brembo, NGK, Motul, FCC).

### 3. Trường hợp không hỗ trợ đổi trả
- Khách hàng tự ý mua nhầm chủng loại xe nhưng không báo trước cho tư vấn viên để xác nhận độ tương thích.
- Phụ tùng tiêu hao đã bóc seal sử dụng: Nhớt máy, dung dịch làm mát két nước, chai xịt sên.
- Quá thời hạn 07 ngày kể từ khi ký nhận hàng từ shipper.

### 4. Quy trình hoàn tiền
- **Thanh toán qua VNPAY:** Tiền sẽ được hoàn trực tiếp về tài khoản ngân hàng/thẻ của quý khách trong vòng **1 - 3 ngày làm việc**.
- **Thanh toán COD:** Cửa hàng sẽ chuyển khoản trực tiếp qua số tài khoản ngân hàng của quý khách ngay khi kho nhận và kiểm tra xong kiện hàng trả về.`,
  },
  {
    policy_id: 'POL_WARRANTY',
    title: 'Chính sách Bảo hành Phụ tùng',
    category: 'CHINH_SACH',
    slug: 'chinh-sach-bao-hanh',
    summary: 'Quy định thời hạn bảo hành chính hãng từ 1 đến 6 tháng cho từng nhóm phụ tùng máy, giảm xóc, điện tử.',
    updated_at: '2026-11-01T08:00:00Z',
    content: `# CHÍNH SÁCH BẢO HÀNH CHÍNH HÃNG

### 1. Thời hạn bảo hành theo nhóm phụ tùng
- **Phụ tùng chính hãng cao cấp (Phuộc YSS, Phuộc RCB, Đĩa thắng RCB, Heo dầu Brembo):** Bảo hành **06 tháng** hoặc 10.000 km (tùy điều kiện nào đến trước).
- **Phụ tùng điện & điện tử (Bóng đèn pha Osram, Đèn trợ sáng Kenzo, Bình ắc quy Globe/GS):** Bảo hành **06 tháng** đổi mới nếu bị sụt áp, không cầm điện hoặc đứt tim đèn do lỗi sản xuất.
- **Bugi NGK Iridium bạch kim:** Bảo hành **03 tháng** đánh lửa ổn định.
- **Hệ thống truyền động (Nhông sên dĩa DID, Recto, Dây Curoa Bando, Bộ nồi FCC):** Bảo hành **03 tháng** chống đứt gãy, nhảy sên do lỗi tôi thép.
- **Nhóm phụ tùng hao mòn (Bố thắng, Lọc gió, Nhớt, Nước mát):** Bảo hành kiểm tra chất lượng ban đầu khi mở hộp, không bảo hành hao mòn vật lý tự nhiên trong quá trình vận hành.

### 2. Điều kiện được bảo hành
- Sản phẩm có mã đơn hàng (#ORD_...) lưu trong lịch sử hệ thống website hoặc phiếu bảo hành còn hiệu lực.
- Lắp đặt đúng kỹ thuật, đúng thông số của dòng xe tương ứng.
- Tem bảo hành của cửa hàng hoặc của nhà phân phối dán trên phụ tùng còn nguyên vẹn, không bị cạo sửa, tẩy xóa.

### 3. Các trường hợp từ chối bảo hành
- Hư hỏng do tai nạn giao thông, té ngã, đâm va, ngập nước hoặc vận hành trong điều kiện quá tải.
- Tự ý tháo rã, mài dũa, độ chế sai lệch kết cấu nguyên bản của nhà sản xuất.
- Sử dụng sai chủng loại dầu nhớt hoặc để cạn nhớt gây bó kẹt piston, xước lòng xi-lanh.

### 4. Địa điểm tiếp nhận bảo hành
- **Gửi trực tiếp qua bưu điện/vận chuyển:** Gửi về Trung tâm bảo hành phụ tùng xe máy (Địa chỉ: 123 Võ Văn Ngân, TP. Thủ Đức, TP.HCM). Cửa hàng sẽ chịu 1 đầu phí ship khi gửi trả lại hàng bảo hành cho quý khách.`,
  },
  {
    policy_id: 'POL_SHIPPING',
    title: 'Chính sách Vận chuyển & Giao hàng',
    category: 'CHINH_SACH',
    slug: 'chinh-sach-van-chuyen',
    summary: 'Chi tiết đối tác vận chuyển GHN Express, miễn phí ship cho đơn từ 500.000đ và thời gian giao hàng toàn quốc.',
    updated_at: '2026-11-01T08:00:00Z',
    content: `# CHÍNH SÁCH VẬN CHUYỂN VÀ GIAO HÀNG

### 1. Đối tác giao nhận liên kết
- Toàn bộ đơn hàng được đóng gói bọc xốp bóng khí 3 lớp chuyên dụng cho phụ tùng cơ khí và vận chuyển tự động qua **Giao Hàng Nhanh (GHN Express)** hoặc **GHTK**.
- Hệ thống tự động tạo mã vận đơn (Tracking Code) ngay khi xác nhận đơn, cho phép khách hàng tra cứu tiến trình di chuyển gói hàng 24/7.

### 2. Cước phí vận chuyển
- **Đơn hàng từ 500.000 ₫ trở lên:** **MIỄN PHÍ VẬN CHUYỂN TOÀN QUỐC (Freeship 100%)**.
- **Đơn hàng dưới 500.000 ₫:** Đồng giá phí ship tiết kiệm **30.000 ₫** cho mọi tỉnh thành trên cả nước.

### 3. Thời gian giao hàng dự kiến
- **Khu vực TP. Hồ Chí Minh & lân cận (Bình Dương, Đồng Nai):** Giao nhanh trong **1 - 2 ngày làm việc**.
- **Các tỉnh miền Tây & miền Trung (Đà Nẵng, Cần Thơ, Nha Trang...):** Giao trong **2 - 3 ngày làm việc**.
- **Khu vực Hà Nội và các tỉnh phía Bắc:** Giao trong **3 - 4 ngày làm việc**.
- *Lưu ý: Các tuyến huyện/xã vùng sâu vùng xa thời gian có thể cộng thêm 1 ngày.*

### 4. Quy định đồng kiểm khi nhận hàng
- Quý khách được quyền yêu cầu shipper cho **kiểm tra ngoại quan gói hàng** (đúng mã hàng, nguyên tem mác, đủ số lượng linh kiện) trước khi thanh toán tiền mặt (với đơn COD).
- Vui lòng quay video ngắn khi mở kiện hàng để được ưu tiên xử lý bồi thường nhanh chóng nếu có sự cố cấn móp trong lúc vận chuyển.`,
  },
  {
    policy_id: 'POL_GUIDE',
    title: 'Hướng dẫn Chọn phụ tùng & Mua hàng',
    category: 'HUONG_DAN',
    slug: 'huong-dan',
    summary: 'Cẩm nang hướng dẫn kiểm tra đời xe, thông số kỹ thuật phụ tùng và cách đặt hàng nhanh chóng trực tuyến.',
    updated_at: '2026-11-01T08:00:00Z',
    content: `# HƯỚNG DẪN CHỌN PHỤ TÙNG XE MÁY VÀ ĐẶT HÀNG

### 1. Quy tắc vàng khi chọn mua phụ tùng
- **Kiểm tra chính xác đời xe:** Cùng một dòng xe (ví dụ Exciter 150 hay Winner X) nhưng các đời xe từ 2015 đến 2024 có thể có sự khác biệt về chân bugi, kích thước đĩa thắng, hoặc số mắt sên.
- **Đọc kỹ mục "Lắp vừa các xe":** Mỗi trang chi tiết sản phẩm trên website đều ghi rõ danh sách các dòng xe tương thích 100%.
- **Hỏi Chatbot AI tư vấn kỹ thuật:** Bạn có thể mở khung chat ở góc phải màn hình, nhập tên xe của mình (ví dụ: *"Xe Vario 150 2020 đi bugi và nhớt gì?"*), trợ lý AI sẽ tự động tra cứu phụ tùng tương thích và báo giá chính xác.

### 2. Các bước đặt hàng trực tuyến
1. **Bước 1 - Tìm kiếm & Chọn sản phẩm:** Sử dụng thanh tìm kiếm hoặc duyệt theo danh mục (Truyền động, Động cơ, Giảm xóc, Phanh...).
2. **Bước 2 - Thêm vào giỏ hàng:** Chọn số lượng mong muốn và bấm **"Thêm vào giỏ"**.
3. **Bước 3 - Tiến hành thanh toán:** Nhập thông tin người nhận hàng (Họ tên, SĐT, Địa chỉ chi tiết phường/xã, quận/huyện).
4. **Bước 4 - Chọn phương thức thanh toán:**
   * **Thanh toán khi nhận hàng (COD):** Kiểm tra hàng rồi trả tiền mặt cho shipper.
   * **Cổng thanh toán điện tử VNPAY (QR Pay, Thẻ ATM/Visa):** Quét mã QR thanh toán tức thì an toàn tuyệt đối.
5. **Bước 5 - Theo dõi đơn hàng:** Lưu mã đơn hàng để theo dõi tiến trình đóng gói và vận chuyển GHN tại mục **"Lịch sử đơn hàng"**.`,
  },
  {
    policy_id: 'POL_FAQ',
    title: 'Câu hỏi thường gặp (FAQ) & CSKH',
    category: 'HO_TRO',
    slug: 'faq',
    summary: 'Giải đáp các câu hỏi thắc mắc phổ biến về sản phẩm chính hãng, kiểm tra đơn hàng và thông tin hỗ trợ kỹ thuật.',
    updated_at: '2026-11-01T08:00:00Z',
    content: `# CÂU HỎI THƯỜNG GẶP (FAQ)

### Q1: Phụ tùng tại shop có đảm bảo chính hãng 100% không?
**Trả lời:** Chúng tôi cam kết 100% sản phẩm là hàng chính hãng từ các thương hiệu hàng đầu thế giới (DID, Brembo, NGK, Motul, Liqui Moly, Bando, YSS, RCB, FCC). Nếu phát hiện hàng giả, hàng nhái, shop xin đền bù gấp 10 lần giá trị đơn hàng.

### Q2: Tôi đặt hàng thì bao lâu sẽ nhận được?
**Trả lời:** Đơn hàng nội thành TP.HCM sẽ nhận sau 1 - 2 ngày làm việc. Các tỉnh thành khác nhận sau 2 - 4 ngày thông qua đối tác Giao Hàng Nhanh (GHN Express). Bạn có thể kiểm tra vị trí kiện hàng bất kỳ lúc nào tại trang **"Tra cứu đơn hàng"**.

### Q3: Tôi không rành kỹ thuật, làm sao biết phụ tùng có gắn vừa xe của tôi không?
**Trả lời:** Bạn có thể sử dụng khung **Chatbot AI** ở góc dưới màn hình và gõ: *"Tư vấn phụ tùng cho xe [Tên xe của bạn]"*. Hệ thống AI RAG sẽ tra cứu danh mục kỹ thuật và đề xuất chính xác các món phụ tùng tương thích 100%. Hoặc gọi hotline **1900 xxxx** để gặp kỹ thuật viên hỗ trợ.

### Q4: Nếu sản phẩm nhận về bị lỗi hoặc không vừa thì đổi như thế nào?
**Trả lời:** Quý khách được đổi mới miễn phí trong vòng **07 ngày** kể từ khi nhận hàng. Vui lòng giữ nguyên vỏ hộp, bao bì và liên hệ hotline hoặc chat trực tiếp trên web để được hướng dẫn đổi trả hỏa tốc.

### Q5: Kênh liên hệ hỗ trợ khách hàng chính thức:
- **Hotline hỗ trợ kỹ thuật & Đơn hàng:** 1900 xxxx (8:00 - 21:00 hàng ngày)
- **Email tiếp nhận phản hồi:** hotro@phutungxemay.store
- **Chat trực tuyến:** Bấm vào biểu tượng Chatbot AI ở góc phải màn hình (Hỗ trợ 24/7).`,
  },
];

const POLICIES_STORAGE_KEY = 'phutung_store_policies';

/**
 * Lấy danh sách toàn bộ chính sách
 */
export function getStoredPolicies(): StorePolicy[] {
  if (typeof window === 'undefined') return DEFAULT_STORE_POLICIES;
  try {
    const raw = window.localStorage.getItem(POLICIES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Lỗi đọc chính sách từ localStorage:', e);
  }
  return DEFAULT_STORE_POLICIES;
}

/**
 * Lấy một chính sách theo slug hoặc policy_id
 */
export function getPolicyBySlugOrId(identifier: string): StorePolicy | null {
  const policies = getStoredPolicies();
  return (
    policies.find(
      (p) => p.slug === identifier || p.policy_id.toUpperCase() === identifier.toUpperCase(),
    ) || null
  );
}

/**
 * Lưu hoặc cập nhật một chính sách
 */
export function savePolicy(policy: StorePolicy): void {
  if (typeof window === 'undefined') return;
  try {
    const current = getStoredPolicies();
    const filtered = current.filter((p) => p.policy_id !== policy.policy_id);
    filtered.push({
      ...policy,
      updated_at: new Date().toISOString(),
    });
    window.localStorage.setItem(POLICIES_STORAGE_KEY, JSON.stringify(filtered));
  } catch (e) {
    console.error('Lỗi lưu chính sách:', e);
  }
}

/**
 * Reset hoặc nạp lại 5 chính sách chuẩn
 */
export function resetDefaultPolicies(): StorePolicy[] {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(POLICIES_STORAGE_KEY, JSON.stringify(DEFAULT_STORE_POLICIES));
  }
  return DEFAULT_STORE_POLICIES;
}
