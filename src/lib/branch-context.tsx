import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from "react";
import { supabase } from "./supabase";
import { useAuth } from "./auth";

export type Branch = {
  id: string;
  name: string;
  city: string;
  country: string;
  lat?: number;
  lng?: number;
  radius_meters?: number;
  employees_count?: number;
  active_staff_count?: number;
  total_staff_count?: number;
  currency?: string;
  timezone?: string;
};

type BranchCtx = {
  current: Branch | null;
  setCurrent: (id: string) => void;
  all: Branch[];
  loading: boolean;
  refresh: () => Promise<void>;
};

const Ctx = createContext<BranchCtx | null>(null);

export function BranchProvider({ children }: { children: ReactNode }) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<any>(null);
  const { profile } = useAuth();

  const loadBranches = async (userBranchId?: string | null) => {
    const [{ data: branchData, error }, { data: directProfiles }, { data: tracking }] = await Promise.all([
      supabase
        .from("branches")
        .select("*")
        .order("name"),
      supabase
        .from("profiles")
        .select("id, branch_id"),
      supabase
        .from("staff_tracking")
        .select("user_id, status, last_update"),
    ]);

    let profiles = directProfiles || [];

    if ((profiles.length === 0 || !profiles.some((item) => item.id === profile?.id)) && profile?.id) {
      if (profile.role === "Admin") {
        const { data: adminProfiles } = await supabase.rpc("admin_list_users", { caller_id: profile.id });
        if (adminProfiles?.length) {
          profiles = adminProfiles.map((item: any) => ({
            id: item.id,
            branch_id: item.branch_id ?? null,
          }));
        }
      }

      if (!profiles.some((item) => item.id === profile.id)) {
        profiles = [
          ...profiles,
          {
            id: profile.id,
            branch_id: profile.branch_id ?? null,
          },
        ];
      }
    }
    
    if (!error && branchData) {
      const activeUserIds = new Set(
        (tracking || [])
          .filter((item) => {
            if (!item?.last_update) return false;
            const ageMs = Date.now() - new Date(item.last_update).getTime();
            return ageMs <= 90_000 && item.status !== "offline";
          })
          .map((item) => item.user_id)
      );

      const totalByBranch = new Map<string, number>();
      const activeByBranch = new Map<string, number>();

      (profiles || []).forEach((item) => {
        if (!item.branch_id) return;
        totalByBranch.set(item.branch_id, (totalByBranch.get(item.branch_id) || 0) + 1);
        if (activeUserIds.has(item.id)) {
          activeByBranch.set(item.branch_id, (activeByBranch.get(item.branch_id) || 0) + 1);
        }
      });

      const enrichedBranches = branchData.map((branch) => ({
        ...branch,
        total_staff_count: totalByBranch.get(branch.id) || 0,
        active_staff_count: activeByBranch.get(branch.id) || 0,
      }));

      setBranches(enrichedBranches);
      if (userBranchId) {
        setCurrentId(userBranchId);
      } else if (enrichedBranches.length > 0 && !currentId) {
        setCurrentId(enrichedBranches[0].id);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    let isMounted = true;
    
    const setupBranches = async () => {
      if (!isMounted) return;
      await loadBranches(profile?.branch_id);
    };

    setupBranches();

    return () => {
      isMounted = false;
    };
  }, [profile?.id]);

  // Separate effect for realtime subscription
  useEffect(() => {
    if (!profile?.id) return;

    // Clean up old channel first
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    // Create new subscription
    const channel = supabase
      .channel('branches_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'branches' },
        () => loadBranches(profile?.branch_id)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => loadBranches(profile?.branch_id)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'staff_tracking' },
        () => loadBranches(profile?.branch_id)
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [profile?.id]);

  const current = branches.find((b) => b.id === currentId) || null;

  return (
    <Ctx.Provider value={{ current, setCurrent: setCurrentId, all: branches, loading, refresh: loadBranches }}>
      {children}
    </Ctx.Provider>
  );
}

export function useBranch() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useBranch must be used inside BranchProvider");
  return ctx;
}
