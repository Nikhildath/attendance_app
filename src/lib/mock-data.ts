export type AttendanceStatus = "present" | "absent" | "late" | "leave" | "holiday" | "weekend" | "none";

export const statusMeta: Record<AttendanceStatus, { label: string; color: string; dot: string }> = {
  present: { label: "Present", color: "bg-success/15 text-success border-success/30", dot: "bg-success" },
  absent: { label: "Absent", color: "bg-destructive/15 text-destructive border-destructive/30", dot: "bg-destructive" },
  late: { label: "Late", color: "bg-warning/20 text-warning border-warning/40", dot: "bg-warning" },
  leave: { label: "On Leave", color: "bg-info/15 text-info border-info/30", dot: "bg-info" },
  holiday: { label: "Holiday", color: "bg-holiday/15 text-holiday border-holiday/30", dot: "bg-holiday" },
  weekend: { label: "Weekend", color: "bg-muted text-muted-foreground border-border", dot: "bg-muted-foreground" },
  none: { label: "—", color: "bg-muted text-muted-foreground", dot: "bg-muted" },
};

// Types for system consistency
export type ShiftType = "fixed" | "rotational" | "open";
export type LeaveRequest = {
  id: string;
  type: string;
  from: string;
  to: string;
  days: number;
  half: boolean;
  status: "Approved" | "Pending" | "Rejected";
  reason: string;
};
