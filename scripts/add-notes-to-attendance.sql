-- Add notes column to attendance table
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS notes TEXT;
