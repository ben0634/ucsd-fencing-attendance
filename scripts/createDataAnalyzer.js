const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createDataAnalyzer() {
  const username = 'data_analyzer';
  const email = `${username}@localhost`;
  const password = 'dataanalyzer123'; // Change this to a secure password
  
  try {
    console.log(`\nCreating data analyzer account...`);
    console.log(`Username: ${username}`);
    console.log(`Email: ${email}`);
    
    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: {
        role: 'data-analyzer',
        username: username,
        full_name: 'Data Analyzer',
        firstName: 'Data',
        lastName: 'Analyzer',
        passwordChanged: false
      }
    });

    if (authError) {
      console.error('Error creating auth user:', authError.message);
      return;
    }

    console.log('✓ Auth user created successfully');
    console.log(`User ID: ${authData.user.id}`);

    // Insert into users table
    const { error: dbError } = await supabase
      .from('users')
      .insert({
        id: authData.user.id,
        username: username,
        email: email,
        role: 'data-analyzer',
        full_name: 'Data Analyzer',
        first_name: 'Data',
        last_name: 'Analyzer'
      });

    if (dbError) {
      console.error('Error inserting into users table:', dbError.message);
      return;
    }

    console.log('✓ Database record created successfully');
    console.log('\n=== LOGIN CREDENTIALS ===');
    console.log(`Username: ${username}`);
    console.log(`Password: ${password}`);
    console.log('========================\n');
    console.log('✓ Data Analyzer account created successfully!');
    console.log('  Access the dashboard at: /data-analyzer');
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

createDataAnalyzer();
