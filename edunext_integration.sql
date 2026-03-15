-- ═══════════════════════════════════════════════════════════════════
-- EduNext ↔ AI Tutor Integration Tables
-- Run this in Supabase SQL Editor after supabase_schema.sql
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. EduNext Performance Data (pushed FROM EduNext TO AI Tutor) ───────────
-- Stores contest scores, mock test results, and topic-wise performance
CREATE TABLE IF NOT EXISTS public.edunext_performance (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        text NOT NULL,
  contest_id     text NOT NULL,                        -- EduNext's internal contest/mock ID
  contest_name   text NOT NULL,                        -- e.g. "JEE Mains Mock 7"
  contest_type   text CHECK (contest_type IN ('mock', 'contest', 'practice', 'chapter_test')),
  score          numeric NOT NULL,
  max_score      numeric NOT NULL,
  percentile     numeric,                              -- 0–100
  rank           integer,                              -- optional rank within contest
  -- Subject-wise breakdown: { "Mathematics": 72, "Physics": 60, "Chemistry": 85 }
  subject_scores jsonb DEFAULT '{}'::jsonb,
  -- Topic-wise breakdown: { "Complex Numbers": 10, "Kinematics": 6, ... }
  topic_scores   jsonb DEFAULT '{}'::jsonb,
  -- Topics where student scored < 40% (auto-populated by EduNext or sync route)
  weak_topics    text[] DEFAULT '{}',
  attempted_at   timestamp with time zone NOT NULL,
  synced_at      timestamp with time zone DEFAULT timezone('utc'::text, now()),
  UNIQUE (user_id, contest_id)
);

-- ─── 2. AI Tutor Insights (pushed FROM AI Tutor TO EduNext) ──────────────────
-- Stores per-user, per-topic behavior insights that EduNext can read
CREATE TABLE IF NOT EXISTS public.ai_tutor_insights (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id             text NOT NULL,
  subject             text NOT NULL,
  topic               text NOT NULL,
  -- Aggregated metrics
  total_sessions      integer DEFAULT 0,
  avg_struggle_score  numeric DEFAULT 0,
  total_hints_used    integer DEFAULT 0,
  total_wrong_attempts integer DEFAULT 0,
  avg_time_per_q_ms   numeric DEFAULT 0,
  -- Mastery level derived from behavior
  mastery_level       text DEFAULT 'unknown'
    CHECK (mastery_level IN ('unknown', 'struggling', 'learning', 'confident', 'mastered')),
  -- Last session raw summary (latest snapshot)
  last_session_summary jsonb DEFAULT '{}'::jsonb,
  last_updated        timestamp with time zone DEFAULT timezone('utc'::text, now()),
  UNIQUE (user_id, subject, topic)
);

-- ─── 3. Unified User Sync Status ─────────────────────────────────────────────
-- Tracks when each system last synced for a user
CREATE TABLE IF NOT EXISTS public.edunext_sync_log (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      text NOT NULL,
  sync_source  text CHECK (sync_source IN ('edunext', 'ai_tutor')),
  sync_type    text,                                   -- 'performance', 'insights', etc.
  records_synced integer DEFAULT 0,
  synced_at    timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- ─── RLS Policies ────────────────────────────────────────────────────────────
ALTER TABLE public.edunext_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_tutor_insights   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edunext_sync_log    ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (used by both sync APIs)
CREATE POLICY "Service role full access to edunext_performance"
  ON public.edunext_performance FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to ai_tutor_insights"
  ON public.ai_tutor_insights FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to edunext_sync_log"
  ON public.edunext_sync_log FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Allow authenticated users to read their own data
CREATE POLICY "Users read own edunext_performance"
  ON public.edunext_performance FOR SELECT TO authenticated
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users read own ai_tutor_insights"
  ON public.ai_tutor_insights FOR SELECT TO authenticated
  USING (auth.uid()::text = user_id);

-- Anon can insert/upsert (AI Tutor uses anon key for client-side ops)
CREATE POLICY "Anon upsert ai_tutor_insights"
  ON public.ai_tutor_insights FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Anon update ai_tutor_insights"
  ON public.ai_tutor_insights FOR UPDATE TO anon USING (true);

-- ─── Indexes for fast lookups ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_edunext_perf_user_id ON public.edunext_performance (user_id);
CREATE INDEX IF NOT EXISTS idx_edunext_perf_attempted ON public.edunext_performance (user_id, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_tutor_insights_user ON public.ai_tutor_insights (user_id);
CREATE INDEX IF NOT EXISTS idx_ai_tutor_insights_topic ON public.ai_tutor_insights (user_id, subject, topic);
