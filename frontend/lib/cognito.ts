// ============================================================
// lib/cognito.ts — AWS Cognito authentication service
// Sử dụng: amazon-cognito-identity-js (CLIENT-SIDE ONLY)
// ============================================================

import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserAttribute,
  type CognitoUserSession,
  type IAuthenticationDetailsData,
} from 'amazon-cognito-identity-js';

// ─── Pool Configuration ───────────────────────────────────────────────────────

const USER_POOL_ID = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID ?? 'ap-southeast-1_ecJz9V8QY';
const CLIENT_ID = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID ?? '7rbclbi7o4vun1dpe6k2glmel7';

const userPool = new CognitoUserPool({
  UserPoolId: USER_POOL_ID,
  ClientId: CLIENT_ID,
});

// ─── Return Types ─────────────────────────────────────────────────────────────

export interface CognitoTokens {
  idToken: string;
  accessToken: string;
  refreshToken: string;
  userId: string;       // Cognito 'sub'
  email: string;
  name: string;
  groups: string[];     // 'cognito:groups' claim
  phone?: string;
}

export interface SignUpParams {
  email: string;
  password: string;
  name: string;
  phone?: string;
}

// ─── Helper: Decode JWT claims (không cần thư viện ngoài) ────────────────────

function decodeJwtClaims(token: string): Record<string, unknown> {
  try {
    const payloadB64 = token.split('.')[1];
    if (!payloadB64) return {};
    const base64 = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
    const binStr = atob(base64);
    const bytes = Uint8Array.from(binStr, (c) => c.charCodeAt(0));
    const jsonStr = new TextDecoder('utf-8').decode(bytes);
    return JSON.parse(jsonStr) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function extractTokenInfo(session: CognitoUserSession): CognitoTokens {
  const idToken = session.getIdToken().getJwtToken();
  const accessToken = session.getAccessToken().getJwtToken();
  const refreshToken = session.getRefreshToken().getToken();
  const claims = decodeJwtClaims(idToken);

  return {
    idToken,
    accessToken,
    refreshToken,
    userId: (claims['sub'] as string) ?? '',
    email: (claims['email'] as string) ?? '',
    name: (claims['name'] as string) ?? '',
    groups: (claims['cognito:groups'] as string[]) ?? [],
    phone: claims['phone_number'] as string | undefined,
  };
}

// ─── Auth Functions ───────────────────────────────────────────────────────────

/**
 * Đăng nhập bằng email + password.
 * Trả về tokens nếu thành công, ném lỗi nếu thất bại.
 */
export async function signIn(email: string, password: string): Promise<CognitoTokens> {
  return new Promise((resolve, reject) => {
    const authDetails = new AuthenticationDetails({
      Username: email,
      Password: password,
    } satisfies IAuthenticationDetailsData);

    const cognitoUser = new CognitoUser({
      Username: email,
      Pool: userPool,
    });

    cognitoUser.authenticateUser(authDetails, {
      onSuccess: (session) => {
        resolve(extractTokenInfo(session));
      },
      onFailure: (err: Error) => {
        reject(new Error(mapCognitoError(err.message)));
      },
      newPasswordRequired: () => {
        reject(new Error('Tài khoản yêu cầu đổi mật khẩu. Vui lòng liên hệ hỗ trợ.'));
      },
    });
  });
}

/**
 * Đăng ký tài khoản mới.
 * Sau khi thành công, Cognito gửi OTP xác thực về email.
 */
export async function signUp({ email, password, name, phone }: SignUpParams): Promise<void> {
  return new Promise((resolve, reject) => {
    const attributes: CognitoUserAttribute[] = [
      new CognitoUserAttribute({ Name: 'email', Value: email }),
      new CognitoUserAttribute({ Name: 'name', Value: name }),
    ];

    if (phone) {
      attributes.push(new CognitoUserAttribute({ Name: 'phone_number', Value: phone }));
    }

    userPool.signUp(email, password, attributes, [], (err) => {
      if (err) {
        reject(new Error(mapCognitoError(err.message)));
      } else {
        resolve();
      }
    });
  });
}

/**
 * Xác thực OTP gửi về email sau khi đăng ký.
 */
export async function confirmSignUp(email: string, code: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const cognitoUser = new CognitoUser({
      Username: email,
      Pool: userPool,
    });

    cognitoUser.confirmRegistration(code, true, (err) => {
      if (err) {
        reject(new Error(mapCognitoError(err.message)));
      } else {
        resolve();
      }
    });
  });
}

/**
 * Gửi lại mã OTP xác thực.
 */
export async function resendConfirmationCode(email: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const cognitoUser = new CognitoUser({
      Username: email,
      Pool: userPool,
    });

    cognitoUser.resendConfirmationCode((err) => {
      if (err) {
        reject(new Error(mapCognitoError(err.message)));
      } else {
        resolve();
      }
    });
  });
}

/**
 * Đăng xuất khỏi tất cả thiết bị (globalSignOut) hoặc thiết bị hiện tại.
 */
export async function signOut(): Promise<void> {
  return new Promise((resolve) => {
    const currentUser = userPool.getCurrentUser();
    if (!currentUser) {
      resolve();
      return;
    }
    currentUser.signOut(() => resolve());
  });
}

/**
 * Lấy session hiện tại từ localStorage (do Cognito SDK tự quản lý).
 * Trả về null nếu chưa đăng nhập hoặc token đã hết hạn.
 */
export async function getCurrentSession(): Promise<CognitoTokens | null> {
  return new Promise((resolve) => {
    const currentUser = userPool.getCurrentUser();
    if (!currentUser) {
      resolve(null);
      return;
    }

    currentUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err || !session || !session.isValid()) {
        resolve(null);
        return;
      }
      resolve(extractTokenInfo(session));
    });
  });
}

// ─── Error Message Mapper ─────────────────────────────────────────────────────

function mapCognitoError(message: string): string {
  if (message.includes('UserNotFoundException') || message.includes('Incorrect username or password')) {
    return 'Email hoặc mật khẩu không đúng. Vui lòng thử lại.';
  }
  if (message.includes('NotAuthorizedException')) {
    return 'Email hoặc mật khẩu không đúng. Vui lòng thử lại.';
  }
  if (message.includes('UserNotConfirmedException')) {
    return 'Tài khoản chưa được xác thực. Vui lòng kiểm tra email và nhập mã OTP.';
  }
  if (message.includes('UsernameExistsException')) {
    return 'Email này đã được đăng ký. Vui lòng sử dụng email khác hoặc đăng nhập.';
  }
  if (message.includes('CodeMismatchException')) {
    return 'Mã xác thực không đúng. Vui lòng kiểm tra lại email.';
  }
  if (message.includes('ExpiredCodeException')) {
    return 'Mã xác thực đã hết hạn. Vui lòng yêu cầu gửi lại mã mới.';
  }
  if (message.includes('InvalidPasswordException') || message.includes('Password did not conform')) {
    return 'Mật khẩu phải có ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường và số.';
  }
  if (message.includes('LimitExceededException')) {
    return 'Bạn đã thử quá nhiều lần. Vui lòng đợi một lúc trước khi thử lại.';
  }
  if (message.includes('NetworkError') || message.includes('Failed to fetch')) {
    return 'Lỗi kết nối mạng. Vui lòng kiểm tra kết nối internet và thử lại.';
  }
  return message;
}
