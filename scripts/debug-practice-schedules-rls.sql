-- Ultimate fix for practice schedule RLS policies
-- This handles multiple authentication scenarios

-- Drop all existing policies
DROP POLICY IF EXISTS "Coaches can read practice schedules" ON public.practice_schedules;
DROP POLICY IF EXISTS "Coaches can insert practice schedules" ON public.practice_schedules;
DROP POLICY IF EXISTS "Coaches can update practice schedules" ON public.practice_schedules;
DROP POLICY IF EXISTS "Team members can read practice schedules" ON public.practice_schedules;
DROP POLICY IF EXISTS "Coaches can manage practice schedules" ON public.practice_schedules;

-- Create permissive policies for debugging
-- First, let's allow coaches full access
CREATE POLICY "Allow coaches full access" ON public.practice_schedules
    FOR ALL USING (
        -- Try multiple ways to check if user is coach
        COALESCE(
            (auth.jwt() ->> 'user_metadata')::jsonb ->> 'role',
            auth.jwt() ->> 'role',
            (current_setting('request.jwt.claims', true)::jsonb ->> 'user_metadata')::jsonb ->> 'role'
        ) = 'coach'
    );

-- Allow all authenticated users to read (for now)
CREATE POLICY "Allow authenticated read" ON public.practice_schedules
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- Temporary: Allow all authenticated users to manage (for debugging)
-- Remove this once we confirm coach detection works
CREATE POLICY "Temp allow all authenticated" ON public.practice_schedules
    FOR ALL USING (auth.uid() IS NOT NULL);
