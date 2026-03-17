/**
 * edunextService.ts
 *
 * Both EduNext and AI Tutor share the SAME Supabase project.
 * This service directly queries EduNext's live tables to get user
 * performance data and format it for the AI Tutor prompt.
 *
 * EduNext tables used:
 *   - user_responses  : one row per question attempted (subject, accuracy, time, difficulty)
 *   - test_attempts   : one row per mock/contest session (total marks, accuracy)
 */

import { createClient } from '@supabase/supabase-js'
import type { BehaviorSummary } from './behaviorTracker'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SubjectPerformance {
  subject: string
  totalQuestions: number
  correct: number
  accuracy: number
  avgTimePerQuestion: number
  difficultyBreakdown: { level: string; total: number; correct: number; accuracy: number }[]
}

export interface EdunextPerformanceSummary {
  overview: {
    totalQuestions: number
    correctAnswers: number
    overallAccuracy: number
    totalMarks: number
    rating: number
    totalSessions: number
    improvementTrend: number
  }
  subjectPerformance: SubjectPerformance[]
  recentTests: { testId: string; marks: number; accuracy: number; date: string }[]
  weakAreas: { area: string; accuracy: number; type: 'subject' | 'difficulty' }[]
}

// ─── Fetch from shared Supabase ───────────────────────────────────────────────

export async function fetchEdunextPerformance(userId: string): Promise<EdunextPerformanceSummary | null> {
  if (!userId || userId.startsWith('guest_') || userId === 'user_123') return null

  try {
    // Fetch question-level responses
    const { data: responses, error: respErr } = await supabase
      .from('user_responses')
      .select('subject_name, is_correct, marks_obtained, time_spent_seconds, difficulty, session_id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (respErr) {
      console.warn('[EdunextService] user_responses fetch error:', respErr.message)
      return null
    }

    // Fetch test/contest attempts
    const { data: attempts, error: attErr } = await supabase
      .from('test_attempts')
      .select('test_id, session_id, obtained_marks, accuracy, correct_answers, incorrect_answers, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10)

    if (attErr) {
      console.warn('[EdunextService] test_attempts fetch error:', attErr.message)
    }

    const rows = responses ?? []
    if (rows.length === 0) return null

    // ─── Overview ────────────────────────────────────────────────────────────
    const isCorrect = (r: any) => r.is_correct === true || r.is_correct === 'True'
    const totalQuestions = rows.length
    const correctAnswers = rows.filter(isCorrect).length
    const overallAccuracy = Math.round((correctAnswers / totalQuestions) * 100)
    const totalMarks = rows.reduce((sum: number, r: any) => sum + (r.marks_obtained || 0), 0)
    const rating = 1200 + Math.round(totalMarks)
    const sessions = [...new Set(rows.map((r: any) => r.session_id).filter(Boolean))]

    // Improvement trend: last 10 vs prev 10
    const last10 = rows.slice(0, 10)
    const prev10 = rows.slice(10, 20)
    const getAcc = (arr: any[]) => arr.length ? (arr.filter(isCorrect).length / arr.length) * 100 : 0
    const improvementTrend = prev10.length ? +(getAcc(last10) - getAcc(prev10)).toFixed(1) : 0

    // ─── Subject performance ─────────────────────────────────────────────────
    const subjectNames = [...new Set(rows.map((r: any) => r.subject_name).filter(Boolean))] as string[]
    const subjectPerformance: SubjectPerformance[] = subjectNames.map(subject => {
      const subRows = rows.filter((r: any) => r.subject_name === subject)
      const correct = subRows.filter(isCorrect).length
      const totalTime = subRows.reduce((sum: number, r: any) => sum + (r.time_spent_seconds || 0), 0)
      const avgTimePerQuestion = subRows.length > 0 ? Math.round(totalTime / subRows.length) : 0

      const diffs = [...new Set(subRows.map((r: any) => r.difficulty).filter(Boolean))] as string[]
      const difficultyBreakdown = diffs.map(diff => {
        const diffRows = subRows.filter((r: any) => r.difficulty === diff)
        const diffCorrect = diffRows.filter(isCorrect).length
        return {
          level: diff,
          total: diffRows.length,
          correct: diffCorrect,
          accuracy: Math.round((diffCorrect / diffRows.length) * 100),
        }
      })

      return {
        subject,
        totalQuestions: subRows.length,
        correct,
        accuracy: Math.round((correct / subRows.length) * 100),
        avgTimePerQuestion,
        difficultyBreakdown,
      }
    })

    // ─── Recent tests ────────────────────────────────────────────────────────
    const recentTests = (attempts ?? []).slice(0, 5).map((a: any) => ({
      testId: a.test_id || a.session_id,
      marks: a.obtained_marks ?? 0,
      accuracy: a.accuracy ?? 0,
      date: a.created_at,
    }))

    // ─── Weak areas ──────────────────────────────────────────────────────────
    const weakAreas: { area: string; accuracy: number; type: 'subject' | 'difficulty' }[] = []
    subjectPerformance.forEach(s => {
      if (s.accuracy < 50) weakAreas.push({ area: s.subject, accuracy: s.accuracy, type: 'subject' })
      s.difficultyBreakdown.forEach(d => {
        if (d.accuracy < 50 && d.total >= 3) {
          weakAreas.push({ area: `${s.subject} - ${d.level}`, accuracy: d.accuracy, type: 'difficulty' })
        }
      })
    })

    return {
      overview: { totalQuestions, correctAnswers, overallAccuracy, totalMarks, rating, totalSessions: sessions.length, improvementTrend },
      subjectPerformance,
      recentTests,
      weakAreas,
    }
  } catch (e) {
    console.warn('[EdunextService] unexpected error:', e)
    return null
  }
}

// ─── Build Tutor Context String ───────────────────────────────────────────────

export function buildEdunextContext(perf: EdunextPerformanceSummary | null): string {
  if (!perf) return ''

  const { overview, subjectPerformance, recentTests, weakAreas } = perf
  const lines: string[] = [
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    'EDUNEXT LIVE PERFORMANCE DATA:',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
  ]

  // Overview
  lines.push(`📊 OVERALL: ${overview.totalQuestions} questions | Accuracy: ${overview.overallAccuracy}% | Rating: ${overview.rating}`)
  lines.push(`   Sessions: ${overview.totalSessions} | Trend: ${overview.improvementTrend > 0 ? '+' : ''}${overview.improvementTrend}% vs previous`)

  // Subject breakdown
  if (subjectPerformance.length > 0) {
    lines.push(`\n📚 SUBJECT ACCURACY:`)
    subjectPerformance.forEach(s => {
      const bar = s.accuracy >= 70 ? '🟢' : s.accuracy >= 50 ? '🟡' : '🔴'
      lines.push(`   ${bar} ${s.subject}: ${s.accuracy}% (${s.totalQuestions} qs, avg ${s.avgTimePerQuestion}s/q)`)
      s.difficultyBreakdown.forEach(d => {
        lines.push(`      └ ${d.level}: ${d.accuracy}% (${d.total} qs)`)
      })
    })
  }

  // Recent tests
  if (recentTests.length > 0) {
    lines.push(`\n🏆 RECENT TESTS:`)
    recentTests.forEach((t, i) => {
      lines.push(`   ${i + 1}. ${t.marks} marks | ${t.accuracy}% accuracy`)
    })
  }

  // Weak areas
  if (weakAreas.length > 0) {
    lines.push(`\n⚠️ WEAK AREAS (< 50% accuracy):`)
    weakAreas.forEach(w => lines.push(`   • ${w.area}: ${w.accuracy}%`))
  }

  lines.push('')
  lines.push('HOW TO USE THIS DATA:')
  lines.push('→ If current topic matches a weak area, be extra patient and start from basics.')
  lines.push('→ If overall accuracy < 50%, use extra encouragement and simpler language.')
  lines.push('→ If accuracy > 75% and trend is positive, push harder — challenge with edge cases.')
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  return lines.join('\n')
}

// ─── Save AI Tutor Insights (for EduNext to read) ────────────────────────────

export async function saveAITutorInsight(
  userId: string,
  subject: string,
  topic: string,
  summary: BehaviorSummary
): Promise<void> {
  if (!userId || userId.startsWith('guest_') || !subject || !topic) return

  try {
    const { data: existing } = await supabase
      .from('ai_tutor_insights')
      .select('total_sessions, avg_struggle_score, total_hints_used, total_wrong_attempts, avg_time_per_q_ms')
      .eq('user_id', userId)
      .eq('subject', subject)
      .eq('topic', topic)
      .single()

    const sessions = (existing?.total_sessions ?? 0) + 1
    const prevAvg = existing?.avg_struggle_score ?? 0
    const newAvg = ((prevAvg * (sessions - 1)) + summary.struggle_score) / sessions

    await supabase.from('ai_tutor_insights').upsert({
      user_id: userId,
      subject,
      topic,
      total_sessions: sessions,
      avg_struggle_score: Math.round(newAvg),
      total_hints_used: (existing?.total_hints_used ?? 0) + summary.hint_count,
      total_wrong_attempts: (existing?.total_wrong_attempts ?? 0) + summary.wrong_attempts,
      avg_time_per_q_ms: Math.round(
        (((existing?.avg_time_per_q_ms ?? 0) * (sessions - 1)) + summary.time_spent_ms) / sessions
      ),
      mastery_level: summary.understanding_level,
      last_session_summary: summary as unknown as Record<string, unknown>,
      last_updated: new Date().toISOString(),
    }, { onConflict: 'user_id,subject,topic' })
  } catch (e) {
    console.warn('[EdunextService] saveAITutorInsight error:', e)
  }
}

// ─── Fetch AI Tutor Insights (for EduNext pull endpoint) ─────────────────────

export async function fetchAITutorInsights(userId: string) {
  if (!userId) return []
  try {
    const { data } = await supabase
      .from('ai_tutor_insights')
      .select('*')
      .eq('user_id', userId)
      .order('last_updated', { ascending: false })
    return data ?? []
  } catch {
    return []
  }
}
