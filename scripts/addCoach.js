/**
 * Add Juan Ignacio Calderon as a coach
 * Usage: node scripts/addCoach.js
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function addCoach() {
  const firstName = 'Juan Ignacio';
  const lastName = 'Calderon';
  const username = 'jcalderon'; // j + calderon
  const email = `${username}@ucsd-fencing.edu`;
  const password = 'coach123'; // Default password
  
  try {
    console.log('👨‍🏫 Adding coach: Juan Ignacio Calderon...');
    
    // Create the user in Supabase auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: {
        firstName: firstName,
        lastName: lastName,
        username: username,
        role: 'coach',
        // No weapon or gender needed for coaches
      },
    });

    if (authError) {
      console.error('❌ Error creating coach user:', authError);
      return;
    }

    console.log('✅ Coach user created successfully in auth!');
    console.log(`📧 Email: ${email}`);
    console.log(`🔑 Password: ${password}`);
    console.log(`👤 Username: ${username}`);
    
    // Also add to the users table for consistency
    const { data: userData, error: userError } = await supabase
      .from('users')
      .insert({
        id: authData.user.id,
        email: email,
        username: username,
        first_name: firstName,
        last_name: lastName,
        full_name: `${firstName} ${lastName}`,
        role: 'coach',
        weapon: null, // No weapon for coaches
        gender: null  // No gender constraint for coaches
      });

    if (userError) {
      console.error('❌ Error adding coach to users table:', userError);
      return;
    }

    console.log('✅ Coach added to users table successfully!');
    console.log('\n🎉 Juan Ignacio Calderon has been added as a coach!');
    console.log('\n💡 Coach login credentials:');
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

addCoach();
