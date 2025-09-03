import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkSchema() {
  try {
    console.log('Checking practice_schedules table schema...');
    
    // Try to get sample data to see the structure
    const { data: sampleData, error: dataError } = await supabase
      .from('practice_schedules')
      .select('*')
      .limit(1);
      
    if (dataError) {
      console.error('Error querying practice_schedules:', dataError);
    } else {
      console.log('Sample data from practice_schedules:', sampleData);
      if (sampleData && sampleData.length > 0) {
        console.log('Available columns:', Object.keys(sampleData[0]));
      }
    }
    
    // Try to query all data
    const { data: allData, error: allError } = await supabase
      .from('practice_schedules')
      .select('*');
      
    if (allError) {
      console.error('Error querying all practice schedules:', allError);
    } else {
      console.log('\nAll practice schedules:');
      allData?.forEach(schedule => {
        console.log(`Squad ${schedule.squad_id}:`, {
          practice_days: schedule.practice_days,
          custom_no_practice_days: schedule.custom_no_practice_days,
          custom_practice_days: schedule.custom_practice_days
        });
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkSchema();
