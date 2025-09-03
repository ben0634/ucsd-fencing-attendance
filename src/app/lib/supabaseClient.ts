import { createClient } from '@supabase/supabase-js'

// These values come from your Supabase dashboard
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string

// This creates the Supabase client — you use this to call the database and auth
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
