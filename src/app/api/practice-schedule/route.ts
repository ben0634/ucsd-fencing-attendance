import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Service client for admin operations
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

const VALID_SESSION_TYPES = ['practice', 'lift'] as const;
type SessionType = typeof VALID_SESSION_TYPES[number];
function normalizeSessionType(raw: any): SessionType {
  if (typeof raw !== 'string') return 'practice';
  return (VALID_SESSION_TYPES as readonly string[]).includes(raw) ? raw as SessionType : 'practice';
}

// Get practice (or lift) schedules for all squads
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const sessionType = normalizeSessionType(url.searchParams.get('sessionType'));
    const { data: schedules, error } = await supabaseAdmin
      .from('practice_schedules')
      .select('*')
      .eq('session_type', sessionType);

    if (error) {
      console.error('Error fetching practice schedules:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ schedules, sessionType });
  } catch (error) {
    console.error('Unexpected error in GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Update practice schedule for a squad
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { squadId, practiceDays, customNoPracticeDays, customPracticeDays, sessionType: incomingSessionType } = body;
    const sessionType = normalizeSessionType(incomingSessionType);

    if (!squadId) {
      return NextResponse.json({ error: 'Squad ID is required' }, { status: 400 });
    }

    // Get the authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'No authorization header' }, { status: 401 });
    }

    // Extract the token
    const token = authHeader.replace('Bearer ', '');
    
    // Verify the token and get user info
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid authorization' }, { status: 401 });
    }

    // Check if user is a coach
    if (user.user_metadata?.role !== 'coach') {
      return NextResponse.json({ error: 'Only coaches can manage practice schedules' }, { status: 403 });
    }

    // Upsert the practice schedule (update if exists, insert if not) using admin client
    const { data, error } = await supabaseAdmin
      .from('practice_schedules')
      .upsert({
        squad_id: squadId,
        practice_days: practiceDays || [],
        custom_no_practice_days: customNoPracticeDays || [],
        custom_practice_days: customPracticeDays || [],
        session_type: sessionType,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'squad_id,session_type'
      })
      .select();

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      message: 'Practice schedule updated successfully',
      schedule: data?.[0],
      sessionType
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
