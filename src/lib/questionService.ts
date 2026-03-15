// src/lib/questionService.ts
// ✅ Calls your own API route (which checks NextAuth session + uses service role)
// ✅ Never touches Supabase directly from the browser

import type { Question } from '../data/questions'

type Filters = {
  subject?: string
  topic?: string
  chapter?: string
  difficulty?: string
  type?: string
}

function mapQuestion(q: any): Question {
  return {
    id: q.id,
    title: q.question_text || 'Untitled Question',
    content: q.question_text || '',
    subject: q.subject || '',
    topic: q.topic || '',
    chapter: q.chapter || '',
    difficulty: q.difficulty || '',
    type: q.question_type || '',
    imageUrl: q.question_image_url || undefined,
    positiveMarks: q.positive_marks ? parseFloat(q.positive_marks) : undefined,
    negativeMarks: q.negative_marks ? parseFloat(q.negative_marks) : undefined,
    numericalAnswer: q.numerical_answer ?? undefined,
    numericalTolerance: q.numerical_tolerance ?? undefined,
    tags: q.tags || [],
    source: q.source || '',
  }
}

export async function getQuestions(filters: Filters = {}): Promise<Question[]> {
  const params = new URLSearchParams()
  if (filters.subject)    params.set('subject', filters.subject)
  if (filters.topic)      params.set('topic', filters.topic)
  if (filters.chapter)    params.set('chapter', filters.chapter)
  if (filters.difficulty) params.set('difficulty', filters.difficulty)
  if (filters.type)       params.set('type', filters.type)

  const res = await fetch(`/api/questions?${params.toString()}`)

  if (res.status === 401) {
    throw new Error('Please log in to access questions')
  }
  if (!res.ok) {
    throw new Error('Failed to fetch questions')
  }

  const { questions } = await res.json()
  return (questions || []).map(mapQuestion)
}

export async function getSubjects(): Promise<string[]> {
  return getDistinctValues('subject')
}

export async function getDistinctValues(
  column: 'subject' | 'topic' | 'chapter' | 'difficulty' | 'type'
): Promise<string[]> {
  const res = await fetch('/api/questions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ column }),
  })

  if (res.status === 401) {
    console.warn(`Not logged in — cannot fetch ${column} options`)
    return []
  }
  if (!res.ok) return []

  const { values } = await res.json()
  return values || []
}