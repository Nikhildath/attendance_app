// ============================================================
// SERVER CONFIGURATION
// ============================================================
// Edit values here for the Socket.io server.
// Keep in sync with src/lib/config.ts for the frontend.
// No .env file needed — all config lives here.
// ============================================================

// --- Main Supabase ---
export const SUPABASE_URL = "https://vmtqwpisvhbjzparejil.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZtdHF3cGlzdmhianpwYXJlamlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1MzE5NzUsImV4cCI6MjA5MzEwNzk3NX0.NTiA1s3OBk_4D7eUyBv7EHtF0N7s6Gjqaj93jIBrm5A";

// --- Chat Supabase (for push subscriptions) ---
export const CHAT_SUPABASE_URL = "https://pcgoxzcllijqqvwaqqpl.supabase.co";
export const CHAT_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjZ294emNsbGlqcXF2d2FxcXBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2MzIzNDIsImV4cCI6MjA5MzIwODM0Mn0.h3eQUd4KCr3C7ml4AOwyYQMm2tmYPhbIcfp7R6VzoZY";

// --- VAPID Keys (Web Push) ---
export const VAPID_PUBLIC_KEY = "BGIA1VAmBOZoD_m9TkevM4BZ3kpsjF70XSgKykZUas8TUTtIBQ7xONMJoEF89NkGMDXYJDTwhGW3Ca5xm_vmO4Q";
export const VAPID_PRIVATE_KEY = "-W1i0bPn1o43k47g2HejC663M02mAbE85l4ssR-6hEo";
export const VAPID_SUBJECT = "mailto:support@attendly.local";

// --- Background Tracking API ---
// Used by the native background geolocation plugin to POST locations via HTTP
// when the app is running in the background or killed
export const API_KEY = "attendly-bg-api-key-change-in-production";

// --- Server ---
export const PORT = 3001;
export const FRONTEND_URL = "*";
