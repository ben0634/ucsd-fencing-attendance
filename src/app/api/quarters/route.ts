import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET - Fetch all quarters for a season
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const seasonId = searchParams.get('seasonId');

    if (!seasonId) {
      return NextResponse.json(
        { error: 'Season ID is required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('quarters')
      .select('*')
      .eq('season_id', seasonId)
      .order('start_date', { ascending: true });

    if (error) {
      console.error('Error fetching quarters:', error);
      return NextResponse.json(
        { error: 'Failed to fetch quarters' },
        { status: 500 }
      );
    }

    return NextResponse.json({ quarters: data });
  } catch (error) {
    console.error('Error in GET /api/quarters:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Create a new quarter
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { seasonId, name, startDate, endDate } = body;

    if (!seasonId || !name || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Season ID, name, start date, and end date are required' },
        { status: 400 }
      );
    }

    // Validate date range
    if (new Date(endDate) <= new Date(startDate)) {
      return NextResponse.json(
        { error: 'End date must be after start date' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('quarters')
      .insert({
        season_id: seasonId,
        name,
        start_date: startDate,
        end_date: endDate,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating quarter:', error);
      
      // Check for unique constraint violation
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'A quarter with this name already exists for this season' },
          { status: 409 }
        );
      }
      
      return NextResponse.json(
        { error: 'Failed to create quarter' },
        { status: 500 }
      );
    }

    return NextResponse.json({ quarter: data }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/quarters:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - Update a quarter
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, startDate, endDate } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Quarter ID is required' },
        { status: 400 }
      );
    }

    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (startDate !== undefined) updates.start_date = startDate;
    if (endDate !== undefined) updates.end_date = endDate;
    updates.updated_at = new Date().toISOString();

    // Validate date range if both dates are provided
    if (startDate && endDate && new Date(endDate) <= new Date(startDate)) {
      return NextResponse.json(
        { error: 'End date must be after start date' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('quarters')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating quarter:', error);
      return NextResponse.json(
        { error: 'Failed to update quarter' },
        { status: 500 }
      );
    }

    return NextResponse.json({ quarter: data });
  } catch (error) {
    console.error('Error in PUT /api/quarters:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a quarter
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Quarter ID is required' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('quarters')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting quarter:', error);
      return NextResponse.json(
        { error: 'Failed to delete quarter' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/quarters:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
