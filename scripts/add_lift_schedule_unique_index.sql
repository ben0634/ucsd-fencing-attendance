-- Migration: Enable separate schedules per (squad_id, session_type)
-- Safe to run multiple times.

BEGIN;

-- 1. Ensure session_type column exists and default set (will not overwrite existing values)
ALTER TABLE practice_schedules
  ADD COLUMN IF NOT EXISTS session_type text NOT NULL DEFAULT 'practice';

-- 2. Backfill any nulls (in case column was added previously without default)
UPDATE practice_schedules SET session_type = 'practice' WHERE session_type IS NULL;

-- 3. Drop legacy unique constraint that only covered squad_id (name may vary). Adjust names below if different.
DO $$
DECLARE r record;
BEGIN
  FOR r IN (
    SELECT conname FROM pg_constraint 
    WHERE conrelid = 'practice_schedules'::regclass 
      AND contype = 'u'
  ) LOOP
    -- Look for a single-column unique constraint on squad_id
    IF EXISTS (
      SELECT 1
      FROM pg_attribute a
      JOIN pg_constraint c ON c.conrelid = a.attrelid
      WHERE c.conname = r.conname
        AND a.attname = 'squad_id'
        AND array_length(c.conkey,1) = 1
    ) THEN
      EXECUTE format('ALTER TABLE practice_schedules DROP CONSTRAINT %I', r.conname);
    END IF;
  END LOOP;
END $$;

-- 4. Create composite unique constraint (idempotent via exception handling)
DO $$
BEGIN
  ALTER TABLE practice_schedules
    ADD CONSTRAINT practice_schedules_squad_id_session_type_key
    UNIQUE (squad_id, session_type);
EXCEPTION WHEN duplicate_object THEN
  -- Constraint already exists; ignore
  NULL;
END $$;

COMMIT;

-- Verification query (optional):
-- SELECT * FROM pg_indexes WHERE tablename='practice_schedules';
-- SELECT conname, contype, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid='practice_schedules'::regclass;