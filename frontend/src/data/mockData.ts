import { Tariff, Merchant, Product, Application, Contract, AuditLog, MFOStats, User } from '../types'

export const mockUsers: User[] = [
  { id: 'u1', name: 'Akbar Toshmatov', email: 'akbar@centralbank.uz', role: 'CENTRAL_BANK', organization: "O'zbekiston Markaziy Banki" },
  { id: 'u2', name: 'Dilnoza Yusupova', email: 'dilnoza@ipoteka.uz', role: 'MFO_ADMIN', organization: 'Ipoteka Bank MFO' },
  { id: 'u3', name: 'Bobur Rahimov', email: 'bobur@techmart.uz', role: 'MERCHANT', organization: 'TechMart Savdo' },
]

export const mockTariffs: Tariff[] = [
  { id: 't1', name: 'Standard 12', mfoName: 'Ipoteka Bank MFO', interestRate: 18, minAmount: 1000000, maxAmount: 10000000, minMonths: 3, maxMonths: 12, minScore: 60, status: 'APPROVED', createdAt: '2026-01-10', approvedAt: '2026-01-12' },
  { id: 't2', name: 'Premium 24', mfoName: 'Ipoteka Bank MFO', interestRate: 22, minAmount: 5000000, maxAmount: 50000000, minMonths: 6, maxMonths: 24, minScore: 70, status: 'APPROVED', createdAt: '2026-01-15', approvedAt: '2026-01-17' },
  { id: 't3', name: 'Micro 6', mfoName: 'Hamkorbank MFO', interestRate: 24, minAmount: 500000, maxAmount: 3000000, minMonths: 1, maxMonths: 6, minScore: 50, status: 'PENDING', createdAt: '2026-03-20' },
  { id: 't4', name: 'Express 18', mfoName: 'Agrobank MFO', interestRate: 20, minAmount: 2000000, maxAmount: 20000000, minMonths: 6, maxMonths: 18, minScore: 65, status: 'PENDING', createdAt: '2026-03-22' },
  { id: 't5', name: 'VIP 36', mfoName: 'Kapitalbank MFO', interestRate: 19, minAmount: 10000000, maxAmount: 100000000, minMonths: 12, maxMonths: 36, minScore: 80, status: 'REJECTED', createdAt: '2026-02-01' },
]

export const mockMerchants: Merchant[] = [
  { id: 'm1', name: 'TechMart Savdo', legalName: 'TechMart Savdo LLC', category: 'Electronics', phone: '+998901234567', address: "Toshkent, Yunusobod, 5-ko'cha 12", status: 'ACTIVE', totalApplications: 145, approvedApplications: 112, joinedAt: '2025-11-01' },
  { id: 'm2', name: 'Mobilux', legalName: 'Mobilux Trading LLC', category: 'Mobile & Gadgets', phone: '+998931234567', address: "Toshkent, Chilonzor, Bunyodkor 45", status: 'ACTIVE', totalApplications: 89, approvedApplications: 71, joinedAt: '2025-12-15' },
  { id: 'm3', name: 'Maishiy Texnika Plus', legalName: 'MT Plus LLC', category: 'Home Appliances', phone: '+998901111222', address: "Samarqand, Registon ko'chasi 8", status: 'ACTIVE', totalApplications: 203, approvedApplications: 168, joinedAt: '2025-10-01' },
  { id: 'm4', name: 'Fergana Mebel', legalName: 'Fergana Mebel OAJ', category: 'Furniture', phone: '+998945554433', address: "Farg'ona, Mustaqillik 33", status: 'SUSPENDED', totalApplications: 45, approvedApplications: 28, joinedAt: '2026-01-20' },
  { id: 'm5', name: 'Namangan Sport', legalName: 'Sport Pro LLC', category: 'Sports & Fitness', phone: '+998977776655', address: "Namangan, Navoi 17", status: 'PENDING', totalApplications: 0, approvedApplications: 0, joinedAt: '2026-03-25' },
]

export const mockProducts: Product[] = [
  { id: 'p1', merchantId: 'm1', name: 'Samsung Galaxy S24', category: 'Smartphones', price: 8500000, description: '256GB, Phantom Black', available: true, downPaymentPercent: 15 },
  { id: 'p2', merchantId: 'm1', name: 'MacBook Air M2', category: 'Laptops', price: 22000000, description: '8GB RAM, 256GB SSD', available: true, downPaymentPercent: 20 },
  { id: 'p3', merchantId: 'm1', name: 'Sony Bravia 55"', category: 'TVs', price: 12000000, description: '4K OLED Smart TV', available: true, downPaymentPercent: 10 },
  { id: 'p4', merchantId: 'm1', name: 'iPhone 15 Pro', category: 'Smartphones', price: 18000000, description: '128GB, Natural Titanium', available: false, downPaymentPercent: 20 },
  { id: 'p5', merchantId: 'm2', name: 'Xiaomi 14', category: 'Smartphones', price: 7200000, description: '12GB RAM, Leica cameras', available: true, downPaymentPercent: 10 },
  { id: 'p6', merchantId: 'm3', name: 'LG Washing Machine', category: 'Appliances', price: 6500000, description: '9kg, Inverter', available: true, downPaymentPercent: 0 },
]

export const mockApplications: Application[] = [
  { id: 'a1', merchantId: 'm1', merchantName: 'TechMart Savdo', clientName: 'Mansur Qodirov', clientPhone: '+998901230001', productName: 'Samsung Galaxy S24', productPrice: 8500000, tariffId: 't1', tariffName: 'Standard 12', months: 12, monthlyPayment: 792000, totalAmount: 9500000, score: 82, status: 'ACTIVE', createdAt: '2026-03-01' },
  { id: 'a2', merchantId: 'm1', merchantName: 'TechMart Savdo', clientName: 'Zulfiya Hasanova', clientPhone: '+998901230002', productName: 'MacBook Air M2', productPrice: 22000000, tariffId: 't2', tariffName: 'Premium 24', months: 24, monthlyPayment: 1100000, totalAmount: 26400000, score: 91, status: 'PENDING', createdAt: '2026-03-26' },
  { id: 'a3', merchantId: 'm2', merchantName: 'Mobilux', clientName: 'Ulugbek Normatov', clientPhone: '+998931230003', productName: 'Xiaomi 14', productPrice: 7200000, tariffId: 't1', tariffName: 'Standard 12', months: 6, monthlyPayment: 1350000, totalAmount: 8100000, score: 74, status: 'APPROVED', createdAt: '2026-03-20', decidedAt: '2026-03-21' },
  { id: 'a4', merchantId: 'm3', merchantName: 'Maishiy Texnika Plus', clientName: 'Sarvinoz Ergasheva', clientPhone: '+998901230004', productName: 'LG Washing Machine', productPrice: 6500000, tariffId: 't1', tariffName: 'Standard 12', months: 12, monthlyPayment: 607000, totalAmount: 7284000, score: 45, status: 'REJECTED', createdAt: '2026-03-15', decidedAt: '2026-03-16' },
  { id: 'a5', merchantId: 'm1', merchantName: 'TechMart Savdo', clientName: 'Doniyor Tursunov', clientPhone: '+998901230005', productName: 'Sony Bravia 55"', productPrice: 12000000, tariffId: 't2', tariffName: 'Premium 24', months: 12, monthlyPayment: 800000, totalAmount: 14400000, score: 88, status: 'ACTIVE', createdAt: '2026-02-10', decidedAt: '2026-02-11' },
  { id: 'a6', merchantId: 'm1', merchantName: 'TechMart Savdo', clientName: 'Nilufar Karimova', clientPhone: '+998901230006', productName: 'MacBook Air M2', productPrice: 22000000, tariffId: 't1', tariffName: 'Standard 12', months: 12, monthlyPayment: 1450000, totalAmount: 15400000, score: 62, status: 'PARTIAL', approvedAmount: 15400000, createdAt: '2026-03-25', decidedAt: '2026-03-25' },
]

export const mockContracts: Contract[] = [
  { id: 'c1', applicationId: 'a1', clientName: 'Mansur Qodirov', merchantName: 'TechMart Savdo', productName: 'Samsung Galaxy S24', totalAmount: 9500000, months: 12, monthlyPayment: 792000, nextPaymentDate: '2026-04-01', paidInstallments: 3, status: 'ACTIVE', createdAt: '2026-03-01' },
  { id: 'c2', applicationId: 'a5', clientName: 'Doniyor Tursunov', merchantName: 'TechMart Savdo', productName: 'Sony Bravia 55"', totalAmount: 14400000, months: 18, monthlyPayment: 800000, nextPaymentDate: '2026-04-10', paidInstallments: 2, status: 'ACTIVE', createdAt: '2026-02-10' },
]

export const mockAuditLogs: AuditLog[] = [
  { id: 'l1', userId: 'u1', userName: 'Akbar Toshmatov', role: 'CENTRAL_BANK', action: 'APPROVE', resource: 'tariff', resourceId: 't1', timestamp: '2026-01-12T09:30:00Z', ipAddress: '10.0.1.5' },
  { id: 'l2', userId: 'u2', userName: 'Dilnoza Yusupova', role: 'MFO_ADMIN', action: 'CREATE', resource: 'tariff', resourceId: 't3', timestamp: '2026-03-20T14:22:00Z', ipAddress: '10.0.2.12' },
  { id: 'l3', userId: 'u3', userName: 'Bobur Rahimov', role: 'MERCHANT', action: 'SUBMIT', resource: 'application', resourceId: 'a2', timestamp: '2026-03-26T11:05:00Z', ipAddress: '10.0.3.8' },
  { id: 'l4', userId: 'u2', userName: 'Dilnoza Yusupova', role: 'MFO_ADMIN', action: 'APPROVE', resource: 'application', resourceId: 'a3', timestamp: '2026-03-21T10:10:00Z', ipAddress: '10.0.2.12' },
  { id: 'l5', userId: 'u2', userName: 'Dilnoza Yusupova', role: 'MFO_ADMIN', action: 'REJECT', resource: 'application', resourceId: 'a4', timestamp: '2026-03-16T16:45:00Z', ipAddress: '10.0.2.12' },
  { id: 'l6', userId: 'u1', userName: 'Akbar Toshmatov', role: 'CENTRAL_BANK', action: 'APPROVE', resource: 'tariff', resourceId: 't2', timestamp: '2026-01-17T11:00:00Z', ipAddress: '10.0.1.5' },
]

export const mockMFOStats: MFOStats[] = [
  { id: 'mfo1', name: 'Ipoteka Bank MFO', totalMerchants: 48, totalApplications: 1250, approvalRate: 78, totalDisbursed: 8500000000, defaultRate: 2.1, status: 'ACTIVE' },
  { id: 'mfo2', name: 'Hamkorbank MFO', totalMerchants: 31, totalApplications: 870, approvalRate: 72, totalDisbursed: 5200000000, defaultRate: 3.4, status: 'ACTIVE' },
  { id: 'mfo3', name: 'Agrobank MFO', totalMerchants: 22, totalApplications: 540, approvalRate: 65, totalDisbursed: 2900000000, defaultRate: 4.8, status: 'ACTIVE' },
  { id: 'mfo4', name: 'Kapitalbank MFO', totalMerchants: 15, totalApplications: 320, approvalRate: 60, totalDisbursed: 1800000000, defaultRate: 5.2, status: 'SUSPENDED' },
]

// monthly application trend (last 6 months)
export const mockMonthlyTrend = [
  { month: 'Oct', applications: 120, approved: 92 },
  { month: 'Nov', applications: 145, approved: 108 },
  { month: 'Dec', applications: 189, approved: 145 },
  { month: 'Jan', applications: 210, approved: 165 },
  { month: 'Feb', applications: 178, approved: 140 },
  { month: 'Mar', applications: 230, approved: 182 },
]
