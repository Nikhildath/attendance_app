import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function PageHeader({ title, subtitle, className, actions }: { title: string; subtitle?: string; className?: string; actions?: React.ReactNode }) {
  return (
    <div className={cn("relative z-10 mb-2 space-y-2", className)}>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-center justify-between gap-4"
      >
        <div className="flex items-center gap-4">
          <div className="h-10 w-2 bg-primary rounded-full shadow-glow" />
          <h1 className="text-4xl font-black italic uppercase leading-none tracking-tighter text-foreground md:text-5xl">
            {title}
          </h1>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </motion.div>
      {subtitle && (
        <motion.p
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="pl-6 text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground md:text-xs"
        >
          {subtitle}
        </motion.p>
      )}
    </div>
  );
}
