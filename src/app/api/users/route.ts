import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.log('Unauthorized request');
      return NextResponse.json({ error: 'Missing authorization' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    
    // Verify the user's JWT token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.log('Authentication verification failed');
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    console.log('User authenticated:', user.email);

    // Check if user is a coach (only coaches can access all users)
    if (user.user_metadata?.role !== 'coach') {
      console.log('User is not a coach, role:', user.user_metadata?.role);
      return NextResponse.json({ error: 'Not authorized - must be coach' }, { status: 403 });
    }

    console.log('Coach access granted, fetching users...');

    // Fetch all users from the users table
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*')
      .in('role', ['athlete', 'captain'])
      .order('full_name');

    if (usersError) {
      console.error('Error fetching users from database:', usersError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    console.log(`Found ${users?.length || 0} users`);
    return NextResponse.json({ users: users || [] });
    
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing authorization' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    
    // Verify the user's JWT token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Check if user is a coach (only coaches can update roles)
    if (user.user_metadata?.role !== 'coach') {
      return NextResponse.json({ error: 'Not authorized - must be coach' }, { status: 403 });
    }

    // Parse the request body
    const { userId, role } = await request.json();

    if (!userId || !role) {
      return NextResponse.json({ error: 'Missing userId or role' }, { status: 400 });
    }

    if (!['athlete', 'captain'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role. Must be athlete or captain' }, { status: 400 });
    }

    // Update the user's role in the users table
    const { data, error: updateError } = await supabase
      .from('users')
      .update({ role })
      .eq('id', userId)
      .select('*')
      .single();

    if (updateError) {
      console.error('Error updating user role:', updateError);
      return NextResponse.json({ error: 'Failed to update user role' }, { status: 500 });
    }

    // Also update the user's metadata in auth.users
    const { error: authUpdateError } = await supabase.auth.admin.updateUserById(userId, {
      user_metadata: { 
        ...data.metadata,
        role: role 
      }
    });

    if (authUpdateError) {
      console.error('Error updating auth metadata:', authUpdateError);
      // Don't fail the request if auth metadata update fails, as the main update succeeded
    }

    return NextResponse.json({ 
      message: `Successfully updated user role to ${role}`,
      user: data 
    });
    
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
