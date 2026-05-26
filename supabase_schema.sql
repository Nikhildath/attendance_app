-- ============================================================
-- ATTENDLY PRO — COMPLETE DATABASE SCHEMA
-- Use this to set up a NEW Supabase project OR upgrade an existing one.
-- All statements use IF NOT EXISTS / IF EXISTS patterns for safety.
-- ============================================================

-- ============================================================
-- 0. CLEANUP: Remove old / overloaded objects before recreating
-- ============================================================

DROP FUNCTION IF EXISTS public.admin_update_profile(uuid, uuid, text, text, text, text, boolean, uuid);
DROP FUNCTION IF EXISTS public.admin_update_profile(uuid, uuid, text, text, text, text, boolean, uuid, date, date);
DROP FUNCTION IF EXISTS public.admin_insert_profile(uuid, uuid, text, text, text, text, text);
DROP FUNCTION IF EXISTS public.admin_insert_profile(uuid, uuid, text, text, text, text, text, date, date);
DROP FUNCTION IF EXISTS public.update_own_face(uuid, float8[]);
DROP FUNCTION IF EXISTS public.update_own_face(uuid, jsonb);

-- ============================================================
-- 1. EXTENSIONS
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 2. TABLES
-- ============================================================

-- Branches
CREATE TABLE IF NOT EXISTS public.branches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    city text NOT NULL,
    country text NOT NULL DEFAULT 'India',
    address text,
    timezone text DEFAULT 'Asia/Kolkata',
    currency text DEFAULT 'INR',
    employees_count integer DEFAULT 0,
    lat numeric,
    lng numeric,
    radius_meters integer DEFAULT 150,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Profiles (linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid PRIMARY KEY references auth.users(id) on delete cascade,
    email text UNIQUE NOT NULL,
    name text NOT NULL,
    role text NOT NULL DEFAULT 'Employee' CHECK (role IN ('Employee', 'Manager', 'Admin')),
    dept text,
    password text,
    branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
    dob date,
    joining_date date,
    avatar_url text,
    passkey_registered boolean DEFAULT false,
    passkey_credential_id text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Attendance
CREATE TABLE IF NOT EXISTS public.attendance (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    check_in timestamptz,
    check_out timestamptz,
    branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
    status text DEFAULT 'present' CHECK (status IN ('present', 'absent', 'late', 'leave', 'holiday')),
    notes text,
    created_at timestamptz DEFAULT now()
);

-- Leaves
CREATE TABLE IF NOT EXISTS public.leaves (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type text NOT NULL,
    from_date date NOT NULL,
    to_date date NOT NULL,
    days numeric NOT NULL,
    half_day boolean DEFAULT false,
    status text DEFAULT 'Pending' CHECK (status IN ('Approved', 'Pending', 'Rejected')),
    reason text,
    approved_by uuid REFERENCES public.profiles(id),
    created_at timestamptz DEFAULT now()
);

-- Leave Categories
CREATE TABLE IF NOT EXISTS public.leave_categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text UNIQUE NOT NULL,
    annual_allowance numeric DEFAULT 0,
    is_paid boolean DEFAULT true,
    is_active boolean DEFAULT true,
    sort_order integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Organisation Settings
CREATE TABLE IF NOT EXISTS public.organisation_settings (
    id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    company_name text DEFAULT 'Attendly Pro',
    logo_url text,
    default_currency text DEFAULT 'INR',
    timezone text DEFAULT 'Asia/Kolkata',
    country_code text DEFAULT 'IN',
    late_threshold_mins integer DEFAULT 15,
    late_fine_amount numeric DEFAULT 50,
    working_hours_per_day numeric DEFAULT 9,
    overtime_rate numeric DEFAULT 0,
    weekend_type text DEFAULT 'second_saturday_sundays',
    fiscal_year_start date DEFAULT '2024-04-01',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Staff Tracking
CREATE TABLE IF NOT EXISTS public.staff_tracking (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
    status text DEFAULT 'offline' CHECK (status IN ('active', 'idle', 'offline')),
    lat numeric DEFAULT 0.0,
    lng numeric DEFAULT 0.0,
    battery integer DEFAULT 100,
    current_task text,
    speed_kmh numeric DEFAULT 0,
    accuracy numeric DEFAULT 0,
    device_model text,
    device_os text,
    device_os_version text,
    last_update timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now()
);

-- Shifts
CREATE TABLE IF NOT EXISTS public.shifts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    type text DEFAULT 'fixed' CHECK (type IN ('fixed', 'rotational', 'open')),
    start_time text,
    end_time text,
    break_minutes integer DEFAULT 60,
    color text DEFAULT 'bg-primary/10 text-primary border-primary/30',
    work_on_holidays boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);

-- Shift Schedule
CREATE TABLE IF NOT EXISTS public.shift_schedule (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
    mon uuid REFERENCES public.shifts(id),
    tue uuid REFERENCES public.shifts(id),
    wed uuid REFERENCES public.shifts(id),
    thu uuid REFERENCES public.shifts(id),
    fri uuid REFERENCES public.shifts(id),
    sat uuid REFERENCES public.shifts(id),
    sun uuid REFERENCES public.shifts(id),
    created_at timestamptz DEFAULT now()
);

-- Company Holidays
CREATE TABLE IF NOT EXISTS public.company_holidays (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    date date NOT NULL,
    kind text DEFAULT 'public' CHECK (kind IN ('public', 'restricted', 'optional')),
    region text DEFAULT 'All',
    branch_id uuid REFERENCES public.branches(id),
    created_at timestamptz DEFAULT now()
);

-- Payslips
CREATE TABLE IF NOT EXISTS public.payslips (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    month text NOT NULL,
    basic_pay numeric DEFAULT 0,
    hra numeric DEFAULT 0,
    allowances numeric DEFAULT 0,
    bonus numeric DEFAULT 0,
    overtime_pay numeric DEFAULT 0,
    fines numeric DEFAULT 0,
    loan_deduction numeric DEFAULT 0,
    tax numeric DEFAULT 0,
    net_payable numeric DEFAULT 0,
    status text DEFAULT 'Pending' CHECK (status IN ('Paid', 'Pending', 'Processing')),
    created_at timestamptz DEFAULT now()
);

-- Meetings
CREATE TABLE IF NOT EXISTS public.meetings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    description text,
    created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    scheduled_at timestamptz NOT NULL,
    duration_minutes integer DEFAULT 30,
    branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
    is_all_branches boolean DEFAULT false,
    status text DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'ongoing', 'completed', 'cancelled')),
    room_name text UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Meeting Participants
CREATE TABLE IF NOT EXISTS public.meeting_participants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'maybe')),
    created_at timestamptz DEFAULT now(),
    UNIQUE(meeting_id, user_id)
);

-- Comp-Off Requests
CREATE TABLE IF NOT EXISTS public.comp_off_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    worked_on date NOT NULL,
    days numeric DEFAULT 1,
    reason text,
    status text DEFAULT 'Pending' CHECK (status IN ('Approved', 'Pending', 'Rejected')),
    created_at timestamptz DEFAULT now()
);

-- Financial Requests
CREATE TABLE IF NOT EXISTS public.financial_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    kind text NOT NULL CHECK (kind IN ('Advance', 'Loan', 'Allowance', 'Bonus')),
    amount numeric NOT NULL,
    emi_months integer,
    reason text,
    status text DEFAULT 'Pending' CHECK (status IN ('Approved', 'Pending', 'Rejected')),
    created_at timestamptz DEFAULT now()
);

-- Announcements
CREATE TABLE IF NOT EXISTS public.announcements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    content text,
    type text DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'critical')),
    is_pinned boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    expires_at timestamptz,
    created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Push Notification Tokens (for incoming call notifications)
CREATE TABLE IF NOT EXISTS public.user_push_tokens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    token text NOT NULL,
    platform text NOT NULL CHECK (platform IN ('web', 'android', 'ios')),
    subscription_json jsonb,
    created_at timestamptz DEFAULT now(),
    UNIQUE(token)
);

-- ============================================================
-- 3. COLUMN MIGRATIONS (safe for existing databases)
-- ============================================================

-- Add missing columns if they don't exist
DO $$
BEGIN
  -- passkey columns (migrate from old biometric_* naming)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='passkey_registered') THEN
    ALTER TABLE public.profiles ADD COLUMN passkey_registered boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='passkey_credential_id') THEN
    ALTER TABLE public.profiles ADD COLUMN passkey_credential_id text;
  END IF;

  -- overtime_rate / weekend_type for organisation_settings
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organisation_settings' AND column_name='overtime_rate') THEN
    ALTER TABLE public.organisation_settings ADD COLUMN overtime_rate numeric DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organisation_settings' AND column_name='weekend_type') THEN
    ALTER TABLE public.organisation_settings ADD COLUMN weekend_type text DEFAULT 'second_saturday_sundays';
  END IF;

  -- accuracy column for staff_tracking
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='staff_tracking' AND column_name='accuracy') THEN
    ALTER TABLE public.staff_tracking ADD COLUMN accuracy numeric DEFAULT 0;
  END IF;

  -- country_code for organisation_settings
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organisation_settings' AND column_name='country_code') THEN
    ALTER TABLE public.organisation_settings ADD COLUMN country_code text DEFAULT 'IN';
  END IF;

  -- device info columns for staff_tracking
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='staff_tracking' AND column_name='device_model') THEN
    ALTER TABLE public.staff_tracking ADD COLUMN device_model text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='staff_tracking' AND column_name='device_os') THEN
    ALTER TABLE public.staff_tracking ADD COLUMN device_os text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='staff_tracking' AND column_name='device_os_version') THEN
    ALTER TABLE public.staff_tracking ADD COLUMN device_os_version text;
  END IF;

  -- is_all_branches column for meetings
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='meetings' AND column_name='is_all_branches') THEN
    ALTER TABLE public.meetings ADD COLUMN is_all_branches boolean DEFAULT false;
  END IF;
END $$;

-- ============================================================
-- 4. FUNCTIONS & RPCs
-- ============================================================

-- Helper: Check if user is Admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'Admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

-- Helper: Check if user is Manager
CREATE OR REPLACE FUNCTION public.is_manager()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'Manager'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

-- RPC: Lookup profile for socket auth (bypass RLS via SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.lookup_profile_for_auth(p_user_id UUID)
RETURNS TABLE (id UUID, name TEXT, email TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY SELECT p.id, p.name, p.email FROM public.profiles p WHERE p.id = p_user_id;
END;
$$;

-- RPC: Custom Login Check
CREATE OR REPLACE FUNCTION public.check_credentials(p_email text, p_password text)
RETURNS TABLE (id uuid, email text, name text, role text, dept text) AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.email, p.name, p.role, p.dept
  FROM public.profiles p
  WHERE p.email = p_email AND p.password = p_password
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

-- RPC: Admin List Users
CREATE OR REPLACE FUNCTION public.admin_list_users(caller_id uuid)
RETURNS SETOF public.profiles AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = caller_id AND role = 'Admin') THEN
    RETURN QUERY SELECT * FROM public.profiles;
  ELSE
    RETURN QUERY SELECT * FROM public.profiles WHERE id = caller_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

-- RPC: Admin Update Profile
CREATE OR REPLACE FUNCTION public.admin_update_profile(
    caller_id uuid,
    p_id uuid,
    p_name text,
    p_role text,
    p_dept text,
    p_password text,
    p_branch_id uuid DEFAULT NULL,
    p_dob date DEFAULT NULL,
    p_joining_date date DEFAULT NULL,
    p_avatar_url text DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = caller_id AND role = 'Admin') THEN
    UPDATE public.profiles
    SET
      name = p_name,
      role = p_role,
      dept = p_dept,
      password = p_password,
      branch_id = p_branch_id,
      dob = p_dob,
      joining_date = p_joining_date,
      avatar_url = p_avatar_url,
      updated_at = NOW()
    WHERE id = p_id;
  ELSE
    RAISE EXCEPTION 'Access Denied';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

-- RPC: Admin Delete Profile
CREATE OR REPLACE FUNCTION public.admin_delete_profile(caller_id uuid, p_id uuid)
RETURNS void AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = caller_id AND role = 'Admin') AND caller_id <> p_id THEN
    DELETE FROM public.profiles WHERE id = p_id;
  ELSE
    RAISE EXCEPTION 'Access Denied or Self-Deletion Attempt';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

-- RPC: Admin Insert Profile (creates auth.users entry + profiles row)
CREATE OR REPLACE FUNCTION public.admin_insert_profile(
    caller_id uuid,
    p_id uuid,
    p_email text,
    p_name text,
    p_role text,
    p_dept text,
    p_password text,
    p_dob date DEFAULT NULL,
    p_joining_date date DEFAULT NULL,
    p_avatar_url text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  auth_user_exists boolean;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = caller_id AND role = 'Admin') THEN
    RAISE EXCEPTION 'Access Denied';
  END IF;

  SELECT EXISTS(SELECT 1 FROM auth.users WHERE id = p_id) INTO auth_user_exists;

  IF NOT auth_user_exists THEN
    INSERT INTO auth.users (
      id, email, encrypted_password, email_confirmed_at,
      created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role
    ) VALUES (
      p_id, p_email,
      crypt(p_password, gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', p_name),
      'authenticated', 'authenticated'
    );
  END IF;

  INSERT INTO public.profiles (id, email, name, role, dept, password, dob, joining_date, avatar_url)
  VALUES (p_id, p_email, p_name, p_role, p_dept, p_password, p_dob, p_joining_date, p_avatar_url)
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    role = EXCLUDED.role,
    dept = EXCLUDED.dept,
    password = EXCLUDED.password,
    dob = EXCLUDED.dob,
    joining_date = EXCLUDED.joining_date,
    avatar_url = EXCLUDED.avatar_url,
    updated_at = NOW();

  RETURN jsonb_build_object('success', true, 'id', p_id);
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'A user with this email already exists';
  WHEN OTHERS THEN
    RAISE EXCEPTION '%', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, extensions;

-- RPC: Upsert Staff Tracking (bypass RLS via SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.upsert_staff_tracking(
    p_id uuid,
    p_lat numeric,
    p_lng numeric,
    p_battery integer DEFAULT 100,
    p_speed_kmh numeric DEFAULT 0,
    p_accuracy numeric DEFAULT 0,
    p_current_task text DEFAULT NULL,
    p_status text DEFAULT 'active',
    p_email text DEFAULT NULL,
    p_name text DEFAULT NULL,
    p_device_model text DEFAULT NULL,
    p_device_os text DEFAULT NULL,
    p_device_os_version text DEFAULT NULL
)
RETURNS boolean AS $$
DECLARE
  v_profile_id uuid;
BEGIN
  SELECT id INTO v_profile_id FROM public.profiles WHERE id = p_id;

  IF v_profile_id IS NULL AND p_email IS NOT NULL THEN
    SELECT id INTO v_profile_id FROM public.profiles WHERE email = p_email;
  END IF;

  IF v_profile_id IS NULL THEN
    INSERT INTO public.profiles (id, email, name, role)
    VALUES (
      p_id,
      COALESCE(p_email, p_id::text || '@pending.local'),
      COALESCE(p_name, 'Pending User'),
      'Employee'
    )
    ON CONFLICT (id) DO NOTHING
    RETURNING id INTO v_profile_id;

    IF v_profile_id IS NULL THEN
      SELECT id INTO v_profile_id FROM public.profiles WHERE id = p_id;
    END IF;
  END IF;

  INSERT INTO public.staff_tracking (user_id, lat, lng, battery, speed_kmh, accuracy, current_task, status, last_update, device_model, device_os, device_os_version)
  VALUES (v_profile_id, p_lat, p_lng, COALESCE(p_battery, 100), COALESCE(p_speed_kmh, 0), COALESCE(p_accuracy, 0), p_current_task, COALESCE(p_status, 'active'), now(), p_device_model, p_device_os, p_device_os_version)
  ON CONFLICT (user_id) DO UPDATE SET
    lat = EXCLUDED.lat,
    lng = EXCLUDED.lng,
    battery = EXCLUDED.battery,
    speed_kmh = EXCLUDED.speed_kmh,
    accuracy = EXCLUDED.accuracy,
    current_task = EXCLUDED.current_task,
    status = EXCLUDED.status,
    device_model = COALESCE(EXCLUDED.device_model, staff_tracking.device_model),
    device_os = COALESCE(EXCLUDED.device_os, staff_tracking.device_os),
    device_os_version = COALESCE(EXCLUDED.device_os_version, staff_tracking.device_os_version),
    last_update = now();

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.upsert_staff_tracking(uuid, numeric, numeric, integer, numeric, numeric, text, text, text, text, text, text, text)
TO postgres, anon, authenticated, service_role;

-- ============================================================
-- 5. TRIGGER FUNCTIONS
-- ============================================================

-- Handle new user from auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'Employee'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Update updated_at automatically
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ============================================================
-- 6. TRIGGERS
-- ============================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

DROP TRIGGER IF EXISTS update_branches_updated_at ON public.branches;
CREATE TRIGGER update_branches_updated_at BEFORE UPDATE ON public.branches FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_organisation_settings_updated_at ON public.organisation_settings;
CREATE TRIGGER update_organisation_settings_updated_at BEFORE UPDATE ON public.organisation_settings FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_leave_categories_updated_at ON public.leave_categories;
CREATE TRIGGER update_leave_categories_updated_at BEFORE UPDATE ON public.leave_categories FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_meetings_updated_at ON public.meetings;
CREATE TRIGGER update_meetings_updated_at BEFORE UPDATE ON public.meetings FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- ============================================================
-- 7. ACCESS CONTROL
-- ============================================================

ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaves DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.organisation_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.payslips DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_tracking DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_schedule DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_holidays DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.comp_off_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_participants DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_push_tokens DISABLE ROW LEVEL SECURITY;

GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO postgres, anon, authenticated, service_role;

-- ============================================================
-- 8. INITIAL DATA
-- ============================================================

INSERT INTO public.organisation_settings (id, company_name)
VALUES (1, 'Attendly Pro')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.branches (name, city, country)
VALUES ('Main Office', 'Mumbai', 'India')
ON CONFLICT DO NOTHING;

INSERT INTO public.leave_categories (name, annual_allowance, is_paid, is_active, sort_order)
VALUES
    ('Annual', 20, true, true, 1),
    ('Sick', 10, true, true, 2),
    ('Casual', 8, true, true, 3),
    ('Unpaid', 0, false, true, 4)
ON CONFLICT (name) DO UPDATE SET
    annual_allowance = EXCLUDED.annual_allowance,
    is_paid = EXCLUDED.is_paid,
    is_active = EXCLUDED.is_active,
    sort_order = EXCLUDED.sort_order;
