import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export const authApi: AxiosInstance = axios.create({
  baseURL: `${BASE_URL}/auth/api/v1`,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
});

export const clientApi: AxiosInstance = axios.create({
  baseURL: `${BASE_URL}/clients/api/v1`,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
});

const attachToken = (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
};

authApi.interceptors.request.use(attachToken);
clientApi.interceptors.request.use(attachToken);

const handleTokenRefresh = async (error: AxiosError, instance: AxiosInstance) => {
  const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
  if (error.response?.status === 401 && !original._retry) {
    original._retry = true;
    try {
      const refreshToken = localStorage.getItem('refresh_token');
      if (!refreshToken) throw new Error('No refresh token');
      const { data } = await authApi.post('/auth/refresh', { refresh_token: refreshToken });
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);
      original.headers.Authorization = `Bearer ${data.access_token}`;
      return instance(original);
    } catch {
      localStorage.clear();
      window.location.href = '/login';
    }
  }
  return Promise.reject(error);
};

authApi.interceptors.response.use(
  (r) => r,
  (err) => handleTokenRefresh(err, authApi),
);
clientApi.interceptors.response.use(
  (r) => r,
  (err) => handleTokenRefresh(err, clientApi),
);
