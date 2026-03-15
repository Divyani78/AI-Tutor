/**
 * POST /api/edunext/sync
 *
 * EduNext calls this endpoint to push contest/mock performance data
 * into the AI Tutor's Supabase so the AI Tutor can personalize responses.
 *
 * Authentication: Bearer token via EDUNEXT_SYNC_SECRET env var.
 * EduNext should send: Authorization: Bearer <EDUNEXT_SYNC_SECRET>
 *
 * Body (single record):
 * {
 *   "user_id": "uuid",
 *   "contest_id": "edunext_mock_7",
 *   "contest_name": "JEE Mains Mock 7",
 *   "contest_type": "mock",
 *   "score": 180,
 *   "max_score": 300,
 *   "percentile": 87.4,
 *   "rank": 1200,
 *   "subject_scores": { "Mathematics": 72, "Physics": 64, "Chemistry": 44 },
 *   "topic_scores": { "Complex Numbers": 10, "Kinematics": 6, "Thermodynamics": 8 },
 *   "attempted_at": "2026-03-10T14:30:00Z"
 * }
 *
 * Or bulk: send an array of the above objects.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function deriveWeakTopics(
  topicScores: Record<string, number>,
  maxPerTopic = 20,
  weakThresholdPct = 0.4
): string[] {
  return Object.entries(topicScores)
    .filter(([, score]) => score / maxPerTopic < weakThresholdPct)
    .map(([topic]) => topic)
}

export async function POST(req: NextRequest) {
  // ─── Auth ────────────────────────────────────────────────────────────────
  const syncSecret = process.env.EDUNEXT_SYNC_SECRET
  if (syncSecret) {
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace('Bearer ', '').trim()
    if (token !== syncSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Support both single record and array
  const records = Array.isArray(body) ? body : [body]

  if (records.length === 0) {
    return NextResponse.json({ error: 'No records provided' }, { status: 400 })
  }

  // ─── Validate & enrich each record ───────────────────────────────────────
  const toUpsert = records.map((r: any) => {
    const weakTopics = r.weak_topics?.length
      ? r.weak_topics
      : deriveWeakTopics(r.topic_scores ?? {})

    return {
      user_id: r.user_id,
      contest_id: r.contest_id,
      contest_name: r.contest_name,
      contest_type: r.contest_type ?? 'mock',
      score: Number(r.score),
      max_score: Number(r.max_score),
      percentile: r.percentile != null ? Number(r.percentile) : null,
      rank: r.rank != null ? Number(r.rank) : null,
      subject_scores: r.subject_scores ?? {},
      topic_scores: r.topic_scores ?? {},
      weak_topics: weakTopics,
      attempted_at: r.attempted_at,
      synced_at: new Date().toISOString(),
    }
  })

  // ─── Upsert into Supabase ─────────────────────────────────────────────────
  const { error } = await supabase
    .from('edunext_performance')
    .upsert(toUpsert, { onConflict: 'user_id,contest_id' })

  if (error) {
    console.error('[EdunextSync] Upsert error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // ─── Log the sync ─────────────────────────────────────────────────────────
  await supabase.from('edunext_sync_log').insert({
    user_id: toUpsert[0]?.user_id ?? 'batch',
    sync_source: 'edunext',
    sync_type: 'performance',
    records_synced: toUpsert.length,
  }).then(() => {}, () => {})

  return NextResponse.json({
    success: true,
    synced: toUpsert.length,
    message: `${toUpsert.length} record(s) synced successfully.`
  })
}
