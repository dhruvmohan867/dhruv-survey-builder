import { Hono } from 'hono'
import { generateId } from '../lib/id'
import type { AppEnv } from '../types'

const publicRoutes = new Hono<AppEnv>()

publicRoutes.get('/surveys/:id', async (c) => {
  const surveyId = c.req.param('id')

  const survey = await c.env.DB.prepare(
    'SELECT id, title, primary_color, logo_url FROM surveys WHERE id = ?',
  )
    .bind(surveyId)
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

publicRoutes.post('/surveys/:id/responses', async (c) => {
  const surveyId = c.req.param('id')

  const survey = await c.env.DB.prepare('SELECT id FROM surveys WHERE id = ?')
    .bind(surveyId)
    .first()

  if (!survey) {
    return c.json({ error: 'Survey not found' }, 404)
  }

  const { answers } = await c.req.json<{
    answers: { questionId: string; value: string }[]
  }>()

  if (!Array.isArray(answers) || answers.length === 0) {
    return c.json({ error: 'Answers are required' }, 400)
  }

  // Check for duplicate answer entries for the same question in the payload
  const questionIdsInPayload = answers.map((a) => a.questionId)
  const uniqueQuestionIds = new Set(questionIdsInPayload)
  if (uniqueQuestionIds.size !== answers.length) {
    return c.json({ error: 'Duplicate answers for the same question are not allowed' }, 400)
  }

  // Fetch all questions for this survey to validate answers
  const { results: dbQuestions } = await c.env.DB.prepare(
    'SELECT id, type, options, title FROM questions WHERE survey_id = ?',
  )
    .bind(surveyId)
    .all<{ id: string; type: string; options: string; title: string }>()

  // Validate each question has a valid answer
  const validatedAnswers: { questionId: string; value: string }[] = []

  for (const dbQ of dbQuestions) {
    const ans = answers.find((a) => a.questionId === dbQ.id)
    if (!ans || typeof ans.value !== 'string' || !ans.value.trim()) {
      return c.json({ error: `Answer is required for question: "${dbQ.title}"` }, 400)
    }

    const value = ans.value.trim()

    if (dbQ.type === 'rating') {
      const ratingVal = Number(value)
      if (Number.isNaN(ratingVal) || ratingVal < 1 || ratingVal > 5) {
        return c.json(
          { error: `Invalid rating value (must be 1-5) for question: "${dbQ.title}"` },
          400,
        )
      }
    } else if (dbQ.type === 'multiple_choice') {
      let optionsList: string[] = []
      try {
        optionsList = JSON.parse(dbQ.options)
      } catch {
        optionsList = []
      }
      if (!optionsList.includes(value)) {
        return c.json({ error: `Invalid option selected for question: "${dbQ.title}"` }, 400)
      }
    }

    validatedAnswers.push({ questionId: dbQ.id, value })
  }

  const responseId = generateId()

  const stmts = [
    c.env.DB.prepare('INSERT INTO responses (id, survey_id) VALUES (?, ?)').bind(
      responseId,
      surveyId,
    ),
    ...validatedAnswers.map((a) =>
      c.env.DB.prepare(
        'INSERT INTO answers (id, response_id, question_id, value) VALUES (?, ?, ?, ?)',
      ).bind(generateId(), responseId, a.questionId, a.value),
    ),
  ]

  await c.env.DB.batch(stmts)

  return c.json({ responseId }, 201)
})

export default publicRoutes
