-- Cleanup script to remove face recognition and biometric related columns and functions
-- This transitions the app to webpunch only.

-- 1. Remove columns from profiles
ALTER TABLE public.profiles DROP COLUMN IF EXISTS face_registered;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS face_descriptor;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS biometric_registered;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS biometric_credential_id;

-- 2. Drop functions related to face recognition
DROP FUNCTION IF EXISTS public.update_own_face(uuid, jsonb);
DROP FUNCTION IF EXISTS public.check_credentials(text, text);

-- 3. Recreate check_credentials without biometric fields (if still needed, though we use Supabase Auth)
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

-- 4. Update admin_update_profile to remove face parameter
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

-- 5. Update handle_new_user trigger function
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
