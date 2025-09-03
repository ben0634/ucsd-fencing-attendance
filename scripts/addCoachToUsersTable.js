/**
 * Add Juan Ignacio Calderon to users table
 * Usage: node scripts/addCoachToUsersTable.js
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function addCoachToUsersTable() {
  try {
    console.log('👨‍🏫 Finding Juan Ignacio Calderon in auth users...');
    
    // Get all users from auth
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.error('❌ Error fetching auth users:', authError);
      return;
    }

    // Find Juan Ignacio Calderon
    const coachUser = authUsers.users.find(user => 
      user.user_metadata?.username === 'jcalderon' && 
      user.user_metadata?.role === 'coach'
    );

    if (!coachUser) {
      console.error('❌ Coach user not found in auth');
      return;
    }

    console.log('✅ Found coach user:', coachUser.user_metadata.firstName, coachUser.user_metadata.lastName);

    // Add to users table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .insert({
        id: coachUser.id,
        email: coachUser.email,
        username: coachUser.user_metadata.username,
        first_name: coachUser.user_metadata.firstName,
        last_name: coachUser.user_metadata.lastName,
        full_name: `${coachUser.user_metadata.firstName} ${coachUser.user_metadata.lastName}`,
        role: coachUser.user_metadata.role,
        weapon: null, // No weapon for coaches
        gender: null  // No gender constraint for coaches
      });

    if (userError) {
      console.error('❌ Error adding coach to users table:', userError);
      return;
    }

    console.log('✅ Coach added to users table successfully!');
    console.log('\n🎉 Juan Ignacio Calderon is now fully set up as a coach!');
    console.log('\n💡 Coach login credentials:');
    console.log(`   Email: ${coachUser.email}`);
    console.log(`   Username: ${coachUser.user_metadata.username}`);
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

addCoachToUsersTable();
