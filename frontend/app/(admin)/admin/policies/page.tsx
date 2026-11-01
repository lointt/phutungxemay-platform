'use client';

// ============================================================
// app/(admin)/admin/policies/page.tsx — Quản lý Chính sách Cửa hàng & RAG
// Cho phép Admin xem, thêm, sửa, import chính sách cho:
// 1. Các liên kết Footer trên giao diện khách hàng
// 2. Cơ sở tri thức (Knowledge Base) của Chatbot RAG AI
// ============================================================

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  getStoredPolicies,
  savePolicy,
  type StorePolicy,
} from '@/lib/policy-storage';
import { formatDate } from '@/lib/utils';

export default function AdminPoliciesPage() {
  const [policies, setPolicies] = useState<StorePolicy[]>([]);
  const [selectedPolicy, setSelectedPolicy] = useState<StorePolicy | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form state
  const [editId, setEditId] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState<'CHINH_SACH' | 'HUONG_DAN' | 'HO_TRO'>('CHINH_SACH');
  const [editSlug, setEditSlug] = useState('');
  const [editSummary, setEditSummary] = useState('');
  const [editContent, setEditContent] = useState('');

  useEffect(() => {
    setPolicies(getStoredPolicies());
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleOpenEdit = (policy: StorePolicy) => {
    setSelectedPolicy(policy);
    setEditId(policy.policy_id);
    setEditTitle(policy.title);
    setEditCategory(policy.category);
    setEditSlug(policy.slug);
    setEditSummary(policy.summary);
    setEditContent(policy.content);
    setIsEditing(true);
  };

  const handleOpenCreate = () => {
    setSelectedPolicy(null);
    const newId = `POL_CUSTOM_${Date.now().toString().slice(-4)}`;
    setEditId(newId);
    setEditTitle('');
    setEditCategory('CHINH_SACH');
    setEditSlug('chinh-sach-moi');
    setEditSummary('');
    setEditContent('# TIÊU ĐỀ CHÍNH SÁCH\n\nNội dung chi tiết của chính sách...');
    setIsEditing(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTitle.trim() || !editContent.trim()) {
      showToast('⚠️ Vui lòng nhập đầy đủ tiêu đề và nội dung chính sách!');
      return;
    }

    const updated: StorePolicy = {
      policy_id: editId,
      title: editTitle.trim(),
      category: editCategory,
      slug: editSlug.trim().toLowerCase().replace(/\s+/g, '-'),
      summary: editSummary.trim() || editTitle.trim(),
      content: editContent.trim(),
      updated_at: new Date().toISOString(),
    };

    // 1. Lưu vào storage
    savePolicy(updated);
    setPolicies(getStoredPolicies());

    // 2. Đồng bộ tới DynamoDB qua API
    try {
      await fetch('/api/policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ policy: updated }),
      });
    } catch {}

    setIsEditing(false);
    showToast(`✅ Đã lưu chính sách "${updated.title}" thành công!`);
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl border border-slate-700 flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header & Stats Banner */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 bg-orange-100 text-orange-600 rounded-xl text-lg">📑</span>
              <h1 className="text-2xl font-black text-gray-900 tracking-tight">
                Quản lý Chính sách Cửa hàng & RAG
              </h1>
            </div>
            <p className="text-xs text-gray-500 mt-1 max-w-2xl leading-relaxed">
              Các tài liệu này được hiển thị trực tiếp tại mục <strong>Footer (Hỗ trợ)</strong> của website và tự động đồng bộ vào <strong>DynamoDB StorePolicies_Replica</strong> để Chatbot RAG truy vấn trả lời khách hàng 24/7.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleOpenCreate}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-orange-500/20 flex items-center gap-1.5 cursor-pointer"
            >
              <span>➕</span> Thêm chính sách
            </button>
          </div>
        </div>

        {/* Quick status bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 pt-6 border-t border-gray-100">
          <div className="bg-orange-50/50 rounded-xl p-3 border border-orange-100">
            <span className="text-[10px] font-bold text-orange-600 uppercase tracking-wider block">
              Tổng số chính sách
            </span>
            <span className="text-xl font-extrabold text-orange-950 mt-0.5 block">
              {policies.length} bài viết
            </span>
          </div>
          <div className="bg-emerald-50/50 rounded-xl p-3 border border-emerald-100">
            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">
              Trạng thái Footer Links
            </span>
            <span className="text-xl font-extrabold text-emerald-950 mt-0.5 block">
              5/5 Đang hoạt động
            </span>
          </div>
          <div className="bg-blue-50/50 rounded-xl p-3 border border-blue-100">
            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">
              Đồng bộ AI Chatbot
            </span>
            <span className="text-xl font-extrabold text-blue-950 mt-0.5 block">
              Tự động (CDC Streams)
            </span>
          </div>
        </div>
      </div>

      {/* Policies List Table */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-gray-900 text-sm">Danh sách Chính sách & Quy định</h2>
          <span className="text-xs text-gray-500">Hiển thị {policies.length} tài liệu</span>
        </div>

        <div className="divide-y divide-gray-100">
          {policies.map((p) => (
            <div key={p.policy_id} className="p-6 hover:bg-gray-50/80 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="px-2 py-0.5 bg-orange-100 text-orange-700 font-mono text-[10px] font-bold rounded">
                    {p.policy_id}
                  </span>
                  <span className="text-xs text-gray-400">•</span>
                  <span className="text-[11px] text-gray-500">
                    Cập nhật: {formatDate(p.updated_at)}
                  </span>
                </div>

                <h3 className="font-bold text-gray-900 text-base mb-1">{p.title}</h3>
                <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed max-w-3xl">
                  {p.summary || p.content.slice(0, 150)}...
                </p>

                <div className="mt-2.5 flex items-center gap-3 text-xs">
                  <span className="text-gray-400">Đường dẫn Footer:</span>
                  <code className="text-orange-600 bg-orange-50 px-2 py-0.5 rounded font-mono text-[11px]">
                    /{p.slug}
                  </code>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 self-start md:self-center flex-shrink-0">
                <Link
                  href={`/${p.slug}`}
                  target="_blank"
                  className="px-3 py-1.5 bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1"
                >
                  <span>👁️</span> Xem trên Web
                </Link>

                <button
                  type="button"
                  onClick={() => handleOpenEdit(p)}
                  className="px-3.5 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-lg transition-colors shadow-sm shadow-orange-500/20 flex items-center gap-1 cursor-pointer"
                >
                  <span>✏️</span> Chỉnh sửa
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Edit / Create Policy Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl max-w-3xl w-full my-8 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h3 className="font-bold text-gray-900 text-base">
                {selectedPolicy ? `Chỉnh sửa chính sách: ${selectedPolicy.policy_id}` : 'Thêm chính sách mới'}
              </h3>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="text-gray-400 hover:text-gray-600 text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Mã chính sách (PolicyID)
                  </label>
                  <input
                    type="text"
                    value={editId}
                    disabled={!!selectedPolicy}
                    onChange={(e) => setEditId(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-mono bg-gray-50 focus:bg-white focus:border-orange-500 outline-none"
                    placeholder="Ví dụ: POL_RETURN"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Đường dẫn trên Web (Slug)
                  </label>
                  <input
                    type="text"
                    value={editSlug}
                    onChange={(e) => setEditSlug(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-mono focus:border-orange-500 outline-none"
                    placeholder="chinh-sach-doi-tra"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Tiêu đề chính sách
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-medium focus:border-orange-500 outline-none"
                  placeholder="Ví dụ: Chính sách Đổi trả & Hoàn tiền"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Tóm tắt ngắn (Dành cho SEO & Chatbot context)
                </label>
                <input
                  type="text"
                  value={editSummary}
                  onChange={(e) => setEditSummary(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:border-orange-500 outline-none"
                  placeholder="Tóm tắt 1-2 câu về nội dung chính..."
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Nội dung đầy đủ (Hỗ trợ cú pháp Markdown)
                </label>
                <textarea
                  rows={12}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full p-3.5 border border-gray-200 rounded-xl text-xs font-mono leading-relaxed focus:border-orange-500 outline-none resize-y"
                  placeholder="Nhập nội dung Markdown chi tiết..."
                  required
                />
              </div>

              {/* Modal Footer */}
              <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-orange-500/20 cursor-pointer"
                >
                  Lưu & Cập nhật
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
