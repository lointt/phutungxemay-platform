'use client';

// ============================================================
// components/customer/vehicle-selector.tsx — Bộ chọn xe nhanh
// Brand → Model → Year → Filter sản phẩm tương thích
// ============================================================

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

// Dữ liệu xe tĩnh — có thể fetch từ API sau
const VEHICLE_DATA: Record<string, Record<string, number[]>> = {
  Yamaha: {
    'Exciter 150': [2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023],
    'NVX 155': [2017, 2018, 2019, 2020, 2021, 2022, 2023],
    'Jupiter': [2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023],
    'Grande': [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023],
    'Sirius': [2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020],
    'R15': [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023],
    'MT-15': [2019, 2020, 2021, 2022, 2023],
  },
  Honda: {
    'Wave Alpha': [2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023],
    'Winner X': [2018, 2019, 2020, 2021, 2022, 2023],
    'Air Blade': [2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023],
    'Vision': [2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023],
    'SH 125/150': [2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023],
    'PCX 125/160': [2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023],
    'CB150R': [2018, 2019, 2020, 2021, 2022],
  },
  Suzuki: {
    'Raider': [2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021],
    'GSX-S150': [2017, 2018, 2019, 2020, 2021],
    'Address': [2014, 2015, 2016, 2017, 2018, 2019, 2020],
  },
  SYM: {
    'Shark': [2016, 2017, 2018, 2019, 2020, 2021],
    'Galaxy': [2017, 2018, 2019, 2020, 2021],
  },
};

const BRANDS = Object.keys(VEHICLE_DATA);

export function VehicleSelector() {
  const router = useRouter();
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');

  const models = brand ? Object.keys(VEHICLE_DATA[brand] ?? {}) : [];
  const years = brand && model ? (VEHICLE_DATA[brand]?.[model] ?? []).sort((a, b) => b - a) : [];

  function handleSearch() {
    if (!brand) return;
    const params = new URLSearchParams();
    params.set('compatible_brand', brand);
    if (model) params.set('compatible_model', model);
    router.push(`/products?${params.toString()}`);
  }

  function handleReset() {
    setBrand('');
    setModel('');
    setYear('');
  }

  return (
    <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
          <svg className="w-4 h-4 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10l2 2h8l2-2zM8 6h3m-3 3h3m-3 3h3M1 10h3" />
          </svg>
        </div>
        <div>
          <h3 className="font-semibold text-gray-800 text-sm">Tìm phụ tùng theo xe của bạn</h3>
          <p className="text-xs text-gray-500">Chọn hãng → dòng xe → đời xe</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Hãng xe */}
        <select
          value={brand}
          onChange={(e) => { setBrand(e.target.value); setModel(''); setYear(''); }}
          className={cn(
            'px-3 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 transition-colors',
            brand ? 'border-orange-300 bg-orange-50 text-gray-800' : 'border-gray-200 text-gray-500',
          )}
        >
          <option value="">🏭 Chọn hãng xe</option>
          {BRANDS.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>

        {/* Dòng xe */}
        <select
          value={model}
          onChange={(e) => { setModel(e.target.value); setYear(''); }}
          disabled={!brand}
          className={cn(
            'px-3 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 transition-colors',
            model ? 'border-orange-300 bg-orange-50 text-gray-800' : 'border-gray-200 text-gray-500',
            !brand && 'opacity-50 cursor-not-allowed',
          )}
        >
          <option value="">🏍️ Chọn dòng xe</option>
          {models.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>

        {/* Đời xe */}
        <select
          value={year}
          onChange={(e) => setYear(e.target.value)}
          disabled={!model}
          className={cn(
            'px-3 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 transition-colors',
            year ? 'border-orange-300 bg-orange-50 text-gray-800' : 'border-gray-200 text-gray-500',
            !model && 'opacity-50 cursor-not-allowed',
          )}
        >
          <option value="">📅 Đời xe</option>
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      <div className="flex gap-2 mt-3">
        <button
          onClick={handleSearch}
          disabled={!brand}
          className={cn(
            'flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all',
            'bg-orange-500 hover:bg-orange-400 text-white',
            'disabled:opacity-50 disabled:cursor-not-allowed',
          )}
        >
          Tìm phụ tùng phù hợp →
        </button>
        {brand && (
          <button
            onClick={handleReset}
            className="px-3 py-2.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            Xóa
          </button>
        )}
      </div>
    </div>
  );
}
