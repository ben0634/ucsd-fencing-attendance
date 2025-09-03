/**
 * Script to verify the attendance table was created successfully
 * Usage: node scripts/verifyAttendanceTable.js
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyTable() {
  try {
    console.log('🔍 Verifying attendance table...');
    
    // Test basic table access
    const { data, error } = await supabase
      .from('attendance')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('❌ Error accessing attendance table:', error.message);
      return;
    }
    
    console.log('✅ Attendance table exists and is accessible!');
    console.log('📊 Current records:', data?.length || 0);
    
    // Test getting users for attendance marking
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();
      if (!usersError && users) {
        const athletes = users.filter(u => u.user_metadata?.role === 'athlete');
        console.log(`👥 Athletes available for attendance: ${athletes.length}`);
      }
    }
    
    console.log('🎉 Ready to implement attendance marking!');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

verifyTable();
