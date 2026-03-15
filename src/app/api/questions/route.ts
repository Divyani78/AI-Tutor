// src/app/api/questions/route.ts
// ✅ Server-side only — service role key never exposed to browser
// ✅ Checks NextAuth session before allowing any Supabase query

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'

// Service role client — bypasses RLS, only used server-side
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

export async function GET(req: NextRequest) {
  // 1. Check user is logged in via NextAuth
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Parse filter params from query string
  const { searchParams } = new URL(req.url)
  const subject    = searchParams.get('subject')
  const topic      = searchParams.get('topic')
  const chapter    = searchParams.get('chapter')
  const difficulty = searchParams.get('difficulty')
  const type       = searchParams.get('type')

  // 3. Build Supabase query
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
  // Endpoint for fetching distinct filter values
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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