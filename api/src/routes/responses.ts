import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import type { AppEnv } from '../types'

const responses = new Hono<AppEnv>()
responses.use('*', authMiddleware)

responses.get('/:id', async (c) => {
  const userId = c.get('userId')
  const responseId = c.req.param('id')

  const response = await c.env.DB.prepare(
    `SELECT r.id, r.survey_id, r.submitted_at
    FROM responses r
    JOIN surveys s ON s.id = r.survey_id
    WHERE r.id = ? AND s.user_id = ?`,
  )
    .bind(responseId, userId)
    .first()

  if (!response) {
    return c.json({ error: 'Response not found' }, 404)
  }

  const { results: answers } = await c.env.DB.prepare(
    `SELECT a.id, a.question_id, a.value, q.title as question_title, q.type as question_type
    FROM answers a
    JOIN questions q ON q.id = a.question_id
    WHERE a.response_id = ?
    ORDER BY q.display_order ASC`,
  )
    .bind(responseId)
    .all()

  return c.json({ response, answers })
})

export default responses
