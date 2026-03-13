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

async function resolveQuarterIdByDate(dateStr?: string | null) {
  let effectiveDate = dateStr;

  if (!effectiveDate) {
    const today = new Date();
    effectiveDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  }

  const { data: quarter, error } = await supabaseAdmin
    .from('quarters')
    .select('id')
    .lte('start_date', effectiveDate)
    .gte('end_date', effectiveDate)
    .order('start_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return null;
  return quarter?.id || null;
}

function mergeSchedulesByScope(globalSchedules: any[], quarterSchedules: any[]) {
  const globalMap = new Map<string, any>();
  const quarterMap = new Map<string, any>();

  (globalSchedules || []).forEach((row: any) => {
    globalMap.set(row.squad_id, row);
  });
  (quarterSchedules || []).forEach((row: any) => {
    quarterMap.set(row.squad_id, row);
  });

  const squadIds = new Set<string>([
    ...Array.from(globalMap.keys()),
    ...Array.from(quarterMap.keys()),
  ]);

  return Array.from(squadIds).map((squadId) => {
    const quarterRow = quarterMap.get(squadId);
    if (quarterRow) return quarterRow;
    return globalMap.get(squadId);
  }).filter(Boolean);
}

// Get practice (or lift) schedules for all squads
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const sessionType = normalizeSessionType(url.searchParams.get('sessionType'));
    const requestedQuarterId = url.searchParams.get('quarterId');
    const requestedDate = url.searchParams.get('date');
    const requestedScope = url.searchParams.get('scope');
    const forceGlobalScope = requestedScope === 'global';
    const effectiveQuarterId = forceGlobalScope
      ? null
      : (requestedQuarterId || await resolveQuarterIdByDate(requestedDate));

    const { data: globalSchedules, error: globalError } = await supabaseAdmin
      .from('practice_schedules')
      .select('*')
      .eq('session_type', sessionType)
      .eq('quarter_scope', 'global');

    if (globalError) {
      const isMissingQuarterScopeColumn = /quarter_scope/i.test(globalError.message || '') && /does not exist/i.test(globalError.message || '');
      if (isMissingQuarterScopeColumn) {
        const { data: legacySchedules, error: legacyError } = await supabaseAdmin
          .from('practice_schedules')
          .select('*')
          .eq('session_type', sessionType);

        if (legacyError) {
          console.error('Error fetching legacy practice schedules:', legacyError);
          return NextResponse.json({ error: legacyError.message }, { status: 500 });
        }

        return NextResponse.json({ schedules: legacySchedules || [], sessionType, quarterId: null, legacyMode: true });
      }

      console.error('Error fetching global practice schedules:', globalError);
      return NextResponse.json({ error: globalError.message }, { status: 500 });
    }

    let quarterSchedules: any[] = [];
    if (!forceGlobalScope && effectiveQuarterId) {
      const { data: scopedSchedules, error: scopedError } = await supabaseAdmin
        .from('practice_schedules')
        .select('*')
        .eq('session_type', sessionType)
        .eq('quarter_scope', effectiveQuarterId);

      if (scopedError) {
        console.error('Error fetching quarter-scoped schedules:', scopedError);
        return NextResponse.json({ error: scopedError.message }, { status: 500 });
      }
      quarterSchedules = scopedSchedules || [];
    }

    const schedules = mergeSchedulesByScope(globalSchedules || [], quarterSchedules || []);

    return NextResponse.json({ schedules, sessionType, quarterId: effectiveQuarterId || null });
  } catch (error) {
    console.error('Unexpected error in GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Update practice schedule for a squad
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { squadId, practiceDays, customNoPracticeDays, customPracticeDays, quarterId, sessionType: incomingSessionType } = body;
    const sessionType = normalizeSessionType(incomingSessionType);
    const quarterScope = typeof quarterId === 'string' && quarterId.trim() ? quarterId.trim() : 'global';

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
        quarter_scope: quarterScope,
        practice_days: practiceDays || [],
        custom_no_practice_days: customNoPracticeDays || [],
        custom_practice_days: customPracticeDays || [],
        session_type: sessionType,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'squad_id,session_type,quarter_scope'
      })
      .select();

    if (error) {
      const isMissingQuarterScopeColumn = /quarter_scope/i.test(error.message || '') && /does not exist/i.test(error.message || '');
      if (isMissingQuarterScopeColumn) {
        const { data: legacyData, error: legacyError } = await supabaseAdmin
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

        if (legacyError) {
          console.error('Legacy database error:', legacyError);
          return NextResponse.json({ error: legacyError.message }, { status: 500 });
        }

        return NextResponse.json({
          message: 'Practice schedule updated successfully (legacy mode)',
          schedule: legacyData?.[0],
          sessionType,
          quarterScope: 'global',
          legacyMode: true,
          hint: 'Run scripts/add_practice_schedule_quarter_scope.sql to enable quarter-scoped schedules.'
        });
      }

      console.error('Database error:', error);
      // Provide targeted guidance if unique constraint for onConflict is missing
      if (error.message && /no unique or exclusion constraint/i.test(error.message)) {
        return NextResponse.json({ 
          error: error.message,
          hint: 'Run scripts/add_practice_schedule_quarter_scope.sql to add quarter-scoped schedule constraints.'
        }, { status: 500 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      message: 'Practice schedule updated successfully',
      schedule: data?.[0],
      sessionType,
      quarterScope
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
