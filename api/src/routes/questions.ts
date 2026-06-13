import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import type { AppEnv } from '../types'

const questions = new Hono<AppEnv>()
questions.use('*', authMiddleware)

questions.put('/:id', async (c) => {
  const userId = c.get('userId')
  const questionId = c.req.param('id')

  const question = await c.env.DB.prepare(
    `SELECT q.id, q.survey_id, q.type, q.options FROM questions q
    JOIN surveys s ON s.id = q.survey_id
    WHERE q.id = ? AND s.user_id = ?`,
  )
    .bind(questionId, userId)
    .first<{ id: string; survey_id: string; type: string; options: string }>()

  if (!question) {
    return c.json({ error: 'Question not found' }, 404)
  }

  const body = await c.req.json<{
    title?: string
    type?: 'short_text' | 'multiple_choice' | 'rating'
    options?: string[]
  }>()

  const updates: string[] = []
  const values: string[] = []

  if (body.title !== undefined) {
    const title = body.title.trim()
    if (!title) {
      return c.json({ error: 'Question title cannot be empty' }, 400)
    }
    const duplicate = await c.env.DB.prepare(
      'SELECT id FROM questions WHERE survey_id = ? AND title = ? AND id != ?',
    )
      .bind(question.survey_id, title, questionId)
      .first()

    if (duplicate) {
      return c.json({ error: 'A question with this title already exists' }, 400)
    }

    updates.push('title = ?')
    values.push(title)
  }

  const finalType = body.type !== undefined ? body.type : question.type
  let optionsList: string[] = []

  if (finalType === 'multiple_choice') {
    let opts: string[] = []
    if (body.options !== undefined) {
      opts = body.options
    } else {
      try {
        opts = JSON.parse(question.options || '[]')
      } catch {
        opts = []
      }
    }
    if (!Array.isArray(opts) || opts.length < 2) {
      return c.json({ error: 'Multiple choice questions must have at least 2 options' }, 400)
    }
    const trimmedOpts = opts.map((o) => (typeof o === 'string' ? o.trim() : '')).filter(Boolean)
    if (trimmedOpts.length < 2) {
      return c.json({ error: 'At least 2 non-empty options are required for multiple choice' }, 400)
    }
    const uniqueOpts = new Set(trimmedOpts)
    if (uniqueOpts.size !== trimmedOpts.length) {
      return c.json({ error: 'Options must be unique' }, 400)
    }
    optionsList = trimmedOpts
  }

  if (body.type !== undefined) {
    updates.push('type = ?')
    values.push(body.type)
  }

  if (body.options !== undefined || body.type !== undefined) {
    updates.push('options = ?')
    values.push(JSON.stringify(optionsList))
  }

  if (updates.length === 0) {
    return c.json({ error: 'No fields to update' }, 400)
  }

  values.push(questionId)
  await c.env.DB.prepare(`UPDATE questions SET ${updates.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run()

  const updated = await c.env.DB.prepare(
    'SELECT id, title, type, options, display_order FROM questions WHERE id = ?',
  )
    .bind(questionId)
    .first()

  if (!updated) {
    return c.json({ error: 'Failed to update question' }, 500)
  }

  return c.json({
    question: { ...updated, options: JSON.parse(updated.options as string) },
  })
})

questions.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const questionId = c.req.param('id')

  const question = await c.env.DB.prepare(
    `SELECT q.id FROM questions q
    JOIN surveys s ON s.id = q.survey_id
    WHERE q.id = ? AND s.user_id = ?`,
  )
    .bind(questionId, userId)
    .first()

  if (!question) {
    return c.json({ error: 'Question not found' }, 404)
  }

  await c.env.DB.prepare('DELETE FROM questions WHERE id = ?').bind(questionId).run()
  return c.json({ ok: true })
})

export default questions
