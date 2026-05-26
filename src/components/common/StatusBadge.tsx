import { cn } from "@/lib/utils";
import { statusMeta, type AttendanceStatus } from "@/lib/mock-data";

export function StatusBadge({ status, className }: { status: AttendanceStatus; className?: string }) {
  const m = statusMeta[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
        m.color,
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", m.dot)} />
      {m.label}
    </span>
  );
}

export function LeaveStatusBadge({ status }: { status: "Approved" | "Pending" | "Rejected" }) {
  const map = {
    Approved: "bg-success/15 text-success border-success/30",
    Pending: "bg-warning/20 text-warning border-warning/40",
    Rejected: "bg-destructive/15 text-destructive border-destructive/30",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium", map[status])}>
      {status}
    </span>
  );
}
