import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const VALID_SESSION_TYPES = ['practice', 'lift'] as const;
type SessionType = typeof VALID_SESSION_TYPES[number];

function normalizeSessionType(raw: any): SessionType {
  if (typeof raw !== 'string') return 'practice';
  return (VALID_SESSION_TYPES as readonly string[]).includes(raw) ? (raw as SessionType) : 'practice';
}

export async function POST(request: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('Missing or invalid authorization header:', authHeader ? 'present but invalid format' : 'missing');
      return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    
    // Verify the user's JWT token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError) {
      console.error('Auth error:', authError);
      return NextResponse.json({ error: `Authentication failed: ${authError.message}` }, { status: 401 });
    }
    
    if (!user) {
      console.error('No user found from token');
      return NextResponse.json({ error: 'User not found' }, { status: 401 });
    }

    // Check if user is a captain or coach
    if (!['captain', 'coach'].includes(user.user_metadata?.role)) {
      console.error('Unauthorized role:', user.user_metadata?.role);
      return NextResponse.json({ error: `Not authorized. Role: ${user.user_metadata?.role || 'none'}` }, { status: 403 });
    }

  // Get the request body
  const { athleteId, date, status, sessionType: incomingSessionType, notes } = await request.json();
  const sessionType = normalizeSessionType(incomingSessionType);

    // Validate required fields
    if (!athleteId || !date || !status) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate status
    const validStatuses = ['on-time', 'late', 'late-justified', 'excused', 'missing'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    // Validate athlete access based on role
    let athleteData = null;
    
    if (user.user_metadata?.role === 'captain') {
      // Captain validation - check squad membership (weapon only, both genders)
      const captainWeapon = user.user_metadata?.weapon;

      if (!captainWeapon) {
        return NextResponse.json({ error: 'Captain missing weapon' }, { status: 400 });
      }

      // Check if the athlete exists and is in the same weapon (or if captain is marking their own attendance)
      const { data: athlete, error: athleteError } = await supabase
        .from('users')
        .select('*')
        .eq('id', athleteId)
        .eq('weapon', captainWeapon)
        .in('role', ['athlete', 'captain']) // Allow both athletes and captains
        .single();

      // If not found in same weapon, check if captain is marking their own attendance
      if (athleteError || !athlete) {
        if (athleteId !== user.id) {
          return NextResponse.json({ error: 'Athlete not found or not in your weapon group' }, { status: 404 });
        }
      } else {
        athleteData = athlete;
      }
    } else if (user.user_metadata?.role === 'coach') {
      // Coach validation - can mark attendance for any athlete/captain
      const { data: athlete, error: athleteError } = await supabase
        .from('users')
        .select('*')
        .eq('id', athleteId)
        .in('role', ['athlete', 'captain'])
        .single();

      if (athleteError || !athlete) {
        return NextResponse.json({ error: 'Athlete not found' }, { status: 404 });
      }
      
      athleteData = athlete;
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return NextResponse.json({ error: 'Invalid date format. Expected YYYY-MM-DD' }, { status: 400 });
    }

    // Use the date string directly (already in YYYY-MM-DD format)
    const formattedDate = date;

    // Insert or update attendance record (now scoped by session_type)
    const { data: attendanceData, error: attendanceError } = await supabase
      .from('attendance')
      .upsert({
        athlete_id: athleteId,
        date: formattedDate,
        status: status,
        marked_by: user.id,
        session_type: sessionType,
        notes: notes || null,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'athlete_id,date,session_type'
      })
      .select()
      .single();

    if (attendanceError) {
      console.error('Error marking attendance:', attendanceError);
      const msg = attendanceError.message || '';
      // Provide targeted guidance for common migration issues
      if (/no unique or exclusion constraint/i.test(msg)) {
        return NextResponse.json({
          error: msg,
          hint: 'Run scripts/add_attendance_session_type_unique_index.sql to add UNIQUE (athlete_id, date, session_type).'
        }, { status: 500 });
      }
      if (/column .*session_type.* does not exist/i.test(msg)) {
        return NextResponse.json({
          error: msg,
          hint: 'Add session_type column by running scripts/add_attendance_session_type_unique_index.sql.'
        }, { status: 500 });
      }
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    // Determine the name for the success message
    let attendeeName = 'Unknown';
    if (athleteId === user.id) {
      // User marking their own attendance
      attendeeName = user.user_metadata?.firstName ? 
        `${user.user_metadata.firstName} ${user.user_metadata.lastName}` :
        user.email?.split('@')[0] || 'You';
    } else if (athleteData) {
      // Marking another athlete's attendance
      attendeeName = athleteData.full_name || athleteData.username || 'Unknown';
    }

    return NextResponse.json({ 
      success: true, 
      attendance: attendanceData,
      message: `Attendance (${sessionType}) marked as ${status} for ${attendeeName}`
    });
    
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// GET endpoint to fetch attendance data
export async function GET(request: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('GET: Missing or invalid authorization header');
      return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    
    // Verify the user's JWT token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError) {
      console.error('GET: Auth error:', authError);
      return NextResponse.json({ error: `Authentication failed: ${authError.message}` }, { status: 401 });
    }
    
    if (!user) {
      console.error('GET: No user found from token');
      return NextResponse.json({ error: 'User not found' }, { status: 401 });
    }

    // Get query parameters
    const url = new URL(request.url);
  const startDate = url.searchParams.get('startDate');
  const endDate = url.searchParams.get('endDate');
  const athleteId = url.searchParams.get('athleteId');
  const sessionType = normalizeSessionType(url.searchParams.get('sessionType'));

  let query = supabase.from('attendance').select('*').eq('session_type', sessionType);

    // Filter based on user role
    if (user.user_metadata?.role === 'captain') {
      // Captain can see attendance for all athletes of their weapon (both genders)
      const weapon = user.user_metadata?.weapon;
      
      if (!weapon) {
        return NextResponse.json({ error: 'Captain missing weapon' }, { status: 400 });
      }
      
      // Get athletes from the same weapon (including captains, both genders)
      const { data: squadMembers, error: squadError } = await supabase
        .from('users')
        .select('id')
        .in('role', ['athlete', 'captain']) // Include both athletes and captains
        .eq('weapon', weapon);

      if (squadError || !squadMembers) {
        console.error('Error fetching squad members:', squadError);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
      }

      const squadMemberIds = squadMembers.map(member => member.id);
      if (squadMemberIds.length > 0) {
        query = query.in('athlete_id', squadMemberIds);
      } else {
        // No members in squad, return empty result
        return NextResponse.json({ attendance: [] });
      }
      
    } else if (user.user_metadata?.role === 'athlete') {
      // Athletes can only see their own attendance
      query = query.eq('athlete_id', user.id);
    } else if (!['coach', 'data-analyzer'].includes(user.user_metadata?.role)) {
      // Only captains, athletes, coaches, and data-analyzers can access attendance
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }
    // Coaches and data-analyzers can see all attendance (no additional filters)

    // Apply date filters
    if (startDate) {
      query = query.gte('date', startDate);
    }
    if (endDate) {
      query = query.lte('date', endDate);
    }

    // Apply athlete filter if specified
    if (athleteId) {
      query = query.eq('athlete_id', athleteId);
    }

    const { data: attendanceData, error: attendanceError } = await query.order('date', { ascending: false });

    if (attendanceError) {
      console.error('Error fetching attendance:', attendanceError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    // If we need user information, fetch it separately
    let attendanceWithUsers = attendanceData || [];

    if (attendanceWithUsers.length > 0 && (user.user_metadata?.role === 'coach' || user.user_metadata?.role === 'captain')) {
      // Get unique athlete IDs
      const athleteIds = [...new Set(attendanceWithUsers.map(a => a.athlete_id))];
      
      // Fetch user details from the users table
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, full_name, username, first_name, last_name, weapon, gender, role')
        .in('id', athleteIds);

      if (!usersError && users) {
        // Add user data to each attendance record
        attendanceWithUsers = attendanceWithUsers.map(attendance => ({
          ...attendance,
          users: users.find(u => u.id === attendance.athlete_id)
        }));
      }
    }

  return NextResponse.json({ attendance: attendanceWithUsers, sessionType });
    
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
