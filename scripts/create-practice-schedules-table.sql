-- Create practice_schedules table
CREATE TABLE IF NOT EXISTS public.practice_schedules (
    id BIGSERIAL PRIMARY KEY,
    squad_id TEXT NOT NULL UNIQUE,
    practice_days JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create RLS policies
ALTER TABLE public.practice_schedules ENABLE ROW LEVEL SECURITY;

-- Allow coaches to read and update practice schedules
CREATE POLICY "Coaches can read practice schedules" ON public.practice_schedules
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role = 'coach'
        )
    );

CREATE POLICY "Coaches can insert practice schedules" ON public.practice_schedules
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role = 'coach'
        )
    );

CREATE POLICY "Coaches can update practice schedules" ON public.practice_schedules
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role = 'coach'
        )
    );

-- Allow team members to read practice schedules
CREATE POLICY "Team members can read practice schedules" ON public.practice_schedules
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('athlete', 'captain')
        )
    );

-- Grant necessary permissions
GRANT ALL ON public.practice_schedules TO authenticated;
GRANT USAGE ON SEQUENCE public.practice_schedules_id_seq TO authenticated;
