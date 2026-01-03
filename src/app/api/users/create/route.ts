import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user || user.user_metadata.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { firstName, lastName, role, squad, weapon, gender, password } = await request.json();

    if (!firstName || !lastName) {
      return NextResponse.json({ error: 'First name and last name are required' }, { status: 400 });
    }

    // Generate username: firstname + last initial
    const baseUsername = `${firstName.toLowerCase()}${lastName[0].toLowerCase()}`;
    
    // Check for existing usernames and handle collisions
    const { data: authUsers } = await supabase.auth.admin.listUsers();
    const existingUsernames = new Set(
      authUsers?.users.map(u => u.user_metadata?.username).filter(Boolean) || []
    );
    
    let username = baseUsername;
    let counter = 1;
    while (existingUsernames.has(username)) {
      counter++;
      username = `${baseUsername}${counter}`;
    }

    const email = `${username}@localhost`;
    const userPassword = password || 'changeme';

    // Map squad to squad_id
    const squadMap: { [key: string]: number } = {
      'coach': 1,
      'mens-epee': 2,
      'mens-foil': 3,
      'mens-saber': 4,
      'womens-saber': 5,
      'womens-foil': 6,
      'womens-epee': 7,
    };
    const squadId = squadMap[squad] || 0;

    // Create auth user
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email,
      password: userPassword,
      email_confirm: true,
      user_metadata: {
        firstName,
        lastName,
        username,
        role,
        squadId,
        weapon,
        gender,
      },
    });

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 400 });
    }

    // Add user to public users table
    const { error: insertError } = await supabase.from('users').insert({
      id: newUser.user.id,
      email,
      username,
      first_name: firstName,
      last_name: lastName,
      full_name: `${firstName} ${lastName}`,
      role,
      squad_id: squadId,
      weapon,
      gender,
    });

    if (insertError) {
      console.error('Error inserting user into users table:', insertError);
      // User is created in auth but not in users table - not critical
    }

    return NextResponse.json({ 
      username, 
      password: userPassword,
      message: 'User created successfully' 
    });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
