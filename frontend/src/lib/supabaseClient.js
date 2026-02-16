import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://xnccwqnayjgxgdgiwcnx.supabase.co'

const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhuY2N3cW5heWpneGdkZ2l3Y254Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NzIwMTcsImV4cCI6MjA4NjU0ODAxN30.EW4i3vN1jKdEPtwkimT8Bxfc9bUQQboyTaHLyX0a-t4'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
