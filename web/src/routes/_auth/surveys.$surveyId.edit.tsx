import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { createFileRoute, Link } from '@tanstack/react-router'
import {
  ArrowLeft,
  BarChart3,
  Copy,
  ExternalLink,
  GripVertical,
  Image,
  Loader2,
  Palette,
  Pencil,
  Plus,
  Save,
  Star,
  Trash2,
  Type,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api'

export const Route = createFileRoute('/_auth/surveys/$surveyId/edit')({
  component: EditSurveyPage,
})

type Survey = {
  id: string
  title: string
  primary_color: string
  logo_url: string
  created_at: string
}

type Question = {
  id: string
  title: string
  type: 'short_text' | 'multiple_choice' | 'rating'
  options: string[]
  display_order: number
}

const QUESTION_TYPES = [
  { value: 'short_text', label: 'Short Text', icon: Type },
  { value: 'multiple_choice', label: 'Multiple Choice', icon: BarChart3 },
  { value: 'rating', label: 'Rating (1-5)', icon: Star },
] as const

function SortableQuestion({
  question,
  isEditing,
  onEdit,
  onSave,
  onCancel,
  onDelete,
  editState,
  onEditStateChange,
}: {
  question: Question
  isEditing: boolean
  onEdit: () => void
  onSave: () => void
  onCancel: () => void
  onDelete: () => void
  editState: { title: string; type: string; options: string[] }
  onEditStateChange: (state: { title?: string; type?: string; options?: string[] }) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: question.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  if (isEditing) {
    return (
      <div ref={setNodeRef} style={style} className="space-y-3 rounded-lg border bg-card p-4">
        <div className="space-y-2">
          <Label>Question Title</Label>
          <Input
            value={editState.title}
            onChange={(e) => onEditStateChange({ title: e.target.value })}
            placeholder="Enter question..."
            autoFocus
          />
        </div>
        <div className="space-y-2">
          <Label>Type</Label>
          <Select value={editState.type} onValueChange={(v) => onEditStateChange({ type: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {QUESTION_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {editState.type === 'multiple_choice' && (
          <div className="space-y-2">
            <Label>Options</Label>
            {editState.options.map((opt, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: index is appropriate for options key
              <div key={`edit-opt-${i}`} className="flex gap-2">
                <Input
                  value={opt}
                  onChange={(e) => {
                    const newOpts = [...editState.options]
                    newOpts[i] = e.target.value
                    onEditStateChange({ options: newOpts })
                  }}
                  placeholder={`Option ${i + 1}`}
                />
                {editState.options.length > 2 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      onEditStateChange({
                        options: editState.options.filter((_, idx) => idx !== i),
                      })
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                onEditStateChange({
                  options: [...editState.options, ''],
                })
              }
            >
              <Plus className="h-3 w-3" /> Add Option
            </Button>
          </div>
        )}
        <div className="flex gap-2 pt-2">
          <Button size="sm" onClick={onSave}>
            <Save className="h-3 w-3" /> Save
          </Button>
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center gap-3 rounded-lg border bg-card p-3 transition-shadow hover:shadow-sm ${isDragging ? 'shadow-lg opacity-50' : ''}`}
    >
      <button
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{question.title}</p>
        <Badge variant="secondary" className="mt-1 text-xs">
          {QUESTION_TYPES.find((t) => t.value === question.type)?.label}
        </Badge>
      </div>
      <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
          <Pencil className="h-3 w-3" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={onDelete}>
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
}

function EditSurveyPage() {
  const { surveyId } = Route.useParams()
  const [survey, setSurvey] = useState<Survey | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editState, setEditState] = useState({
    title: '',
    type: 'short_text',
    options: ['', ''],
  })
  const [addingType, setAddingType] = useState<string | null>(null)
  const [addTitle, setAddTitle] = useState('')
  const [addOptions, setAddOptions] = useState(['', ''])
  const [saving, setSaving] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const fetchSurvey = useCallback(async () => {
    try {
      const data = await api.get<{ survey: Survey; questions: Question[] }>(`/surveys/${surveyId}`)
      setSurvey(data.survey)
      setQuestions(data.questions)
    } catch {
      toast.error('Failed to load survey')
    } finally {
      setLoading(false)
    }
  }, [surveyId])

  useEffect(() => {
    fetchSurvey()
  }, [fetchSurvey])

  const handleSurveyUpdate = async (
    updates: Partial<{
      title: string
      primaryColor: string
      logoUrl: string
    }>,
  ) => {
    if (!survey) return
    try {
      const data = await api.put<{ survey: Survey }>(`/surveys/${surveyId}`, updates)
      setSurvey(data.survey)
    } catch {
      toast.error('Failed to update survey')
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = questions.findIndex((q) => q.id === active.id)
    const newIndex = questions.findIndex((q) => q.id === over.id)
    const reordered = arrayMove(questions, oldIndex, newIndex)
    setQuestions(reordered)
    try {
      await api.put(`/surveys/${surveyId}/questions/reorder`, {
        questionIds: reordered.map((q) => q.id),
      })
    } catch {
      toast.error('Failed to reorder')
      fetchSurvey()
    }
  }

  const handleAddQuestion = async () => {
    if (!addTitle.trim() || !addingType) return
    setSaving(true)
    try {
      const data = await api.post<{ question: Question }>(`/surveys/${surveyId}/questions`, {
        title: addTitle.trim(),
        type: addingType,
        options: addingType === 'multiple_choice' ? addOptions.filter(Boolean) : [],
      })
      setQuestions((prev) => [...prev, data.question])
      setAddingType(null)
      setAddTitle('')
      setAddOptions(['', ''])
      toast.success('Question added')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add question')
    } finally {
      setSaving(false)
    }
  }

  const handleStartEdit = (q: Question) => {
    setEditingId(q.id)
    setEditState({
      title: q.title,
      type: q.type,
      options: q.options.length > 0 ? [...q.options] : ['', ''],
    })
  }

  const handleSaveEdit = async () => {
    if (!editingId || !editState.title.trim()) return
    setSaving(true)
    try {
      const data = await api.put<{ question: Question }>(`/questions/${editingId}`, {
        title: editState.title.trim(),
        type: editState.type,
        options: editState.type === 'multiple_choice' ? editState.options.filter(Boolean) : [],
      })
      setQuestions((prev) => prev.map((q) => (q.id === editingId ? data.question : q)))
      setEditingId(null)
      toast.success('Question updated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteQuestion = async (id: string) => {
    try {
      await api.delete(`/questions/${id}`)
      setQuestions((prev) => prev.filter((q) => q.id !== id))
      if (editingId === id) setEditingId(null)
      toast.success('Question deleted')
    } catch {
      toast.error('Failed to delete question')
    }
  }

  const publicUrl = `${window.location.origin}/s/${surveyId}`

  const copyLink = () => {
    navigator.clipboard.writeText(publicUrl)
    toast.success('Link copied to clipboard')
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-4 w-1/4" />
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="space-y-4 lg:col-span-3">
            <Skeleton className="h-32" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
          <div className="lg:col-span-2">
            <Skeleton className="h-96" />
          </div>
        </div>
      </div>
    )
  }

  if (!survey) {
    return (
      <div className="flex flex-col items-center py-16">
        <h2 className="text-lg font-semibold">Survey not found</h2>
        <Link to="/dashboard" className="mt-2 text-primary hover:underline">
          Back to Dashboard
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link to="/dashboard" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <Input
            value={survey.title}
            onChange={(e) => setSurvey({ ...survey, title: e.target.value })}
            onBlur={() => handleSurveyUpdate({ title: survey.title })}
            className="border-none bg-transparent px-0 text-xl font-bold focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={copyLink}>
            <Copy className="h-3 w-3" /> Copy Link
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={publicUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3 w-3" /> Preview
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/surveys/$surveyId/responses" params={{ surveyId }}>
              <BarChart3 className="h-3 w-3" /> Responses
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Palette className="h-4 w-4" /> Branding
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-end gap-4">
                <div className="space-y-2">
                  <Label>Primary Color</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={survey.primary_color}
                      onChange={(e) => {
                        setSurvey({
                          ...survey,
                          primary_color: e.target.value,
                        })
                        handleSurveyUpdate({
                          primaryColor: e.target.value,
                        })
                      }}
                      className="h-9 w-9 cursor-pointer rounded-md border border-input p-0.5"
                    />
                    <Input
                      value={survey.primary_color}
                      onChange={(e) =>
                        setSurvey({
                          ...survey,
                          primary_color: e.target.value,
                        })
                      }
                      onBlur={() =>
                        handleSurveyUpdate({
                          primaryColor: survey.primary_color,
                        })
                      }
                      className="w-28 font-mono text-sm"
                    />
                  </div>
                </div>
                <div className="flex-1 space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <Image className="h-3 w-3" /> Logo URL
                  </Label>
                  <Input
                    value={survey.logo_url}
                    onChange={(e) =>
                      setSurvey({
                        ...survey,
                        logo_url: e.target.value,
                      })
                    }
                    onBlur={() => handleSurveyUpdate({ logoUrl: survey.logo_url })}
                    placeholder="https://example.com/logo.png"
                  />
                </div>
              </div>
              {survey.logo_url && (
                <div className="flex items-center gap-2 rounded-md bg-muted p-3">
                  <img
                    src={survey.logo_url}
                    alt="Logo preview"
                    className="h-8 max-w-[120px] object-contain"
                    onError={(e) => {
                      ;(e.target as HTMLImageElement).style.display = 'none'
                    }}
                  />
                  <span className="text-xs text-muted-foreground">Logo preview</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Questions ({questions.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {questions.length === 0 && !addingType && (
                <div className="py-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    No questions yet. Add your first question below.
                  </p>
                </div>
              )}

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={questions.map((q) => q.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {questions.map((q) => (
                    <SortableQuestion
                      key={q.id}
                      question={q}
                      isEditing={editingId === q.id}
                      onEdit={() => handleStartEdit(q)}
                      onSave={handleSaveEdit}
                      onCancel={() => setEditingId(null)}
                      onDelete={() => handleDeleteQuestion(q.id)}
                      editState={editState}
                      onEditStateChange={(changes) =>
                        setEditState((prev) => ({
                          ...prev,
                          ...changes,
                        }))
                      }
                    />
                  ))}
                </SortableContext>
              </DndContext>

              {addingType ? (
                <div className="space-y-3 rounded-lg border border-dashed border-primary/50 bg-primary/5 p-4">
                  <div className="space-y-2">
                    <Label>Question Type</Label>
                    <Select value={addingType} onValueChange={setAddingType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {QUESTION_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Question Title</Label>
                    <Input
                      value={addTitle}
                      onChange={(e) => setAddTitle(e.target.value)}
                      placeholder="Enter your question..."
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddQuestion()
                      }}
                    />
                  </div>
                  {addingType === 'multiple_choice' && (
                    <div className="space-y-2">
                      <Label>Options</Label>
                      {addOptions.map((opt, i) => (
                        // biome-ignore lint/suspicious/noArrayIndexKey: index is appropriate for options key
                        <div key={`add-opt-${i}`} className="flex gap-2">
                          <Input
                            value={opt}
                            onChange={(e) => {
                              const newOpts = [...addOptions]
                              newOpts[i] = e.target.value
                              setAddOptions(newOpts)
                            }}
                            placeholder={`Option ${i + 1}`}
                          />
                          {addOptions.length > 2 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                setAddOptions(addOptions.filter((_, idx) => idx !== i))
                              }
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAddOptions([...addOptions, ''])}
                      >
                        <Plus className="h-3 w-3" /> Add Option
                      </Button>
                    </div>
                  )}
                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      onClick={handleAddQuestion}
                      disabled={saving || !addTitle.trim()}
                    >
                      {saving ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Plus className="h-3 w-3" />
                      )}
                      Add Question
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setAddingType(null)
                        setAddTitle('')
                        setAddOptions(['', ''])
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="w-full border-dashed"
                  onClick={() => setAddingType('short_text')}
                >
                  <Plus className="h-4 w-4" /> Add Question
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <div className="sticky top-20">
            <Card className="overflow-hidden">
              <div className="h-1.5" style={{ backgroundColor: survey.primary_color }} />
              <CardContent className="p-6">
                <div className="space-y-6">
                  {survey.logo_url && (
                    <img
                      src={survey.logo_url}
                      alt="Survey logo"
                      className="h-10 object-contain"
                      onError={(e) => {
                        ;(e.target as HTMLImageElement).style.display = 'none'
                      }}
                    />
                  )}
                  <h2 className="text-lg font-bold">{survey.title || 'Untitled Survey'}</h2>
                  <Separator />
                  {questions.length === 0 ? (
                    <p className="py-4 text-center text-sm text-muted-foreground">
                      Questions will appear here
                    </p>
                  ) : (
                    questions.map((q, i) => (
                      <div key={q.id} className="space-y-2">
                        <p className="text-sm font-medium">
                          {i + 1}. {q.title}
                        </p>
                        {q.type === 'short_text' && (
                          <div className="h-9 rounded-md border bg-muted/30" />
                        )}
                        {q.type === 'multiple_choice' && (
                          <div className="space-y-1.5">
                            {q.options.map((opt) => (
                              <div key={opt} className="flex items-center gap-2">
                                <div
                                  className="h-4 w-4 rounded-full border-2"
                                  style={{
                                    borderColor: survey.primary_color,
                                  }}
                                />
                                <span className="text-sm text-muted-foreground">{opt}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {q.type === 'rating' && (
                          <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map((n) => (
                              <Star
                                key={n}
                                className="h-5 w-5"
                                style={{
                                  color: survey.primary_color,
                                }}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                  {questions.length > 0 && (
                    <Button
                      className="w-full"
                      style={{
                        backgroundColor: survey.primary_color,
                      }}
                      disabled
                    >
                      Submit
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
            <p className="mt-2 text-center text-xs text-muted-foreground">Live Preview</p>
          </div>
        </div>
      </div>
    </div>
  )
}
