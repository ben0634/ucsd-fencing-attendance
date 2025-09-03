import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createPracticeSchedulesTable() {
  try {
    console.log('Checking if practice_schedules table exists...');
    
    // Since we can't use exec_sql, let's just create some test data to see if the table exists
    // If it doesn't exist, we'll get an error and know we need to create it manually
    const { data: testData, error: testError } = await supabase
      .from('practice_schedules')
      .select('*')
      .limit(1);
    
    if (testError && testError.code === 'PGRST116') {
      console.log('Table does not exist. You need to create it manually in the Supabase dashboard.');
      console.log('Please run this SQL in your Supabase SQL editor:');
      console.log(`
-- Create practice_schedules table
CREATE TABLE IF NOT EXISTS public.practice_schedules (
    id BIGSERIAL PRIMARY KEY,
    squad_id TEXT NOT NULL UNIQUE,
    practice_days JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.practice_schedules ENABLE ROW LEVEL SECURITY;

-- Create policies
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

CREATE POLICY "Team members can read practice schedules" ON public.practice_schedules
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('athlete', 'captain')
        )
    );

-- Grant permissions
GRANT ALL ON public.practice_schedules TO authenticated;
GRANT USAGE ON SEQUENCE public.practice_schedules_id_seq TO authenticated;
      `);
    } else if (testError) {
      console.error('Unexpected error:', testError);
    } else {
      console.log('practice_schedules table already exists');
      console.log('Current data:', testData);
    }
    
  } catch (err) {
    console.error('Error:', err.message);
  }
}

createPracticeSchedulesTable();
