import { Hono } from 'hono'
import { generateId } from '../lib/id'
import { authMiddleware } from '../middleware/auth'
import type { AppEnv } from '../types'

const surveys = new Hono<AppEnv>()
surveys.use('*', authMiddleware)

surveys.get('/', async (c) => {
  const userId = c.get('userId')
  const { results } = await c.env.DB.prepare(
    'SELECT id, title, primary_color, logo_url, created_at FROM surveys WHERE user_id = ? ORDER BY created_at DESC',
  )
    .bind(userId)
    .all()
  return c.json({ surveys: results })
})

surveys.post('/', async (c) => {
  const userId = c.get('userId')
  const body = await c.req.json<{ title: string }>()
  if (!body.title || typeof body.title !== 'string') {
    return c.json({ error: 'Title is required' }, 400)
  }

  const title = body.title.trim()
  if (!title) {
    return c.json({ error: 'Title is required' }, 400)
  }

  const id = generateId()
  await c.env.DB.prepare('INSERT INTO surveys (id, user_id, title) VALUES (?, ?, ?)')
    .bind(id, userId, title)
    .run()

  const survey = await c.env.DB.prepare(
    'SELECT id, user_id, title, primary_color, logo_url, created_at FROM surveys WHERE id = ?',
  )
    .bind(id)
    .first()

  return c.json({ survey }, 201)
})

surveys.get('/:id', async (c) => {
  const userId = c.get('userId')
  const surveyId = c.req.param('id')

  const survey = await c.env.DB.prepare(
    'SELECT id, user_id, title, primary_color, logo_url, created_at FROM surveys WHERE id = ? AND user_id = ?',
  )
    .bind(surveyId, userId)
    .first()

  if (!survey) {
    return c.json({ error: 'Survey not found' }, 404)
  }

  const { results: questions } = await c.env.DB.prepare(
    'SELECT id, title, type, options, display_order FROM questions WHERE survey_id = ? ORDER BY display_order ASC',
  )
    .bind(surveyId)
    .all()

  return c.json({
    survey,
    questions: questions.map((q) => ({
      ...q,
      options: JSON.parse(q.options as string),
    })),
  })
})

surveys.put('/:id', async (c) => {
  const userId = c.get('userId')
  const surveyId = c.req.param('id')
  const body = await c.req.json<{
    title?: string
    primaryColor?: string
    logoUrl?: string
  }>()

  const existing = await c.env.DB.prepare('SELECT id FROM surveys WHERE id = ? AND user_id = ?')
    .bind(surveyId, userId)
    .first()

  if (!existing) {
    return c.json({ error: 'Survey not found' }, 404)
  }

  const updates: string[] = []
  const values: string[] = []

  if (body.title !== undefined) {
    const title = body.title.trim()
    if (!title) {
      return c.json({ error: 'Title cannot be empty' }, 400)
    }
    updates.push('title = ?')
    values.push(title)
  }
  if (body.primaryColor !== undefined) {
    const color = body.primaryColor.trim()
    const colorRegex = /^#[0-9a-fA-F]{3,8}$/
    if (!colorRegex.test(color)) {
      return c.json({ error: 'Invalid color hex code' }, 400)
    }
    updates.push('primary_color = ?')
    values.push(color)
  }
  if (body.logoUrl !== undefined) {
    const url = body.logoUrl.trim()
    if (url !== '') {
      try {
        new URL(url)
      } catch {
        return c.json({ error: 'Invalid logo URL format' }, 400)
      }
    }
    updates.push('logo_url = ?')
    values.push(url)
  }

  if (updates.length === 0) {
    return c.json({ error: 'No fields to update' }, 400)
  }

  values.push(surveyId)
  await c.env.DB.prepare(`UPDATE surveys SET ${updates.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run()

  const survey = await c.env.DB.prepare(
    'SELECT id, user_id, title, primary_color, logo_url, created_at FROM surveys WHERE id = ?',
  )
    .bind(surveyId)
    .first()

  return c.json({ survey })
})

surveys.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const surveyId = c.req.param('id')

  const existing = await c.env.DB.prepare('SELECT id FROM surveys WHERE id = ? AND user_id = ?')
    .bind(surveyId, userId)
    .first()

  if (!existing) {
    return c.json({ error: 'Survey not found' }, 404)
  }

  await c.env.DB.prepare('DELETE FROM surveys WHERE id = ?').bind(surveyId).run()
  return c.json({ ok: true })
})

surveys.post('/:id/questions', async (c) => {
  const userId = c.get('userId')
  const surveyId = c.req.param('id')

  const survey = await c.env.DB.prepare('SELECT id FROM surveys WHERE id = ? AND user_id = ?')
    .bind(surveyId, userId)
    .first()

  if (!survey) {
    return c.json({ error: 'Survey not found' }, 404)
  }

  const body = await c.req.json<{
    title: string
    type: 'short_text' | 'multiple_choice' | 'rating'
    options?: string[]
  }>()

  const title = body.title.trim()
  if (!title || !body.type) {
    return c.json({ error: 'Title and type are required' }, 400)
  }

  const duplicate = await c.env.DB.prepare(
    'SELECT id FROM questions WHERE survey_id = ? AND title = ?',
  )
    .bind(surveyId, title)
    .first()

  if (duplicate) {
    return c.json({ error: 'A question with this title already exists' }, 400)
  }

  let optionsList: string[] = []
  if (body.type === 'multiple_choice') {
    if (!Array.isArray(body.options) || body.options.length < 2) {
      return c.json({ error: 'Multiple choice questions must have at least 2 options' }, 400)
    }
    const trimmedOpts = body.options
      .map((o) => (typeof o === 'string' ? o.trim() : ''))
      .filter(Boolean)
    if (trimmedOpts.length < 2) {
      return c.json({ error: 'At least 2 non-empty options are required' }, 400)
    }
    const uniqueOpts = new Set(trimmedOpts)
    if (uniqueOpts.size !== trimmedOpts.length) {
      return c.json({ error: 'Options must be unique' }, 400)
    }
    optionsList = trimmedOpts
  }

  const maxOrder = await c.env.DB.prepare(
    'SELECT COALESCE(MAX(display_order), -1) as max_order FROM questions WHERE survey_id = ?',
  )
    .bind(surveyId)
    .first<{ max_order: number }>()

  const id = generateId()
  const displayOrder = (maxOrder?.max_order ?? -1) + 1

  await c.env.DB.prepare(
    'INSERT INTO questions (id, survey_id, title, type, options, display_order) VALUES (?, ?, ?, ?, ?, ?)',
  )
    .bind(id, surveyId, title, body.type, JSON.stringify(optionsList), displayOrder)
    .run()

  const question = await c.env.DB.prepare(
    'SELECT id, title, type, options, display_order FROM questions WHERE id = ?',
  )
    .bind(id)
    .first()
  if (!question) {
    return c.json({ error: 'Failed to create question' }, 500)
  }

  return c.json(
    {
      question: {
        ...question,
        options: JSON.parse(question.options as string),
      },
    },
    201,
  )
})

surveys.put('/:id/questions/reorder', async (c) => {
  const userId = c.get('userId')
  const surveyId = c.req.param('id')

  const survey = await c.env.DB.prepare('SELECT id FROM surveys WHERE id = ? AND user_id = ?')
    .bind(surveyId, userId)
    .first()

  if (!survey) {
    return c.json({ error: 'Survey not found' }, 404)
  }

  const { questionIds } = await c.req.json<{ questionIds: string[] }>()

  if (!Array.isArray(questionIds) || questionIds.some((id) => typeof id !== 'string')) {
    return c.json({ error: 'questionIds must be an array of strings' }, 400)
  }

  const uniqueIds = new Set(questionIds)
  if (uniqueIds.size !== questionIds.length) {
    return c.json({ error: 'questionIds must contain unique IDs' }, 400)
  }

  // Fetch the actual question IDs belonging to this survey
  const { results: dbQuestions } = await c.env.DB.prepare(
    'SELECT id FROM questions WHERE survey_id = ?',
  )
    .bind(surveyId)
    .all<{ id: string }>()

  const dbIds = dbQuestions.map((q) => q.id)
  if (dbIds.length !== questionIds.length || !questionIds.every((id) => dbIds.includes(id))) {
    return c.json({ error: 'Invalid questionIds list' }, 400)
  }

  const stmts = questionIds.map((qId, index) =>
    c.env.DB.prepare('UPDATE questions SET display_order = ? WHERE id = ? AND survey_id = ?').bind(
      index,
      qId,
      surveyId,
    ),
  )

  await c.env.DB.batch(stmts)

  return c.json({ ok: true })
})

surveys.get('/:id/responses', async (c) => {
  const userId = c.get('userId')
  const surveyId = c.req.param('id')

  const survey = await c.env.DB.prepare('SELECT id FROM surveys WHERE id = ? AND user_id = ?')
    .bind(surveyId, userId)
    .first()

  if (!survey) {
    return c.json({ error: 'Survey not found' }, 404)
  }

  const { results: responses } = await c.env.DB.prepare(
    'SELECT id, submitted_at FROM responses WHERE survey_id = ? ORDER BY submitted_at DESC',
  )
    .bind(surveyId)
    .all()

  const { results: questions } = await c.env.DB.prepare(
    'SELECT id, title, type, options, display_order FROM questions WHERE survey_id = ? ORDER BY display_order ASC',
  )
    .bind(surveyId)
    .all()

  const { results: answers } = await c.env.DB.prepare(
    `SELECT a.id, a.response_id, a.question_id, a.value 
     FROM answers a 
     JOIN responses r ON r.id = a.response_id 
     WHERE r.survey_id = ?`,
  )
    .bind(surveyId)
    .all()

  return c.json({
    responses,
    questions: questions.map((q) => ({
      ...q,
      options: JSON.parse(q.options as string),
    })),
    answers,
  })
})

export default surveys
