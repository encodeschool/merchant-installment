import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import LoginPage from '../pages/auth/LoginPage'
import Layout from '../components/layout/Layout'

import CBDashboard from '../pages/central-bank/CBDashboard'
import CBTariffApprovals from '../pages/central-bank/CBTariffApprovals'
import CBMFOMonitoring from '../pages/central-bank/CBMFOMonitoring'
import CBAuditLogs from '../pages/central-bank/CBAuditLogs'
import MFODashboard from '../pages/mfo/MFODashboard'
import MFOTariffs from '../pages/mfo/MFOTariffs'
import MFOMerchants from '../pages/mfo/MFOMerchants'
import MFOApplications from '../pages/mfo/MFOApplications'
import MFOScoringSettings from '../pages/mfo/MFOScoringSettings'
import MerchantDashboard from '../pages/merchant/MerchantDashboard'
import MerchantProducts from '../pages/merchant/MerchantProducts'
import MerchantNewApplication from '../pages/merchant/MerchantNewApplication'
import MerchantInstallments from '../pages/merchant/MerchantInstallments'

function RequireAuth({ children, role }: { children: React.ReactNode; role: string }) {
  const { isAuthenticated, user } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (user?.role !== role) {
    const map: Record<string, string> = {
      CENTRAL_BANK: '/cb',
      MFO_ADMIN: '/mfo',
      MERCHANT: '/merchant',
    }
    return <Navigate to={map[user?.role ?? ''] ?? '/login'} replace />
  }
  return <>{children}</>
}

export default function AppRouter() {
  const { isAuthenticated, user } = useAuthStore()

  const homeRedirect = () => {
    if (!isAuthenticated) return '/login'
    const map: Record<string, string> = {
      CENTRAL_BANK: '/cb',
      MFO_ADMIN: '/mfo',
      MERCHANT: '/merchant',
    }
    return map[user?.role ?? ''] ?? '/login'
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/* Central Bank */}
      <Route path="/cb" element={<RequireAuth role="CENTRAL_BANK"><Layout /></RequireAuth>}>
        <Route index element={<CBDashboard />} />
        <Route path="tariffs" element={<CBTariffApprovals />} />
        <Route path="mfo" element={<CBMFOMonitoring />} />
        <Route path="audit" element={<CBAuditLogs />} />
      </Route>

      {/* MFO Admin */}
      <Route path="/mfo" element={<RequireAuth role="MFO_ADMIN"><Layout /></RequireAuth>}>
        <Route index element={<MFODashboard />} />
        <Route path="tariffs" element={<MFOTariffs />} />
        <Route path="merchants" element={<MFOMerchants />} />
        <Route path="applications" element={<MFOApplications />} />
        <Route path="scoring/:tariffId" element={<MFOScoringSettings />} />
      </Route>

      {/* Merchant */}
      <Route path="/merchant" element={<RequireAuth role="MERCHANT"><Layout /></RequireAuth>}>
        <Route index element={<MerchantDashboard />} />
        <Route path="products" element={<MerchantProducts />} />
        <Route path="apply" element={<MerchantNewApplication />} />
        <Route path="installments" element={<MerchantInstallments />} />
      </Route>

      <Route path="/" element={<Navigate to={homeRedirect()} replace />} />
      <Route path="*" element={<Navigate to={homeRedirect()} replace />} />
    </Routes>
  )
}
