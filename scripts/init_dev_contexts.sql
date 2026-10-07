-- ========================================================
-- Koliance Dev Contexts Sync Table
-- ========================================================
-- Execute this script in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/kjsggytvrmpkmlytkdri/sql

CREATE TABLE IF NOT EXISTS public.dev_contexts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    author TEXT NOT NULL,
    module TEXT DEFAULT 'general',
    summary TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.dev_contexts ENABLE ROW LEVEL SECURITY;

-- Allow read & write using Supabase anon key
CREATE POLICY "Allow public read access on dev_contexts"
    ON public.dev_contexts
    FOR SELECT
    USING (true);

CREATE POLICY "Allow public insert access on dev_contexts"
    ON public.dev_contexts
    FOR INSERT
    WITH CHECK (true);

-- Enable Realtime (optional, for real-time subscribers)
ALTER PUBLICATION supabase_realtime ADD TABLE public.dev_contexts;
