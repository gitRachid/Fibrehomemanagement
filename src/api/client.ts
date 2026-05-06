import { Platform } from 'react-native';

type Primitive = string | number | boolean | null | undefined;
type QueryParams = Record<string, Primitive>;

const ENV_API_BASE_URL = process.env.EXPO_PUBLIC_API_URL?.trim();

const getDefaultApiUrl = (): string => {
  if (ENV_API_BASE_URL) return ENV_API_BASE_URL;
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

const request = async <T>(endpoint: string, init: RequestInit = {}, params?: QueryParams): Promise<{ data: T }> => {
  const token = getToken ? await getToken() : null;
  const response = await fetch(buildUrl(endpoint, params), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(payload?.message || `HTTP ${response.status}`, response.status, payload?.code);
  }

  return payload;
};

export const apiClient = {
  get: <T>(endpoint: string, params?: QueryParams) => request<T>(endpoint, { method: 'GET' }, params),
  post: <T>(endpoint: string, body: unknown) =>
    request<T>(endpoint, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(endpoint: string, body: unknown) =>
    request<T>(endpoint, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' }),
};