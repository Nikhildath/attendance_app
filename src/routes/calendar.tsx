import { useEffect, useState } from "react";
import { exportToCSV } from "@/lib/csv-utils";
import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/common/PageHeader";
import { MonthCalendar } from "@/components/calendar/MonthCalendar";
import { Download, Filter } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useSettings } from "@/lib/settings-context";
import { isWeekend } from "@/lib/utils";

export const Route = createFileRoute("/calendar")({
  head: () => ({
    meta: [
      { title: "Calendar — Attendly" },
      { name: "description", content: "Visual monthly calendar with color-coded attendance, leaves and holidays." },
    ],
  }),
  component: CalendarPage,
});

function CalendarPage() {
  const { profile } = useAuth();
  const { settings } = useSettings();
  const [holidays, setHolidays] = useState<{ date: string; localName: string }[]>([]);
  const [stats, setStats] = useState({ present: 0, absent: 0, late: 0, leave: 0 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedUserId, setSelectedUserId] = useState<string | undefined>(undefined);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (profile?.role === "Admin") {
      supabase.from("profiles").select("id, name").then(({ data }) => {
        if (data) setUsers(data);
      });
    }
  }, [profile]);

  useEffect(() => {
    if (profile && !selectedUserId) {
        setSelectedUserId(profile.id);
    }
  }, [profile]);

  const today = new Date();
  const upcoming = holidays
    .filter((h) => new Date(h.date) >= new Date(today.getFullYear(), today.getMonth(), today.getDate()))
    .slice(0, 6);

  useEffect(() => {
    const targetId = selectedUserId || profile?.id;
    if (!targetId) return;

    async function loadStats() {
      setLoading(true);
      const start = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 1).toISOString();

      const { data: att } = await supabase
        .from("attendance")
        .select("status, check_in, created_at")
        .eq("user_id", targetId)
        .gte("created_at", start)
        .lt("created_at", end);

      const { data: lvs } = await supabase
        .from("leaves")
        .select("status, from_date, to_date")
        .eq("user_id", targetId)
        .eq("status", "Approved")
        .gte("from_date", start.split('T')[0])
        .lte("to_date", end.split('T')[0]);

      if (att) {
        const presentCount = att.filter(a => a.status === 'present').length;
        const lateCount = att.filter(a => a.status === 'late').length;
        const leaveCount = lvs?.length || 0;
        
        // Calculate absent days from attendance records (where status was explicitly set to absent if any)
        // plus inferred absent days from MonthCalendar logic (days with no record)
        const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
        const currentDay = today.getDate();
        
        let inferredAbsent = 0;
        for (let d = 1; d < currentDay; d++) {
          const date = new Date(today.getFullYear(), today.getMonth(), d);
          const dow = date.getDay();
          const hasRecord = att.some(a => new Date(a.check_in || a.created_at).getDate() === d);
          const hasLeave = lvs?.some(l => {
            const dayStr = date.toISOString().split('T')[0];
            return dayStr >= l.from_date && dayStr <= l.to_date;
          });
          
          if (!hasRecord && !hasLeave && !isWeekend(date, settings?.weekend_type)) {
             inferredAbsent++;
          }
        }

        setStats({
          present: presentCount,
          absent: inferredAbsent + att.filter(a => a.status === 'absent').length,
          late: lateCount,
          leave: leaveCount
        });
      }
      setLoading(false);
    }
    loadStats();
  }, [profile, selectedUserId]);

  const handleExport = () => {
    const data = [
      { Category: "Present", Days: stats.present },
      { Category: "Absent", Days: stats.absent },
      { Category: "Late", Days: stats.late },
      { Category: "On Leave", Days: stats.leave },
      { Category: "Holidays", Days: holidays.filter(h => new Date(h.date).getMonth() === today.getMonth()).length },
    ];
    exportToCSV(data, "attendance_summary");
  };

  return (
    <div>
      <PageHeader
        title="Attendance Calendar"
        subtitle="Color-coded view of your attendance, leaves and public holidays"
        actions={
          <div className="flex flex-wrap items-center gap-3">
            {profile?.role === "Admin" && (
              <select 
                value={selectedUserId} 
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="h-10 rounded-xl border bg-card px-4 py-2 text-sm font-black uppercase tracking-widest shadow-sm focus:ring-2 ring-primary/20 transition-all"
              >
                <option value={profile.id}>My Calendar</option>
                {users.filter(u => u.id !== profile.id).map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            )}

            <select 
              value={statusFilter} 
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 rounded-xl border bg-card px-4 py-2 text-sm font-black uppercase tracking-widest shadow-sm focus:ring-2 ring-primary/20 transition-all"
            >
              <option value="all">All Status</option>
              <option value="present">Present</option>
              <option value="absent">Absent</option>
              <option value="late">Late</option>
              <option value="leave">On Leave</option>
              <option value="holiday">Holidays</option>
            </select>

            <button 
              onClick={handleExport}
              className="inline-flex h-10 items-center gap-2 rounded-xl gradient-primary px-4 py-2 text-sm font-black uppercase tracking-widest text-primary-foreground shadow-elegant transition-all active:scale-95"
            >
              <Download className="h-4 w-4" /> Export
            </button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <MonthCalendar 
          onHolidaysChange={setHolidays} 
          userId={selectedUserId}
          statusFilter={statusFilter}
        />

        <aside className="space-y-4">
          <div className="rounded-xl border bg-card p-5 shadow-card">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">This Month</h3>
            <div className="mt-4 space-y-4">
              <Row dotClass="bg-success" label="Present" value={`${stats.present} days`} />
              <Row dotClass="bg-destructive" label="Absent" value={`${stats.absent} days`} />
              <Row dotClass="bg-warning" label="Late" value={`${stats.late} days`} />
              <Row dotClass="bg-info" label="On Leave" value={`${stats.leave} days`} />
              <Row dotClass="bg-holiday" label="Holidays" value={`${holidays.filter(h => new Date(h.date).getMonth() === today.getMonth()).length} this month`} />
            </div>
          </div>

          <div className="rounded-xl border bg-card p-5 shadow-card">
            <h3 className="text-sm font-semibold">Upcoming Holidays</h3>
            <p className="text-[11px] text-muted-foreground">Live from Google Calendar</p>
            {upcoming.length === 0 ? (
              <p className="mt-4 text-xs text-muted-foreground">No upcoming holidays found.</p>
            ) : (
              <ul className="mt-4 space-y-3 text-sm">
                {upcoming.map((h) => {
                  const d = new Date(h.date);
                  const month = d.toLocaleString("en-US", { month: "short" });
                  return (
                    <li key={h.date} className="flex items-center gap-3 rounded-lg border bg-background/40 p-3">
                      <div className="flex h-10 w-10 flex-col items-center justify-center rounded-lg bg-holiday/15 text-holiday">
                        <span className="text-[10px] uppercase">{month}</span>
                        <span className="text-sm font-bold leading-none">{d.getDate()}</span>
                      </div>
                      <span className="text-sm font-medium">{h.localName}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Row({ dotClass, label, value }: { dotClass: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-muted-foreground">
        <span className={`h-2 w-2 rounded-full ${dotClass}`} />
        {label}
      </span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
