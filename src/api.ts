// Gọi backend Tâm Tín (API riêng cho đại lý: /client-portal/*)
const API_URL = (import.meta.env.VITE_API_URL || 'https://khacdauapi.tamtin.id.vn').replace(/\/$/, '');
const TOKEN_KEY = 'khacdau_client_token';

export interface Account {
  id: string;
  username: string;
  displayName: string;
  phone: string;
  address: string;
}

export interface CompanyInfo {
  taxCode: string;
  name: string;
  address: string;
  representative?: string;
  establishedDate?: string; // YYYY-MM-DD
  status?: string;
}

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

const storage = {
  get: () => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (token: string | null) => {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* trình duyệt chặn localStorage: chỉ giữ đăng nhập trong phiên */
    }
  },
};

let token = storage.get();
let onUnauthorized: () => void = () => {};

export const setUnauthorizedHandler = (handler: () => void) => {
  onUnauthorized = handler;
};

export const hasToken = () => !!token;

export const logout = () => {
  token = null;
  storage.set(null);
};

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new ApiError('Không kết nối được máy chủ, vui lòng kiểm tra mạng', 0);
  }

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const raw = body?.message;
    const message = Array.isArray(raw) ? raw.join(', ') : raw || 'Có lỗi xảy ra, vui lòng thử lại';
    // 401 ở các API cần đăng nhập => token hết hạn / tài khoản bị khóa
    if (res.status === 401 && path !== '/client-portal/auth/login') {
      logout();
      onUnauthorized();
    }
    throw new ApiError(message, res.status);
  }
  return body as T;
}

export const api = {
  login: async (username: string, password: string) => {
    const data = await request<{ access_token: string; account: Account }>('/client-portal/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    token = data.access_token;
    storage.set(token);
    return data.account;
  },
  me: () => request<Account>('/client-portal/me'),
  lookup: (taxCode: string) => request<CompanyInfo>(`/client-portal/company-lookup/${encodeURIComponent(taxCode)}`),
};
