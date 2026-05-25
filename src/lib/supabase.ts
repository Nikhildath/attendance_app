import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config";

const isMissingVars = !SUPABASE_URL || !SUPABASE_ANON_KEY;

if (isMissingVars) {
  const msg = "Supabase credentials missing! Please check SUPABASE_URL and SUPABASE_ANON_KEY in src/lib/config.ts.";
  console.error(msg);

  if (import.meta.env.PROD && typeof window !== 'undefined') {
    setTimeout(() => {
      alert(msg);
    }, 1000);
  }
}

export const supabase = createClient(
  SUPABASE_URL || "https://placeholder-project.supabase.co",
  SUPABASE_ANON_KEY || "placeholder-key"
);
