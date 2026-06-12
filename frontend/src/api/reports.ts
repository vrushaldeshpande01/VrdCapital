import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export const reportApi = axios.create({
  baseURL: `${BASE_URL}/reports/api/v1`,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

reportApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export type ReportType = 'portfolio_summary' | 'client_statement' | 'tax_report' | 'performance' | 'order_history';
export type ReportFormat = 'PDF' | 'XLSX' | 'CSV';
export type ReportPeriod = 'this_month' | 'last_month' | 'this_quarter' | 'this_fy' | 'last_fy' | 'custom';
export type ReportStatus = 'PENDING' | 'GENERATING' | 'READY' | 'FAILED';

export interface Report {
  id: string;
  name: string;
  report_type: ReportType;
  format: ReportFormat;
  period: ReportPeriod;
  status: ReportStatus;
  size: string;
  created_at: string;
  completed_at: string | null;
  error_message: string | null;
}

export interface GeneratePayload {
  report_type: ReportType;
  format: ReportFormat;
  period: ReportPeriod;
  date_from?: string;
  date_to?: string;
}

export const reportsService = {
  generate: (payload: GeneratePayload) =>
    reportApi.post<Report>('/reports', payload),

  list: () =>
    reportApi.get<Report[]>('/reports'),

  status: (id: string) =>
    reportApi.get<Report>(`/reports/${id}/status`),

  download: async (id: string, name: string, format: ReportFormat) => {
    const res = await reportApi.get(`/reports/${id}/download`, { responseType: 'blob' });
    const ext = format.toLowerCase();
    const url = URL.createObjectURL(new Blob([res.data]));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name.replace(/[^a-zA-Z0-9 _-]/g, '').trim()}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  },
};
