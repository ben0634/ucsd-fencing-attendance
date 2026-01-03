import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Helper function to generate username
function generateUsername(firstName: string, lastName: string, existingUsernames: Set<string>): string {
  let username = `${firstName[0].toLowerCase()}${lastName.toLowerCase()}`;
  let counter = 1;
  
  while (existingUsernames.has(username)) {
    counter++;
    username = `${firstName[0].toLowerCase()}${lastName.toLowerCase()}${counter}`;
  }
  
  return username;
}

// Helper function to generate easy password
function generateEasyPassword(): string {
  const words = [
    'apple', 'beach', 'cloud', 'dance', 'eagle', 'flame', 'grape', 'house',
    'magic', 'plane', 'smile', 'tiger', 'water', 'zebra', 'bread', 'chair',
    'dream', 'field', 'ghost', 'honey', 'island', 'jungle', 'knight', 'light',
  ];
  
  const number = Math.floor(Math.random() * 90) + 10; // 10-99
  const word = words[Math.floor(Math.random() * words.length)];
  
  return `${word}${number}`;
}

export async function POST(request: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify the user is an admin
    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user || user.user_metadata.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 403 });
    }

    // Get request body
    const body = await request.json();
    const { firstName, lastName, role, squad, weapon, gender, password: customPassword } = body;

    if (!firstName || !lastName || !role || !squad) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get existing usernames
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUsernames = new Set(
      existingUsers?.users.map(u => u.user_metadata.username).filter(Boolean) || []
    );

    // Generate username and password
    const username = generateUsername(firstName, lastName, existingUsernames);
    const password = customPassword && customPassword.trim() ? customPassword.trim() : generateEasyPassword();
    const email = `${username}@ucsd-fencing.edu`;

    // Create user
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        username,
        firstName,
        lastName,
        role,
        squad,
        weapon: weapon || 'N/A',
        gender: gender || 'N/A',
      },
    });

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }

    // Also insert into users table
    const fullName = `${firstName} ${lastName}`;
    const { error: insertError } = await supabase
      .from('users')
      .insert({
        id: newUser.user.id,
        email,
        username,
        first_name: firstName,
        last_name: lastName,
        full_name: fullName,
        role,
        squad_id: 0, // Default squad_id
        weapon: weapon || 'N/A',
        gender: gender || 'N/A',
      });

    if (insertError) {
      console.error('Error inserting into users table:', insertError);
      // Don't fail the request, just log it
    }

    return NextResponse.json({
      success: true,
      username,
      password,
      userId: newUser.user.id,
    });
  } catch (error: any) {
    console.error('Error creating user:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
