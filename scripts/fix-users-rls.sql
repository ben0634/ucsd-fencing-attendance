-- Fix the RLS policies for the users table
-- This addresses the circular dependency issue

-- Drop existing policies
DROP POLICY IF EXISTS "Captains can view their squad" ON users;
DROP POLICY IF EXISTS "Coaches can view all users" ON users;

-- Allow captains to view athletes in their squad (same weapon + gender)
-- Use auth.users metadata instead of the users table to avoid circular dependency
CREATE POLICY "Captains can view their squad" ON users
    FOR SELECT USING (
        -- Allow users to view their own record
        auth.uid() = id 
        OR 
        -- Allow captains to view athletes in their squad
        (
            EXISTS (
                SELECT 1 FROM auth.users
                WHERE auth.users.id = auth.uid()
                AND auth.users.user_metadata->>'role' = 'captain'
            )
            AND users.role = 'athlete'
            AND users.weapon = (
                SELECT user_metadata->>'weapon' FROM auth.users WHERE id = auth.uid()
            )
            AND users.gender = (
                SELECT user_metadata->>'gender' FROM auth.users WHERE id = auth.uid()
            )
        )
    );

-- Allow coaches to view all users
CREATE POLICY "Coaches can view all users" ON users
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.user_metadata->>'role' = 'coach'
        )
    );
