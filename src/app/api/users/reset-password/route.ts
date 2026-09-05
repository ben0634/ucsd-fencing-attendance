import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

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
    const { userId, customPassword } = body;

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    // Use custom password if provided, otherwise generate new password
    const newPassword = customPassword || generateEasyPassword();

    // Update user password
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      userId,
      { password: newPassword }
    );

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      newPassword,
    });
  } catch (error: any) {
    console.error('Reset request error:', error?.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
