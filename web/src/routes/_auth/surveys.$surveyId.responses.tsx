import { createFileRoute, Link } from '@tanstack/react-router'
import {
  ArrowLeft,
  BarChart3,
  ChevronRight,
  Download,
  Eye,
  Loader2,
  MessageSquare,
  Star,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api'

export const Route = createFileRoute('/_auth/surveys/$surveyId/responses')({
  component: ResponsesPage,
})

type SurveyResponse = {
  id: string
  submitted_at: string
}

type Answer = {
  id: string
  question_id: string
  value: string
  question_title: string
  question_type: string
}

type Question = {
  id: string
  title: string
  type: 'short_text' | 'multiple_choice' | 'rating'
  options: string[]
  display_order: number
}

type DBAnswer = {
  id: string
  response_id: string
  question_id: string
  value: string
}

function ResponsesPage() {
  const { surveyId } = Route.useParams()
  const [responses, setResponses] = useState<SurveyResponse[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [allAnswers, setAllAnswers] = useState<DBAnswer[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Answer[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [surveyTitle, setSurveyTitle] = useState('')

  const fetchResponses = useCallback(async () => {
    try {
      const surveyData = await api.get<{
        survey: { title: string }
      }>(`/surveys/${surveyId}`)
      setSurveyTitle(surveyData.survey.title)

      const data = await api.get<{
        responses: SurveyResponse[]
        questions: Question[]
        answers: DBAnswer[]
      }>(`/surveys/${surveyId}/responses`)

      setResponses(data.responses)
      setQuestions(data.questions || [])
      setAllAnswers(data.answers || [])
    } catch {
      toast.error('Failed to load responses')
    } finally {
      setLoading(false)
    }
  }, [surveyId])

  useEffect(() => {
    fetchResponses()
  }, [fetchResponses])

  const viewDetail = async (id: string) => {
    setSelectedId(id)
    setLoadingDetail(true)
    try {
      const data = await api.get<{
        response: SurveyResponse
        answers: Answer[]
      }>(`/responses/${id}`)
      setAnswers(data.answers)
    } catch {
      toast.error('Failed to load response details')
      setSelectedId(null)
    } finally {
      setLoadingDetail(false)
    }
  }

  const handleExportCSV = () => {
    if (responses.length === 0 || questions.length === 0) return

    // CSV header row: Response ID, Submitted At, followed by all questions' titles
    const headers = [
      'Response ID',
      'Submitted At',
      ...questions.map((q) => `"${q.title.replace(/"/g, '""')}"`),
    ]

    // Rows: for each response, map its answers matching the question ID
    const rows = responses.map((r) => {
      const responseAnswers = allAnswers.filter((a) => a.response_id === r.id)
      const answerValues = questions.map((q) => {
        const ans = responseAnswers.find((a) => a.question_id === q.id)
        const val = ans ? ans.value : ''
        return `"${val.replace(/"/g, '""')}"`
      })
      return [`"${r.id}"`, `"${new Date(r.submitted_at).toLocaleString()}"`, ...answerValues]
    })

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute(
      'download',
      `${surveyTitle.toLowerCase().replace(/[^a-z0-9]/g, '_')}_responses.csv`,
    )
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('CSV export completed')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          to="/surveys/$surveyId/edit"
          params={{ surveyId }}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Responses</h1>
          <p className="text-muted-foreground">{surveyTitle}</p>
        </div>
        <Badge variant="secondary" className="ml-auto">
          {loading ? '...' : responses.length} {responses.length === 1 ? 'response' : 'responses'}
        </Badge>
      </div>

      {/* Analytics Section */}
      {!loading && responses.length > 0 && (
        <Card className="border-muted bg-card shadow-sm">
          <CardContent className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Response Summary Analytics
              </h2>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCSV}
                className="flex items-center gap-1.5"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {questions.map((q) => {
                const qAnswers = allAnswers.filter((a) => a.question_id === q.id)
                const totalAnswers = qAnswers.length

                if (q.type === 'rating') {
                  const ratings = qAnswers
                    .map((a) => Number(a.value))
                    .filter((v) => !Number.isNaN(v))
                  const average =
                    ratings.length > 0
                      ? (ratings.reduce((sum, r) => sum + r, 0) / ratings.length).toFixed(1)
                      : 'N/A'

                  // Compute counts for 1-5
                  const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
                  for (const r of ratings) {
                    if (r >= 1 && r <= 5) counts[r] = (counts[r] || 0) + 1
                  }

                  return (
                    <div key={q.id} className="p-4 rounded-lg border bg-muted/20 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-foreground truncate">
                            {q.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Rating Question • {totalAnswers} answers
                          </p>
                        </div>
                        <Badge
                          variant="default"
                          className="bg-primary/10 text-primary hover:bg-primary/20 text-sm font-semibold ml-2 shrink-0"
                        >
                          {average} / 5.0
                        </Badge>
                      </div>

                      <div className="space-y-1.5">
                        {[5, 4, 3, 2, 1].map((rating) => {
                          const count = counts[rating] || 0
                          const pct =
                            totalAnswers > 0 ? Math.round((count / totalAnswers) * 100) : 0
                          return (
                            <div key={rating} className="flex items-center gap-2 text-xs">
                              <span className="w-12 text-muted-foreground flex items-center gap-0.5">
                                {rating}{' '}
                                <Star className="h-3 w-3 fill-amber-400 stroke-amber-400" />
                              </span>
                              <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                                <div
                                  className="h-full bg-primary transition-all"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="w-10 text-right font-medium">
                                {count} ({pct}%)
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                }

                if (q.type === 'multiple_choice') {
                  return (
                    <div key={q.id} className="p-4 rounded-lg border bg-muted/20 space-y-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground truncate">{q.title}</p>
                        <p className="text-xs text-muted-foreground">
                          Multiple Choice • {totalAnswers} answers
                        </p>
                      </div>

                      <div className="space-y-2">
                        {q.options.map((opt) => {
                          const count = qAnswers.filter((a) => a.value === opt).length
                          const pct =
                            totalAnswers > 0 ? Math.round((count / totalAnswers) * 100) : 0
                          return (
                            <div key={opt} className="space-y-1">
                              <div className="flex items-center justify-between text-xs font-medium">
                                <span>{opt}</span>
                                <span>
                                  {count} ({pct}%)
                                </span>
                              </div>
                              <div className="h-2 rounded-full bg-secondary overflow-hidden">
                                <div
                                  className="h-full bg-primary transition-all"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                }

                // Short Text
                const recentAnswers = qAnswers.slice(-3)
                return (
                  <div key={q.id} className="p-4 rounded-lg border bg-muted/20 space-y-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground truncate">{q.title}</p>
                      <p className="text-xs text-muted-foreground">
                        Short Text • {totalAnswers} answers
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                        Recent Answers
                      </p>
                      {recentAnswers.length === 0 ? (
                        <p className="text-xs italic text-muted-foreground">No text responses</p>
                      ) : (
                        <div className="space-y-1">
                          {recentAnswers.map((ans) => (
                            <div
                              key={ans.id}
                              className="text-xs bg-background p-2 rounded border truncate"
                            >
                              "{ans.value}"
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={`resp-skeleton-${i}`} className="h-16" />
          ))}
        </div>
      ) : responses.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <MessageSquare className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="mb-1 text-lg font-semibold">No responses yet</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              Share your survey to start collecting responses
            </p>
            <Button variant="outline" asChild>
              <Link to="/surveys/$surveyId/edit" params={{ surveyId }}>
                Back to Survey
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {responses.map((r, i) => (
            <button
              key={r.id}
              type="button"
              onClick={() => viewDetail(r.id)}
              className="flex w-full items-center gap-4 rounded-lg border bg-card p-4 text-left transition-colors hover:bg-accent"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                {responses.length - i}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Response #{responses.length - i}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(r.submitted_at).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          ))}
        </div>
      )}

      <Dialog open={!!selectedId} onOpenChange={() => setSelectedId(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Response Details
            </DialogTitle>
          </DialogHeader>
          {loadingDetail ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="space-y-4">
              {answers.map((a) => (
                <div key={a.id} className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">{a.question_title}</p>
                  {a.question_type === 'rating' ? (
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star
                          key={n}
                          className="h-4 w-4"
                          fill={Number(a.value) >= n ? '#f59e0b' : 'transparent'}
                          stroke={Number(a.value) >= n ? '#f59e0b' : 'currentColor'}
                          strokeWidth={1.5}
                        />
                      ))}
                      <span className="ml-1 text-sm">{a.value}/5</span>
                    </div>
                  ) : (
                    <p className="text-sm">{a.value}</p>
                  )}
                  <Separator />
                </div>
              ))}
              {answers.length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">No answers found</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
