'use client';

// ============================================================
// components/customer/policy-viewer.tsx
// Component hiển thị nội dung chính sách chuẩn SEO, hỗ trợ Markdown
// ============================================================

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getPolicyBySlugOrId, type StorePolicy, DEFAULT_STORE_POLICIES } from '@/lib/policy-storage';
import { formatDate } from '@/lib/utils';

interface PolicyViewerProps {
  slug: string;
  defaultTitle: string;
}

export function PolicyViewer({ slug, defaultTitle }: PolicyViewerProps) {
  const [policy, setPolicy] = useState<StorePolicy | null>(null);

  useEffect(() => {
    const loaded = getPolicyBySlugOrId(slug);
    if (loaded) {
      setPolicy(loaded);
    } else {
      const fallback = DEFAULT_STORE_POLICIES.find((p) => p.slug === slug);
      if (fallback) setPolicy(fallback);
    }
  }, [slug]);

  const activePolicy = policy || DEFAULT_STORE_POLICIES.find((p) => p.slug === slug);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/" className="hover:text-orange-500 transition-colors">Trang chủ</Link>
        <span>/</span>
        <span className="text-gray-400">Chính sách & Hỗ trợ</span>
        <span>/</span>
        <span className="text-gray-800 font-medium">{activePolicy?.title || defaultTitle}</span>
      </nav>

      {/* Main Card */}
      <div className="bg-white rounded-2xl border border-gray-200/90 shadow-sm p-6 sm:p-10 text-gray-800">
        <div className="border-b border-gray-100 pb-6 mb-8">
          <span className="px-3 py-1 bg-orange-50 text-orange-600 border border-orange-200/80 rounded-full text-xs font-bold uppercase tracking-wider inline-block mb-3">
            Chính sách chính thức
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
            {activePolicy?.title || defaultTitle}
          </h1>
          <p className="text-xs text-gray-500 mt-2 flex items-center gap-2">
            <span>🕒 Cập nhật lần cuối:</span>
            <span className="font-medium text-gray-700">
              {activePolicy?.updated_at ? formatDate(activePolicy.updated_at) : 'Mới cập nhật'}
            </span>
          </p>
        </div>

        {/* Content Area */}
        <div className="prose max-w-none text-gray-700 leading-relaxed space-y-4 text-sm sm:text-base">
          {renderMarkdownContent(activePolicy?.content || '')}
        </div>

        {/* Support CTA Box */}
        <div className="mt-12 bg-gradient-to-r from-orange-50 to-amber-50 rounded-2xl p-6 border border-orange-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h4 className="font-bold text-gray-900 text-base">Bạn còn thắc mắc về chính sách này?</h4>
            <p className="text-xs text-gray-600 mt-1">
              Chat trực tuyến với Trợ lý AI hoặc gọi hotline chăm sóc khách hàng 1900 xxxx (8:00 - 21:00).
            </p>
          </div>
          <Link
            href="/#chat"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-orange-500/20 flex-shrink-0"
          >
            💬 Chat với tư vấn viên
          </Link>
        </div>
      </div>
    </div>
  );
}

function renderMarkdownContent(text: string) {
  if (!text) return null;
  const lines = text.split('\n');

  return lines.map((line, idx) => {
    const trimmed = line.trim();

    if (trimmed.startsWith('# ')) {
      return (
        <h2 key={idx} className="text-xl sm:text-2xl font-bold text-gray-900 mt-6 mb-3">
          {trimmed.replace('# ', '')}
        </h2>
      );
    }
    if (trimmed.startsWith('### ')) {
      return (
        <h3 key={idx} className="text-base sm:text-lg font-bold text-gray-900 mt-5 mb-2 text-orange-600">
          {trimmed.replace('### ', '')}
        </h3>
      );
    }
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const content = trimmed.substring(2);
      return (
        <div key={idx} className="flex items-start gap-2.5 pl-2 my-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-2 flex-shrink-0" />
          <span className="flex-1">{renderInline(content)}</span>
        </div>
      );
    }
    if (!trimmed) {
      return <div key={idx} className="h-2" />;
    }
    return (
      <p key={idx} className="leading-relaxed">
        {renderInline(line)}
      </p>
    );
  });
}

function renderInline(str: string) {
  const parts = str.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-bold text-gray-900">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}
