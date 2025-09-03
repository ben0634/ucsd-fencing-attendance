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
      return NextResponse.json({ error: 'Missing authorization' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    
    // Verify the user's JWT token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Check if user is a captain
    if (user.user_metadata?.role !== 'captain') {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // Get captain's weapon and gender from metadata
    const weapon = user.user_metadata?.weapon;
    const gender = user.user_metadata?.gender;

    if (!weapon || !gender) {
      return NextResponse.json({ error: 'Captain missing weapon or gender' }, { status: 400 });
    }

    // Fetch all squad members (athletes + captain) from the same squad using service role
    const { data: squadMembers, error } = await supabase
      .from('users')
      .select('*')
      .in('role', ['athlete', 'captain'])
      .eq('weapon', weapon)
      .eq('gender', gender)
      .order('role', { ascending: true }) // Show athletes first, then captain
      .order('full_name', { ascending: true });

    if (error) {
      console.error('Error fetching squad members:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json({ athletes: squadMembers || [] });
    
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
