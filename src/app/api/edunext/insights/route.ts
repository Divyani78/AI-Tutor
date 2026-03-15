/**
 * GET /api/edunext/insights?user_id=<uid>
 *
 * EduNext calls this to read the AI Tutor's behavioral insights for a user.
 * Returns per-topic mastery levels, struggle scores, hints used, etc.
 * so EduNext can show teachers/students how they perform in AI Tutor sessions.
 *
 * Authentication: Bearer token via EDUNEXT_SYNC_SECRET env var.
 *
 * Response:
 * {
 *   "user_id": "uuid",
 *   "insights": [
 *     {
 *       "subject": "Mathematics",
 *       "topic": "Complex Numbers",
 *       "mastery_level": "struggling",
 *       "avg_struggle_score": 72,
 *       "total_sessions": 5,
 *       "total_hints_used": 8,
 *       "total_wrong_attempts": 12,
 *       "avg_time_per_q_ms": 180000,
 *       "last_updated": "2026-03-15T10:00:00Z"
 *     }
 *   ],
 *   "summary": {
 *     "struggling_topics": ["Complex Numbers", "Integration"],
 *     "mastered_topics": ["Algebra", "Electrostatics"],
 *     "overall_mastery_score": 45,
 *     "total_ai_tutor_sessions": 23
 *   }
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { fetchAITutorInsights } from '@/lib/edunextService'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  // ─── Auth ────────────────────────────────────────────────────────────────
  const syncSecret = process.env.EDUNEXT_SYNC_SECRET
  if (syncSecret) {
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace('Bearer ', '').trim()
    if (token !== syncSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const userId = req.nextUrl.searchParams.get('user_id')
  if (!userId) {
    return NextResponse.json({ error: 'user_id query param required' }, { status: 400 })
  }

  const insights = await fetchAITutorInsights(userId)

  // ─── Build summary ────────────────────────────────────────────────────────
  const strugglingTopics = insights
    .filter(i => i.mastery_level === 'struggling')
    .map(i => i.topic)

  const masteredTopics = insights
    .filter(i => i.mastery_level === 'mastered')
    .map(i => i.topic)

  const totalSessions = insights.reduce((sum, i) => sum + i.total_sessions, 0)

  // Overall mastery score: 0–100 (struggling=0, learning=33, confident=66, mastered=100)
  const masteryMap: Record<string, number> = {
    unknown: 0, struggling: 10, learning: 40, confident: 70, mastered: 100
  }
  const overallMastery = insights.length > 0
    ? Math.round(insights.reduce((sum, i) => sum + (masteryMap[i.mastery_level] ?? 0), 0) / insights.length)
    : 0

  // Log the pull
  supabase.from('edunext_sync_log').insert({
    user_id: userId,
    sync_source: 'ai_tutor',
    sync_type: 'insights',
    records_synced: insights.length,
  }).then(() => {}, () => {})

  return NextResponse.json({
    user_id: userId,
    insights,
    summary: {
      struggling_topics: strugglingTopics,
      mastered_topics: masteredTopics,
      overall_mastery_score: overallMastery,
      total_ai_tutor_sessions: totalSessions,
    }
  })
}
