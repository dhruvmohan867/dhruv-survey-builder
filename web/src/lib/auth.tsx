import { createContext, type ReactNode, useContext } from 'react'

export type User = {
  id: string
  email: string
  created_at: string
}

type AuthContextType = {
  user: User
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ user, children }: { user: User; children: ReactNode }) {
  return <AuthContext value={{ user }}>{children}</AuthContext>
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
