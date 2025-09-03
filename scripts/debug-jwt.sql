-- Debug script to see what's in the JWT token
-- Run this in Supabase SQL Editor while logged in as coach

SELECT 
    'User ID' as info_type,
    auth.uid()::text as value
UNION ALL
SELECT 
    'Raw JWT',
    auth.jwt()::text
UNION ALL  
SELECT 
    'JWT User Metadata',
    (auth.jwt() ->> 'user_metadata')::text
UNION ALL
SELECT 
    'Role from JWT',
    (auth.jwt() ->> 'user_metadata')::jsonb ->> 'role'
UNION ALL
SELECT 
    'Email from JWT', 
    auth.jwt() ->> 'email';
