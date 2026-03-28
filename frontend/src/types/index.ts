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

// ── Application (new multi-product model) ─────────────────────────────────────

export interface ApplicationItem {
  productId: string
  productName: string
  category: string
  price: number
  quantity: number
  subtotal: number          // price * quantity
  imageUrl: string | null
}

export interface ScoreResult {
  f1_affordability: number   // 0-100
  f2_credit: number
  f3_behavioral: number
  f4_demographic: number
  weights: {
    w1: number
    w2: number
    w3: number
    w4: number
  }
  total_score: number
  decision: 'APPROVED' | 'PARTIAL' | 'REJECTED'
  approved_ratio: number
  hard_reject: boolean
  hard_reject_reason: string | null
  reason_codes: string[]
}

export interface ScoreBreakdown {
  f1_affordability: number   // 0-100
  f2_credit: number
  f3_behavioral: number
  f4_demographic: number
  weights: {
    w1: number
    w2: number
    w3: number
    w4: number
  }
  total_score: number
  decision: 'APPROVED' | 'PARTIAL' | 'REJECTED'
  approved_ratio: number
  hard_reject: boolean
  hard_reject_reason: string | null
  reason_codes: string[]
}

export interface FraudSignal {
  code: string
  severity: 'block' | 'warning' | 'info'
  score_impact: number
  description: string
}

export interface Application {
  id: string
  merchantId: string
  merchantName: string

  // Client sub-object
  client: {
    fullName: string
    passportNumber: string
    phone: string
    age: number
    monthlyIncome: number
    employmentType: string
    openLoans: number
    overdueDays: number
    hasBankruptcy: boolean
    creditHistory: 'GOOD' | 'FAIR' | 'NONE' | 'BAD'
    pinfl: string | null
  }

  // Products (multiple)
  items: ApplicationItem[]
  totalAmount: number
  downPaymentAmount: number
  financedAmount: number

  // Selected offer
  tariffId: string | null
  tariffName: string | null
  mfoName: string | null
  months: number | null
  monthlyPayment: number | null
  approvedAmount: number | null

  // Scoring
  score: number
  scoreBreakdown: ScoreBreakdown | null

  // Fraud
  fraudGate: 'PASS' | 'FLAG' | 'BLOCK'
  fraudSignals: FraudSignal[]

  // Verification assets
  faceImageUrl: string | null
  signatureUrl: string | null

  contractId: string | null

  status: 'PENDING' | 'APPROVED' | 'PARTIAL' | 'REJECTED' | 'ACTIVE' | 'COMPLETED' | 'BLOCKED' | 'DRAFT'
  decisionSource: 'AUTOMATED'
  createdAt: string
}

// Normalize old flat API responses to the new Application shape
export function normalizeApplication(raw: any): Application {
  if (raw && typeof raw.client === 'object' && raw.client !== null) {
    // Already new format — camelCase the client fields if needed
    const c = raw.client
    return {
      ...raw,
      client: {
        fullName:       c.fullName       ?? c.full_name        ?? '',
        passportNumber: c.passportNumber ?? c.passport_number  ?? '',
        phone:          c.phone          ?? '',
        age:            c.age            ?? 0,
        monthlyIncome:  c.monthlyIncome  ?? c.monthly_income   ?? 0,
        employmentType: c.employmentType ?? c.employment_type  ?? 'EMPLOYED',
        openLoans:      c.openLoans      ?? c.open_loans       ?? 0,
        overdueDays:    c.overdueDays    ?? c.overdue_days     ?? 0,
        hasBankruptcy:  c.hasBankruptcy  ?? c.has_bankruptcy   ?? false,
        creditHistory:  c.creditHistory  ?? c.credit_history   ?? 'NONE',
        pinfl:          c.pinfl          ?? null,
      },
      items: (raw.items ?? []).map((it: any) => ({
        productId:   it.productId   ?? it.product_id   ?? '',
        productName: it.productName ?? it.product_name ?? '',
        category:    it.category    ?? '',
        price:       it.price       ?? 0,
        quantity:    it.quantity    ?? 1,
        subtotal:    it.subtotal    ?? (it.price ?? 0) * (it.quantity ?? 1),
        imageUrl:    it.imageUrl    ?? it.image_url    ?? null,
      })),
      tariffId:       raw.tariffId        ?? raw.tariff_id        ?? null,
      tariffName:     raw.tariffName      ?? raw.tariff_name      ?? null,
      mfoName:        raw.mfoName         ?? raw.mfo_name         ?? null,
      months:         raw.months          ?? raw.months           ?? null,
      monthlyPayment: raw.monthlyPayment  ?? raw.monthly_payment  ?? null,
      approvedAmount: raw.approvedAmount  ?? raw.approved_amount  ?? null,
      totalAmount:    raw.totalAmount     ?? raw.total_amount     ?? 0,
      downPaymentAmount: raw.downPaymentAmount ?? raw.down_payment_amount ?? 0,
      financedAmount:    raw.financedAmount    ?? raw.financed_amount     ?? raw.approvedAmount ?? raw.totalAmount ?? 0,
      scoreBreakdown: raw.scoreBreakdown  ?? raw.score_breakdown  ?? null,
      fraudGate:      (raw.fraudGate      ?? raw.fraud_gate       ?? 'PASS') as Application['fraudGate'],
      fraudSignals:   raw.fraudSignals    ?? raw.fraud_signals    ?? [],
      faceImageUrl:   raw.faceImageUrl    ?? raw.face_image_url   ?? null,
      signatureUrl:   raw.signatureUrl    ?? raw.signature_url    ?? null,
      decisionSource: 'AUTOMATED' as const,
      createdAt:      raw.createdAt       ?? raw.created_at       ?? '',
      contractId:     raw.contractId      ?? raw.contract_id      ?? null,
    } as Application
  }

  // Old flat format — wrap into new shape
  return {
    id:          raw.id          ?? '',
    merchantId:  raw.merchantId  ?? raw.merchant_id  ?? '',
    merchantName: raw.merchantName ?? raw.merchant_name ?? '',
    client: {
      fullName:       raw.clientName      ?? raw.client_name  ?? '',
      passportNumber: raw.passportNumber  ?? '',
      phone:          raw.clientPhone     ?? raw.client_phone ?? '',
      age:            raw.age             ?? 0,
      monthlyIncome:  raw.monthlyIncome   ?? 0,
      employmentType: 'EMPLOYED',
      openLoans:      0,
      overdueDays:    0,
      hasBankruptcy:  false,
      creditHistory:  'NONE',
      pinfl:          raw.pinfl           ?? null,
    },
    items: raw.productName
      ? [{
          productId:   raw.tariffId ?? '',
          productName: raw.productName,
          category:    '',
          price:       raw.productPrice ?? 0,
          quantity:    1,
          subtotal:    raw.productPrice ?? 0,
          imageUrl:    null,
        }]
      : [],
    totalAmount:       raw.totalAmount    ?? raw.total_amount    ?? 0,
    downPaymentAmount: 0,
    financedAmount:    raw.approvedAmount ?? raw.totalAmount     ?? 0,
    tariffId:          raw.tariffId       ?? null,
    tariffName:        raw.tariffName     ?? null,
    mfoName:           raw.mfoName        ?? null,
    months:            raw.months         ?? null,
    monthlyPayment:    raw.monthlyPayment ?? null,
    approvedAmount:    raw.approvedAmount ?? null,
    score:             raw.score          ?? 0,
    scoreBreakdown:    null,
    fraudGate:         'PASS',
    fraudSignals:      [],
    faceImageUrl:      null,
    signatureUrl:      null,
    status:         raw.status,
    decisionSource: 'AUTOMATED' as const,
    createdAt:      raw.createdAt ?? raw.created_at ?? '',
    contractId:     raw.contractId ?? raw.contract_id ?? null,
  }
}

export interface Contract {
  id: string
  applicationId: string
  clientName: string
  merchantName: string
  // Multi-product summary (replaces single productName)
  itemsSummary: string   // e.g. "iPhone 15 × 1, MacBook × 2"
  itemCount: number
  /** @deprecated use itemsSummary instead */
  productName?: string
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

export interface MultiProductResponse {
  id: string
  score_result: ScoreResult
  eligible_offers: EligibleOffer[]
  fraud_gate: 'PASS' | 'FLAG' | 'BLOCK'
  fraud_signals: string[]
}
