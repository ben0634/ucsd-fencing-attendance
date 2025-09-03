/**
 * List all users with their roles and squad information
 * Usage: node scripts/listAllUsers.js
 * Optional: node scripts/listAllUsers.js captain (to filter by role)
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function listAllUsers() {
  const filterRole = process.argv[2]?.toLowerCase();
  
  try {
    // Get all users from auth.users
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.error('❌ Error fetching users:', authError);
      return;
    }

    let users = authUsers.users;
    
    // Filter by role if specified
    if (filterRole) {
      users = users.filter(user => user.user_metadata?.role === filterRole);
      console.log(`📋 Users with role: ${filterRole.toUpperCase()}`);
    } else {
      console.log('📋 All Users:');
    }
    
    if (users.length === 0) {
      console.log(`❌ No users found${filterRole ? ` with role: ${filterRole}` : ''}`);
      return;
    }

    // Group users by squad for better display
    const squads = {};
    
    users.forEach(user => {
      const metadata = user.user_metadata || {};
      const fullName = `${metadata.firstName || ''} ${metadata.lastName || ''}`.trim() || metadata.username || user.email;
      const role = metadata.role || 'unknown';
      const weapon = metadata.weapon || 'unknown';
      const gender = metadata.gender || 'unknown';
      
      const squadKey = `${gender} ${weapon}`;
      
      if (!squads[squadKey]) {
        squads[squadKey] = [];
      }
      
      squads[squadKey].push({
        name: fullName,
        role: role,
        username: metadata.username || user.email.split('@')[0],
        email: user.email
      });
    });

    // Display by squad
    Object.keys(squads).sort().forEach(squadKey => {
      const [gender, weapon] = squadKey.split(' ');
      const genderText = gender === 'male' ? "Men's" : gender === 'female' ? "Women's" : gender;
      const weaponText = weapon.charAt(0).toUpperCase() + weapon.slice(1);
      
      console.log(`\n🏆 ${genderText} ${weaponText}:`);
      
      // Sort by role (captains first) then by name
      squads[squadKey]
        .sort((a, b) => {
          if (a.role === 'captain' && b.role !== 'captain') return -1;
          if (a.role !== 'captain' && b.role === 'captain') return 1;
          return a.name.localeCompare(b.name);
        })
        .forEach(user => {
          const roleIcon = user.role === 'captain' ? '👑' : user.role === 'coach' ? '🏃‍♂️' : '🤺';
          console.log(`  ${roleIcon} ${user.name} (${user.username}) - ${user.role}`);
        });
    });

    // Summary stats
    const stats = {
      total: users.length,
      captains: users.filter(u => u.user_metadata?.role === 'captain').length,
      athletes: users.filter(u => u.user_metadata?.role === 'athlete').length,
      coaches: users.filter(u => u.user_metadata?.role === 'coach').length
    };

    console.log(`\n📊 Summary:`);
    console.log(`  Total users: ${stats.total}`);
    console.log(`  👑 Captains: ${stats.captains}`);
    console.log(`  🤺 Athletes: ${stats.athletes}`);
    console.log(`  🏃‍♂️ Coaches: ${stats.coaches}`);

    console.log(`\n💡 To update a user role: node scripts/updateUserByName.js "Full Name" newRole`);
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

listAllUsers();
