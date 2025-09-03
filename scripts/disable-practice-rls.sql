-- Disable RLS temporarily for testing
-- Copy and paste this into Supabase SQL Editor:

-- Disable RLS on practice_schedules table  
ALTER TABLE public.practice_schedules DISABLE ROW LEVEL SECURITY;

-- This allows the admin client to write to the table without policy restrictions
-- We can re-enable RLS later once we confirm everything works
