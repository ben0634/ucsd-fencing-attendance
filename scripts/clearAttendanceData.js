/**
 * Clear all attendance data from the database
 * Usage: node scripts/clearAttendanceData.js
 * 
 * Options:
 * - node scripts/clearAttendanceData.js --confirm: Actually delete the data
 * - node scripts/clearAttendanceData.js --before-date YYYY-MM-DD: Delete attendance before a specific date
 * - node scripts/clearAttendanceData.js --dry-run: Show what would be deleted without actually deleting
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function clearAttendanceData() {
  const args = process.argv.slice(2);
  const hasConfirm = args.includes('--confirm');
  const hasDryRun = args.includes('--dry-run');
  const beforeDateIndex = args.indexOf('--before-date');
  const beforeDate = beforeDateIndex !== -1 ? args[beforeDateIndex + 1] : null;

  if (!hasConfirm && !hasDryRun) {
    console.log('🚨 WARNING: This will delete ALL attendance data!');
    console.log('');
    console.log('Usage options:');
    console.log('  --confirm              Actually delete the data');
    console.log('  --dry-run              Show what would be deleted without deleting');
    console.log('  --before-date YYYY-MM-DD   Only delete attendance before this date');
    console.log('');
    console.log('Examples:');
    console.log('  node scripts/clearAttendanceData.js --dry-run');
    console.log('  node scripts/clearAttendanceData.js --confirm');
    console.log('  node scripts/clearAttendanceData.js --before-date 2025-09-01 --confirm');
    console.log('');
    console.log('💡 Use --dry-run first to see what will be deleted!');
    process.exit(1);
  }

  try {
    // Build query
    let query = supabase.from('attendance').select('*');
    
    if (beforeDate) {
      // Validate date format
      if (!/^\d{4}-\d{2}-\d{2}$/.test(beforeDate)) {
        console.log('❌ Invalid date format. Use YYYY-MM-DD format.');
        process.exit(1);
      }
      query = query.lt('date', beforeDate);
      console.log(`🔍 Looking for attendance records before ${beforeDate}...`);
    } else {
      console.log('🔍 Looking for all attendance records...');
    }

    // Get records that would be affected
    const { data: attendanceRecords, error: selectError } = await query;

    if (selectError) {
      console.error('❌ Error fetching attendance records:', selectError);
      return;
    }

    if (!attendanceRecords || attendanceRecords.length === 0) {
      console.log('✅ No attendance records found to delete.');
      return;
    }

    // Group records by date for better display
    const recordsByDate = {};
    attendanceRecords.forEach(record => {
      if (!recordsByDate[record.date]) {
        recordsByDate[record.date] = [];
      }
      recordsByDate[record.date].push(record);
    });

    console.log(`📊 Found ${attendanceRecords.length} attendance records:`);
    console.log('');
    
    Object.keys(recordsByDate).sort().forEach(date => {
      const records = recordsByDate[date];
      console.log(`📅 ${date}: ${records.length} records`);
      records.forEach(record => {
        console.log(`   • ${record.athlete_id.substring(0, 8)}... - ${record.status}`);
      });
    });

    console.log('');

    if (hasDryRun) {
      console.log('🔍 DRY RUN - No data was deleted.');
      console.log(`💡 Run with --confirm to actually delete these ${attendanceRecords.length} records.`);
      return;
    }

    if (!hasConfirm) {
      console.log('❌ Missing --confirm flag. No data deleted.');
      return;
    }

    // Actually delete the records
    console.log('🗑️  Deleting attendance records...');
    
    let deleteQuery = supabase.from('attendance').delete();
    
    if (beforeDate) {
      deleteQuery = deleteQuery.lt('date', beforeDate);
    } else {
      // Delete all records - use a condition that's always true
      deleteQuery = deleteQuery.neq('id', '00000000-0000-0000-0000-000000000000');
    }

    const { error: deleteError } = await deleteQuery;

    if (deleteError) {
      console.error('❌ Error deleting attendance records:', deleteError);
      return;
    }

    console.log(`✅ Successfully deleted ${attendanceRecords.length} attendance records!`);

    if (beforeDate) {
      console.log(`📅 Deleted all attendance records before ${beforeDate}`);
    } else {
      console.log('📅 Deleted ALL attendance records');
    }

    // Show summary
    console.log('');
    console.log('📋 Summary:');
    console.log(`   • Records deleted: ${attendanceRecords.length}`);
    if (beforeDate) {
      console.log(`   • Date filter: before ${beforeDate}`);
    }
    console.log('   • Database: attendance table cleared');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

clearAttendanceData();
