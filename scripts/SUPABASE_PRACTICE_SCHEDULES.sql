-- Create practice_schedules table in Supabase
-- Copy and paste this SQL into your Supabase SQL Editor

-- Create practice_schedules table
CREATE TABLE IF NOT EXISTS public.practice_schedules (
    id BIGSERIAL PRIMARY KEY,
    squad_id TEXT NOT NULL UNIQUE,
    practice_days JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.practice_schedules ENABLE ROW LEVEL SECURITY;

-- Create policies (simplified to avoid any circular references)
CREATE POLICY "Coaches can manage practice schedules" ON public.practice_schedules
    FOR ALL USING (
        (auth.jwt() ->> 'user_metadata')::jsonb ->> 'role' = 'coach'
    );

CREATE POLICY "Team members can read practice schedules" ON public.practice_schedules
    FOR SELECT USING (
        (auth.jwt() ->> 'user_metadata')::jsonb ->> 'role' IN ('athlete', 'captain', 'coach')
    );

-- Grant permissions
GRANT ALL ON public.practice_schedules TO authenticated;
GRANT USAGE ON SEQUENCE public.practice_schedules_id_seq TO authenticated;

-- Insert default schedules for all squads (optional - you can modify these)
INSERT INTO public.practice_schedules (squad_id, practice_days) VALUES
('male_epee', '["monday", "wednesday", "friday"]'),
('female_epee', '["monday", "wednesday", "friday"]'),
('male_foil', '["tuesday", "thursday"]'),
('female_foil', '["tuesday", "thursday"]'),
('male_saber', '["monday", "thursday"]'),
('female_saber', '["monday", "thursday"]')
ON CONFLICT (squad_id) DO NOTHING;
