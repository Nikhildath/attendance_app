import { useState, useEffect } from "react";
import { Plus, Trash2, Download, Globe, PartyPopper, Calendar as CalendarIcon, MapPin, AlertTriangle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { GOOGLE_CALENDAR_API_KEY } from "@/lib/config";

type Holiday = {
  id: string;
  name: string;
  date: string;
  kind: "public" | "restricted" | "optional";
  branch_id: string | null;
  region: string;
};

type Suggestion = {
  name: string;
  date: string;
  selected: boolean;
};

const GOOGLE_CALENDAR_IDS: Record<string, string> = {
  "IN": "en.indian#holiday@group.v.calendar.google.com",
  "US": "en.usa#holiday@group.v.calendar.google.com",
  "GB": "en.uk#holiday@group.v.calendar.google.com",
  "DE": "en.german#holiday@group.v.calendar.google.com",
  "FR": "en.french#holiday@group.v.calendar.google.com",
  "CA": "en.canadian#holiday@group.v.calendar.google.com",
  "AU": "en.australian#holiday@group.v.calendar.google.com",
  "JP": "en.japanese#holiday@group.v.calendar.google.com",
  "BR": "en.brazilian#holiday@group.v.calendar.google.com",
  "ES": "en.spanish#holiday@group.v.calendar.google.com",
};

export function HolidayManager({ branches }: { branches: any[] }) {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(false);
  const [countryCode, setCountryCode] = useState("IN");
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1); // 1-indexed
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [fetchingApi, setFetchingApi] = useState(false);

  const [newH, setNewH] = useState<Partial<Holiday>>({
    name: "",
    date: new Date().toISOString().split("T")[0],
    kind: "public",
    branch_id: null,
    region: "All",
  });

  const loadHolidays = async () => {
    setLoading(true);
    const { data } = await supabase.from("company_holidays").select("*").order("date");
    if (data) setHolidays(data);
    setLoading(false);
  };

  useEffect(() => { loadHolidays(); }, []);

  const addManual = async (e: React.FormEvent) => {
    e.preventDefault();
    const branch = branches.find((b) => b.id === newH.branch_id);
    const { error } = await supabase.from("company_holidays").insert([{
      ...newH,
      region: branch ? `${branch.city}, ${branch.country}` : "Global",
    }]);
    if (!error) {
      toast.success("Holiday added");
      setNewH({ name: "", date: new Date().toISOString().split("T")[0], kind: "public", branch_id: null, region: "All" });
      loadHolidays();
    } else toast.error(error.message);
  };

  const deleteH = async (id: string) => {
    const { error } = await supabase.from("company_holidays").delete().eq("id", id);
    if (!error) {
      toast.success("Deleted");
      setHolidays((h) => h.filter((x) => x.id !== id));
    }
  };

  // Fetch from Google Calendar and show as suggestions (admin picks which to add)
  const fetchSuggestions = async () => {
    if (!GOOGLE_CALENDAR_API_KEY) return toast.error("Google Calendar API key missing. Check GOOGLE_CALENDAR_API_KEY in src/lib/config.ts.");
    const apiKey = GOOGLE_CALENDAR_API_KEY;
    if (!countryCode || countryCode.length !== 2) return toast.error("Enter a valid 2-letter country code.");

    const calendarId = GOOGLE_CALENDAR_IDS[countryCode] || GOOGLE_CALENDAR_IDS["IN"];
    setFetchingApi(true);
    setSuggestions([]);

    try {
      // Fetch only for the selected month
      const timeMin = new Date(year, month - 1, 1).toISOString();
      const timeMax = new Date(year, month, 0, 23, 59, 59).toISOString(); // Last day of month

      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?key=${apiKey}&timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true`
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || `API Error: ${res.status}`);
      }

      const data = await res.json();
      if (!data.items || data.items.length === 0) {
        toast.info("No holidays found for this month/country.");
        return;
      }

      // Mark already-added ones as unselected by default
      const { data: existing } = await supabase.from("company_holidays").select("date, name");
      const mapped: Suggestion[] = data.items.map((item: any) => {
        const date = item.start.date || item.start.dateTime?.split("T")[0];
        const alreadyExists = existing?.some((e) => e.date === date && e.name === item.summary);
        return { name: item.summary, date, selected: !alreadyExists };
      });

      setSuggestions(mapped);
      toast.success(`Found ${mapped.length} holidays — review and confirm below.`);
    } catch (err: any) {
      toast.error(err.message || "Failed to fetch holidays");
    } finally {
      setFetchingApi(false);
    }
  };

  const confirmSuggestions = async () => {
    const toAdd = suggestions.filter((s) => s.selected);
    if (toAdd.length === 0) return toast.info("No holidays selected.");

    const { error } = await supabase.from("company_holidays").insert(
      toAdd.map((s) => ({
        name: s.name,
        date: s.date,
        kind: "public",
        region: countryCode === "IN" ? "India" : countryCode,
        branch_id: null,
      }))
    );

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`${toAdd.length} holiday(s) added to company calendar.`);
      setSuggestions([]);
      loadHolidays();
    }
  };

  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  return (
    <div className="space-y-6">
      {/* Shift Priority Notice */}
      <div className="flex items-start gap-3 rounded-xl border border-info/30 bg-info/5 p-4 text-sm">
        <AlertTriangle className="h-4 w-4 shrink-0 text-info mt-0.5" />
        <div>
          <div className="font-semibold text-foreground">Shift-Based Holiday Priority</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Holidays here are reference dates only. Attendance is always determined by each employee's shift.
            If a shift has <strong>Work on Holidays</strong> enabled, the employee is expected to work — they will be marked <strong>absent</strong> if they don't check in, not holiday.
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Manual Add */}
        <div className="rounded-xl border bg-card p-5 shadow-card">
          <h3 className="mb-4 flex items-center gap-2 font-semibold"><Plus className="h-4 w-4" /> Add Holiday Manually</h3>
          <form onSubmit={addManual} className="space-y-3">
            <div className="space-y-1">
              <Label className="text-[10px] uppercase">Holiday Name</Label>
              <Input value={newH.name} onChange={(e) => setNewH({ ...newH, name: e.target.value })} required placeholder="e.g. Diwali, Independence Day" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] uppercase">Date</Label>
                <Input type="date" value={newH.date} onChange={(e) => setNewH({ ...newH, date: e.target.value })} required />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase">Type</Label>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={newH.kind}
                  onChange={(e) => setNewH({ ...newH, kind: e.target.value as any })}
                >
                  <option value="public">Public</option>
                  <option value="restricted">Restricted</option>
                  <option value="optional">Optional</option>
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase">Apply to Branch</Label>
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={newH.branch_id || ""}
                onChange={(e) => setNewH({ ...newH, branch_id: e.target.value || null })}
              >
                <option value="">Global (All Branches)</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.city})</option>)}
              </select>
            </div>
            <Button type="submit" className="w-full mt-2">Add Holiday</Button>
          </form>
        </div>

        {/* Google Calendar Suggestion Tool */}
        <div className="rounded-xl border bg-card p-5 shadow-card">
          <h3 className="mb-1 flex items-center gap-2 font-semibold"><Globe className="h-4 w-4" /> Suggest from Google Calendar</h3>
          <p className="text-[11px] text-muted-foreground mb-4">
            Fetch public holidays for a country &amp; month. <strong>You review and confirm</strong> which ones to add — nothing is added automatically.
          </p>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-[10px] uppercase">Country</Label>
                <Input value={countryCode} onChange={(e) => setCountryCode(e.target.value.toUpperCase())} placeholder="IN, US…" maxLength={2} />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase">Month</Label>
                <select className="h-10 w-full rounded-md border bg-background px-2 text-sm" value={month} onChange={(e) => setMonth(parseInt(e.target.value))}>
                  {monthNames.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase">Year</Label>
                <Input type="number" value={year} onChange={(e) => setYear(parseInt(e.target.value))} />
              </div>
            </div>
            <Button variant="outline" className="w-full gap-2" onClick={fetchSuggestions} disabled={fetchingApi}>
              <Download className="h-4 w-4" />
              {fetchingApi ? "Fetching…" : "Fetch Suggestions"}
            </Button>
          </div>

          {/* Suggestions list for admin to review */}
          {suggestions.length > 0 && (
            <div className="mt-4 space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Review &amp; select holidays to add
              </div>
              <div className="max-h-52 overflow-y-auto space-y-1 rounded-lg border bg-muted/20 p-2">
                {suggestions.map((s, i) => (
                  <label key={i} className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-xs transition-colors",
                    s.selected ? "border-primary/40 bg-primary/5" : "border-border/50 opacity-60"
                  )}>
                    <input
                      type="checkbox"
                      checked={s.selected}
                      onChange={() => setSuggestions((prev) => prev.map((x, j) => j === i ? { ...x, selected: !x.selected } : x))}
                      className="accent-primary"
                    />
                    <span className="font-mono text-muted-foreground w-20 shrink-0">{s.date}</span>
                    <span className="font-medium flex-1">{s.name}</span>
                  </label>
                ))}
              </div>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={confirmSuggestions}>
                  Add {suggestions.filter((s) => s.selected).length} Selected
                </Button>
                <Button variant="outline" onClick={() => setSuggestions([])}>Cancel</Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Holiday List */}
      <div className="rounded-xl border bg-card shadow-card overflow-hidden">
        <div className="border-b p-4 flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2"><CalendarIcon className="h-4 w-4" /> Company Holiday Calendar</h3>
          <span className="text-xs text-muted-foreground">{holidays.length} holidays configured</span>
        </div>
        {loading ? (
          <div className="py-10 text-center text-xs text-muted-foreground">Loading…</div>
        ) : holidays.length === 0 ? (
          <div className="py-10 text-center text-xs text-muted-foreground">No holidays added yet.</div>
        ) : (
          <div className="max-h-[400px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground sticky top-0">
                <tr>
                  <th className="px-5 py-3">Holiday</th>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Scope</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {holidays.map((h) => (
                  <tr key={h.id} className="border-t hover:bg-accent/30">
                    <td className="px-5 py-3 flex items-center gap-2 font-medium">
                      <PartyPopper className="h-3 w-3 text-holiday" /> {h.name}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{h.date}</td>
                    <td className="px-5 py-3">
                      <span className="flex items-center gap-1.5">
                        {h.branch_id ? <MapPin className="h-3 w-3 text-primary" /> : <Globe className="h-3 w-3 text-muted-foreground" />}
                        {h.region}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-[10px] font-bold uppercase">{h.kind}</span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteH(h.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
