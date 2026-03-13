-- Migration: Add quarter-scoped schedule versions
-- Allows separate practice/lift schedules per quarter while keeping a global fallback.
-- Safe to run multiple times.

BEGIN;

-- 1) Add quarter_scope column (global fallback or specific quarter id)
ALTER TABLE practice_schedules
  ADD COLUMN IF NOT EXISTS quarter_scope text NOT NULL DEFAULT 'global';

-- 2) Backfill any nulls just in case
UPDATE practice_schedules
SET quarter_scope = 'global'
WHERE quarter_scope IS NULL;

-- 3) Drop old unique constraints that are now too coarse
DO $$
DECLARE r record;
BEGIN
  FOR r IN (
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'practice_schedules'::regclass
      AND contype = 'u'
  ) LOOP
    IF r.conname IN (
      'practice_schedules_squad_id_key',
      'practice_schedules_squad_id_session_type_key'
    ) THEN
      EXECUTE format('ALTER TABLE practice_schedules DROP CONSTRAINT IF EXISTS %I', r.conname);
    END IF;
  END LOOP;
END $$;

-- 4) Add quarter-scoped unique key
DO $$
BEGIN
  ALTER TABLE practice_schedules
    ADD CONSTRAINT practice_schedules_squad_session_scope_key
    UNIQUE (squad_id, session_type, quarter_scope);
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

COMMIT;

-- Optional verification
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid = 'practice_schedules'::regclass
--   AND contype = 'u';
