// ============================================================
// components/customer/footer.tsx — Customer Footer (Server Component)
// ============================================================

import Link from 'next/link';

export function CustomerFooter() {
  return (
    <footer className="bg-gray-900 text-gray-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">

          {/* Brand */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-3 mb-4">
              <img
                src="/brand-logo.png?v=2"
                alt="Phụ Tùng Xe Máy"
                className="w-11 h-11 rounded-xl object-cover shadow-md shadow-orange-500/25 ring-1 ring-orange-500/30"
              />
              <div>
                <span className="font-extrabold text-white text-base tracking-tight block leading-tight">
                  PHỤ TÙNG <span className="text-orange-400">XE MÁY</span>
                </span>
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
                  Genuine Parts Store
                </span>
              </div>
            </div>
            <p className="text-sm text-gray-400 leading-relaxed">
              Chuyên phụ tùng xe máy chính hãng. Tư vấn kỹ thuật trực tuyến 24/7. Giao hàng toàn quốc.
            </p>
            <div className="flex gap-3 mt-4">
              <a href="#" className="w-8 h-8 bg-gray-700 hover:bg-orange-500 rounded-lg flex items-center justify-center transition-colors" aria-label="Facebook">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              </a>
              <a href="#" className="w-8 h-8 bg-gray-700 hover:bg-orange-500 rounded-lg flex items-center justify-center transition-colors" aria-label="Zalo">
                <span className="text-xs font-bold">Za</span>
              </a>
            </div>
          </div>

          {/* Danh mục */}
          <div>
            <h3 className="font-semibold text-white mb-4">Danh Mục</h3>
            <ul className="space-y-2 text-sm">
              {[
                { label: 'Truyền động', href: `/products?category=${encodeURIComponent('Truyền động')}` },
                { label: 'Động cơ', href: `/products?category=${encodeURIComponent('Động cơ')}` },
                { label: 'Giảm xóc', href: `/products?category=${encodeURIComponent('Giảm xóc')}` },
                { label: 'Hệ thống phanh', href: `/products?category=${encodeURIComponent('Hệ thống phanh')}` },
                { label: 'Điện - Đèn', href: `/products?category=${encodeURIComponent('Điện - Đèn')}` },
                { label: 'Nhớt - Lọc', href: `/products?category=${encodeURIComponent('Nhớt - Lọc')}` },
                { label: 'Lốp - Vỏ xe', href: `/products?category=${encodeURIComponent('Lốp - Vỏ xe')}` },
                { label: 'Phụ kiện - Pô xe', href: `/products?category=${encodeURIComponent('Phụ kiện - Pô xe')}` },
              ].map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="hover:text-orange-400 transition-colors">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Hỗ trợ */}
          <div>
            <h3 className="font-semibold text-white mb-4">Hỗ Trợ</h3>
            <ul className="space-y-2 text-sm">
              {[
                { label: 'Tra cứu đơn hàng', href: '/account/orders' },
                { label: 'Chính sách đổi trả', href: '/chinh-sach-doi-tra' },
                { label: 'Hướng dẫn mua hàng', href: '/huong-dan' },
                { label: 'Câu hỏi thường gặp', href: '/faq' },
              ].map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="hover:text-orange-400 transition-colors">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Liên hệ */}
          <div>
            <h3 className="font-semibold text-white mb-4">Liên Hệ</h3>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2">
                <svg className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                <span>1900 xxxx (8:00 - 21:00)</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                <span>hotro@phutungxemay.store</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                <span>TP. Hồ Chí Minh, Việt Nam</span>
              </li>
            </ul>

            {/* Phương thức thanh toán */}
            <div className="mt-4">
              <p className="text-xs text-gray-500 mb-2">Thanh toán</p>
              <div className="flex gap-2">
                <div className="px-2 py-1 bg-gray-700 rounded text-xs font-medium">COD</div>
                <div className="px-2 py-1 bg-blue-900 rounded text-xs font-medium text-blue-200">VNPay</div>
                <div className="px-2 py-1 bg-pink-900 rounded text-xs font-medium text-pink-200">MoMo</div>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-700 mt-10 pt-6 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-gray-500">
          <p>© 2024 Phụ Tùng Xe Máy. Tất cả quyền được bảo lưu.</p>
          <div className="flex gap-4">
            <Link href="/chinh-sach-bao-mat" className="hover:text-gray-300 transition-colors">Chính sách bảo mật</Link>
            <Link href="/dieu-khoan" className="hover:text-gray-300 transition-colors">Điều khoản sử dụng</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
