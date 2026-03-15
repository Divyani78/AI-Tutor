/**
 * edunextService.ts
 * Fetches EduNext contest/mock performance for a user and formats it
 * for injection into the AI Tutor prompt. Also handles saving AI Tutor
 * behavior insights back to the shared Supabase tables for EduNext to read.
 */

import { createClient } from '@supabase/supabase-js'
import type { BehaviorSummary } from './behaviorTracker'

// Use service role for server-side access; falls back to anon key on client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabaseServer = createClient(supabaseUrl, supabaseKey)

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EdunextPerformance {
  id: string
  user_id: string
  contest_id: string
  contest_name: string
  contest_type: 'mock' | 'contest' | 'practice' | 'chapter_test'
  score: number
  max_score: number
  percentile: number | null
  rank: number | null
  subject_scores: Record<string, number>    // { "Mathematics": 72, "Physics": 60 }
  topic_scores: Record<string, number>      // { "Complex Numbers": 10, "Kinematics": 6 }
  weak_topics: string[]
  attempted_at: string
}

export interface AiTutorInsight {
  user_id: string
  subject: string
  topic: string
  total_sessions: number
  avg_struggle_score: number
  total_hints_used: number
  total_wrong_attempts: number
  avg_time_per_q_ms: number
  mastery_level: 'unknown' | 'struggling' | 'learning' | 'confident' | 'mastered'
  last_session_summary: Record<string, unknown>
  last_updated: string
}

// ─── Fetch EduNext Performance ────────────────────────────────────────────────

/**
 * Returns the last 10 contest/mock entries for a user, newest first.
 */
export async function fetchEdunextPerformance(userId: string): Promise<EdunextPerformance[]> {
  if (!userId || userId.startsWith('guest_')) return []

  try {
    const { data, error } = await supabaseServer
      .from('edunext_performance')
      .select('*')
      .eq('user_id', userId)
      .order('attempted_at', { ascending: false })
      .limit(10)

    if (error) {
      console.warn('[EdunextService] fetch error:', error.message)
      return []
    }
    return (data as EdunextPerformance[]) ?? []
  } catch (e) {
    console.warn('[EdunextService] unexpected error:', e)
    return []
  }
}

// ─── Build Tutor Context String ───────────────────────────────────────────────

/**
 * Converts EduNext performance records into a concise context block
 * that gets injected into the AI Tutor's system prompt.
 */
export function buildEdunextContext(records: EdunextPerformance[]): string {
  if (records.length === 0) return ''

  const lines: string[] = [
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    'EDUNEXT CONTEST & MOCK PERFORMANCE:',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
  ]

  // Latest result summary
  const latest = records[0]
  const latestPct = latest.max_score > 0
    ? Math.round((latest.score / latest.max_score) * 100)
    : 0
  lines.push(`📋 LATEST: ${latest.contest_name} (${latest.contest_type})`)
  lines.push(`   Score: ${latest.score}/${latest.max_score} (${latestPct}%)${latest.percentile ? ` | Percentile: ${latest.percentile.toFixed(1)}` : ''}${latest.rank ? ` | Rank: ${latest.rank}` : ''}`)

  // Subject-wise scores from latest
  if (Object.keys(latest.subject_scores).length > 0) {
    const subjectLine = Object.entries(latest.subject_scores)
      .map(([subj, score]) => `${subj}: ${score}`)
      .join(' | ')
    lines.push(`   Subject Scores: ${subjectLine}`)
  }

  // Weak topics from latest
  if (latest.weak_topics.length > 0) {
    lines.push(`   ⚠️ Weak Topics (latest): ${latest.weak_topics.join(', ')}`)
  }

  // Trend: last 3 scores
  if (records.length >= 2) {
    const trend = records.slice(0, 3).map(r => {
      const pct = r.max_score > 0 ? Math.round((r.score / r.max_score) * 100) : 0
      return `${pct}%`
    })
    lines.push(`📈 Recent Trend (newest first): ${trend.join(' → ')}`)
  }

  // Aggregate weak topics across all records
  const allWeakTopics = new Set<string>()
  records.forEach(r => r.weak_topics.forEach(t => allWeakTopics.add(t)))
  if (allWeakTopics.size > 0) {
    lines.push(`🔴 Recurring Weak Topics: ${[...allWeakTopics].slice(0, 8).join(', ')}`)
  }

  // Average percentile
  const percs = records.filter(r => r.percentile !== null).map(r => r.percentile!)
  if (percs.length > 0) {
    const avgPerc = (percs.reduce((a, b) => a + b, 0) / percs.length).toFixed(1)
    lines.push(`🏅 Average Percentile: ${avgPerc}`)
  }

  lines.push('')
  lines.push('HOW TO USE THIS DATA:')
  lines.push('→ If current question topic matches a recurring weak topic, be more patient and thorough.')
  lines.push('→ If student scores <50% overall in EduNext mocks, increase encouragement and basics.')
  lines.push('→ If percentile is high (>80), student is competitive — challenge them with harder variations.')
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  return lines.join('\n')
}

// ─── Save AI Tutor Insights (for EduNext to read) ────────────────────────────

/**
 * Upserts the AI Tutor's behavior-based insight for a specific user+topic.
 * Called by behaviorTracker when saving summaries, so EduNext can read
 * how a student is doing on each topic in the AI Tutor.
 */
export async function saveAITutorInsight(
  userId: string,
  subject: string,
  topic: string,
  summary: BehaviorSummary
): Promise<void> {
  if (!userId || userId.startsWith('guest_') || !subject || !topic) return

  try {
    // Fetch existing insight to aggregate
    const { data: existing } = await supabaseServer
      .from('ai_tutor_insights')
      .select('*')
      .eq('user_id', userId)
      .eq('subject', subject)
      .eq('topic', topic)
      .single()

    const prev = existing as AiTutorInsight | null
    const sessions = (prev?.total_sessions ?? 0) + 1
    const prevAvgStruggle = prev?.avg_struggle_score ?? 0
    const newAvgStruggle = ((prevAvgStruggle * (sessions - 1)) + summary.struggle_score) / sessions
    const totalHints = (prev?.total_hints_used ?? 0) + summary.hint_count
    const totalWrong = (prev?.total_wrong_attempts ?? 0) + summary.wrong_attempts
    const prevAvgTime = prev?.avg_time_per_q_ms ?? 0
    const newAvgTime = ((prevAvgTime * (sessions - 1)) + summary.time_spent_ms) / sessions

    await supabaseServer.from('ai_tutor_insights').upsert({
      user_id: userId,
      subject,
      topic,
      total_sessions: sessions,
      avg_struggle_score: Math.round(newAvgStruggle),
      total_hints_used: totalHints,
      total_wrong_attempts: totalWrong,
      avg_time_per_q_ms: Math.round(newAvgTime),
      mastery_level: summary.understanding_level,
      last_session_summary: summary as unknown as Record<string, unknown>,
      last_updated: new Date().toISOString(),
    }, { onConflict: 'user_id,subject,topic' })
  } catch (e) {
    console.warn('[EdunextService] saveAITutorInsight error:', e)
  }
}

// ─── Fetch AI Tutor Insights (for EduNext to pull) ───────────────────────────

/**
 * Returns all AI Tutor behavior insights for a user.
 * EduNext calls GET /api/edunext/insights?user_id=xxx to get this data.
 */
export async function fetchAITutorInsights(userId: string): Promise<AiTutorInsight[]> {
  if (!userId) return []

  try {
    const { data, error } = await supabaseServer
      .from('ai_tutor_insights')
      .select('*')
      .eq('user_id', userId)
      .order('last_updated', { ascending: false })

    if (error) {
      console.warn('[EdunextService] fetchAITutorInsights error:', error.message)
      return []
    }
    return (data as AiTutorInsight[]) ?? []
  } catch (e) {
    console.warn('[EdunextService] unexpected error:', e)
    return []
  }
}
