import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'

export const Route = createFileRoute('/_auth/surveys/create')({
  component: CreateSurveyPage,
})

type Survey = {
  id: string
  title: string
}

function CreateSurveyPage() {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      toast.error('Please enter a survey title')
      return
    }

    setLoading(true)
    try {
      const data = await api.post<{ survey: Survey }>('/surveys', {
        title: title.trim(),
      })
      toast.success('Survey created!')
      navigate({
        to: '/surveys/$surveyId/edit',
        params: { surveyId: data.survey.id },
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create survey')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Create New Survey</h1>
        <p className="text-muted-foreground">Start with a title, then add questions and branding</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Survey Details</CardTitle>
          <CardDescription>
            You can customize branding and add questions after creating
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Survey Title</Label>
              <Input
                id="title"
                placeholder="e.g., Customer Satisfaction Survey"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
                required
              />
            </div>
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate({ to: '/dashboard' })}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading || !title.trim()}>
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create & Continue'
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
