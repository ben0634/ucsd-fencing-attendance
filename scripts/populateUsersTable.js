/**
 * Script to populate the users table with data from auth.users
 * Run this after creating the users table
 * 
 * Usage: node scripts/populateUsersTable.js
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables:');
  console.error('NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.error('SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey);
  console.log('\n💡 You need to add SUPABASE_SERVICE_ROLE_KEY to your .env.local file');
  console.log('   Get it from: Supabase Dashboard → Settings → API → service_role key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function populateUsersTable() {
  try {
    console.log('🔍 Fetching users from auth.users...');
    
    // Get all users from auth
    const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.error('❌ Error fetching auth users:', authError);
      return;
    }
    
    if (!users || users.length === 0) {
      console.log('⚠️  No users found in auth.users');
      return;
    }
    
    console.log(`📊 Found ${users.length} users in auth.users`);
    
    // Prepare user records for insertion
    const userRecords = users.map(user => {
      const meta = user.user_metadata || {};
      return {
        id: user.id,
        email: user.email,
        username: meta.username || user.email.split('@')[0],
        first_name: meta.firstName || meta.first_name || '',
        last_name: meta.lastName || meta.last_name || '',
        full_name: meta.full_name || `${meta.firstName || ''} ${meta.lastName || ''}`.trim(),
        role: meta.role || 'athlete',
        squad_id: meta.squad_id || 0,
        weapon: meta.weapon || 'foil',
        gender: meta.gender || 'unknown'
      };
    });
    
    console.log('📝 Sample user record:');
    console.log(userRecords[0]);
    
    // Insert users into the users table
    const { data, error } = await supabase
      .from('users')
      .upsert(userRecords, { onConflict: 'id' });
    
    if (error) {
      console.error('❌ Error inserting users:', error);
      return;
    }
    
    console.log('✅ Successfully populated users table!');
    console.log(`📊 Inserted ${userRecords.length} user records`);
    
    // Show summary by role
    const roleCount = userRecords.reduce((acc, user) => {
      acc[user.role] = (acc[user.role] || 0) + 1;
      return acc;
    }, {});
    
    console.log('\n📋 Users by role:');
    Object.entries(roleCount).forEach(([role, count]) => {
      console.log(`  ${role}: ${count}`);
    });
    
    // Show squads
    const squads = userRecords.reduce((acc, user) => {
      if (user.role === 'athlete' || user.role === 'captain') {
        const squadKey = `${user.gender} ${user.weapon}`;
        if (!acc[squadKey]) acc[squadKey] = [];
        acc[squadKey].push(user.full_name || user.username);
      }
      return acc;
    }, {});
    
    console.log('\n🏆 Squads:');
    Object.entries(squads).forEach(([squad, members]) => {
      console.log(`  ${squad}: ${members.length} members`);
    });
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

populateUsersTable();
