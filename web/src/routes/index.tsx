import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (res.ok) {
        throw redirect({ to: '/dashboard' })
      }
    } catch (e) {
      if (e instanceof Response || (e && typeof e === 'object' && 'to' in e)) {
        throw e
      }
    }
    throw redirect({ to: '/login' })
  },
})
