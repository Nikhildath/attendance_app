-- Run this in your Supabase SQL Editor
-- Creates RPCs that bypass RLS for the socket server

-- RPC to lookup profile for socket auth (bypass RLS via SECURITY DEFINER)
CREATE OR REPLACE FUNCTION lookup_profile_for_auth(p_user_id UUID)
RETURNS TABLE (id UUID, name TEXT, email TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY SELECT p.id, p.name, p.email FROM profiles p WHERE p.id = p_user_id;
END;
$$;

-- RPC to upsert staff tracking (bypass RLS via SECURITY DEFINER)
CREATE OR REPLACE FUNCTION upsert_staff_tracking(
  p_user_id UUID,
  p_lat DECIMAL,
  p_lng DECIMAL,
  p_battery INTEGER,
  p_speed_kmh DECIMAL,
  p_accuracy DECIMAL,
  p_current_task TEXT,
  p_status TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO staff_tracking (user_id, lat, lng, battery, speed_kmh, accuracy, current_task, status, last_update)
  VALUES (p_user_id, p_lat, p_lng, p_battery, p_speed_kmh, p_accuracy, p_current_task, COALESCE(p_status, 'active'), NOW())
  ON CONFLICT (user_id)
  DO UPDATE SET
    lat = EXCLUDED.lat,
    lng = EXCLUDED.lng,
    battery = EXCLUDED.battery,
    speed_kmh = EXCLUDED.speed_kmh,
    accuracy = EXCLUDED.accuracy,
    current_task = EXCLUDED.current_task,
    status = COALESCE(EXCLUDED.status, staff_tracking.status),
    last_update = NOW();
END;
$$;
