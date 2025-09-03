/**
 * Reset attendance data for specific scenarios
 * Usage: node scripts/resetAttendanceData.js [options]
 * 
 * This script provides more granular control over attendance data cleanup
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function resetAttendanceData() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('📋 Attendance Data Reset Tool');
    console.log('');
    console.log('Available commands:');
    console.log('  clear-all                     Clear all attendance data');
    console.log('  clear-week [YYYY-MM-DD]       Clear attendance for a specific week');
    console.log('  clear-month [YYYY-MM]         Clear attendance for a specific month');
    console.log('  clear-athlete [email]         Clear attendance for a specific athlete');
    console.log('  clear-test-data               Clear attendance data from before today');
    console.log('  show-stats                    Show attendance statistics');
    console.log('');
    console.log('Examples:');
    console.log('  node scripts/resetAttendanceData.js show-stats');
    console.log('  node scripts/resetAttendanceData.js clear-week 2025-09-02');
    console.log('  node scripts/resetAttendanceData.js clear-month 2025-09');
    console.log('  node scripts/resetAttendanceData.js clear-athlete bkim@ucsd.edu');
    console.log('  node scripts/resetAttendanceData.js clear-test-data');
    console.log('');
    console.log('💡 All commands will ask for confirmation before deleting data');
    process.exit(1);
  }

  const command = args[0];
  const parameter = args[1];

  try {
    switch (command) {
      case 'show-stats':
        await showStats();
        break;
      case 'clear-all':
        await clearAll();
        break;
      case 'clear-week':
        await clearWeek(parameter);
        break;
      case 'clear-month':
        await clearMonth(parameter);
        break;
      case 'clear-athlete':
        await clearAthlete(parameter);
        break;
      case 'clear-test-data':
        await clearTestData();
        break;
      default:
        console.log(`❌ Unknown command: ${command}`);
        process.exit(1);
    }
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

async function showStats() {
  console.log('📊 Attendance Statistics');
  console.log('');

  // Get all attendance records
  const { data: records, error } = await supabase
    .from('attendance')
    .select('*')
    .order('date', { ascending: false });

  if (error) {
    console.error('❌ Error fetching records:', error);
    return;
  }

  if (!records || records.length === 0) {
    console.log('✅ No attendance records found.');
    return;
  }

  // Group by date
  const byDate = {};
  const byStatus = {};
  const byAthlete = {};

  records.forEach(record => {
    // By date
    if (!byDate[record.date]) byDate[record.date] = 0;
    byDate[record.date]++;

    // By status
    if (!byStatus[record.status]) byStatus[record.status] = 0;
    byStatus[record.status]++;

    // By athlete
    if (!byAthlete[record.athlete_id]) byAthlete[record.athlete_id] = 0;
    byAthlete[record.athlete_id]++;
  });

  console.log(`Total records: ${records.length}`);
  console.log(`Date range: ${Object.keys(byDate).sort()[0]} to ${Object.keys(byDate).sort().pop()}`);
  console.log('');

  console.log('📅 Records by date:');
  Object.keys(byDate).sort().forEach(date => {
    console.log(`   ${date}: ${byDate[date]} records`);
  });
  console.log('');

  console.log('📊 Records by status:');
  Object.entries(byStatus).forEach(([status, count]) => {
    console.log(`   ${status}: ${count} records`);
  });
  console.log('');

  console.log(`👥 Unique athletes: ${Object.keys(byAthlete).length}`);
}

async function clearAll() {
  console.log('🚨 WARNING: This will delete ALL attendance data!');
  const confirm = await askConfirmation('Type "DELETE ALL" to confirm');
  
  if (confirm !== 'DELETE ALL') {
    console.log('❌ Operation cancelled.');
    return;
  }

  const { error } = await supabase
    .from('attendance')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');

  if (error) {
    console.error('❌ Error deleting records:', error);
    return;
  }

  console.log('✅ All attendance data deleted successfully!');
}

async function clearWeek(dateStr) {
  if (!dateStr) {
    console.log('❌ Please provide a date (YYYY-MM-DD)');
    return;
  }

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    console.log('❌ Invalid date format. Use YYYY-MM-DD');
    return;
  }

  // Calculate week start (Sunday) and end (Saturday)
  const dayOfWeek = date.getDay();
  const weekStart = new Date(date);
  weekStart.setDate(date.getDate() - dayOfWeek);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  const startStr = weekStart.toISOString().split('T')[0];
  const endStr = weekEnd.toISOString().split('T')[0];

  console.log(`🗑️  Clearing attendance for week: ${startStr} to ${endStr}`);

  const { data: records, error: selectError } = await supabase
    .from('attendance')
    .select('*')
    .gte('date', startStr)
    .lte('date', endStr);

  if (selectError) {
    console.error('❌ Error fetching records:', selectError);
    return;
  }

  if (!records || records.length === 0) {
    console.log('✅ No records found for this week.');
    return;
  }

  console.log(`Found ${records.length} records to delete.`);
  const confirm = await askConfirmation('Type "yes" to confirm');
  
  if (confirm !== 'yes') {
    console.log('❌ Operation cancelled.');
    return;
  }

  const { error } = await supabase
    .from('attendance')
    .delete()
    .gte('date', startStr)
    .lte('date', endStr);

  if (error) {
    console.error('❌ Error deleting records:', error);
    return;
  }

  console.log(`✅ Deleted ${records.length} records for week ${startStr} to ${endStr}!`);
}

async function clearMonth(monthStr) {
  if (!monthStr || !/^\d{4}-\d{2}$/.test(monthStr)) {
    console.log('❌ Please provide a month in format YYYY-MM');
    return;
  }

  const [year, month] = monthStr.split('-');
  const monthStart = `${year}-${month}-01`;
  const monthEnd = new Date(parseInt(year), parseInt(month), 0).toISOString().split('T')[0];

  console.log(`🗑️  Clearing attendance for month: ${monthStr} (${monthStart} to ${monthEnd})`);

  const { data: records, error: selectError } = await supabase
    .from('attendance')
    .select('*')
    .gte('date', monthStart)
    .lte('date', monthEnd);

  if (selectError) {
    console.error('❌ Error fetching records:', selectError);
    return;
  }

  if (!records || records.length === 0) {
    console.log('✅ No records found for this month.');
    return;
  }

  console.log(`Found ${records.length} records to delete.`);
  const confirm = await askConfirmation('Type "yes" to confirm');
  
  if (confirm !== 'yes') {
    console.log('❌ Operation cancelled.');
    return;
  }

  const { error } = await supabase
    .from('attendance')
    .delete()
    .gte('date', monthStart)
    .lte('date', monthEnd);

  if (error) {
    console.error('❌ Error deleting records:', error);
    return;
  }

  console.log(`✅ Deleted ${records.length} records for month ${monthStr}!`);
}

async function clearAthlete(email) {
  if (!email) {
    console.log('❌ Please provide an athlete email address');
    return;
  }

  // Find the user by email
  const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
  
  if (authError) {
    console.error('❌ Error fetching users:', authError);
    return;
  }

  const user = authUsers.users.find(u => u.email === email);
  if (!user) {
    console.log(`❌ User not found: ${email}`);
    return;
  }

  console.log(`🗑️  Clearing attendance for: ${user.user_metadata?.firstName} ${user.user_metadata?.lastName} (${email})`);

  const { data: records, error: selectError } = await supabase
    .from('attendance')
    .select('*')
    .eq('athlete_id', user.id);

  if (selectError) {
    console.error('❌ Error fetching records:', selectError);
    return;
  }

  if (!records || records.length === 0) {
    console.log('✅ No records found for this athlete.');
    return;
  }

  console.log(`Found ${records.length} records to delete.`);
  const confirm = await askConfirmation('Type "yes" to confirm');
  
  if (confirm !== 'yes') {
    console.log('❌ Operation cancelled.');
    return;
  }

  const { error } = await supabase
    .from('attendance')
    .delete()
    .eq('athlete_id', user.id);

  if (error) {
    console.error('❌ Error deleting records:', error);
    return;
  }

  console.log(`✅ Deleted ${records.length} records for ${email}!`);
}

async function clearTestData() {
  const today = new Date().toISOString().split('T')[0];
  
  console.log(`🧹 Clearing test attendance data (records before ${today})`);

  const { data: records, error: selectError } = await supabase
    .from('attendance')
    .select('*')
    .lt('date', today);

  if (selectError) {
    console.error('❌ Error fetching records:', selectError);
    return;
  }

  if (!records || records.length === 0) {
    console.log('✅ No test data found to delete.');
    return;
  }

  console.log(`Found ${records.length} test records to delete.`);
  const confirm = await askConfirmation('Type "yes" to confirm');
  
  if (confirm !== 'yes') {
    console.log('❌ Operation cancelled.');
    return;
  }

  const { error } = await supabase
    .from('attendance')
    .delete()
    .lt('date', today);

  if (error) {
    console.error('❌ Error deleting records:', error);
    return;
  }

  console.log(`✅ Deleted ${records.length} test records (before ${today})!`);
}

function askConfirmation(prompt) {
  return new Promise((resolve) => {
    process.stdout.write(`${prompt}: `);
    process.stdin.once('data', (data) => {
      resolve(data.toString().trim());
    });
  });
}

resetAttendanceData();
