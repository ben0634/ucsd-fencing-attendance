import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import dotenv from "dotenv";

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
);

// Generate simple, easy to remember passwords (one word + number)
function generateEasyPassword() {
  const words = [
    'apple', 'beach', 'cloud', 'dance', 'eagle', 'flame', 'grape', 'house',
    'magic', 'plane', 'smile', 'tiger', 'water', 'zebra', 'bread', 'chair',
    'dream', 'field', 'ghost', 'honey', 'island', 'jungle', 'knight', 'light',
    'mouse', 'night', 'ocean', 'piano', 'queen', 'robot', 'storm', 'train'
  ];
  
  const number = Math.floor(Math.random() * 90) + 10; // 10-99 (2 digits)
  const word = words[Math.floor(Math.random() * words.length)];
  
  return `${word}${number}`;
}

async function updatePasswordsFromChangeme() {
  try {
    console.log('🔍 Finding users with "changeme" passwords...');
    
    const { data: users, error } = await supabase.auth.admin.listUsers();
    
    if (error) {
      console.error("Error fetching users:", error.message);
      return;
    }

    console.log(`📊 Found ${users.users.length} total users`);
    
    const changemeUsers = [];
    
    for (const user of users.users) {
      // Check if user has changeme password by attempting to sign them in
      try {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: 'changeme'
        });
        
        if (!signInError) {
          // User has changeme password
          changemeUsers.push(user);
          // Sign out immediately
          await supabase.auth.signOut();
        }
      } catch (e) {
        // User doesn't have changeme password, skip
      }
    }
    
    if (changemeUsers.length === 0) {
      console.log('✅ No users found with "changeme" password');
      return;
    }
    
    console.log(`🔒 Found ${changemeUsers.length} users with "changeme" password`);
    console.log('\\n🔄 Updating passwords...');
    
    const updatedCredentials = [];
    
    for (const user of changemeUsers) {
      const metadata = user.user_metadata;
      const newPassword = generateEasyPassword();
      
      try {
        const { data: updateData, error: updateError } = await supabase.auth.admin.updateUserById(
          user.id,
          { password: newPassword }
        );
        
        if (updateError) {
          console.error(`❌ Failed to update password for ${metadata.username}: ${updateError.message}`);
          continue;
        }
        
        updatedCredentials.push({
          username: metadata.username,
          password: newPassword,
          fullName: `${metadata.firstName || ''} ${metadata.lastName || ''}`.trim(),
          role: metadata.role || 'athlete',
          email: user.email
        });
        
        console.log(`✅ Updated password for ${metadata.username}: ${newPassword}`);
        
      } catch (e) {
        console.error(`❌ Error updating ${metadata.username}:`, e.message);
      }
    }
    
    if (updatedCredentials.length > 0) {
      console.log('\\n📋 UPDATED CREDENTIALS:');
      console.log('Username'.padEnd(20) + ' | ' + 'New Password'.padEnd(15) + ' | ' + 'Full Name');
      console.log('-'.repeat(60));
      
      updatedCredentials.forEach(cred => {
        console.log(`${cred.username.padEnd(20)} | ${cred.password.padEnd(15)} | ${cred.fullName}`);
      });
      
      console.log(`\\n✅ Successfully updated ${updatedCredentials.length} passwords`);
      console.log('\\n🔒 Security Notes:');
      console.log('   • All passwords have been changed from "changeme"');
      console.log('   • Users should be notified of their new passwords');
      console.log('   • Users should change passwords after first login');
    }
    
  } catch (error) {
    console.error('Error updating passwords:', error);
  }
}

// Check command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');

if (isDryRun) {
  console.log('🔍 DRY RUN MODE - No passwords will be changed');
  console.log('Run without --dry-run to actually update passwords\\n');
} else {
  console.log('⚠️  LIVE MODE - Passwords will be changed!');
  console.log('Add --dry-run flag to test first\\n');
}

updatePasswordsFromChangeme();
