import { Platform } from 'react-native';

type Primitive = string | number | boolean | null | undefined;
type QueryParams = Record<string, Primitive>;

const ENV_API_BASE_URL = process.env.EXPO_PUBLIC_API_URL?.trim();
const PUBLIC_API_BASE_URL = 'http://94.177.204.65/api';

const getDefaultApiUrl = (): string => {
  if (ENV_API_BASE_URL) return ENV_API_BASE_URL;
  if (!__DEV__) return PUBLIC_API_BASE_URL;
  if (Platform.OS === 'android') return 'http://10.0.2.2:8084/api';
  return 'http://localhost:8084/api';
};

export const API_BASE_URL = getDefaultApiUrl();

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

let getToken: (() => Promise<string | null>) | null = null;
export const registerTokenGetter = (getter: () => Promise<string | null>) => {
  getToken = getter;
};

export const getAuthHeaders = async (): Promise<Record<string, string>> => {
  const token = getToken ? await getToken() : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const buildUrl = (endpoint: string, params?: QueryParams) => {
  const url = new URL(`${API_BASE_URL}${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    });
  }
  return url.toString();
};

const getErrorMessage = (payload: unknown, status: number): string => {
  const body = payload as { message?: string; errors?: Array<{ msg?: string; message?: string; param?: string; path?: string }> };
  if (body?.message) return body.message;
  if (Array.isArray(body?.errors) && body.errors.length > 0) {
    return body.errors
      .map((error) => error.msg || error.message || error.param || error.path)
      .filter(Boolean)
      .join(', ');
  }
  return `HTTP ${status}`;
};

const request = async <T>(endpoint: string, init: RequestInit = {}, params?: QueryParams): Promise<T> => {
  const token = getToken ? await getToken() : null;
  const url = buildUrl(endpoint, params);
  const method = init.method || 'GET';

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.headers || {}),
      },
    });
  } catch (error: any) {
    throw new ApiError(`Network failed (${method} ${url}): ${error?.message || 'Network request failed'}`, 0, 'NETWORK_ERROR');
  }

  const payload = (await response.json().catch(() => ({}))) as T;
  if (!response.ok) {
    const err = payload as { message?: string; code?: string };
    throw new ApiError(`${getErrorMessage(payload, response.status)} (${method} ${url})`, response.status, err?.code);
  }

  return payload;
};

/** Backend list endpoints: `{ success, data: T[] }` — returns the array only. */
export function apiListField<T>(body: { data?: T[] } | null | undefined): T[] {
  const list = body?.data;
  return Array.isArray(list) ? list : [];
}

/** Backend detail/create envelopes: `{ success, data: T }`. */
export function apiDataField<T>(body: { data?: T } | null | undefined): T | undefined {
  return body?.data;
}

/** Multipart POST with Bearer auth; do not set Content-Type (boundary required). */
export const postFormData = async <T>(endpoint: string, formData: FormData): Promise<T> => {
  const token = getToken ? await getToken() : null;
  const url = buildUrl(endpoint);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      body: formData,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  } catch (error: any) {
    throw new ApiError(`Network failed (POST ${url}): ${error?.message || 'Network request failed'}`, 0, 'NETWORK_ERROR');
  }

  const payload = (await response.json().catch(() => ({}))) as T;
  if (!response.ok) {
    const err = payload as { message?: string; code?: string };
    throw new ApiError(`${getErrorMessage(payload, response.status)} (POST ${url})`, response.status, err?.code);
  }

  return payload;
};

export const apiClient = {
  get: <T>(endpoint: string, params?: QueryParams) => request<T>(endpoint, { method: 'GET' }, params),
  post: <T>(endpoint: string, body: unknown) =>
    request<T>(endpoint, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(endpoint: string, body: unknown) =>
    request<T>(endpoint, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(endpoint: string, body: unknown) =>
    request<T>(endpoint, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' }),
};