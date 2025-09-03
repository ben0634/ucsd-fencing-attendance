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

async function cleanupBadData() {
  try {
    console.log('Removing incorrect squad_id "all" record...');
    
    const { error } = await supabase
      .from('practice_schedules')
      .delete()
      .eq('squad_id', 'all');
      
    if (error) {
      console.error('Error deleting bad record:', error);
    } else {
      console.log('Successfully removed incorrect record');
    }
    
    // Check remaining data
    const { data: remainingData, error: queryError } = await supabase
      .from('practice_schedules')
      .select('*');
      
    if (queryError) {
      console.error('Error querying remaining data:', queryError);
    } else {
      console.log('\nRemaining practice schedules:');
      remainingData?.forEach(schedule => {
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

cleanupBadData();
