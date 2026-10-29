// ============================================================
// types/user.ts — User & Garage domain types
// ============================================================

import type { ShippingAddress } from './order';

export type UserGroup = 'Admins' | 'Customers';

/** Thông tin user lưu trong AuthContext (giải mã từ Cognito JWT) */
export interface AuthUser {
  userId: string;         // Cognito 'sub' claim
  email: string;
  name: string;
  groups: UserGroup[];    // Từ 'cognito:groups' claim
  phone?: string;
}

/** Hồ sơ đầy đủ từ GET /api/users/me */
export interface UserProfile {
  user_id: string;        // Cognito sub
  email: string;
  name: string;
  phone?: string;
  default_shipping_address?: ShippingAddress;
  garage: Vehicle[];
  created_at: string;
}

/** Phương tiện trong Garage */
export interface Vehicle {
  vehicle_id: string;
  brand: string;          // Ví dụ: "Yamaha"
  model: string;          // Ví dụ: "Exciter 150"
  year: number;           // Ví dụ: 2019
  plate_number?: string;  // Biển số xe
  is_primary: boolean;    // Xe chính (dùng để personalise Chatbot)
  created_at: string;
}

/** Body gửi lên PUT /api/users/me */
export interface UpdateProfileRequest {
  name?: string;
  phone?: string;
  default_shipping_address?: ShippingAddress;
}

/** Body gửi lên POST /api/users/me/garage */
export interface AddVehicleRequest {
  brand: string;
  model: string;
  year: number;
  plate_number?: string;
  is_primary: boolean;
}
