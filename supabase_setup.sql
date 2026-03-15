CREATE TABLE IF NOT EXISTS student_profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    weaknesses TEXT[] DEFAULT '{}',
    strengths TEXT[] DEFAULT '{}',
    learning_style TEXT DEFAULT 'visual',
    score_history JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Insert dummy data to be queried by the application
INSERT INTO student_profiles (id, name, weaknesses, strengths, learning_style, score_history)
VALUES (
    'user_123',
    'Ashish',
    ARRAY['Integration', 'Chain Rule', 'Vectors'],
    ARRAY['Algebra', 'Electrostatics Concept'],
    'visual',
    '[{"date": "2026-02-20", "score": 85, "test": "JEE Mains Mock 1"}, {"date": "2026-02-25", "score": 72, "test": "JEE Advanced Mock 1"}]'::jsonb
) ON CONFLICT (id) DO NOTHING;
