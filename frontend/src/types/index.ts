export type Role = 'CENTRAL_BANK' | 'MFO_ADMIN' | 'MERCHANT'

export interface User {
  id: string
  name: string
  email: string
  role: Role
  organization: string
}

export interface Tariff {
  id: string
  name: string
  mfoName: string
  interestRate: number
  minAmount: number
  maxAmount: number
  months: number
  minScore: number
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  createdAt: string
  approvedAt?: string
}

export interface Merchant {
  id: string
  name: string
  legalName: string
  category: string
  phone: string
  address: string
  status: 'ACTIVE' | 'SUSPENDED' | 'PENDING'
  totalApplications: number
  approvedApplications: number
  joinedAt: string
}

export interface Product {
  id: string
  merchantId: string
  name: string
  category: string
  price: number
  description: string
  available: boolean
  downPaymentPercent: number
}

export interface Client {
  id: string
  fullName: string
  passportNumber: string
  phone: string
  monthlyIncome: number
  age: number
  creditHistory: 'GOOD' | 'FAIR' | 'BAD' | 'NONE'
}

export interface Application {
  id: string
  merchantId: string
  merchantName: string
  clientName: string
  clientPhone: string
  productName: string
  productPrice: number
  tariffId: string
  tariffName: string
  months: number
  monthlyPayment: number
  totalAmount: number
  score: number
  status: 'PENDING' | 'APPROVED' | 'PARTIAL' | 'REJECTED' | 'ACTIVE' | 'COMPLETED'
  approvedAmount?: number
  createdAt: string
  decidedAt?: string
}

export interface EligibleOffer {
  tariff_id: string
  mfo_name: string
  tariff_name: string
  interest_rate: number
  available_months: number[]
  min_monthly_payment: number
  max_monthly_payment: number
  min_down_payment_pct: number
  approved_amount: number
  approved_ratio: number
}

export interface ScoreResult {
  f1: number
  f2: number
  f3: number
  f4: number
  total_score: number
  decision: 'APPROVED' | 'PARTIAL' | 'REJECTED'
  weights: { w1: number; w2: number; w3: number; w4: number }
  hard_reject: boolean
  hard_reject_reason: string | null
  reason_codes: string[]
  approved_ratio: number
}

export interface MultiProductResponse {
  id: string
  score_result: ScoreResult
  eligible_offers: EligibleOffer[]
  fraud_gate: 'PASS' | 'FLAG' | 'BLOCK'
  fraud_signals: string[]
}

export interface Contract {
  id: string
  applicationId: string
  clientName: string
  merchantName: string
  productName: string
  totalAmount: number
  months: number
  monthlyPayment: number
  nextPaymentDate: string
  paidInstallments: number
  status: 'ACTIVE' | 'COMPLETED' | 'DEFAULTED'
  createdAt: string
}

export interface AuditLog {
  id: string
  userId: string
  userName: string
  role: Role
  action: string
  resource: string
  resourceId: string
  timestamp: string
  ipAddress: string
}

export interface MFOStats {
  id: string
  name: string
  totalMerchants: number
  totalApplications: number
  approvalRate: number
  totalDisbursed: number
  defaultRate: number
  status: 'ACTIVE' | 'SUSPENDED'
}
