import api from './client'
import { Application, AuditLog, Contract, Merchant, MFOStats, MultiProductResponse, Product, Tariff, User, normalizeApplication } from '../types'

export interface Installment {
  id: string
  contractId: string
  installmentNumber: number
  dueDate: string
  amount: number
  paidAt: string | null
  status: 'UPCOMING' | 'PAID' | 'OVERDUE'
}

export const apiTariffs = {
  list: () => api.get<Tariff[]>('/api/v1/tariffs').then(r => r.data),
  create: (b: object) => api.post<Tariff>('/api/v1/tariffs', b).then(r => r.data),
  update: (id: string, b: object) => api.put<Tariff>(`/api/v1/tariffs/${id}`, b).then(r => r.data),
  remove: (id: string) => api.delete(`/api/v1/tariffs/${id}`),
  approve: (id: string) => api.patch<Tariff>(`/api/v1/tariffs/${id}/approve`).then(r => r.data),
  reject: (id: string) => api.patch<Tariff>(`/api/v1/tariffs/${id}/reject`).then(r => r.data),
}

export const apiMerchants = {
  list: () => api.get<Merchant[]>('/api/v1/merchants').then(r => r.data),
  create: (b: object) => api.post<Merchant>('/api/v1/merchants', b).then(r => r.data),
  setStatus: (id: string, status: string) =>
    api.patch<Merchant>(`/api/v1/merchants/${id}/status`, { status }).then(r => r.data),
  my: () => api.get<Merchant>('/api/v1/merchants/my').then(r => r.data),
}

export const apiProducts = {
  list: () => api.get<Product[]>('/api/v1/products').then(r => r.data),
  create: (b: object) => api.post<Product>('/api/v1/products', b).then(r => r.data),
  update: (id: string, b: object) => api.put<Product>(`/api/v1/products/${id}`, b).then(r => r.data),
  toggleAvailability: (id: string) =>
    api.patch<Product>(`/api/v1/products/${id}/availability`).then(r => r.data),
  remove: (id: string) => api.delete(`/api/v1/products/${id}`),
}

export interface PagedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export const apiApplications = {
  list: (page = 1, pageSize = 10) =>
    api.get<PagedResponse<any>>('/api/v1/applications', { params: { page, page_size: pageSize } })
      .then(r => ({ ...r.data, items: r.data.items.map(normalizeApplication) })),
  get: (id: string) =>
    api.get<any>(`/api/v1/applications/${id}/detail`).then(r => normalizeApplication(r.data)),
  submit: (b: object) =>
    api.post<any>('/api/v1/applications', b)
      .then(r => normalizeApplication(r.data)),
  submitMulti: (b: object) =>
    api.post<MultiProductResponse>('/api/v1/applications/multi-product', b).then(r => r.data),
  confirm: (id: string, b: object) =>
    api.post<any>(`/api/v1/applications/${id}/confirm`, b).then(r => r.data),
  decide: (id: string, b: object) =>
    api.patch<any>(`/api/v1/applications/${id}/decide`, b)
      .then(r => normalizeApplication(r.data)),
}

export const apiContracts = {
  list: (page = 1, pageSize = 10) =>
    api.get<PagedResponse<Contract>>('/api/v1/contracts', { params: { page, page_size: pageSize } })
      .then(r => r.data),
  schedule: (id: string) =>
    api.get<Installment[]>(`/api/v1/contracts/${id}/schedule`).then(r => r.data),
  downloadPdf: (id: string) => {
    api.get(`/api/v1/contracts/${id}/pdf`, { responseType: 'blob' })
      .then(res => {
        const url = URL.createObjectURL(res.data)
        const a = document.createElement('a')
        a.href = url
        a.download = `shartnoma-${id.slice(-8).toUpperCase()}.pdf`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        setTimeout(() => URL.revokeObjectURL(url), 100)
      })
      .catch(err => console.error('PDF download failed:', err))
  },
  get: (id: string) =>
    api.get<Contract>(`/api/v1/contracts/${id}`).then(r => r.data),
}

export const apiScoringConfig = {
  get: (tariffId: string) =>
    api.get(`/api/v1/tariffs/${tariffId}/scoring-config`).then(r => r.data),
  update: (tariffId: string, b: object) =>
    api.patch(`/api/v1/tariffs/${tariffId}/scoring-config`, b).then(r => r.data),
}

export const apiScore = {
  calculate: (b: object) =>
    api.post('/api/v1/score/calculate', b).then(r => r.data),
}

export const apiProfile = {
  update: (b: object) => api.patch<User>('/api/v1/auth/profile', b).then(r => r.data),
}

export const apiFaceVerify = {
  verify: (passportNumber: string, faceImage: string) =>
    api.post<{ verified: boolean; confidence: number; message: string }>(
      '/api/v1/face-verify',
      { passport_number: passportNumber, face_image: faceImage },
    ).then(r => r.data),
}

export const apiDashboard = {
  mfo: () => api.get<{
    totalMerchants: number
    pendingApplications: number
    approvedThisMonth: number
    totalTurnover: number
    unpaidAmount: number
    monthlyTrend: { month: string; applications: number }[]
  }>('/api/v1/dashboard/mfo').then(r => r.data),

  cb: () => api.get<{
    totalMFOs: number
    totalApplications: number
    totalDisbursed: number
    avgDefaultRate: number
    monthlyTrend: { month: string; applications: number }[]
  }>('/api/v1/dashboard/cb').then(r => r.data),

  mfoList: () => api.get<MFOStats[]>('/api/v1/dashboard/mfo-list').then(r => r.data),
  auditLogs: () => api.get<AuditLog[]>('/api/v1/dashboard/audit-logs').then(r => r.data),
  mfoForecast: () => api.get<{
    monthlyHistory: { month: string; revenue: number; approved: number }[]
    projections: { month: string; projectedRevenue: number }[]
    aiInsight: string
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'
    riskReason: string
  }>('/api/v1/dashboard/mfo/forecast').then(r => r.data),
}
