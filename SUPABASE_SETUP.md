# Supabase Setup Guide

This guide will help you set up the backend infrastructure for **Attendly Pro** using Supabase.

## 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. Fill in your project details:
   - **Name**: `attendly-pro`
   - **Database Password**: Choose a strong password.
   - **Region**: Select a region close to your target audience (e.g., `South Asia (Mumbai)` for India).
3. Wait for the project to provision.

## 2. Get Your Project Credentials

Go to **Settings > API** in your Supabase dashboard and copy:
- **Project URL**
- **Anon/Public Key**

## 3. Configure Environment Variables

Create a `.env` file in your project root (this file is git-ignored for security):

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_GOOGLE_CALENDAR_API_KEY=your-google-calendar-key
```

> [!TIP]
> You can get a Google Calendar API key from the [Google Cloud Console](https://console.cloud.google.com/). Ensure the "Google Calendar API" is enabled.

## 4. Set Up Database Schema

Instead of running individual commands, Attendly Pro uses a comprehensive schema file.

1. Open the **SQL Editor** in your Supabase dashboard.
2. Click **New Query**.
3. Copy and paste the entire contents of the [supabase_schema.sql](./supabase_schema.sql) file into the editor.
4. Click **Run**.

This will automatically create:
- All tables (`profiles`, `attendance`, `leaves`, `announcements`, `shifts`, etc.)
- Administrative RPC functions for user and payroll management.
- The `staff_tracking` identity-aware upsert logic.
- Automated triggers for new user profiles and timestamps.
- Initial seed data for settings and branches.

## 5. Security & Row Level Security (RLS)

By default, the schema initializes with **RLS Disabled** on all tables. This is to ensure a smooth administrative experience during the initial rollout and to prevent policy-related blockers.

> [!CAUTION]
> Before moving to a public production environment, it is highly recommended to review and enable RLS policies for each table.

## 6. Authentication Settings

In your Supabase dashboard:
1. Go to **Authentication > Settings**.
2. **Site URL**: Set this to your production domain or `http://localhost:5173` for development.
3. **Email Confirmations**: You may choose to disable "Confirm Email" for faster onboarding, or keep it enabled for higher security.

## 7. Next Steps

1. Start the development server: `npm run dev`.
2. Sign up your first user; they will automatically be assigned the `Employee` role.
3. To promote a user to `Admin`, use the SQL Editor:
   ```sql
   update public.profiles set role = 'Admin' where email = 'your-email@example.com';
   ```

---
*Built with ❤️ by Nikhil Dath.*