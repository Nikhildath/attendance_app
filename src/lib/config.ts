// ============================================================
// SINGLE CONFIGURATION FILE
// ============================================================
// Edit values here before building your APK via GitHub Actions.
// This file replaces .env variables so you don't need a .env
// file during build. All other files import from here.
// ============================================================

// --- Main Supabase ---
export const SUPABASE_URL = "https://vmtqwpisvhbjzparejil.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZtdHF3cGlzdmhianpwYXJlamlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1MzE5NzUsImV4cCI6MjA5MzEwNzk3NX0.NTiA1s3OBk_4D7eUyBv7EHtF0N7s6Gjqaj93jIBrm5A";

// --- Chat Supabase ---
export const CHAT_SUPABASE_URL = "https://pcgoxzcllijqqvwaqqpl.supabase.co";
export const CHAT_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjZ294emNsbGlqcXF2d2FxcXBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2MzIzNDIsImV4cCI6MjA5MzIwODM0Mn0.h3eQUd4KCr3C7ml4AOwyYQMm2tmYPhbIcfp7R6VzoZY";
export const CHAT_STORAGE_BUCKET = "chat-media";

// --- Google Calendar ---
export const GOOGLE_CALENDAR_API_KEY = "AIzaSyDQRgaN0xdNTMwEJdLNoKHBYTOTuqhHzFE";

// --- Socket Server (on Render) ---
// After deploying to Render, REPLACE this with your actual URL:
//   https://attendance-socket-server.onrender.com
// (Render gives you the URL after you create the web service)
// The APK will use this URL to connect to the socket server.
export const SOCKET_URL = "REPLACE_ME_AFTER_RENDER_DEPLOY";

// --- VAPID Keys (Web Push) ---
export const VAPID_PUBLIC_KEY = "BGIA1VAmBOZoD_m9TkevM4BZ3kpsjF70XSgKykZUas8TUTtIBQ7xONMJoEF89NkGMDXYJDTwhGW3Ca5xm_vmO4Q";

// --- VAPID Private (server-side only, kept here for reference) ---
export const VAPID_PRIVATE_KEY = "-W1i0bPn1o43k47g2HejC663M02mAbE85l4ssR-6hEo";
export const VAPID_SUBJECT = "mailto:support@attendly.local";
