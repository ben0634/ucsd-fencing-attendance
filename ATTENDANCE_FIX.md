# Practice Management Feature

## Overview
Added a new "Practice Management" tab to the coach dashboard that allows coaches to set recurring practice days for each squad.

## Features
- **Practice Days Section**: For each squad, coaches can select which days of the week (Monday-Friday) they have regular practice
- **Interactive Toggle**: Click on day buttons to toggle practice schedule for each squad  
- **Visual Feedback**: Selected days are highlighted in blue, unselected days remain gray
- **Auto-save**: Changes are automatically saved when toggled
- **Squad-specific**: Each squad (Men's/Women's Epee, Foil, Saber) has independent practice schedules

## How it Works
1. Navigate to "Practice Management" tab in coach dashboard
2. For each squad, click on the days when they have regular practice
3. Blue days = practice days, gray days = no practice
4. Schedule is saved automatically
5. When "No Practice" is set, it will show in attendance views for athletes and captains

## Integration with Attendance System
The Practice Management feature is now integrated with the athlete and captain dashboards:

- **Athletes**: See "No Practice" on days when their squad doesn't have scheduled practice
- **Captains**: Can't mark attendance on "No Practice" days, and see "No Practice" in their personal attendance view
- **Real-time**: Practice schedule changes immediately reflect in attendance views
- **Squad-specific**: Each squad (Men's/Women's Epee, Foil, Saber) has independent schedules

## Database Setup Required ⚠️
**IMPORTANT**: To use this feature, you must create the `practice_schedules` table in Supabase:

### Step 1: Open Supabase SQL Editor
1. Go to your [Supabase Dashboard](https://supabase.com/dashboard/projects)
2. Select your project
3. Navigate to **SQL Editor** in the left sidebar

### Step 2: Run the SQL Script
1. Copy the entire contents of `/scripts/SUPABASE_PRACTICE_SCHEDULES.sql`
2. Paste it into the SQL Editor
3. Click **Run** to execute

### Step 2b: Fix RLS Conflicts (if you get "infinite recursion" or "row-level security" errors)
If you see any policy errors:

**Quick Temporary Fix:**
1. Copy the contents of `/scripts/temp-fix-practice-schedules.sql` 
2. Paste it into the SQL Editor
3. Click **Run**
4. This allows all authenticated users to manage schedules (we can tighten security later)

**Debug JWT Issues:**
1. Run `/scripts/debug-jwt.sql` in SQL Editor to see what's in your JWT token
2. This helps us understand why role detection isn't working

### Step 3: Verify Table Creation
The script will:
- ✅ Create the `practice_schedules` table
- ✅ Enable Row Level Security (RLS)
- ✅ Create policies for coaches and team members
- ✅ Insert default practice schedules for all squads

### Temporary Fallback
Until you create the table, the Practice Management tab will show default schedules but won't save changes. You'll see a helpful error message with setup instructions.

## Files Modified
- `/src/app/coach/CoachDashboard.tsx` - Added practice management tab and functionality
- `/src/app/captain/CaptainDashboard.tsx` - Integrated practice schedules, shows "No Practice" appropriately
- `/src/app/athlete/AthleteDashboard.tsx` - Integrated practice schedules, shows "No Practice" for off days
- `/src/app/api/practice-schedule/route.ts` - API endpoint for practice schedule operations
- `/scripts/SUPABASE_PRACTICE_SCHEDULES.sql` - SQL to create database table
- `/scripts/insertSamplePracticeData.js` - Script to populate sample data

## Default Schedules (can be customized)
- **Men's/Women's Epee**: Monday, Wednesday, Friday
- **Men's/Women's Foil**: Tuesday, Thursday  
- **Men's/Women's Saber**: Monday, Thursday