-- Fix practice_schedules RLS policies to avoid circular dependency
-- Run this if you already created the practice_schedules table and are getting recursion errors

-- Drop existing policies
DROP POLICY IF EXISTS "Coaches can read practice schedules" ON public.practice_schedules;
DROP POLICY IF EXISTS "Coaches can insert practice schedules" ON public.practice_schedules;
DROP POLICY IF EXISTS "Coaches can update practice schedules" ON public.practice_schedules;
DROP POLICY IF EXISTS "Team members can read practice schedules" ON public.practice_schedules;
DROP POLICY IF EXISTS "Coaches can manage practice schedules" ON public.practice_schedules;

-- Create new simplified policies that avoid any table references
CREATE POLICY "Coaches can manage practice schedules" ON public.practice_schedules
    FOR ALL USING (
        (auth.jwt() ->> 'user_metadata')::jsonb ->> 'role' = 'coach'
    );

CREATE POLICY "Team members can read practice schedules" ON public.practice_schedules
    FOR SELECT USING (
        (auth.jwt() ->> 'user_metadata')::jsonb ->> 'role' IN ('athlete', 'captain', 'coach')
    );
