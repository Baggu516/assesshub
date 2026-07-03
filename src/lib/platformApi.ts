import axios, { type AxiosError } from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL || '/api';

export const PLATFORM_KEY_STORAGE = 'tm_platform_api_key';
export const PLATFORM_TOKEN_STORAGE = 'tm_platform_access_token';

export function getPlatformToken() {
  return sessionStorage.getItem(PLATFORM_TOKEN_STORAGE);
}

export function setPlatformToken(token: string) {
  sessionStorage.setItem(PLATFORM_TOKEN_STORAGE, token.trim());
}

export function getPlatformKey() {
  return sessionStorage.getItem(PLATFORM_KEY_STORAGE);
}

export function setPlatformKey(key: string) {
  sessionStorage.setItem(PLATFORM_KEY_STORAGE, key.trim());
}

/** Clears JWT and optional legacy API key. */
export function clearPlatformSession() {
  sessionStorage.removeItem(PLATFORM_TOKEN_STORAGE);
  sessionStorage.removeItem(PLATFORM_KEY_STORAGE);
}

/** @deprecated use clearPlatformSession */
export const clearPlatformKey = clearPlatformSession;

/** True if user has either JWT session or legacy key. */
export function hasPlatformAccess() {
  return !!(getPlatformToken() || getPlatformKey());
}

export const platformApi = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
});

platformApi.interceptors.request.use((config) => {
  const token = getPlatformToken();
  const key = getPlatformKey();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else if (key) {
    config.headers['X-Platform-Key'] = key;
  }
  return config;
});

platformApi.interceptors.response.use(
  (r) => r,
  (error: AxiosError) => {
    const status = error.response?.status;
    if (status === 401 || status === 403) {
      clearPlatformSession();
      const path = window.location.pathname;
      if (!path.startsWith('/platform/login')) {
        window.location.assign('/platform/login');
      }
    }
    throw error;
  }
);
