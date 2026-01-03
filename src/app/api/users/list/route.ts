import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
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

    // Fetch all users
    const { data: authUsers, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error('Error listing users from auth:', listError);
      return NextResponse.json({ error: listError.message }, { status: 500 });
    }

    if (!authUsers || !authUsers.users) {
      console.error('No users data returned from auth');
      return NextResponse.json({ error: 'No users data available' }, { status: 500 });
    }

    // Transform user data
    const users = authUsers.users.map(u => {
      const metadata = u.user_metadata;
      let squad = metadata.squad || metadata.squadId || 'N/A';
      
      // Convert squadId to squad name if needed
      if (typeof squad === 'number') {
        const squadMap: { [key: number]: string } = {
          1: 'coach',
          2: 'mens-epee',
          3: 'mens-foil',
          4: 'mens-saber',
          5: 'womens-saber',
          6: 'womens-foil',
          7: 'womens-epee',
        };
        squad = squadMap[squad] || 'N/A';
      }
      
      // Convert to string to avoid .includes errors
      squad = String(squad);
      
      // Convert old squad format to new format if needed
      if (squad && !squad.includes('-') && squad !== 'N/A' && squad !== 'coach') {
        const weapon = metadata.weapon || 'N/A';
        const gender = metadata.gender || 'N/A';
        if (weapon !== 'N/A' && gender !== 'N/A') {
          const genderPrefix = gender === 'male' ? 'mens' : gender === 'female' ? 'womens' : '';
          if (genderPrefix) {
            squad = `${genderPrefix}-${weapon}`;
          }
        }
      }
      
      return {
        id: u.id,
        email: u.email || '',
        username: metadata.username || '',
        firstName: metadata.firstName || '',
        lastName: metadata.lastName || '',
        role: metadata.role || '',
        squad: squad,
        weapon: metadata.weapon || 'N/A',
        gender: metadata.gender || 'N/A',
      };
    });

    return NextResponse.json({ users });
  } catch (error: any) {
    console.error('Error listing users:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
