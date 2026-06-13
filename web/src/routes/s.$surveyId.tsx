import { createFileRoute } from '@tanstack/react-router'
import { Check, Loader2, Star } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'

export const Route = createFileRoute('/s/$surveyId')({
  component: PublicSurveyPage,
})

type Survey = {
  id: string
  title: string
  primary_color: string
  logo_url: string
}

type Question = {
  id: string
  title: string
  type: 'short_text' | 'multiple_choice' | 'rating'
  options: string[]
  display_order: number
}

function PublicSurveyPage() {
  const { surveyId } = Route.useParams()
  const [survey, setSurvey] = useState<Survey | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState(false)

  const fetchSurvey = useCallback(async () => {
    try {
      const res = await fetch(`/api/public/surveys/${surveyId}`)
      if (!res.ok) throw new Error('Not found')
      const data = (await res.json()) as {
        survey: Survey
        questions: Question[]
      }
      setSurvey(data.survey)
      setQuestions(data.questions)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [surveyId])

  useEffect(() => {
    fetchSurvey()
  }, [fetchSurvey])

  const setAnswer = (questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const unanswered = questions.filter((q) => !answers[q.id]?.trim())
    if (unanswered.length > 0) {
      toast.error('Please answer all questions')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/public/surveys/${surveyId}/responses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers: Object.entries(answers).map(([questionId, value]) => ({
            questionId,
            value,
          })),
        }),
      })
      if (!res.ok) throw new Error('Failed')
      setSubmitted(true)
    } catch {
      toast.error('Failed to submit response')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen px-4 py-8 sm:py-12">
        <div className="mx-auto max-w-2xl space-y-4">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
          <div className="mt-8 space-y-6">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        </div>
      </div>
    )
  }

  if (error || !survey) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Survey Not Found</h1>
          <p className="mt-2 text-muted-foreground">
            This survey doesn&apos;t exist or has been removed.
          </p>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div
        className="flex min-h-screen items-center justify-center p-4"
        style={{ backgroundColor: `${survey.primary_color}08` }}
      >
        <div className="space-y-4 text-center">
          <div
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-full"
            style={{ backgroundColor: `${survey.primary_color}20` }}
          >
            <Check className="h-8 w-8" style={{ color: survey.primary_color }} />
          </div>
          <h1 className="text-2xl font-bold">Thank You!</h1>
          <p className="text-muted-foreground">Your response has been recorded.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-2xl">
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="h-2" style={{ backgroundColor: survey.primary_color }} />
          <div className="p-6 sm:p-8">
            {survey.logo_url && (
              <img
                src={survey.logo_url}
                alt="Logo"
                className="mb-6 h-10 object-contain"
                onError={(e) => {
                  ;(e.target as HTMLImageElement).style.display = 'none'
                }}
              />
            )}
            <h1 className="text-2xl font-bold">{survey.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Please fill out this survey. All fields are required.
            </p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-8">
              {questions.map((q, i) => (
                <div key={q.id} className="space-y-3">
                  <p className="text-sm font-medium">
                    {i + 1}. {q.title}
                  </p>

                  {q.type === 'short_text' && (
                    <Input
                      value={answers[q.id] || ''}
                      onChange={(e) => setAnswer(q.id, e.target.value)}
                      placeholder="Your answer..."
                      className="transition-colors"
                      style={{
                        borderColor: answers[q.id] ? survey.primary_color : undefined,
                      }}
                    />
                  )}

                  {q.type === 'multiple_choice' && (
                    <div className="space-y-2">
                      {q.options.map((opt) => {
                        const isSelected = answers[q.id] === opt
                        return (
                          <label
                            key={opt}
                            className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-all hover:bg-accent"
                            style={{
                              borderColor: isSelected ? survey.primary_color : undefined,
                              boxShadow: isSelected
                                ? `0 0 0 1px ${survey.primary_color}`
                                : undefined,
                            }}
                          >
                            <div
                              className="flex h-4 w-4 items-center justify-center rounded-full border-2 transition-colors"
                              style={{
                                borderColor: isSelected ? survey.primary_color : undefined,
                                backgroundColor: isSelected ? survey.primary_color : undefined,
                              }}
                            >
                              {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                            </div>
                            <span className="text-sm">{opt}</span>
                            <input
                              type="radio"
                              name={`q-${q.id}`}
                              value={opt}
                              checked={isSelected}
                              onChange={() => setAnswer(q.id, opt)}
                              className="sr-only"
                            />
                          </label>
                        )
                      })}
                    </div>
                  )}

                  {q.type === 'rating' && (
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((n) => {
                        const filled = Number(answers[q.id]) >= n
                        return (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setAnswer(q.id, String(n))}
                            className="rounded-lg p-1 transition-transform hover:scale-110"
                          >
                            <Star
                              className="h-8 w-8 transition-colors"
                              fill={filled ? survey.primary_color : 'transparent'}
                              stroke={filled ? survey.primary_color : 'currentColor'}
                              strokeWidth={1.5}
                            />
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              ))}

              {questions.length > 0 && (
                <Button
                  type="submit"
                  className="w-full text-white"
                  size="lg"
                  disabled={submitting}
                  style={{
                    backgroundColor: survey.primary_color,
                  }}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    'Submit Response'
                  )}
                </Button>
              )}

              {questions.length === 0 && (
                <p className="py-8 text-center text-muted-foreground">
                  This survey has no questions yet.
                </p>
              )}
            </form>
          </div>
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground">Powered by Survey Builder</p>
      </div>
    </div>
  )
}
