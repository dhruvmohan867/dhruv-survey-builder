import { Hono } from 'hono'
import auth from './routes/auth'
import publicRoutes from './routes/public'
import questions from './routes/questions'
import responses from './routes/responses'
import surveys from './routes/surveys'
import type { AppEnv } from './types'

const app = new Hono<AppEnv>()

app.onError((err, c) => {
  console.error(err)
  if (err instanceof SyntaxError && err.message.includes('JSON')) {
    return c.json({ error: 'Invalid JSON payload' }, 400)
  }
  return c.json({ error: err.message || 'Internal Server Error' }, 500)
})

app.get('/api/health', (c) => c.json({ status: 'ok' }))

app.route('/api/auth', auth)
app.route('/api/public', publicRoutes)
app.route('/api/surveys', surveys)
app.route('/api/questions', questions)
app.route('/api/responses', responses)

export default app
