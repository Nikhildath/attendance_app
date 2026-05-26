import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn, isWeekend } from "@/lib/utils";
import { statusMeta, type AttendanceStatus } from "@/lib/mock-data";
import { holidayOnDate, type CompanyHoliday } from "@/lib/holidays";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useSettings } from "@/lib/settings-context";
import { useBranch } from "@/lib/branch-context";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const dotMap: Record<AttendanceStatus, string> = {
  present: "bg-success",
  absent:  "bg-destructive",
  late:    "bg-warning",
  leave:   "bg-info",
  holiday: "bg-holiday",
  weekend: "bg-transparent",
  none:    "bg-transparent",
};

const cellTone: Record<AttendanceStatus, string> = {
  present: "border-success/40 bg-success/20 hover:border-success/60 hover:bg-success/25",
  absent:  "border-destructive/40 bg-destructive/20 hover:border-destructive/60 hover:bg-destructive/25",
  late:    "border-warning/40 bg-warning/25 hover:border-warning/60 hover:bg-warning/30",
  leave:   "border-info/40 bg-info/20 hover:border-info/60 hover:bg-info/25",
  holiday: "border-holiday/40 bg-holiday/20 hover:border-holiday/60 hover:bg-holiday/25",
  weekend: "opacity-60 bg-muted/30",
  none:    "opacity-50 hover:bg-muted/40",
};

export function MonthCalendar({
  compact = false,
  onHolidaysChange,
  userId,
  statusFilter = "all",
}: {
  compact?: boolean;
  onHolidaysChange?: (h: { date: string; localName: string }[]) => void;
  userId?: string;
  statusFilter?: string;
}) {
  const { profile } = useAuth();
  const { settings } = useSettings();
  const { current: branch } = useBranch();
  const [today, setToday] = useState<Date | null>(null);
  const [cursor, setCursor] = useState({ y: 2025, m: 3 });
  const [attendanceData, setAttendanceData] = useState<Record<number, { status: AttendanceStatus; checkIn?: string; checkOut?: string; note?: string }>>({});
  const [holidays, setHolidays] = useState<CompanyHoliday[]>([]);

  useEffect(() => {
    const t = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    setToday(t);
    setCursor({ y: t.getFullYear(), m: t.getMonth() });
  }, []);

  // Load company holidays from Supabase (shift-based, not from Google Calendar)
  useEffect(() => {
    async function loadHolidays() {
      let q = supabase.from("company_holidays").select("*");
      if (branch?.id) {
        q = q.or(`branch_id.is.null,branch_id.eq.${branch.id}`);
      } else {
        q = q.is("branch_id", null);
      }
      const { data } = await q.order("date");
      if (data) {
        setHolidays(data as CompanyHoliday[]);
        if (onHolidaysChange) {
          onHolidaysChange(data.map((h) => ({ date: h.date, localName: h.name })));
        }
      }
    }
    loadHolidays();
  }, [branch?.id, cursor.y]);

  useEffect(() => {
    async function load() {
      const targetId = userId || profile?.id;
      if (!targetId) return;

      const start = new Date(cursor.y, cursor.m, 1).toISOString();
      const end   = new Date(cursor.y, cursor.m + 1, 1).toISOString();

      const { data } = await supabase
        .from("attendance")
        .select("*")
        .eq("user_id", targetId)
        .gte("check_in", start)
        .lt("check_in", end);

      const { data: shifts }   = await supabase.from("shifts").select("*");
      const { data: userSched } = await supabase
        .from("shift_schedule")
        .select("*")
        .eq("user_id", targetId)
        .maybeSingle();

      const map: Record<number, { status: AttendanceStatus; checkIn?: string; checkOut?: string; note?: string }> = {};

      // 1. Initialise all days as absent/none/weekend
      const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
      for (let d = 1; d <= daysInMonth; d++) {
        const dateObj = new Date(cursor.y, cursor.m, d);
        if (isWeekend(dateObj, settings?.weekend_type)) {
          const dow = dateObj.getDay();
          const isSun = dow === 0;
          const isSecondSat = settings?.weekend_type === "second_saturday_sundays" && dow === 6 && d >= 8 && d <= 14;
          map[d] = {
            status: (isSun || isSecondSat) ? "holiday" : "weekend",
            note: isSun ? "Sunday" : isSecondSat ? "2nd Saturday" : "Weekend",
          };
        } else {
          const isPast = today && dateObj < today;
          map[d] = { status: isPast ? "absent" : "none" };
        }
      }

      // 2. Overwrite with Company Holidays — SHIFT HAS PRIORITY
      // If the employee's shift has work_on_holidays=true, it stays as a normal working day
      holidays.forEach((h) => {
        const hDate = new Date(h.date);
        if (hDate.getMonth() !== cursor.m || hDate.getFullYear() !== cursor.y) return;

        const d = hDate.getDate();
        const dow = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][hDate.getDay()];
        const shiftId = userSched ? (userSched as any)[dow] : null;
        const shift = shifts?.find((s) => s.id === shiftId);

        if (shift?.work_on_holidays) {
          // Shift requires working on holidays → treat as normal workday
          if (map[d].status === "holiday" || map[d].status === "weekend") {
            map[d] = { status: today && hDate < today ? "absent" : "none", note: h.name };
          }
        } else {
          // No work on holidays → mark as holiday off-day
          map[d] = { status: "holiday", note: h.name };
        }
      });

      // 3. Overwrite with actual Attendance records
      if (data) {
        data.forEach((rec) => {
          const rawStatus = (rec.status || "present").toLowerCase();
          // Normalize to AttendanceStatus type
          const status = (rawStatus === "present" || rawStatus === "absent" || rawStatus === "late" || rawStatus === "leave") 
            ? rawStatus as AttendanceStatus 
            : "present";

          const recDate = new Date((rec as any).check_in || (rec as any).created_at);
          const day = recDate.getDate();
          map[day] = {
            status,
            checkIn:  (rec as any).check_in  ? new Date((rec as any).check_in).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : undefined,
            checkOut: (rec as any).check_out ? new Date((rec as any).check_out).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : undefined,
            note: (rec as any).notes,
          };
        });
      }

      // 4. Overwrite with Approved Leaves
      // Use overlap query: fetch any leave whose range intersects with this month
      const monthStart = start.split("T")[0]; // "YYYY-MM-DD"
      const monthEnd   = new Date(cursor.y, cursor.m + 1, 0).toISOString().split("T")[0]; // last day of month

      const { data: leaves } = await supabase
        .from("leaves")
        .select("*")
        .eq("user_id", targetId)
        .eq("status", "Approved")
        .lte("from_date", monthEnd)   // leave starts on or before month end
        .gte("to_date",   monthStart); // leave ends on or after month start

      if (leaves) {
        leaves.forEach((lv) => {
          for (let d = 1; d <= daysInMonth; d++) {
            // Use ISO string comparison to avoid timezone issues (Date("YYYY-MM-DD") parses as UTC)
            const dayStr = `${cursor.y}-${String(cursor.m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
            if (dayStr >= lv.from_date && dayStr <= lv.to_date) {
              if (map[d]?.status === "none" || map[d]?.status === "absent" || map[d]?.status === "holiday") {
                map[d] = { status: "leave", note: `Leave: ${lv.reason || lv.category || "Approved Leave"}` };
              }
            }
          }
        });
      }

      setAttendanceData(map);
    }
    load();
  }, [cursor, profile, holidays, userId, today]);

  const firstDow = new Date(cursor.y, cursor.m, 1).getDay();
  const days     = new Date(cursor.y, cursor.m + 1, 0).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const move = (delta: number) => {
    const m = cursor.m + delta;
    const y = cursor.y + Math.floor(m / 12);
    setCursor({ y, m: ((m % 12) + 12) % 12 });
  };

  return (
    <div className="bg-transparent">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className={cn("font-bold tracking-tight", compact ? "text-base" : "text-xl")}>
            {MONTHS[cursor.m]} {cursor.y}
          </h2>
          {!compact && <p className="text-xs text-muted-foreground">Hover any day for details</p>}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => move(-1)} className="rounded-lg border p-2 transition-colors hover:bg-accent">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => today && setCursor({ y: today.getFullYear(), m: today.getMonth() })}
            className="rounded-lg border px-3 py-2 text-xs font-medium transition-colors hover:bg-accent"
          >
            Today
          </button>
          <button onClick={() => move(1)} className="rounded-lg border p-2 transition-colors hover:bg-accent">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {DOW.map((d) => <div key={d} className="py-1">{d}</div>)}
      </div>

      <div className="mt-1 overflow-x-auto no-scrollbar pb-2">
        <div className="grid min-w-[320px] grid-cols-7 gap-1.5">
          {cells.map((d, i) => {
            if (d === null) return <div key={i} className={compact ? "aspect-square" : "h-20"} />;

            const baseInfo = attendanceData[d] || { status: "none" };
            const holiday  = holidayOnDate(holidays, cursor.y, cursor.m, d);

            // Holiday display: only show holiday colour if the base status didn't already
            // get overridden by actual attendance (present/late/leave)
            const info =
              holiday && baseInfo.status !== "leave" && baseInfo.status !== "present" && baseInfo.status !== "late"
                ? { ...baseInfo, status: "holiday" as AttendanceStatus, note: holiday.name }
                : baseInfo;

            const isToday =
              !!today &&
              cursor.y === today.getFullYear() &&
              cursor.m === today.getMonth() &&
              d === today.getDate();

            const meta = statusMeta[info.status];

            return (
              <div
                key={i}
                className={cn(
                  "group relative rounded-lg border bg-background/40 p-1.5 transition-all",
                  compact ? "aspect-square text-[11px]" : "h-20 text-xs",
                  cellTone[info.status],
                  isToday && "ring-2 ring-primary",
                  statusFilter !== "all" && info.status !== statusFilter && "opacity-20 grayscale-[0.5]"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className={cn("font-semibold", isToday && "text-primary")}>{d}</span>
                  {(statusFilter === "all" || info.status === statusFilter) && (
                    <span className={cn("h-1.5 w-1.5 rounded-full", dotMap[info.status])} />
                  )}
                </div>
                {!compact &&
                  info.status !== "weekend" &&
                  info.status !== "none" &&
                  (statusFilter === "all" || info.status === statusFilter) && (
                    <div className="mt-1 line-clamp-2 text-[10px] leading-tight text-muted-foreground">
                      {info.status === "holiday"
                        ? holiday?.name ?? "Holiday"
                        : info.status === "present" || info.status === "late"
                        ? info.checkIn
                        : meta.label}
                    </div>
                  )}
              </div>
            );
          })}
        </div>
      </div>

      {!compact && (
        <div className="mt-5 flex flex-wrap items-center gap-3 border-t pt-4 text-xs">
          {(["present", "absent", "late", "leave", "holiday"] as AttendanceStatus[]).map((s) => (
            <div key={s} className="flex items-center gap-1.5">
              <span className={cn("h-2 w-2 rounded-full", dotMap[s])} />
              <span className="text-muted-foreground">{statusMeta[s].label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
