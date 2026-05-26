import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { supabase } from "./supabase";

export type OrganisationSettings = {
  company_name: string;
  logo_url?: string;
  default_currency: string;
  timezone: string;
  late_threshold_mins: number;
  working_hours_per_day: number;
  fiscal_year_start: string;
  late_fine_amount: number;
  overtime_rate: number;
  weekend_type?: string;
};

type SettingsCtx = {
  settings: OrganisationSettings | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

const Ctx = createContext<SettingsCtx | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<OrganisationSettings | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data, error } = await supabase
      .from("organisation_settings")
      .select("*")
      .eq("id", 1)
      .single();
    
    if (!error && data) {
      setSettings(data as OrganisationSettings);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <Ctx.Provider value={{ settings, loading, refresh: load }}>
      {children}
    </Ctx.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSettings must be used inside SettingsProvider");
  return ctx;
}
