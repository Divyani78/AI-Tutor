// src/app/api/questions/route.ts
// Queries questions from Supabase using service role (bypasses RLS)

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Service role client — bypasses RLS, only used server-side
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const subject    = searchParams.get('subject')
  const topic      = searchParams.get('topic')
  const chapter    = searchParams.get('chapter')
  const difficulty = searchParams.get('difficulty')
  const type       = searchParams.get('type')

  let query = supabaseAdmin.from('questions').select('*')

  if (subject)    query = query.eq('subject', subject)
  if (topic)      query = query.eq('topic', topic)
  if (chapter)    query = query.ilike('chapter', `%${chapter}%`)
  if (difficulty) query = query.eq('difficulty', difficulty)
  if (type)       query = query.eq('question_type', type)

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    console.error('Supabase error:', error)
    return NextResponse.json({ error: 'Failed to fetch questions' }, { status: 500 })
  }

  return NextResponse.json({ questions: data || [] })
}

export async function POST(req: NextRequest) {
  const { column } = await req.json()
  const dbColumn = column === 'type' ? 'question_type' : column

  const validColumns = ['subject', 'topic', 'chapter', 'difficulty', 'question_type']
  if (!validColumns.includes(dbColumn)) {
    return NextResponse.json({ error: 'Invalid column' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('questions')
    .select(dbColumn)

  if (error) {
    return NextResponse.json({ error: `Failed to fetch ${column}` }, { status: 500 })
  }

  const values = [...new Set(data?.map((row: any) => row[dbColumn]).filter(Boolean) || [])]
  return NextResponse.json({ values })
}
