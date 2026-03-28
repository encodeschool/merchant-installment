import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { User } from '../types'
import { mockUsers } from '../data/mockData'

interface AuthState {
  user: User | null
  token: string | null
  login: (email: string, password: string) => Promise<boolean>
  logout: () => void
  isAuthenticated: boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      login: async (email: string, _password: string) => {
        const user = mockUsers.find(u => u.email === email)
        if (!user) return false
        const token = `mock-jwt-${user.role}-${Date.now()}`
        set({ user, token, isAuthenticated: true })
        return true
      },
      logout: () => set({ user: null, token: null, isAuthenticated: false }),
    }),
    { name: 'auth-storage' }
  )
)
