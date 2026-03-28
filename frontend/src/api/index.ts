import api from './client'
import { Application, AuditLog, Contract, Merchant, MFOStats, MultiProductResponse, Product, Tariff, User } from '../types'

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

export const apiApplications = {
  list: () => api.get<Application[]>('/api/v1/applications').then(r => r.data),
  submit: (b: object) => api.post<Application>('/api/v1/applications', b).then(r => r.data),
  submitMulti: (b: object) =>
    api.post<MultiProductResponse>('/api/v1/applications/multi-product', b).then(r => r.data),
  confirm: (id: string, b: object) =>
    api.post(`/api/v1/applications/${id}/confirm`, b).then(r => r.data),
  decide: (id: string, b: object) =>
    api.patch<Application>(`/api/v1/applications/${id}/decide`, b).then(r => r.data),
}

export const apiContracts = {
  list: () => api.get<Contract[]>('/api/v1/contracts').then(r => r.data),
  schedule: (id: string) =>
    api.get<Installment[]>(`/api/v1/contracts/${id}/schedule`).then(r => r.data),
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
}
