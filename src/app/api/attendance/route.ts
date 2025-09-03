import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request: NextRequest) {
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

    // Get the request body
    const { athleteId, date, status } = await request.json();

    // Validate required fields
    if (!athleteId || !date || !status) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate status
    const validStatuses = ['on-time', 'late', 'late-justified', 'excused', 'missing'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    // Validate that the athlete is in the captain's squad
    const captainWeapon = user.user_metadata?.weapon;
    const captainGender = user.user_metadata?.gender;

    if (!captainWeapon || !captainGender) {
      return NextResponse.json({ error: 'Captain missing weapon or gender' }, { status: 400 });
    }

    // Check if the athlete exists and is in the same squad (or if captain is marking their own attendance)
    const { data: athlete, error: athleteError } = await supabase
      .from('users')
      .select('*')
      .eq('id', athleteId)
      .eq('weapon', captainWeapon)
      .eq('gender', captainGender)
      .in('role', ['athlete', 'captain']) // Allow both athletes and captains
      .single();

    // If not found in same squad, check if captain is marking their own attendance
    if (athleteError || !athlete) {
      if (athleteId === user.id) {
        // Captain is marking their own attendance - this is allowed
        // We'll use the captain's data instead
        const captainData = {
          id: user.id,
          weapon: captainWeapon,
          gender: captainGender,
          role: 'captain'
        };
        
        // Continue with the captain as the "athlete"
      } else {
        return NextResponse.json({ error: 'Athlete not found or not in your squad' }, { status: 404 });
      }
    }

    // Parse and validate date
    const attendanceDate = new Date(date);
    if (isNaN(attendanceDate.getTime())) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
    }

    // Format date as YYYY-MM-DD
    const formattedDate = attendanceDate.toISOString().split('T')[0];

    // Insert or update attendance record
    const { data: attendanceData, error: attendanceError } = await supabase
      .from('attendance')
      .upsert({
        athlete_id: athleteId,
        date: formattedDate,
        status: status,
        marked_by: user.id,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'athlete_id,date'
      })
      .select()
      .single();

    if (attendanceError) {
      console.error('Error marking attendance:', attendanceError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    // Determine the name for the success message
    let attendeeName = 'Unknown';
    if (athleteId === user.id) {
      // Captain marking their own attendance
      attendeeName = user.user_metadata?.firstName ? 
        `${user.user_metadata.firstName} ${user.user_metadata.lastName}` :
        user.email?.split('@')[0] || 'You';
    } else if (athlete) {
      // Marking an athlete's attendance
      attendeeName = athlete.full_name || athlete.username || 'Unknown';
    }

    return NextResponse.json({ 
      success: true, 
      attendance: attendanceData,
      message: `Attendance marked as ${status} for ${attendeeName}`
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
      return NextResponse.json({ error: 'Missing authorization' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    
    // Verify the user's JWT token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Get query parameters
    const url = new URL(request.url);
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');
    const athleteId = url.searchParams.get('athleteId');

    let query = supabase.from('attendance').select('*');

    // Filter based on user role
    if (user.user_metadata?.role === 'captain') {
      // Captain can see their squad's attendance (including their own)
      const weapon = user.user_metadata?.weapon;
      const gender = user.user_metadata?.gender;
      
      if (!weapon || !gender) {
        return NextResponse.json({ error: 'Captain missing weapon or gender' }, { status: 400 });
      }
      
      // Get athletes from the same squad (including captains)
      const { data: squadMembers, error: squadError } = await supabase
        .from('users')
        .select('id')
        .in('role', ['athlete', 'captain']) // Include both athletes and captains
        .eq('weapon', weapon)
        .eq('gender', gender);

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
    } else if (user.user_metadata?.role !== 'coach') {
      // Only captains, athletes, and coaches can access attendance
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }
    // Coaches can see all attendance (no additional filters)

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

    return NextResponse.json({ attendance: attendanceWithUsers });
    
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
