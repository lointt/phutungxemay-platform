// ============================================================
// lib/validators/index.ts — Zod Validation Schemas for Application
// Kiểm tra & xác thực chặt chẽ dữ liệu đầu vào (Input Validation)
// ============================================================

import { z } from 'zod';

// ─── 1. Schema Đặt hàng & Thanh toán (Order Schema) ──────────────────────────
export const orderItemSchema = z.object({
  productId: z.string().min(1, 'Mã sản phẩm không được để trống'),
  quantity: z.number().int().positive('Số lượng phải là số nguyên dương'),
  price: z.number().positive('Giá sản phẩm phải lớn hơn 0').optional(),
  name: z.string().min(1, 'Tên sản phẩm không được để trống').optional(),
});

export const orderSchema = z.object({
  productId: z.string().min(1, 'Mã sản phẩm không được để trống').optional(),
  quantity: z.number().int().positive('Số lượng phải là số nguyên dương').optional(),
  customerEmail: z.string().email('Email không hợp lệ'),
  customerName: z.string().min(2, 'Họ tên khách hàng tối thiểu 2 ký tự').optional(),
  customerPhone: z.string().regex(/^(0|\+84)[0-9]{9}$/, 'Số điện thoại không hợp lệ').optional(),
  shippingAddress: z.string().min(5, 'Địa chỉ giao hàng quá ngắn').optional(),
  items: z.array(orderItemSchema).min(1, 'Giỏ hàng không được để trống').optional(),
  paymentMethod: z.enum(['COD', 'VNPAY', 'BANKING']).default('COD'),
  totalAmount: z.number().nonnegative('Tổng tiền không hợp lệ').optional(),
});

export type OrderInput = z.infer<typeof orderSchema>;
export type OrderItemInput = z.infer<typeof orderItemSchema>;

// ─── 2. Schema Trừ kho tồn (Inventory Deduction Schema) ───────────────────────
export const deductItemSchema = z.object({
  product_id: z.string().min(1, 'Mã sản phẩm (product_id) không được để trống'),
  quantity: z.number().int().positive('Số lượng trừ kho phải là số nguyên dương'),
});

export const inventoryDeductSchema = z.object({
  items: z.array(deductItemSchema).min(1, 'Danh sách phụ tùng trừ kho không được rỗng'),
  clientAdminToken: z.string().optional(),
});

export type InventoryDeductInput = z.infer<typeof inventoryDeductSchema>;
export type DeductItemInput = z.infer<typeof deductItemSchema>;

// ─── 3. Schema Quản lý Admin Token Server ─────────────────────────────────────
export const serverAdminTokenSchema = z.object({
  idToken: z.string().min(10, 'JWT Token không hợp lệ hoặc quá ngắn'),
  email: z.string().email('Email định dạng không hợp lệ').optional(),
});

export type ServerAdminTokenInput = z.infer<typeof serverAdminTokenSchema>;

// ─── 4. Schema Quản lý Sản phẩm / Phụ tùng (Product Schema) ───────────────────
export const productSchema = z.object({
  ProductID: z.string().min(1, 'Mã sản phẩm không được để trống'),
  name: z.string().min(1, 'Tên phụ tùng không được để trống'),
  price: z.number().nonnegative('Giá bán phải lớn hơn hoặc bằng 0'),
  category: z.string().min(1, 'Danh mục không được để trống'),
  stock: z.number().int().nonnegative('Số lượng tồn kho phải là số không âm').default(0),
  brand: z.string().optional().default('Chính hãng'),
  description: z.string().optional().default(''),
  sku: z.string().optional(),
  image_url: z.string().optional().default(''),
  image_urls: z.array(z.string()).optional().default([]),
  compatible_models: z.array(z.string()).optional().default([]),
});

export const productStockUpdateSchema = z.object({
  stock: z.number().int().nonnegative('Số lượng tồn kho phải là số nguyên không âm'),
});

export type ProductInput = z.infer<typeof productSchema>;
export type ProductStockUpdateInput = z.infer<typeof productStockUpdateSchema>;
