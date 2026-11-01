'use client';

// ============================================================
// app/(admin)/admin/products/page.tsx — Quản lý Sản phẩm & Tồn kho
// Hỗ trợ Thêm mới, Chỉnh sửa, Cập nhật tồn kho nhanh, Xóa
// ============================================================

import { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import { getAdminCustomProducts, saveAdminProduct, deleteAdminProduct } from '@/lib/admin-storage';
import apiClient from '@/lib/api-client';
import { normalizeDynamoProduct } from '@/lib/product-normalizer';
import { formatCurrencyVND, getCategoryLabel, getImageUrl } from '@/lib/utils';
import type { Product } from '@/types/product';

const CATEGORIES = [
  'Truyền động',
  'Động cơ',
  'Giảm xóc',
  'Hệ thống phanh',
  'Điện - Đèn',
  'Nhớt - Lọc',
  'Khác',
];

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [stockFilter, setStockFilter] = useState<'ALL' | 'IN_STOCK' | 'LOW' | 'OUT'>('ALL');
  const [isLoading, setIsLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [brand, setBrand] = useState('Chính hãng');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [price, setPrice] = useState<number>(100000);
  const [stock, setStock] = useState<number>(50);
  const [imageUrl, setImageUrl] = useState('');
  const [description, setDescription] = useState('');
  const [compatibleModels, setCompatibleModels] = useState('Yamaha Exciter 150, Honda Winner X');
  const [isSaving, setIsSaving] = useState(false);

  // S3 Pre-signed URL Upload State
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageFile = async (file: File) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadError('Vui lòng chỉ chọn file hình ảnh (PNG, JPG, WEBP, GIF...).');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setUploadError('Dung lượng file tối đa là 10MB.');
      return;
    }

    setIsUploadingImage(true);
    setUploadError(null);

    try {
      // 1. Gọi backend Catalog API để lấy S3 Pre-signed URL
      const data = await apiClient.post<{
        upload_url: string;
        public_url: string;
        s3_key: string;
      }>('/api/products/upload-url', {
        file_name: file.name,
        content_type: file.type || 'image/jpeg',
      });

      if (!data?.upload_url || !data?.public_url) {
        throw new Error('Không nhận được S3 pre-signed URL từ máy chủ.');
      }

      // 2. Upload trực tiếp binary data sang S3 bucket
      const uploadRes = await fetch(data.upload_url, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type || 'image/jpeg',
        },
        body: file,
      });

      if (!uploadRes.ok) {
        throw new Error(`Upload lên Amazon S3 thất bại (HTTP ${uploadRes.status})`);
      }

      // 3. Gán CloudFront CDN URL vào form
      setImageUrl(data.public_url);
    } catch (err: unknown) {
      console.error('Lỗi khi tải ảnh lên S3:', err);
      const msg = err instanceof Error ? err.message : 'Có lỗi xảy ra khi tải ảnh lên Amazon S3';
      setUploadError(msg);
    } finally {
      setIsUploadingImage(false);
    }
  };

  useEffect(() => {
    async function fetchProducts() {
      setIsLoading(true);
      try {
        const res = await apiClient
          .get<{ items?: Record<string, unknown>[] }>('/api/products')
          .catch(() => null);
        let items: Product[] = [];
        if (res?.items && Array.isArray(res.items)) {
          items = res.items.map(normalizeDynamoProduct);
        }

        const custom = getAdminCustomProducts();
        const map = new Map<string, Product>();
        // 1. Nạp sản phẩm nháp từ storage trước
        custom.forEach((p) => map.set(p.product_id || p.ProductID || '', p));
        // 2. Sản phẩm từ AWS DynamoDB là SOURCE OF TRUTH: đè lên để thông tin tồn kho và giá luôn đồng bộ thực tế 100%
        items.forEach((p) => map.set(p.product_id || p.ProductID || '', p));

        setProducts(Array.from(map.values()));
      } catch {
        setProducts(getAdminCustomProducts());
      } finally {
        setIsLoading(false);
      }
    }

    void fetchProducts();
  }, []);

  const openAddModal = () => {
    setEditingProduct(null);
    setName('');
    const randomCode = Math.floor(100 + Math.random() * 900);
    setSku(`PROD_NEW_${randomCode}`);
    setBrand('Chính hãng');
    setCategory(CATEGORIES[0]);
    setPrice(150000);
    setStock(50);
    setImageUrl('');
    setUploadError(null);
    setDescription('Phụ tùng chính hãng chất lượng cao, chịu nhiệt và độ bền vượt trội.');
    setCompatibleModels('Honda Wave, Yamaha Exciter 150, Winner X');
    setIsModalOpen(true);
  };

  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setName(p.name);
    setSku(p.sku || p.product_id || p.ProductID || '');
    setBrand(p.brand || 'Chính hãng');
    setCategory(p.category || CATEGORIES[0]);
    setPrice(p.price);
    setStock(p.stock);
    setImageUrl(p.image_urls?.[0] || p.image_url || '');
    setUploadError(null);
    setDescription(p.description || '');
    setCompatibleModels((p.compatible_models || []).join(', '));
    setIsModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSaving(true);
    const productId = editingProduct
      ? editingProduct.product_id || editingProduct.ProductID || ''
      : sku.trim() || `PROD_${Date.now()}`;

    const models = compatibleModels
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const productPayload: Product = {
      product_id: productId,
      ProductID: productId,
      name: name.trim(),
      sku: sku.trim() || productId,
      brand: brand.trim(),
      category: category,
      price: Number(price),
      stock: Number(stock),
      image_urls: imageUrl.trim() ? [imageUrl.trim()] : [],
      image_url: imageUrl.trim() || undefined,
      description: description.trim(),
      compatible_models: models,
      compatible_vehicles: models.map((m) => {
        const parts = m.split(' ');
        return {
          brand: parts[0] || 'Honda',
          model: parts.slice(1).join(' ') || m,
          year_from: 2018,
          year_to: 2025,
        };
      }),
      specs: {},
      status: 'ACTIVE',
      is_active: true,
      created_at: editingProduct?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // 1. Chuẩn bị payload chuẩn DynamoDB theo CatalogServiceHandler Lambda
    const cleanPayload = {
      ProductID: productId,
      product_id: productId,
      name: name.trim(),
      sku: sku.trim() || productId,
      brand: brand.trim(),
      category: category,
      price: Number(price),
      stock: Number(stock),
      image_url: imageUrl.trim() || 'https://d1yvm1htsd670r.cloudfront.net/images/elig-em050.jpg',
      image_urls: imageUrl.trim() ? [imageUrl.trim()] : ['https://d1yvm1htsd670r.cloudfront.net/images/elig-em050.jpg'],
      description: description.trim(),
      compatible_models: models,
      status: 'ACTIVE',
      updated_at: new Date().toISOString(),
      ...(editingProduct?.created_at ? { created_at: editingProduct.created_at } : { created_at: new Date().toISOString() }),
    };

    // 2. Đồng bộ lên Backend API DynamoDB (AWS)
    let syncSuccess = false;
    let syncErrorMsg = '';
    try {
      if (editingProduct) {
        await apiClient.put(`/api/products/${productId}`, cleanPayload);
      } else {
        await apiClient.post('/api/products', cleanPayload);
      }
      syncSuccess = true;
    } catch (err: unknown) {
      console.error('Backend API product sync error:', err);
      syncErrorMsg = err instanceof Error ? err.message : String(err);
    }

    // 3. Lưu vào storage admin cục bộ làm cache tức thời
    saveAdminProduct(productPayload);

    // 4. Cập nhật state
    setProducts((prev) => {
      const filtered = prev.filter((p) => (p.product_id || p.ProductID) !== productId);
      return [productPayload, ...filtered];
    });

    setIsSaving(false);
    setIsModalOpen(false);

    if (syncSuccess) {
      alert(`✅ Đã đồng bộ thành công sản phẩm "${name.trim()}" (ID: ${productId}) vào cơ sở dữ liệu DynamoDB trên AWS!`);
    } else {
      alert(`⚠️ Lưu tạm cục bộ. Không thể đồng bộ trực tiếp lên DynamoDB AWS. Lỗi: ${syncErrorMsg}`);
    }
  };

  const handleDelete = async (productId: string, productName: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa phụ tùng "${productName}" khỏi hệ thống?`)) {
      return;
    }

    deleteAdminProduct(productId);
    try {
      await apiClient.delete(`/api/products/${productId}`);
    } catch {
      // ignore
    }

    setProducts((prev) => prev.filter((p) => (p.product_id || p.ProductID) !== productId));
  };

  const handleStockDelta = async (product: Product, delta: number) => {
    const newStock = Math.max(0, product.stock + delta);
    const prodId = product.product_id || product.ProductID || '';
    const updated: Product = {
      ...product,
      stock: newStock,
      updated_at: new Date().toISOString(),
    };
    saveAdminProduct(updated);
    setProducts((prev) =>
      prev.map((p) =>
        (p.product_id || p.ProductID) === (updated.product_id || updated.ProductID)
          ? updated
          : p,
      ),
    );

    try {
      await apiClient.put(`/api/products/${prodId}`, {
        ...updated,
        stock: newStock,
      });
    } catch {
      // Backend catalog sync fallback
    }
  };

  // Lọc sản phẩm
  const filteredProducts = products.filter((p) => {
    const matchSearch =
      !search.trim() ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(search.toLowerCase())) ||
      (p.brand && p.brand.toLowerCase().includes(search.toLowerCase()));

    const matchCategory =
      selectedCategory === 'ALL' ||
      p.category === selectedCategory ||
      getCategoryLabel(p.category) === selectedCategory;

    let matchStock = true;
    if (stockFilter === 'IN_STOCK') matchStock = p.stock > 5;
    if (stockFilter === 'LOW') matchStock = p.stock > 0 && p.stock <= 5;
    if (stockFilter === 'OUT') matchStock = p.stock === 0;

    return matchSearch && matchCategory && matchStock;
  });

  return (
    <div className="space-y-6">
      {/* ── Top Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">
            Quản lý Phụ Tùng & Tồn Kho
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Tổng cộng {products.length} sản phẩm trong hệ thống Catalog Service.
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="px-4 py-2.5 bg-orange-500 hover:bg-orange-400 text-white font-bold text-xs rounded-xl shadow-md shadow-orange-500/20 transition-all flex items-center gap-2 self-start cursor-pointer"
        >
          <span>+</span> Thêm phụ tùng mới
        </button>
      </div>

      {/* ── Search & Filter Controls ────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-xs flex flex-col md:flex-row gap-3">
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="Tìm theo tên sản phẩm, mã SKU, thương hiệu..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
          <span className="absolute left-3 top-2.5 text-gray-400 text-xs">🔍</span>
        </div>

        {/* Category selector */}
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-3 py-2 text-xs border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
        >
          <option value="ALL">Tất cả danh mục ({CATEGORIES.length})</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        {/* Stock Filter */}
        <select
          value={stockFilter}
          onChange={(e) => setStockFilter(e.target.value as any)}
          className="px-3 py-2 text-xs border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
        >
          <option value="ALL">Tất cả tình trạng kho</option>
          <option value="IN_STOCK">Còn hàng dồi dào (&gt; 5)</option>
          <option value="LOW">Sắp hết hàng (≤ 5)</option>
          <option value="OUT">Hết hàng (0)</option>
        </select>
      </div>

      {/* ── Product Table ───────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-gray-400 animate-pulse">
            Đang tải danh sách phụ tùng...
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <span className="text-4xl">🔍</span>
            <p className="text-sm font-bold text-gray-700">Không tìm thấy phụ tùng phù hợp</p>
            <p className="text-xs text-gray-400">Hãy thử thay đổi từ khóa tìm kiếm hoặc bỏ bớt bộ lọc.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-500 border-b border-gray-100 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Ảnh</th>
                  <th className="py-3 px-4">Tên phụ tùng & SKU</th>
                  <th className="py-3 px-4">Danh mục</th>
                  <th className="py-3 px-4">Giá bán</th>
                  <th className="py-3 px-4">Tồn kho & Điều chỉnh</th>
                  <th className="py-3 px-4">Xe tương thích</th>
                  <th className="py-3 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredProducts.map((p) => {
                  const id = p.product_id || p.ProductID || '';
                  const img = p.image_urls?.[0] || p.image_url;

                  return (
                    <tr key={id} className="hover:bg-gray-50/70 transition-colors">
                      {/* Image */}
                      <td className="py-3 px-4">
                        <div className="w-12 h-12 rounded-xl bg-gray-100 overflow-hidden relative flex-shrink-0 border border-gray-100">
                          {img ? (
                            <Image
                              src={getImageUrl(img)}
                              alt={p.name}
                              fill
                              className="object-cover"
                              sizes="48px"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-sm">🏍️</div>
                          )}
                        </div>
                      </td>

                      {/* Name & SKU */}
                      <td className="py-3 px-4 max-w-xs">
                        <p className="font-bold text-gray-900 line-clamp-1">{p.name}</p>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-400">
                          <span className="font-mono">{p.sku || id}</span>
                          <span>•</span>
                          <span>{p.brand || 'Chính hãng'}</span>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="inline-block px-2.5 py-0.5 bg-gray-100 text-gray-700 rounded-full font-medium text-[11px]">
                          {getCategoryLabel(p.category)}
                        </span>
                      </td>

                      {/* Price */}
                      <td className="py-3 px-4 font-bold text-orange-600 whitespace-nowrap">
                        {formatCurrencyVND(p.price)}
                      </td>

                      {/* Stock & Fast Editor */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              p.stock === 0
                                ? 'bg-red-100 text-red-700'
                                : p.stock <= 5
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-green-100 text-green-700'
                            }`}
                          >
                            {p.stock === 0 ? 'Hết hàng (0)' : `${p.stock} cái`}
                          </span>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleStockDelta(p, -1)}
                              disabled={p.stock <= 0}
                              className="w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold flex items-center justify-center text-xs disabled:opacity-40 cursor-pointer"
                              title="Giảm 1"
                            >
                              -
                            </button>
                            <button
                              onClick={() => handleStockDelta(p, 1)}
                              className="w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold flex items-center justify-center text-xs cursor-pointer"
                              title="Tăng 1"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* Compatibility */}
                      <td className="py-3 px-4 max-w-xs text-[11px] text-gray-500 line-clamp-1">
                        {(p.compatible_models || []).join(', ') || 'Đang cập nhật'}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditModal(p)}
                            className="px-2.5 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded-lg font-bold transition-colors cursor-pointer"
                          >
                            Sửa
                          </button>
                          <button
                            onClick={() => handleDelete(id, p.name)}
                            className="px-2.5 py-1 text-xs text-red-600 hover:bg-red-50 rounded-lg font-bold transition-colors cursor-pointer"
                          >
                            Xóa
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Product Modal (Create / Edit) ───────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200 my-8">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <h3 className="text-lg font-black text-gray-900">
                {editingProduct ? 'Chỉnh sửa phụ tùng' : 'Thêm mới phụ tùng vào kho'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-700 text-lg font-bold p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Tên phụ tùng <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Bố thắng đĩa trước Elig EM050"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    Mã SKU <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Thương hiệu</label>
                  <input
                    type="text"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Danh mục</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-2.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 text-xs bg-white"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Giá bán (VND)</label>
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    value={price}
                    onChange={(e) => setPrice(Number(e.target.value))}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Tồn kho ban đầu</label>
                  <input
                    type="number"
                    min={0}
                    value={stock}
                    onChange={(e) => setStock(Number(e.target.value))}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 text-xs font-bold"
                  />
                </div>
              </div>

              {/* VÙNG TẢI ẢNH LÊN S3 QUA PRE-SIGNED URL */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block font-bold text-gray-700 text-xs">
                    Hình ảnh sản phẩm <span className="text-gray-400 font-normal">(Tải trực tiếp lên Amazon S3)</span>
                  </label>
                  {imageUrl && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-[11px] text-orange-600 hover:text-orange-700 font-semibold cursor-pointer"
                    >
                      Đổi ảnh khác
                    </button>
                  )}
                </div>

                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleImageFile(f);
                  }}
                  className="hidden"
                />

                {/* Khung Preview nếu đã có ảnh */}
                {imageUrl ? (
                  <div className="relative border border-gray-200 rounded-xl p-3 bg-gray-50 flex items-center gap-3">
                    <div className="w-16 h-16 rounded-lg bg-white border border-gray-200 overflow-hidden relative flex-shrink-0 shadow-xs">
                      <Image
                        src={getImageUrl(imageUrl)}
                        alt="Product Preview"
                        fill
                        className="object-cover"
                        sizes="64px"
                        unoptimized
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
                        <span className="text-[11px] font-bold text-gray-800">Ảnh đã lưu trữ trên Amazon S3</span>
                      </div>
                      <p className="text-[10px] text-gray-400 font-mono truncate mt-0.5" title={imageUrl}>
                        {imageUrl}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setImageUrl('')}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer text-sm font-bold"
                      title="Xóa ảnh này"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  /* Vùng kéo thả khi chưa có ảnh */
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      const f = e.dataTransfer.files?.[0];
                      if (f) void handleImageFile(f);
                    }}
                    onClick={() => !isUploadingImage && fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
                      isDragging
                        ? 'border-orange-500 bg-orange-50/50'
                        : 'border-gray-200 hover:border-orange-400 hover:bg-gray-50/50'
                    }`}
                  >
                    {isUploadingImage ? (
                      <div className="flex flex-col items-center justify-center py-2 space-y-2">
                        <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-xs font-bold text-orange-600">Đang tải ảnh trực tiếp lên Amazon S3...</p>
                        <p className="text-[11px] text-gray-400">Vui lòng đợi vài giây</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-2 space-y-1">
                        <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-lg mb-1">
                          ☁️
                        </div>
                        <p className="text-xs font-bold text-gray-700">
                          Kéo thả ảnh vào đây, hoặc <span className="text-orange-600 underline">bấm để chọn ảnh</span>
                        </p>
                        <p className="text-[11px] text-gray-400">Hỗ trợ PNG, JPG, WEBP tối đa 10MB (S3 + CloudFront CDN)</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Báo lỗi nếu có */}
                {uploadError && (
                  <p className="text-[11px] text-red-600 flex items-center gap-1 mt-1">
                    <span>⚠️</span> {uploadError}
                  </p>
                )}

                {/* Nhập URL thủ công (fallback) */}
                <div className="pt-0.5">
                  <details className="text-[11px] text-gray-500 cursor-pointer">
                    <summary className="hover:text-gray-700 select-none">Nhập hoặc sửa link URL ảnh thủ công (tùy chọn)</summary>
                    <input
                      type="text"
                      placeholder="https://d1yvm1htsd670r.cloudfront.net/images/..."
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      className="w-full mt-1.5 px-3 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-400 font-mono text-[11px]"
                    />
                  </details>
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Xe tương thích (cách nhau bởi dấu phẩy)</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Yamaha Exciter 150, Honda Winner X, Wave RSX"
                  value={compatibleModels}
                  onChange={(e) => setCompatibleModels(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Mô tả chi tiết</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 text-xs resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 bg-orange-500 hover:bg-orange-400 text-white font-bold rounded-xl shadow-md shadow-orange-500/25 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? 'Đang lưu vào kho...' : editingProduct ? 'Lưu thay đổi' : 'Tạo phụ tùng'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

