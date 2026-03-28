import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { User } from '../types'
import api from '../api/client'

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<boolean>
  logout: () => void
  updateUser: (u: User) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      login: async (email: string, password: string) => {
        try {
          const { data } = await api.post('/api/v1/auth/login', { email, password })
          const { data: me } = await api.get('/api/v1/auth/me', {
            headers: { Authorization: `Bearer ${data.access_token}` },
          })
          set({ user: me, token: data.access_token, isAuthenticated: true })
          return true
        } catch {
          return false
        }
      },

      logout: async () => {
        try { await api.post('/api/v1/auth/logout') } catch {}
        set({ user: null, token: null, isAuthenticated: false })
      },

      updateUser: (u: User) => set({ user: u }),
    }),
    { name: 'auth-storage' }
  )
)
