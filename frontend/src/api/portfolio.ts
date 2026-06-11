import axios from 'axios';
import type { Holding, PortfolioSummary, AUMSummary, PortfolioSnapshot } from '@/types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export const portfolioApi = axios.create({
  baseURL: `${BASE_URL}/portfolio/api/v1`,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
});

portfolioApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const portfolioService = {
  getHoldings: async (clientId: string): Promise<Holding[]> => {
    const { data } = await portfolioApi.get<Holding[]>('/holdings', {
      params: { client_id: clientId },
    });
    return data;
  },

  getSummary: async (clientId: string): Promise<PortfolioSummary> => {
    const { data } = await portfolioApi.get<PortfolioSummary>(`/portfolio/summary/${clientId}`);
    return data;
  },

  getAUM: async (): Promise<AUMSummary> => {
    const { data } = await portfolioApi.get<AUMSummary>('/portfolio/aum');
    return data;
  },

  getHistory: async (clientId: string, days = 30): Promise<PortfolioSnapshot[]> => {
    const { data } = await portfolioApi.get<PortfolioSnapshot[]>(`/portfolio/history/${clientId}`, {
      params: { days },
    });
    return data;
  },

  createHolding: async (payload: Partial<Holding>): Promise<Holding> => {
    const { data } = await portfolioApi.post<Holding>('/holdings', payload);
    return data;
  },

  updatePrices: async (prices: { symbol: string; current_price: number; previous_close?: number }[]) => {
    await portfolioApi.post('/holdings/price-update', { prices });
  },
};
