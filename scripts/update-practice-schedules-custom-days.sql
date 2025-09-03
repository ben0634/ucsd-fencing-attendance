-- Add custom days columns to practice_schedules table
-- Run this SQL in your Supabase SQL Editor

-- Add new columns for custom days
ALTER TABLE practice_schedules 
ADD COLUMN IF NOT EXISTS custom_no_practice_days TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS custom_practice_days TEXT[] DEFAULT '{}';

-- Update existing records to have empty arrays for new columns
UPDATE practice_schedules 
SET 
    custom_no_practice_days = '{}',
    custom_practice_days = '{}'
WHERE 
    custom_no_practice_days IS NULL 
    OR custom_practice_days IS NULL;

-- Add comments to document the new columns
COMMENT ON COLUMN practice_schedules.custom_no_practice_days IS 'Array of specific dates (YYYY-MM-DD) when there is no practice, overriding regular schedule';
COMMENT ON COLUMN practice_schedules.custom_practice_days IS 'Array of specific dates (YYYY-MM-DD) when there is extra practice, overriding regular schedule';

-- Verify the table structure
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'practice_schedules'
ORDER BY ordinal_position;
