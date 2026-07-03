import axios, { type AxiosError } from 'axios';
import { queryClient } from './queryClient';
import { clearSessionCache } from './sessionCache';

const ACCESS = 'tm_access_token';
const REFRESH = 'tm_refresh_token';

/** Use Vite proxy `/api` by default. */
const baseURL = import.meta.env.VITE_API_BASE_URL || '/api';

export const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
});

let getSubdomain: () => string | null = () => null;
let onAuthFailure: (() => void) | null = null;

export function configureApiHooks(opts: {
  getSubdomain: () => string | null;
  onAuthFailure?: () => void;
}) {
  getSubdomain = opts.getSubdomain;
  onAuthFailure = opts.onAuthFailure ?? null;
}

export function getStoredAccessToken() {
  return localStorage.getItem(ACCESS);
}

export function setTokens(access: string, refresh: string) {
  localStorage.setItem(ACCESS, access);
  localStorage.setItem(REFRESH, refresh);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS);
  localStorage.removeItem(REFRESH);
}

const TENANT_KEY = 'tm_tenant_subdomain';

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(ACCESS);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  const tenant =
    getSubdomain?.() || (typeof localStorage !== 'undefined' ? localStorage.getItem(TENANT_KEY) : null);
  if (tenant) {
    config.headers['X-Tenant-Subdomain'] = tenant;
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config;
    if (!original) throw error;
    const url = original.url || '';
    const isRefresh = url.includes('/auth/refresh');
    if (error.response?.status === 401 && !isRefresh) {
      const refresh = localStorage.getItem(REFRESH);
      if (refresh) {
        try {
          const { data } = await axios.post(`${baseURL}/auth/refresh`, { refreshToken: refresh });
          setTokens(data.accessToken, data.refreshToken);
          original.headers.Authorization = `Bearer ${data.accessToken}`;
          return api(original);
        } catch {
          clearTokens();
          clearSessionCache();
          queryClient.clear();
          onAuthFailure?.();
        }
      } else {
        onAuthFailure?.();
      }
    }
    throw error;
  }
);
