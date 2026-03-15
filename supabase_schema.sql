-- Create questions table
create table public.questions (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  content text not null,
  image_url text,
  subject text not null,
  topic text,
  difficulty text check (difficulty in ('Easy', 'Medium', 'Hard')),
  solution_steps jsonb, -- structured solution
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create sessions table to track student progress/scratchpad history
create table public.sessions (
  id uuid default gen_random_uuid() primary key,
  question_id uuid references public.questions(id),
  messages jsonb default '[]'::jsonb, -- Store chat history
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS (Optional for now, but good practice)
alter table public.questions enable row level security;
alter table public.sessions enable row level security;

create policy "Allow public read access to questions"
on public.questions for select
to anon
using (true);

create policy "Allow public insert to sessions"
on public.sessions for insert
to anon
with check (true);

create policy "Allow public update to sessions"
on public.sessions for update
to anon
using (true);

-- Seed Data: A sample JEE Math Question (Complex Numbers)
insert into public.questions (title, content, subject, topic, difficulty, solution_steps)
values (
  'Complex Numbers - Locus',
  'If z is a complex number such that |z| = 4 and arg(z) = 5π/6, then find z.',
  'Mathematics',
  'Complex Numbers',
  'Easy',
  '[
    "Step 1: Recall the polar form of a complex number z = r(cos θ + i sin θ), where r = |z| and θ = arg(z).",
    "Step 2: Substitute the given values: r = 4, θ = 5π/6.",
    "Step 3: z = 4(cos(5π/6) + i sin(5π/6)).",
    "Step 4: Evaluate cos(5π/6) = -√3/2 and sin(5π/6) = 1/2.",
    "Step 5: z = 4(-√3/2 + i/2) = -2√3 + 2i."
  ]'::jsonb
);
