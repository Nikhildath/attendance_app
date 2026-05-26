import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown } from "lucide-react";

export function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  tone = "default",
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: { value: string; up: boolean };
  tone?: "default" | "success" | "destructive" | "warning" | "info";
}) {
  const toneMap = {
    default: "bg-primary/10 text-primary",
    success: "bg-success/15 text-success",
    destructive: "bg-destructive/15 text-destructive",
    warning: "bg-warning/20 text-warning",
    info: "bg-info/15 text-info",
  };
  return (
    <div className="group relative overflow-hidden rounded-[1.5rem] border border-border/50 bg-card/60 backdrop-blur-md p-4 md:p-6 shadow-sm transition-all duration-500 hover:-translate-y-1 hover:shadow-elegant hover:bg-card">
      {/* Background Decor */}
      <div className={cn("absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-[0.05] transition-opacity group-hover:opacity-[0.1] blur-xl", toneMap[tone].split(' ')[0])} />
      <div className={cn("absolute -left-12 -bottom-12 h-24 w-24 rounded-full opacity-[0.03] blur-2xl", toneMap[tone].split(' ')[0])} />
      
      <div className="flex items-start justify-between relative z-10">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/80">{label}</p>
          <p className="mt-1 md:mt-2 text-2xl md:text-4xl font-black tracking-tighter">{value}</p>
        </div>
        <div className={cn("flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-xl md:rounded-2xl shadow-sm transition-transform group-hover:scale-110", toneMap[tone])}>
          <Icon className="h-5 w-5 md:h-6 md:w-6" />
        </div>
      </div>
      {trend && (
        <div className="mt-4 flex items-center gap-1.5 text-xs relative z-10">
          <div className={cn("flex items-center gap-1 rounded-full px-2 py-0.5 font-bold", trend.up ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")}>
            {trend.up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            <span>{trend.value}</span>
          </div>
          <span className="font-medium text-muted-foreground/60">vs last period</span>
        </div>
      )}
    </div>
  );
}
