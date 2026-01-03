-- Create quarters table
CREATE TABLE IF NOT EXISTS quarters (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT valid_date_range CHECK (end_date > start_date),
  CONSTRAINT unique_quarter_per_season UNIQUE (season_id, name)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_quarters_season_id ON quarters(season_id);
CREATE INDEX IF NOT EXISTS idx_quarters_date_range ON quarters(start_date, end_date);

-- Enable RLS
ALTER TABLE quarters ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can view quarters
CREATE POLICY "Anyone can view quarters"
  ON quarters
  FOR SELECT
  USING (true);

-- Policy: Only coaches and admins can insert quarters
CREATE POLICY "Coaches and admins can insert quarters"
  ON quarters
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (
        auth.users.raw_user_meta_data->>'role' = 'coach'
        OR auth.users.raw_user_meta_data->>'role' = 'admin'
      )
    )
  );

-- Policy: Only coaches and admins can update quarters
CREATE POLICY "Coaches and admins can update quarters"
  ON quarters
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (
        auth.users.raw_user_meta_data->>'role' = 'coach'
        OR auth.users.raw_user_meta_data->>'role' = 'admin'
      )
    )
  );

-- Policy: Only coaches and admins can delete quarters
CREATE POLICY "Coaches and admins can delete quarters"
  ON quarters
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (
        auth.users.raw_user_meta_data->>'role' = 'coach'
        OR auth.users.raw_user_meta_data->>'role' = 'admin'
      )
    )
  );
