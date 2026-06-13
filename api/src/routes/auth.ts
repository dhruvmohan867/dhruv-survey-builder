import { Hono } from 'hono'
import { deleteCookie, setSignedCookie } from 'hono/cookie'
import { generateId } from '../lib/id'
import { authMiddleware } from '../middleware/auth'
import type { AppEnv } from '../types'

const auth = new Hono<AppEnv>()

auth.post('/login', async (c) => {
  const body = await c.req.json<{ email: string }>()
  if (!body.email || typeof body.email !== 'string') {
    return c.json({ error: 'Email is required' }, 400)
  }

  const email = body.email.trim().toLowerCase()
  if (!email) {
    return c.json({ error: 'Email is required' }, 400)
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return c.json({ error: 'Invalid email address' }, 400)
  }

  let user = await c.env.DB.prepare('SELECT id, email, created_at FROM users WHERE email = ?')
    .bind(email)
    .first<{ id: string; email: string; created_at: string }>()

  if (!user) {
    const id = generateId()
    try {
      await c.env.DB.prepare('INSERT INTO users (id, email) VALUES (?, ?)').bind(id, email).run()
      user = { id, email, created_at: new Date().toISOString() }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      if (errMsg.includes('UNIQUE') || errMsg.includes('constraint')) {
        user = await c.env.DB.prepare('SELECT id, email, created_at FROM users WHERE email = ?')
          .bind(email)
          .first<{ id: string; email: string; created_at: string }>()
      } else {
        throw err
      }
    }
  }

  if (!user) {
    return c.json({ error: 'Failed to authenticate user' }, 500)
  }

  await setSignedCookie(c, 'session', user.id, c.env.AUTH_SECRET, {
    httpOnly: true,
    secure: false,
    sameSite: 'Lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  })

  return c.json({ user })
})

auth.post('/logout', (c) => {
  deleteCookie(c, 'session', { path: '/' })
  return c.json({ ok: true })
})

auth.get('/me', authMiddleware, async (c) => {
  const userId = c.get('userId')
  const user = await c.env.DB.prepare('SELECT id, email, created_at FROM users WHERE id = ?')
    .bind(userId)
    .first()

  if (!user) {
    deleteCookie(c, 'session', { path: '/' })
    return c.json({ error: 'User not found' }, 401)
  }

  return c.json({ user })
})

export default auth
