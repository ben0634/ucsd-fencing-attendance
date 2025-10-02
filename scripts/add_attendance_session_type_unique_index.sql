-- Migration: Add session_type and composite unique constraint to attendance for dual-mode (practice/lift)
-- Safe to run multiple times.

BEGIN;

-- 1. Add session_type column if missing (default 'practice').
ALTER TABLE attendance
  ADD COLUMN IF NOT EXISTS session_type text NOT NULL DEFAULT 'practice';

-- 2. Backfill any NULL values (defensive if column added without default previously).
UPDATE attendance SET session_type = 'practice' WHERE session_type IS NULL;

-- 3. Drop any legacy unique constraint that only enforces (athlete_id, date)
DO $$
DECLARE r record;
BEGIN
  FOR r IN (
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'attendance'::regclass
      AND contype = 'u'
      AND pg_get_constraintdef(oid) = 'UNIQUE (athlete_id, date)'
  ) LOOP
    EXECUTE format('ALTER TABLE attendance DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

-- 3b. (Optional) Remove duplicates that would block new composite unique constraint
-- Keeps the most recently updated row per (athlete_id, date) pair.
WITH ranked AS (
  SELECT ctid,
         row_number() OVER (PARTITION BY athlete_id, date ORDER BY updated_at DESC NULLS LAST) AS rn
  FROM attendance
)
DELETE FROM attendance
WHERE ctid IN (SELECT ctid FROM ranked WHERE rn > 1);

-- 3c. Drop any standalone UNIQUE index that still enforces only (athlete_id, date)
DO $$
DECLARE idx text;
BEGIN
  FOR idx IN
    SELECT indexname
    FROM pg_indexes
    WHERE tablename = 'attendance'
      AND indexdef ILIKE '%UNIQUE%'
      AND indexdef ILIKE '%(athlete_id, date)%'
  LOOP
    -- If this index name is NOT the composite constraint index we want, drop it.
    IF idx <> 'attendance_athlete_id_date_session_type_key' THEN
      EXECUTE format('DROP INDEX IF EXISTS %I', idx);
    END IF;
  END LOOP;
END $$;

-- 4. Create composite unique constraint (athlete_id, date, session_type) if it does not exist.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'attendance'::regclass
      AND conname = 'attendance_athlete_id_date_session_type_key'
  ) THEN
    ALTER TABLE attendance
      ADD CONSTRAINT attendance_athlete_id_date_session_type_key
      UNIQUE (athlete_id, date, session_type);
  END IF;
END $$;

-- 5. Optional: index to speed queries filtered by session_type & date range
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS idx_attendance_session_type_date ON attendance(session_type, date);
END $$;

COMMIT;

-- Verification (optional):
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint WHERE conrelid='attendance'::regclass AND contype='u';
-- \d+ attendance;
