import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createPracticeSchedulesTable() {
  try {
    console.log('Creating practice_schedules table...');
    
    // Create the table directly with SQL
    const { error: createError } = await supabase.rpc('exec_sql', { 
      sql: `
        -- Create practice_schedules table
        CREATE TABLE IF NOT EXISTS public.practice_schedules (
            id BIGSERIAL PRIMARY KEY,
            squad_id TEXT NOT NULL UNIQUE,
            practice_days JSONB NOT NULL DEFAULT '{}',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `
    });
    
    if (createError) {
      console.error('Error creating table:', createError);
      return;
    }
    
    console.log('Table created successfully');
    
    // Enable RLS
    const { error: rlsError } = await supabase.rpc('exec_sql', { 
      sql: 'ALTER TABLE public.practice_schedules ENABLE ROW LEVEL SECURITY;'
    });
    
    if (rlsError) {
      console.error('Error enabling RLS:', rlsError);
      return;
    }
    
    console.log('RLS enabled successfully');
    
    // Create policies
    const policies = [
      `CREATE POLICY "Coaches can read practice schedules" ON public.practice_schedules
          FOR SELECT USING (
              EXISTS (
                  SELECT 1 FROM public.users 
                  WHERE users.id = auth.uid() 
                  AND users.role = 'coach'
              )
          );`,
      `CREATE POLICY "Coaches can insert practice schedules" ON public.practice_schedules
          FOR INSERT WITH CHECK (
              EXISTS (
                  SELECT 1 FROM public.users 
                  WHERE users.id = auth.uid() 
                  AND users.role = 'coach'
              )
          );`,
      `CREATE POLICY "Coaches can update practice schedules" ON public.practice_schedules
          FOR UPDATE USING (
              EXISTS (
                  SELECT 1 FROM public.users 
                  WHERE users.id = auth.uid() 
                  AND users.role = 'coach'
              )
          );`,
      `CREATE POLICY "Team members can read practice schedules" ON public.practice_schedules
          FOR SELECT USING (
              EXISTS (
                  SELECT 1 FROM public.users 
                  WHERE users.id = auth.uid() 
                  AND users.role IN ('athlete', 'captain')
              )
          );`
    ];
    
    for (const policy of policies) {
      const { error: policyError } = await supabase.rpc('exec_sql', { sql: policy });
      if (policyError) {
        console.error('Error creating policy:', policyError);
      }
    }
    
    // Grant permissions
    const { error: grantError } = await supabase.rpc('exec_sql', { 
      sql: `
        GRANT ALL ON public.practice_schedules TO authenticated;
        GRANT USAGE ON SEQUENCE public.practice_schedules_id_seq TO authenticated;
      `
    });
    
    if (grantError) {
      console.error('Error granting permissions:', grantError);
    } else {
      console.log('Permissions granted successfully');
    }
    
    console.log('Successfully created practice_schedules table and policies');
    
  } catch (err) {
    console.error('Error:', err.message);
  }
}

createPracticeSchedulesTable();
