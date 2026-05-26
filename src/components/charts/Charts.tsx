import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const tooltipStyle = {
  background: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 12,
};

export function WeeklyTrendChart({ data = [] }: { data?: any[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="gPresent" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.66 0.16 155)" stopOpacity={0.4} />
            <stop offset="100%" stopColor="oklch(0.66 0.16 155)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.85 0.01 255 / 0.4)" vertical={false} />
        <XAxis dataKey="day" stroke="currentColor" fontSize={11} tickLine={false} axisLine={false} className="text-muted-foreground" />
        <YAxis stroke="currentColor" fontSize={11} tickLine={false} axisLine={false} className="text-muted-foreground" />
        <Tooltip contentStyle={tooltipStyle} />
        <Area type="monotone" dataKey="present" stroke="oklch(0.66 0.16 155)" strokeWidth={2.5} fill="url(#gPresent)" />
        <Line type="monotone" dataKey="late" stroke="oklch(0.78 0.15 80)" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="absent" stroke="oklch(0.62 0.22 25)" strokeWidth={2} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function MonthlyRateChart({ data = [] }: { data?: any[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.85 0.01 255 / 0.4)" vertical={false} />
        <XAxis dataKey="month" stroke="currentColor" fontSize={11} tickLine={false} axisLine={false} className="text-muted-foreground" />
        <YAxis domain={[0, 100]} stroke="currentColor" fontSize={11} tickLine={false} axisLine={false} className="text-muted-foreground" />
        <Tooltip contentStyle={tooltipStyle} />
        <Line type="monotone" dataKey="rate" stroke="oklch(0.55 0.18 260)" strokeWidth={3} dot={{ fill: "oklch(0.55 0.18 260)", r: 4 }} activeDot={{ r: 6 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function DepartmentBarChart({ data = [] }: { data?: any[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.85 0.01 255 / 0.4)" vertical={false} />
        <XAxis dataKey="dept" stroke="currentColor" fontSize={11} tickLine={false} axisLine={false} className="text-muted-foreground" />
        <YAxis domain={[0, 100]} stroke="currentColor" fontSize={11} tickLine={false} axisLine={false} className="text-muted-foreground" />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "oklch(0.5 0.02 260 / 0.08)" }} />
        <Bar dataKey="rate" fill="oklch(0.55 0.18 260)" radius={[8, 8, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
