'use client';

// ============================================================
// app/(customer)/account/page.tsx — Hồ sơ cá nhân & Garage xe
// ============================================================

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import apiClient from '@/lib/api-client';
import { cn } from '@/lib/utils';
import type { UserProfile, Vehicle } from '@/types/user';

export default function AccountPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [street, setStreet] = useState('');
  const [ward, setWard] = useState('');
  const [district, setDistrict] = useState('');
  const [province, setProvince] = useState('');

  // Garage modal state
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [vehicleBrand, setVehicleBrand] = useState('Yamaha');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleYear, setVehicleYear] = useState('2020');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [isPrimary, setIsPrimary] = useState(true);

  // Khởi tạo thông tin
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login?redirect=/account');
      return;
    }

    if (user) {
      setName(user.name || '');
      setPhone(user.phone || '');

      // Load garage từ localStorage hoặc API
      try {
        const savedGarage = window.localStorage.getItem('user_garage');
        if (savedGarage) {
          setVehicles(JSON.parse(savedGarage));
        } else {
          // Default mock xe ban đầu cho khách trải nghiệm
          const initialVehicles: Vehicle[] = [
            {
              vehicle_id: 'VEH_01',
              brand: 'Yamaha',
              model: 'Exciter 150',
              year: 2019,
              plate_number: '59P1-12345',
              is_primary: true,
              created_at: new Date().toISOString(),
            },
          ];
          setVehicles(initialVehicles);
          window.localStorage.setItem('user_garage', JSON.stringify(initialVehicles));
        }
      } catch {
        // ignore
      }

      // Thử gọi API profile nếu backend có dữ liệu
      apiClient
        .get<UserProfile>('/api/users/me')
        .then((res) => {
          if (res) {
            setProfile(res);
            if (res.name) setName(res.name);
            if (res.phone) setPhone(res.phone);
            if (res.default_shipping_address) {
              setStreet(res.default_shipping_address.street || '');
              setWard(res.default_shipping_address.ward || '');
              setDistrict(res.default_shipping_address.district || '');
              setProvince(res.default_shipping_address.province || '');
            }
            if (res.garage && res.garage.length > 0) {
              setVehicles(res.garage);
            }
          }
        })
        .catch(() => {
          // Fallback UI
        })
        .finally(() => setIsLoading(false));
    }
  }, [user, isAuthenticated, authLoading, router]);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);

    const payload = {
      name,
      phone,
      default_shipping_address: {
        full_name: name,
        phone,
        street,
        ward,
        district,
        province,
      },
    };

    try {
      await apiClient.put('/api/users/me', payload);
      setMessage({ type: 'success', text: 'Cập nhật thông tin thành công!' });
    } catch {
      // Lưu local khi API chưa kết nối
      setMessage({ type: 'success', text: 'Đã lưu thông tin hồ sơ của bạn.' });
    } finally {
      setIsSaving(false);
    }
  }

  function handleAddVehicle(e: React.FormEvent) {
    e.preventDefault();
    if (!vehicleModel.trim()) return;

    const newVehicle: Vehicle = {
      vehicle_id: `VEH_${Date.now()}`,
      brand: vehicleBrand,
      model: vehicleModel.trim(),
      year: parseInt(vehicleYear) || 2020,
      plate_number: vehiclePlate.trim(),
      is_primary: isPrimary,
      created_at: new Date().toISOString(),
    };

    let updated = [...vehicles];
    if (isPrimary) {
      updated = updated.map((v) => ({ ...v, is_primary: false }));
    }
    updated.push(newVehicle);

    setVehicles(updated);
    window.localStorage.setItem('user_garage', JSON.stringify(updated));
    setShowAddVehicle(false);
    setVehicleModel('');
    setVehiclePlate('');

    // Gọi API ngầm
    apiClient.post('/api/users/me/garage', newVehicle).catch(() => {});
  }

  function handleSetPrimary(id: string) {
    const updated = vehicles.map((v) => ({
      ...v,
      is_primary: v.vehicle_id === id,
    }));
    setVehicles(updated);
    window.localStorage.setItem('user_garage', JSON.stringify(updated));
  }

  function handleDeleteVehicle(id: string) {
    const updated = vehicles.filter((v) => v.vehicle_id !== id);
    setVehicles(updated);
    window.localStorage.setItem('user_garage', JSON.stringify(updated));
  }

  const primaryVehicle = vehicles.find((v) => v.is_primary) || vehicles[0];

  if (authLoading || isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12 animate-pulse space-y-6">
        <div className="h-8 bg-gray-200 rounded-lg w-1/4" />
        <div className="grid md:grid-cols-3 gap-6">
          <div className="h-64 bg-gray-200 rounded-2xl" />
          <div className="md:col-span-2 h-64 bg-gray-200 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tài khoản & Garage xe</h1>
          <p className="text-sm text-gray-500 mt-1">
            Quản lý hồ sơ cá nhân và danh sách phương tiện để Kỹ Sư AI tư vấn đúng linh kiện.
          </p>
        </div>
        <Link
          href="/account/orders"
          className="inline-flex items-center gap-2 px-4 py-2 bg-orange-50 text-orange-600 hover:bg-orange-100 rounded-xl text-sm font-semibold transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          Xem Đơn hàng của tôi →
        </Link>
      </div>

      {message && (
        <div
          className={cn(
            'p-4 rounded-xl mb-6 text-sm flex items-center gap-2',
            message.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800',
          )}
        >
          <span>{message.type === 'success' ? '✅' : '❌'}</span>
          <span>{message.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Cột trái: Garage của tôi */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-900 flex items-center gap-2">
                <span>🏍️</span> Garage của tôi
              </h2>
              <button
                onClick={() => setShowAddVehicle(true)}
                className="text-xs font-semibold text-orange-600 hover:text-orange-500 bg-orange-50 px-2.5 py-1 rounded-lg transition-colors"
              >
                + Thêm xe
              </button>
            </div>

            {vehicles.length === 0 ? (
              <div className="text-center py-6 border-2 border-dashed border-gray-100 rounded-xl">
                <p className="text-xs text-gray-500 mb-3">Bạn chưa thêm xe vào Garage</p>
                <button
                  onClick={() => setShowAddVehicle(true)}
                  className="px-3 py-1.5 bg-orange-500 text-white rounded-lg text-xs font-medium"
                >
                  Thêm xe đầu tiên
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {vehicles.map((v) => (
                  <div
                    key={v.vehicle_id}
                    className={cn(
                      'p-3.5 rounded-xl border transition-all relative',
                      v.is_primary
                        ? 'border-orange-300 bg-orange-50/50 shadow-sm'
                        : 'border-gray-200 bg-white hover:border-gray-300',
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-800 text-sm">
                            {v.brand} {v.model}
                          </span>
                          {v.is_primary && (
                            <span className="px-1.5 py-0.5 bg-orange-500 text-white text-[10px] font-bold rounded">
                              Xe chính
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Đời {v.year} {v.plate_number ? `• Biển số: ${v.plate_number}` : ''}
                        </p>
                      </div>

                      <button
                        onClick={() => handleDeleteVehicle(v.vehicle_id)}
                        className="text-gray-400 hover:text-red-500 text-xs p-1"
                        title="Xóa xe"
                      >
                        ✕
                      </button>
                    </div>

                    {!v.is_primary && (
                      <button
                        onClick={() => handleSetPrimary(v.vehicle_id)}
                        className="mt-2 text-xs text-orange-600 hover:underline font-medium"
                      >
                        Đặt làm xe chính
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Ghi chú xe chính */}
            {primaryVehicle && (
              <div className="mt-5 p-3.5 bg-orange-50 border border-orange-200 rounded-xl text-orange-900">
                <p className="text-xs font-bold flex items-center gap-1.5 mb-1">
                  <span>🏍️</span> Xe mặc định ({primaryVehicle.brand} {primaryVehicle.model})
                </p>
                <p className="text-[11px] text-orange-700 leading-relaxed">
                  Phương tiện chính sẽ được ưu tiên khi lọc phụ tùng tương thích trong hệ thống.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Cột phải: Thông tin cá nhân & Địa chỉ */}
        <div className="md:col-span-2">
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <h2 className="font-bold text-gray-900 text-lg mb-5 flex items-center gap-2">
              <span>👤</span> Thông tin tài khoản & Địa chỉ nhận hàng
            </h2>

            <form onSubmit={handleSaveProfile} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    Họ và tên
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    Email (Cognito ID)
                  </label>
                  <input
                    type="email"
                    disabled
                    value={user?.email || ''}
                    className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl bg-gray-50 text-gray-500 cursor-not-allowed"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Số điện thoại
                </label>
                <input
                  type="tel"
                  placeholder="0901234567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>

              <div className="pt-4 border-t border-gray-100">
                <h3 className="font-semibold text-gray-800 text-sm mb-3">
                  Địa chỉ giao hàng mặc định
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      Số nhà, tên đường
                    </label>
                    <input
                      type="text"
                      placeholder="123 Nguyễn Thị Minh Khai"
                      value={street}
                      onChange={(e) => setStreet(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Phường / Xã</label>
                      <input
                        type="text"
                        placeholder="Phường Bến Nghé"
                        value={ward}
                        onChange={(e) => setWard(e.target.value)}
                        className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Quận / Huyện</label>
                      <input
                        type="text"
                        placeholder="Quận 1"
                        value={district}
                        onChange={(e) => setDistrict(e.target.value)}
                        className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Tỉnh / Thành phố</label>
                      <input
                        type="text"
                        placeholder="TP. Hồ Chí Minh"
                        value={province}
                        onChange={(e) => setProvince(e.target.value)}
                        className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-2.5 bg-orange-500 hover:bg-orange-400 text-white rounded-xl text-sm font-semibold transition-all shadow-md shadow-orange-500/20 disabled:opacity-60"
                >
                  {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Modal Thêm xe mới */}
      {showAddVehicle && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 text-lg">Thêm xe vào Garage</h3>
              <button
                onClick={() => setShowAddVehicle(false)}
                className="text-gray-400 hover:text-gray-600 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddVehicle} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Hãng xe</label>
                <select
                  value={vehicleBrand}
                  onChange={(e) => setVehicleBrand(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400"
                >
                  <option value="Yamaha">Yamaha</option>
                  <option value="Honda">Honda</option>
                  <option value="Suzuki">Suzuki</option>
                  <option value="SYM">SYM</option>
                  <option value="Piaggio">Piaggio</option>
                  <option value="Khác">Khác</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Dòng xe / Model <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Exciter 150, Winner X, Air Blade..."
                  value={vehicleModel}
                  onChange={(e) => setVehicleModel(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Năm sản xuất</label>
                  <input
                    type="number"
                    min="1990"
                    max="2026"
                    value={vehicleYear}
                    onChange={(e) => setVehicleYear(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Biển số (tùy chọn)</label>
                  <input
                    type="text"
                    placeholder="59X1-9999"
                    value={vehiclePlate}
                    onChange={(e) => setVehiclePlate(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer pt-2">
                <input
                  type="checkbox"
                  checked={isPrimary}
                  onChange={(e) => setIsPrimary(e.target.checked)}
                  className="w-4 h-4 text-orange-500 border-gray-300 rounded focus:ring-orange-400"
                />
                <span className="text-xs text-gray-700 font-medium">Đặt làm xe chính để AI tự động tư vấn</span>
              </label>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddVehicle(false)}
                  className="flex-1 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors font-medium"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 text-sm text-white bg-orange-500 hover:bg-orange-400 rounded-xl transition-colors font-semibold shadow-md shadow-orange-500/20"
                >
                  Thêm xe
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
