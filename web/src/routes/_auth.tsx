import { createFileRoute, Outlet, redirect, useNavigate } from '@tanstack/react-router'
import { LogOut } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { AuthProvider, type User } from '@/lib/auth'

export const Route = createFileRoute('/_auth')({
  beforeLoad: async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (!res.ok) throw new Error('Unauthorized')
      const data = (await res.json()) as { user: User }
      return { user: data.user }
    } catch {
      throw redirect({ to: '/login' })
    }
  },
  component: AuthLayout,
})

function AuthLayout() {
  const { user } = Route.useRouteContext()
  const navigate = useNavigate()

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout')
      navigate({ to: '/login' })
    } catch {
      toast.error('Logout failed')
    }
  }

  return (
    <AuthProvider user={user}>
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-sm">
          <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
            <a
              href="/dashboard"
              className="text-lg font-bold tracking-tight text-foreground transition-colors hover:text-primary"
            >
              Survey Builder
            </a>
            <div className="flex items-center gap-3">
              <span className="hidden text-sm text-muted-foreground sm:inline">{user.email}</span>
              <Button variant="ghost" size="icon" onClick={handleLogout} title="Sign out">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <Outlet />
        </main>
      </div>
    </AuthProvider>
  )
}
