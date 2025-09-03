#!/bin/bash

echo "==================================================="
echo "UCSD Fencing - Practice Schedule Database Update"
echo "==================================================="
echo ""
echo "You need to add the custom days columns to your practice_schedules table."
echo "Please copy and paste the following SQL into your Supabase SQL Editor:"
echo ""
echo "---------------------------------------------------"
cat scripts/update-practice-schedules-custom-days.sql
echo "---------------------------------------------------"
echo ""
echo "After running the SQL, your practice management custom days feature will work properly!"
echo ""
