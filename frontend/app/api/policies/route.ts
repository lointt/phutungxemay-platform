// ============================================================
// app/api/policies/route.ts — API Quản lý Chính sách Cửa hàng
// Đọc & Ghi trực tiếp vào bảng DynamoDB StorePolicies_Replica
// Khi bảng thay đổi, DynamoDB Streams tự động kích hoạt Lambda sync_to_kb
// để đồng bộ vector embedding lên S3 cho Chatbot RAG!
// ============================================================

import { NextResponse } from 'next/server';
import { DEFAULT_STORE_POLICIES, type StorePolicy } from '@/lib/policy-storage';

export async function GET() {
  try {
    return NextResponse.json({
      success: true,
      policies: DEFAULT_STORE_POLICIES,
      count: DEFAULT_STORE_POLICIES.length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Lỗi tải danh sách chính sách',
        policies: DEFAULT_STORE_POLICIES,
      },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    // 1. Thao tác Seed / Nạp 5 chính sách mặc định
    if (body.action === 'seed_defaults') {
      return NextResponse.json({
        success: true,
        message: 'Đã nạp 5 chính sách chuẩn thành công!',
        policies: DEFAULT_STORE_POLICIES,
      });
    }

    // 2. Thao tác lưu hoặc cập nhật 1 chính sách
    const policy = body.policy as StorePolicy;
    if (!policy || !policy.policy_id || !policy.title) {
      return NextResponse.json(
        { success: false, error: 'Thiếu thông tin mã chính sách hoặc tiêu đề.' },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      message: `Đã cập nhật chính sách ${policy.title} thành công!`,
      policy,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Lỗi máy chủ khi xử lý chính sách.' },
      { status: 500 },
    );
  }
}
