-- Create a users table to store additional user information
-- This allows us to query user info without needing admin access
-- Run this in the Supabase SQL Editor

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    username VARCHAR(100) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    full_name VARCHAR(200),
    role VARCHAR(50) NOT NULL,
    squad_id INTEGER,
    weapon VARCHAR(20),
    gender VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own record
CREATE POLICY "Users can view their own profile" ON users
    FOR SELECT USING (auth.uid() = id);

-- Allow captains to view athletes in their squad (same weapon + gender)
CREATE POLICY "Captains can view their squad" ON users
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users captain_user
            WHERE captain_user.id = auth.uid()
            AND captain_user.role = 'captain'
            AND captain_user.weapon = users.weapon
            AND captain_user.gender = users.gender
        ) OR auth.uid() = id
    );

-- Allow coaches to view all users
CREATE POLICY "Coaches can view all users" ON users
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users coach_user
            WHERE coach_user.id = auth.uid()
            AND coach_user.role = 'coach'
        )
    );

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_squad ON users(weapon, gender, role);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
