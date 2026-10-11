import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const DEMO_MODE = !supabaseUrl || !supabaseAnonKey ||
  supabaseUrl === 'your_supabase_project_url'

if (DEMO_MODE) {
  console.warn(
    '[KRS Silvers] Supabase credentials not configured. ' +
    'Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local ' +
    'to enable database features.'
  )
}

// Use a valid-looking placeholder URL to prevent SDK crash during initialization
export const supabase = DEMO_MODE
  ? createClient('https://demo.supabase.co', 'demo-anon-key')
  : createClient(supabaseUrl, supabaseAnonKey)

export const isDemoMode = DEMO_MODE

