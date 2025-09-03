import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "fs";
import { join } from "path";
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

async function generatePasswordFile() {
  try {
    console.log('Fetching users from database...');
    
    const { data: users, error } = await supabase.auth.admin.listUsers();
    
    if (error) {
      console.error("Error fetching users:", error.message);
      return;
    }

    console.log(`Found ${users.users.length} users`);
    
    let output = '';
    output += '# UCSD Fencing Team - User Credentials\n';
    output += `# Generated on: ${new Date().toLocaleDateString()}\n`;
    output += '# Format: Username | Password | Full Name | Role\n';
    output += '# ===============================================\n\n';
    
    const credentials = [];
    
    users.users.forEach(user => {
      const metadata = user.user_metadata;
      const username = metadata.username;
      const fullName = `${metadata.firstName || ''} ${metadata.lastName || ''}`.trim();
      const role = metadata.role || 'athlete';
      const password = generateEasyPassword();
      
      credentials.push({
        username,
        password,
        fullName,
        role,
        email: user.email
      });
    });
    
    // Sort by role (coaches first, then captains, then athletes) and then by name
    credentials.sort((a, b) => {
      const roleOrder = { 'coach': 0, 'captain': 1, 'athlete': 2 };
      if (roleOrder[a.role] !== roleOrder[b.role]) {
        return roleOrder[a.role] - roleOrder[b.role];
      }
      return a.fullName.localeCompare(b.fullName);
    });
    
    // Generate the credentials list
    credentials.forEach(cred => {
      const roleIcon = cred.role === 'coach' ? '🏆' : 
                      cred.role === 'captain' ? '👑' : '⚔️';
      
      output += `${cred.username.padEnd(20)} | ${cred.password.padEnd(15)} | ${cred.fullName.padEnd(25)} | ${roleIcon} ${cred.role}\n`;
    });
    
    // Add summary
    const coaches = credentials.filter(c => c.role === 'coach').length;
    const captains = credentials.filter(c => c.role === 'captain').length;
    const athletes = credentials.filter(c => c.role === 'athlete').length;
    
    output += '\n\n# SUMMARY\n';
    output += '# =======\n';
    output += `# Total Users: ${credentials.length}\n`;
    output += `# Coaches: ${coaches}\n`;
    output += `# Captains: ${captains}\n`;
    output += `# Athletes: ${athletes}\n\n`;
    
    output += '# INSTRUCTIONS FOR USERS:\n';
    output += '# =====================\n';
    output += '# 1. Go to the UCSD Fencing attendance website\n';
    output += '# 2. Use your USERNAME (not email) to login\n';
    output += '# 3. Use the password provided above\n';
    output += '# 4. Please change your password after first login\n\n';
    
    output += '# CSV FORMAT (for import):\n';
    output += '# username,password,fullName,role,email\n';
    credentials.forEach(cred => {
      output += `# ${cred.username},${cred.password},"${cred.fullName}",${cred.role},${cred.email}\n`;
    });
    
    // Write to accounts folder
    const filename = `team_credentials_${new Date().toISOString().split('T')[0]}.txt`;
    const filepath = join(process.cwd(), 'accounts', filename);
    
    writeFileSync(filepath, output);
    
    console.log('\n✅ Credentials file generated successfully!');
    console.log(`📁 File saved as: ${filename}`);
    console.log(`📍 Location: ${filepath}`);
    console.log(`\n📊 Summary:`);
    console.log(`   • Total users: ${credentials.length}`);
    console.log(`   • Coaches: ${coaches}`);
    console.log(`   • Captains: ${captains}`);
    console.log(`   • Athletes: ${athletes}`);
    console.log(`\n🔒 Security Notes:`);
    console.log(`   • All passwords are randomly generated (word + number)`);
    console.log(`   • Users should change passwords after first login`);
    console.log(`   • Keep this file secure and delete after distribution`);
    console.log(`\n💡 Sample passwords generated:`);
    console.log(`   • ${generateEasyPassword()}`);
    console.log(`   • ${generateEasyPassword()}`);
    console.log(`   • ${generateEasyPassword()}`);
    
  } catch (error) {
    console.error('Error generating password file:', error);
  }
}

generatePasswordFile();
