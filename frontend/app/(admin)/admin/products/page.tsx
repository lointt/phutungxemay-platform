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
import { formatCurrencyVND, getCategoryLabel, getImageUrl, cn } from '@/lib/utils';
import type { Product, CompatibleVehicle } from '@/types/product';

interface FormVehicle {
  id: string;
  brand: string;
  model: string;
  year_from: number;
  year_to: number;
  all_years: boolean;
}

const CATEGORIES = [
  'Dầu nhớt & Phụ gia',
  'Hệ thống phanh',
  'Nhông sên dĩa & Bộ nồi',
  'Giảm xóc & Phuộc',
  'Vỏ lốp & Mâm xe',
  'Động cơ & Hút xả',
  'Hệ thống Điện & Chiếu sáng',
  'Dàn áo – Nhựa – Khung sườn',
  'Phụ kiện & Đồ chơi xe',
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
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [manualImageUrl, setManualImageUrl] = useState('');
  const [description, setDescription] = useState('');

  // Structured Compatible Vehicles State
  const [compatibleVehicles, setCompatibleVehicles] = useState<FormVehicle[]>([]);
  const [inputBrand, setInputBrand] = useState('Honda');
  const [inputModel, setInputModel] = useState('');
  const [inputYearFrom, setInputYearFrom] = useState(2018);
  const [inputYearTo, setInputYearTo] = useState(2026);
  const [inputAllYears, setInputAllYears] = useState(false);

  const [isSaving, setIsSaving] = useState(false);

  // S3 Pre-signed URL Upload State
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageFiles = async (files: FileList | File[]) => {
    const fileList = Array.from(files);
    if (fileList.length === 0) return;

    const validFiles = fileList.filter((f) => {
      if (!f.type.startsWith('image/')) {
        setUploadError(`File "${f.name}" không phải định dạng ảnh hợp lệ.`);
        return false;
      }
      if (f.size > 10 * 1024 * 1024) {
        setUploadError(`File "${f.name}" vượt quá dung lượng tối đa 10MB.`);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    setIsUploadingImage(true);
    setUploadError(null);

    const uploaded: string[] = [];
    try {
      for (const file of validFiles) {
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
          throw new Error(`Không nhận được S3 pre-signed URL cho file ${file.name}.`);
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
          throw new Error(`Upload ảnh "${file.name}" lên Amazon S3 thất bại.`);
        }

        uploaded.push(data.public_url);
      }

      setImageUrls((prev) => [...prev, ...uploaded]);
    } catch (err: unknown) {
      console.error('Lỗi khi tải ảnh lên S3:', err);
      const msg = err instanceof Error ? err.message : 'Có lỗi xảy ra khi tải ảnh lên Amazon S3';
      setUploadError(msg);
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleSetPrimaryImage = (index: number) => {
    if (index <= 0 || index >= imageUrls.length) return;
    const target = imageUrls[index];
    const rest = imageUrls.filter((_, i) => i !== index);
    setImageUrls([target, ...rest]);
  };

  const handleRemoveImage = (index: number) => {
    setImageUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddManualUrl = () => {
    const trimmed = manualImageUrl.trim();
    if (!trimmed) return;
    setImageUrls((prev) => [...prev, trimmed]);
    setManualImageUrl('');
    setUploadError(null);
  };

  const handleAddVehicle = () => {
    const trimmedModel = inputModel.trim();
    if (!trimmedModel && inputBrand !== 'Đa năng') return;

    const newVehicle: FormVehicle = {
      id: `v_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      brand: inputBrand,
      model: trimmedModel || 'Tất cả dòng xe',
      year_from: inputAllYears ? 2000 : inputYearFrom || 2015,
      year_to: inputAllYears ? 2030 : inputYearTo || 2026,
      all_years: inputAllYears,
    };

    setCompatibleVehicles((prev) => [...prev, newVehicle]);
    setInputModel('');
  };

  const handleAddUniversalVehicle = () => {
    const exists = compatibleVehicles.some((v) => v.all_years && v.brand === 'Đa năng');
    if (exists) return;
    setCompatibleVehicles((prev) => [
      ...prev,
      {
        id: `v_${Date.now()}_univ`,
        brand: 'Đa năng',
        model: 'Tất cả dòng xe máy',
        year_from: 2000,
        year_to: 2030,
        all_years: true,
      },
    ]);
  };

  const handleRemoveVehicle = (id: string) => {
    setCompatibleVehicles((prev) => prev.filter((v) => v.id !== id));
  };

  useEffect(() => {
    async function fetchProducts() {
      setIsLoading(true);
      try {
        const res = await apiClient
          .get<{ items?: Record<string, unknown>[] }>('/api/products')
          .catch(() => null);
        let items: Product[] = [];
        const rawList = (res as any)?.products ?? res?.items;
        if (rawList && Array.isArray(rawList)) {
          items = rawList.map(normalizeDynamoProduct);
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
    setImageUrls([]);
    setManualImageUrl('');
    setUploadError(null);
    setDescription('Phụ tùng chính hãng chất lượng cao, chịu nhiệt và độ bền vượt trội.');
    setCompatibleVehicles([]);
    setInputBrand('Honda');
    setInputModel('');
    setInputYearFrom(2018);
    setInputYearTo(2026);
    setInputAllYears(false);
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

    const imgs = p.image_urls && p.image_urls.length > 0
      ? p.image_urls
      : p.image_url
      ? [p.image_url]
      : [];
    setImageUrls(imgs);
    setManualImageUrl('');
    setUploadError(null);
    setDescription(p.description || '');

    if (p.compatible_vehicles && p.compatible_vehicles.length > 0) {
      setCompatibleVehicles(
        p.compatible_vehicles.map((v, i) => ({
          id: `v_${i}_${Date.now()}`,
          brand: v.brand || 'Honda',
          model: v.model || '',
          year_from: Number(v.year_from) || 2015,
          year_to: Number(v.year_to) || 2026,
          all_years: (v.year_from <= 2000 && v.year_to >= 2030) || false,
        }))
      );
    } else if (p.compatible_models && p.compatible_models.length > 0) {
      setCompatibleVehicles(
        p.compatible_models.map((m, i) => {
          const parts = m.split(' ');
          return {
            id: `v_${i}_${Date.now()}`,
            brand: parts[0] || 'Honda',
            model: parts.slice(1).join(' ') || m,
            year_from: 2015,
            year_to: 2026,
            all_years: false,
          };
        })
      );
    } else {
      setCompatibleVehicles([]);
    }

    setInputBrand('Honda');
    setInputModel('');
    setInputYearFrom(2018);
    setInputYearTo(2026);
    setInputAllYears(false);
    setIsModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSaving(true);
    const productId = editingProduct
      ? editingProduct.product_id || editingProduct.ProductID || ''
      : sku.trim() || `PROD_${Date.now()}`;

    const vehiclesPayload: CompatibleVehicle[] = compatibleVehicles.map((v) => ({
      brand: v.brand.trim() || 'Chính hãng',
      model: v.model.trim() || 'Tất cả dòng xe',
      year_from: v.all_years ? 2000 : (Number(v.year_from) || 2015),
      year_to: v.all_years ? 2030 : (Number(v.year_to) || 2026),
      all_years: v.all_years || (v.year_from <= 2000 && v.year_to >= 2030),
    }));

    const modelsPayload: string[] = compatibleVehicles.length > 0
      ? compatibleVehicles.map((v) => {
          if (v.all_years || (v.year_from <= 2000 && v.year_to >= 2030)) {
            return `${v.brand} ${v.model} (Tất cả đời xe)`;
          }
          const range = v.year_from === v.year_to ? `${v.year_from}` : `${v.year_from}-${v.year_to}`;
          return `${v.brand} ${v.model} (${range})`;
        })
      : ['Phổ thông (Tất cả đời xe)'];

    const validImageUrls = imageUrls.filter((u) => u.trim().length > 0);
    const finalImageUrls = validImageUrls.length > 0
      ? validImageUrls
      : ['https://d1yvm1htsd670r.cloudfront.net/images/elig-em050.jpg'];
    const primaryImageUrl = finalImageUrls[0];

    const productPayload: Product = {
      product_id: productId,
      ProductID: productId,
      name: name.trim(),
      sku: sku.trim() || productId,
      brand: brand.trim(),
      category: category,
      price: Number(price),
      stock: Number(stock),
      image_urls: finalImageUrls,
      image_url: primaryImageUrl,
      description: description.trim(),
      compatible_models: modelsPayload,
      compatible_vehicles: vehiclesPayload,
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
      image_url: primaryImageUrl,
      image_urls: finalImageUrls,
      compatible_models: modelsPayload,
      compatible_vehicles: vehiclesPayload,
      description: description.trim(),
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
        stock: newStock,
      });
    } catch (err) {
      console.error('Lỗi khi cập nhật tồn kho:', err);
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
                            <>
                              <Image
                                src={getImageUrl(img)}
                                alt={p.name}
                                fill
                                className="object-cover"
                                sizes="48px"
                              />
                              {p.image_urls && p.image_urls.length > 1 && (
                                <span className="absolute bottom-0 right-0 bg-black/75 text-white text-[9px] font-bold px-1 rounded-tl">
                                  +{p.image_urls.length - 1}
                                </span>
                              )}
                            </>
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
                      <td className="py-3 px-4 max-w-xs text-[11px] text-gray-500">
                        <div className="line-clamp-2">
                          {p.compatible_vehicles && p.compatible_vehicles.length > 0
                            ? p.compatible_vehicles
                                .map((v) => {
                                  const yearStr =
                                    v.all_years ||
                                    (v.year_from <= 2000 && v.year_to >= 2030) ||
                                    (v.year_from === 0 && v.year_to === 0)
                                      ? 'Tất cả đời xe'
                                      : v.year_from === v.year_to
                                      ? `${v.year_from}`
                                      : `${v.year_from}-${v.year_to}`;
                                  return `${v.brand} ${v.model} (${yearStr})`;
                                })
                                .join(', ')
                            : (p.compatible_models || []).join(', ') || 'Đang cập nhật'}
                        </div>
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 overflow-y-auto p-4 sm:p-6 flex justify-center items-start">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200 my-4 sm:my-8 relative">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div>
                <h3 className="text-lg font-black text-gray-900">
                  {editingProduct ? 'Chỉnh sửa phụ tùng' : 'Thêm mới phụ tùng vào kho'}
                </h3>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Điền thông tin phụ tùng, hình ảnh và đời xe tương thích
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-800 font-bold flex items-center justify-center transition-colors cursor-pointer"
                title="Đóng cửa sổ"
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

              {/* VÙNG TẢI ẢNH LÊN S3 QUA PRE-SIGNED URL (HỖ TRỢ NHIỀU ẢNH) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block font-bold text-gray-700 text-xs">
                    Hình ảnh sản phẩm{' '}
                    <span className="text-gray-400 font-normal">
                      ({imageUrls.length} ảnh — Tải trực tiếp lên Amazon S3)
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-[11px] text-orange-600 hover:text-orange-700 font-semibold cursor-pointer flex items-center gap-1"
                  >
                    <span>+ Tải thêm ảnh</span>
                  </button>
                </div>

                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    const files = e.target.files;
                    if (files && files.length > 0) void handleImageFiles(files);
                    e.target.value = '';
                  }}
                  className="hidden"
                />

                {/* Danh sách ảnh đã upload (Gallery) */}
                {imageUrls.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-2.5 bg-gray-50/80 rounded-xl border border-gray-200">
                    {imageUrls.map((url, idx) => (
                      <div
                        key={`${url}-${idx}`}
                        className={cn(
                          'group relative rounded-lg overflow-hidden border bg-white flex flex-col',
                          idx === 0 ? 'border-orange-500 shadow-2xs ring-1 ring-orange-500' : 'border-gray-200',
                        )}
                      >
                        <div className="relative aspect-square w-full bg-gray-100">
                          <Image
                            src={getImageUrl(url)}
                            alt={`Ảnh phụ tùng ${idx + 1}`}
                            fill
                            className="object-cover"
                            sizes="120px"
                            unoptimized
                          />
                          {idx === 0 ? (
                            <span className="absolute top-1 left-1 bg-orange-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow">
                              ★ Ảnh chính
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleSetPrimaryImage(idx)}
                              className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/70 hover:bg-orange-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded cursor-pointer"
                              title="Đặt làm ảnh chính hiển thị đầu tiên"
                            >
                              Đặt ảnh chính
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemoveImage(idx)}
                            className="absolute top-1 right-1 w-5 h-5 bg-black/60 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-xs font-bold transition-colors cursor-pointer"
                            title="Xóa ảnh này"
                          >
                            ✕
                          </button>
                        </div>
                        <div className="p-1 bg-white text-center">
                          <p className="text-[9px] text-gray-400 font-mono truncate" title={url}>
                            {url.split('/').pop()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Khung kéo thả hoặc bấm chọn ảnh */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    const files = e.dataTransfer.files;
                    if (files && files.length > 0) void handleImageFiles(files);
                  }}
                  onClick={() => !isUploadingImage && fileInputRef.current?.click()}
                  className={cn(
                    'border-2 border-dashed rounded-xl p-3 text-center cursor-pointer transition-all',
                    isDragging
                      ? 'border-orange-500 bg-orange-50/50'
                      : 'border-gray-200 hover:border-orange-400 hover:bg-gray-50/50',
                  )}
                >
                  {isUploadingImage ? (
                    <div className="flex flex-col items-center justify-center py-2 space-y-1.5">
                      <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-xs font-bold text-orange-600">Đang tải ảnh trực tiếp lên Amazon S3...</p>
                      <p className="text-[10px] text-gray-400">Vui lòng đợi vài giây</p>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2 py-1">
                      <span className="text-base">📸</span>
                      <span className="text-xs font-bold text-gray-700">
                        Kéo thả nhiều ảnh vào đây, hoặc <span className="text-orange-600 underline">chọn từ máy tính</span>
                      </span>
                      <span className="text-[10px] text-gray-400 hidden sm:inline">(PNG, JPG, WEBP tối đa 10MB)</span>
                    </div>
                  )}
                </div>

                {uploadError && (
                  <p className="text-[11px] text-red-600 flex items-center gap-1 mt-1">
                    <span>⚠️</span> {uploadError}
                  </p>
                )}

                {/* Nhập URL thủ công */}
                <div className="pt-0.5">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Dán link URL ảnh nếu có (https://...)"
                      value={manualImageUrl}
                      onChange={(e) => setManualImageUrl(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddManualUrl();
                        }
                      }}
                      className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-400 font-mono text-[11px]"
                    />
                    <button
                      type="button"
                      onClick={handleAddManualUrl}
                      className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                    >
                      + Thêm link
                    </button>
                  </div>
                </div>
              </div>

              {/* XE TƯƠNG THÍCH (HÃNG + MODEL + NĂM / ĐỜI XE) */}
              <div className="space-y-2 border-t border-gray-100 pt-3">
                <div className="flex items-center justify-between">
                  <label className="block font-bold text-gray-700 text-xs">
                    🏍️ Đời xe tương thích{' '}
                    <span className="text-gray-400 font-normal">
                      ({compatibleVehicles.length} dòng xe được hỗ trợ)
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={handleAddUniversalVehicle}
                    className="text-[11px] text-orange-600 hover:text-orange-700 font-semibold cursor-pointer"
                  >
                    + Phổ thông (Dùng cho mọi xe)
                  </button>
                </div>

                {/* Form nhập thêm xe */}
                <div className="p-3 bg-gray-50/90 rounded-xl border border-gray-200 space-y-2.5">
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                    {/* Hãng */}
                    <div className="sm:col-span-3">
                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Hãng xe</label>
                      <select
                        value={inputBrand}
                        onChange={(e) => setInputBrand(e.target.value)}
                        className="w-full px-2.5 py-2 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-800 focus:outline-none focus:ring-1 focus:ring-orange-400"
                      >
                        <option value="Honda">Honda</option>
                        <option value="Yamaha">Yamaha</option>
                        <option value="Suzuki">Suzuki</option>
                        <option value="Piaggio">Piaggio / Vespa</option>
                        <option value="SYM">SYM</option>
                        <option value="Kawasaki">Kawasaki</option>
                        <option value="Đa năng">Phổ thông / Đa năng</option>
                        <option value="Khác">Hãng khác</option>
                      </select>
                    </div>

                    {/* Model / Dòng xe */}
                    <div className="sm:col-span-4">
                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Dòng xe / Model</label>
                      <input
                        type="text"
                        placeholder="Ví dụ: Exciter 150, Winner X..."
                        value={inputModel}
                        onChange={(e) => setInputModel(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddVehicle();
                          }
                        }}
                        className="w-full px-2.5 py-2 bg-white border border-gray-200 rounded-lg text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-orange-400"
                      />
                    </div>

                    {/* Đời xe / Năm */}
                    <div className="sm:col-span-3">
                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Đời xe (Năm)</label>
                      {inputAllYears ? (
                        <div className="w-full px-2 py-2 bg-gray-100 border border-gray-200 rounded-lg text-xs text-gray-500 font-medium text-center truncate">
                          Tất cả đời xe
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min={1990}
                            max={2035}
                            placeholder="Từ"
                            value={inputYearFrom}
                            onChange={(e) => setInputYearFrom(Number(e.target.value))}
                            className="w-16 sm:w-20 px-2 py-2 bg-white border border-gray-200 rounded-lg text-xs text-center font-mono focus:outline-none focus:ring-1 focus:ring-orange-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <span className="text-gray-400 text-xs font-bold">-</span>
                          <input
                            type="number"
                            min={1990}
                            max={2035}
                            placeholder="Đến"
                            value={inputYearTo}
                            onChange={(e) => setInputYearTo(Number(e.target.value))}
                            className="w-16 sm:w-20 px-2 py-2 bg-white border border-gray-200 rounded-lg text-xs text-center font-mono focus:outline-none focus:ring-1 focus:ring-orange-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        </div>
                      )}
                    </div>

                    {/* Nút Thêm */}
                    <div className="sm:col-span-2">
                      <button
                        type="button"
                        onClick={handleAddVehicle}
                        className="w-full py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-lg text-xs transition-colors cursor-pointer shadow-2xs"
                      >
                        + Thêm xe
                      </button>
                    </div>
                  </div>

                  {/* Checkbox tất cả đời xe (ĐÃ BỎ CÁC TAG CHỌN NHANH THEO YÊU CẦU CỦA USER) */}
                  <div className="pt-1.5 border-t border-gray-200/60 flex items-center justify-between">
                    <label className="flex items-center gap-2 text-xs text-gray-700 font-medium cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={inputAllYears}
                        onChange={(e) => setInputAllYears(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-400 cursor-pointer"
                      />
                      <span>Áp dụng cho mọi đời xe</span>
                    </label>
                  </div>
                </div>

                {/* Danh sách các xe tương thích đã thêm */}
                {compatibleVehicles.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1.5 rounded-xl border border-gray-100 bg-white">
                    {compatibleVehicles.map((v) => {
                      const yearDisplay =
                        v.all_years ||
                        (v.year_from <= 2000 && v.year_to >= 2030) ||
                        (v.year_from === 0 && v.year_to === 0)
                          ? 'Tất cả đời xe'
                          : v.year_from === v.year_to
                          ? `${v.year_from}`
                          : `${v.year_from}–${v.year_to}`;
                      return (
                        <span
                          key={v.id}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-orange-50 text-orange-800 border border-orange-200/80 rounded-lg text-xs font-medium"
                        >
                          <span className="font-bold text-orange-900">[{v.brand}]</span>
                          <span>{v.model}</span>
                          <span className="text-orange-600 text-[11px]">({yearDisplay})</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveVehicle(v.id)}
                            className="ml-1 text-orange-400 hover:text-red-600 font-bold text-xs cursor-pointer"
                            title="Xóa xe này"
                          >
                            ✕
                          </button>
                        </span>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-[11px] text-gray-400 italic">
                    Chưa gán xe tương thích nào. Bấm nút "+ Phổ thông" nếu sản phẩm dùng cho mọi dòng xe.
                  </p>
                )}
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

