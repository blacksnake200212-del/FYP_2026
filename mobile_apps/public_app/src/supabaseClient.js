// Supabase Client Configuration for SDAS Public Advisory Portal
// Reads credentials securely from environment variables (EXPO_PUBLIC_*)

export const SUPABASE_CONFIG = {
  PROJECT_REF: process.env.EXPO_PUBLIC_SUPABASE_PROJECT_REF || 'YOUR_SUPABASE_PROJECT_REF',
  URL: process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co',
  PUBLISHABLE_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY'
};
