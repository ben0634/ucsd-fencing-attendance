-- Simple temporary fix - allows all authenticated users
-- Use this to test if the Practice Management feature works
-- We can tighten security later once we confirm functionality

-- Drop all existing policies
DROP POLICY IF EXISTS "Coaches can read practice schedules" ON public.practice_schedules;
DROP POLICY IF EXISTS "Coaches can insert practice schedules" ON public.practice_schedules;
DROP POLICY IF EXISTS "Coaches can update practice schedules" ON public.practice_schedules;  
DROP POLICY IF EXISTS "Team members can read practice schedules" ON public.practice_schedules;
DROP POLICY IF EXISTS "Coaches can manage practice schedules" ON public.practice_schedules;
DROP POLICY IF EXISTS "Allow coaches full access" ON public.practice_schedules;
DROP POLICY IF EXISTS "Allow authenticated read" ON public.practice_schedules;
DROP POLICY IF EXISTS "Temp allow all authenticated" ON public.practice_schedules;

-- Temporary permissive policy for testing
CREATE POLICY "Allow all authenticated users" ON public.practice_schedules
    FOR ALL USING (auth.uid() IS NOT NULL);
