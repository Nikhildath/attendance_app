import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";
import type { Session, User } from "@supabase/supabase-js";

export type ProfileRole = "Employee" | "Manager" | "Admin";
export type Profile = {
  id: string;
  email: string;
  name: string;
  role: ProfileRole;
  dept?: string;
  face_registered?: boolean;
  face_descriptor?: number[];
  password?: string;
  branch_id?: string | null;
  dob?: string | null;
  joining_date?: string | null;
  avatar_url?: string | null;
  biometric_registered?: boolean;
  biometric_credential_id?: string | null;
};

type AuthContextValue = {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  isAdmin?: boolean;
  isManager?: boolean;
  isDevMode?: boolean;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Session expires after 30 days
const SESSION_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;

async function fetchProfileById(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id,email,name,role,dept,face_registered,face_descriptor,branch_id,dob,joining_date,avatar_url,biometric_registered,biometric_credential_id")
    .eq("id", userId)
    .single();

  return { data: (data as Profile) ?? null, error };
}

async function fetchProfile(user: User | null) {
  if (!user) return null;

  const { data, error } = await fetchProfileById(user.id);

  if (error && !data) {
    // If profile doesn't exist, try to create it (though the trigger should handle this)
    const name = user.user_metadata?.full_name || user.email || "Unknown";
    const { data: inserted, error: insertError } = await supabase
      .from("profiles")
      .insert({
        id: user.id,
        email: user.email,
        name,
        role: "Employee",
        face_registered: false,
      })
      .select("id,email,name,role,dept,face_registered,face_descriptor,branch_id,dob,joining_date,avatar_url,biometric_registered,biometric_credential_id")
      .single();
    
    if (insertError) {
      console.error("Error creating profile:", insertError);
      return null;
    }
    return (inserted as Profile) ?? null;
  }

  return (data as Profile) ?? null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      // Safety timeout: Never let the app hang on loading for more than 3 seconds
      const timeoutId = setTimeout(() => {
        if (mounted) setLoading(false);
      }, 3000);

      try {
        // 1. Check manual session first, validate it hasn't expired
        const savedSession = localStorage.getItem("sb_custom_session");
        if (savedSession) {
          try {
            const parsed = JSON.parse(savedSession);
            if (parsed && parsed.profile && parsed.profile.id) {
              const { profile: p, timestamp } = parsed;
              // Check session expiry
              if (timestamp && Date.now() - timestamp < SESSION_EXPIRY_MS) {
                // Fetch latest profile from DB to ensure consistency
                const { data: latestProfile } = await fetchProfileById(p.id);
                if (mounted) {
                  setProfile(latestProfile || p);
                  setLoading(false);
                  clearTimeout(timeoutId);
                  return;
                }
              } else {
                // Session expired, remove it
                localStorage.removeItem("sb_custom_session");
              }
            } else {
              localStorage.removeItem("sb_custom_session");
            }
          } catch {
            localStorage.removeItem("sb_custom_session");
          }
        }

        // 2. Fallback to Supabase session
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user && mounted) {
          setUser(session.user);
          const fetchedProfile = await fetchProfile(session.user);
          if (mounted) setProfile(fetchedProfile);
        }
      } catch (err) {
        console.error("Auth initialization failed:", err);
      } finally {
        if (mounted) {
          setLoading(false);
          clearTimeout(timeoutId);
        }
      }
    };

    initAuth();

    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      
      // If we have a manual session, don't let Supabase Auth override it for nulls
      if (localStorage.getItem("sb_custom_session")) {
        if (event === 'SIGNED_OUT') {
           return;
        }
      }

      if (session?.user) {
        setUser(session.user);
        const p = await fetchProfile(session.user);
        if (mounted) setProfile(p);
      } else if (!localStorage.getItem("sb_custom_session")) {
        setUser(null);
        setProfile(null);
      }
      
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  const refreshProfile = async () => {
    const userId = profile?.id || user?.id;
    if (!userId) return;
    
    // Don't set loading=true here — causes full-page flashes on subtle refreshes
    let nextProfile: Profile | null = null;

    const { data: rpcData, error: rpcError } = await supabase.rpc('get_profile_by_id', { p_id: userId }).maybeSingle();
    if (!rpcError && rpcData) {
      nextProfile = rpcData as Profile;
    } else {
      const { data: directProfile } = await fetchProfileById(userId);
      nextProfile = directProfile;
    }

    if (nextProfile) {
      setProfile(nextProfile);
      if (localStorage.getItem("sb_custom_session")) {
        localStorage.setItem("sb_custom_session", JSON.stringify({
          profile: nextProfile,
          timestamp: Date.now(),
        }));
      }
    }
  };

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      signIn: async (email: string, password: string) => {
        setLoading(true);
        
        // Custom Login Logic: Use RPC to bypass RLS for non-authenticated users
        const { data: profileData, error: profileError } = await supabase
          .rpc('check_credentials', { p_email: email, p_password: password })
          .maybeSingle();

        if (!profileError && profileData) {
          const baseProfile = profileData as Profile;
          const { data: fullProfile } = await fetchProfileById(baseProfile.id);
          const resolvedProfile = fullProfile || baseProfile;
          setProfile(resolvedProfile);
          localStorage.setItem("sb_custom_session", JSON.stringify({
            profile: resolvedProfile,
            timestamp: Date.now(),
          }));
          setLoading(false);
          return;
        }

        // Fallback to Supabase Auth if custom check fails
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        
        if (error) {
          setLoading(false);
          throw new Error("Invalid login credentials. Please check your email and password.");
        }
      },
      signUp: async (email: string, password: string, fullName: string) => {
        setLoading(true);
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            },
          },
        });
        
        if (error) {
          setLoading(false);
          throw error;
        }

        // NOTE: Do NOT store plaintext password in profiles here.
        // The handle_new_user trigger creates the profile automatically.
        setLoading(false);
      },
      signOut: async () => {
        setLoading(true);
        localStorage.removeItem("sb_custom_session");
        await supabase.auth.signOut().catch(() => {});
        setUser(null);
        setProfile(null);
        setLoading(false);
      },
      refreshProfile,
      isAdmin: profile?.role?.toLowerCase() === "admin",
      isManager: profile?.role?.toLowerCase() === "manager",
    }),
    [user, profile, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
