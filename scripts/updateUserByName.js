/**
 * Update user role by name
 * Usage: node scripts/updateUserByName.js "First Last" newRole
 * Example: node scripts/updateUserByName.js "Erenei Ligh" captain
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function updateUserByName() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('❌ Usage: node scripts/updateUserByName.js "First Last" newRole');
    console.log('📝 Example: node scripts/updateUserByName.js "Erenei Ligh" captain');
    console.log('📝 Example: node scripts/updateUserByName.js "Ben Kim" athlete');
    console.log('🎯 Valid roles: athlete, captain, coach');
    process.exit(1);
  }

  const fullName = args[0];
  const newRole = args[1].toLowerCase();
  
  // Validate role
  const validRoles = ['athlete', 'captain', 'coach'];
  if (!validRoles.includes(newRole)) {
    console.log(`❌ Invalid role: ${newRole}`);
    console.log(`🎯 Valid roles: ${validRoles.join(', ')}`);
    process.exit(1);
  }

  console.log(`🔍 Searching for user: "${fullName}"`);
  console.log(`🎯 New role: ${newRole}`);

  try {
    // First, get all users from auth.users to find the right one
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.error('❌ Error fetching users:', authError);
      return;
    }

    // Find user by full name (case insensitive)
    const targetUser = authUsers.users.find(user => {
      const userFullName = `${user.user_metadata?.firstName || ''} ${user.user_metadata?.lastName || ''}`.trim();
      return userFullName.toLowerCase() === fullName.toLowerCase();
    });

    if (!targetUser) {
      console.log(`❌ User not found: "${fullName}"`);
      console.log('\n📋 Available users:');
      authUsers.users.forEach(user => {
        const userFullName = `${user.user_metadata?.firstName || ''} ${user.user_metadata?.lastName || ''}`.trim();
        console.log(`  • ${userFullName} (${user.user_metadata?.role || 'unknown'})`);
      });
      return;
    }

    console.log(`✅ Found user: ${targetUser.email}`);
    console.log(`📊 Current role: ${targetUser.user_metadata?.role || 'unknown'}`);

    if (targetUser.user_metadata?.role === newRole) {
      console.log(`ℹ️  User already has role: ${newRole}`);
      return;
    }

    // Update user metadata
    const updatedMetadata = {
      ...targetUser.user_metadata,
      role: newRole
    };

    const { error: updateError } = await supabase.auth.admin.updateUserById(
      targetUser.id,
      { user_metadata: updatedMetadata }
    );

    if (updateError) {
      console.error('❌ Error updating user:', updateError);
      return;
    }

    console.log(`✅ Successfully updated ${fullName} to role: ${newRole}`);

    // Now update the users table as well
    console.log('🔄 Updating users table...');
    
    const { error: tableError } = await supabase
      .from('users')
      .update({ role: newRole })
      .eq('id', targetUser.id);

    if (tableError) {
      console.error('⚠️  Warning: Error updating users table:', tableError);
      console.log('💡 You may need to run: node scripts/populateUsersTable.js');
    } else {
      console.log('✅ Users table updated successfully');
    }

    // Show updated squad information if role changed to/from captain
    if (newRole === 'captain' || targetUser.user_metadata?.role === 'captain') {
      const weapon = targetUser.user_metadata?.weapon;
      const gender = targetUser.user_metadata?.gender;
      
      if (weapon && gender) {
        const { data: squadMembers, error: squadError } = await supabase
          .from('users')
          .select('full_name, role')
          .eq('weapon', weapon)
          .eq('gender', gender);

        if (!squadError && squadMembers) {
          const genderText = gender === 'male' ? "Men's" : gender === 'female' ? "Women's" : gender;
          const weaponText = weapon.charAt(0).toUpperCase() + weapon.slice(1);
          
          console.log(`\n🏆 ${genderText} ${weaponText} Squad:`);
          squadMembers.forEach(member => {
            const roleIcon = member.role === 'captain' ? '👑' : '🤺';
            console.log(`  ${roleIcon} ${member.full_name} (${member.role})`);
          });
        }
      }
    }

    console.log('\n✅ Update completed successfully!');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

updateUserByName();
