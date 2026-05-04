import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const isMissingVars = !supabaseUrl || !supabaseAnonKey || supabaseUrl === "https://placeholder-project.supabase.co";

if (isMissingVars) {
  const msg = "Supabase credentials missing! Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your hosting environment variables (e.g., Render, Netlify, or Vercel dashboard).";
  console.error(msg);
  
  // Only alert in production if it's missing, to help the user debug deployment
  if (import.meta.env.PROD && typeof window !== 'undefined') {
    // We'll use a timeout to let the app mount before showing the alert
    setTimeout(() => {
      alert(msg);
    }, 1000);
  }
}

// We use a dummy URL/Key if missing to prevent fatal initialization errors, 
// though actual calls will fail. This allows the React app to mount and show a proper error UI.
export const supabase = createClient(
  supabaseUrl || "https://placeholder-project.supabase.co", 
  supabaseAnonKey || "placeholder-key"
);
