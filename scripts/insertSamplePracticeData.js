import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function insertSamplePracticeData() {
  try {
    console.log('Inserting sample practice schedule data...');
    
    const schedules = [
      { squad_id: 'male_epee', practice_days: ['monday', 'wednesday', 'friday'] },
      { squad_id: 'female_epee', practice_days: ['monday', 'wednesday', 'friday'] },
      { squad_id: 'male_foil', practice_days: ['tuesday', 'thursday'] },
      { squad_id: 'female_foil', practice_days: ['tuesday', 'thursday'] },
      { squad_id: 'male_saber', practice_days: ['monday', 'thursday'] },
      { squad_id: 'female_saber', practice_days: ['monday', 'thursday'] }
    ];
    
    for (const schedule of schedules) {
      const { data, error } = await supabase
        .from('practice_schedules')
        .upsert(schedule, { onConflict: 'squad_id' });
      
      if (error) {
        console.error(`Error inserting ${schedule.squad_id}:`, error);
      } else {
        console.log(`✓ Inserted practice schedule for ${schedule.squad_id}`);
      }
    }
    
    console.log('Sample data insertion complete');
    
  } catch (err) {
    console.error('Error:', err.message);
  }
}

insertSamplePracticeData();
