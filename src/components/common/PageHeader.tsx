import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function PageHeader({ title, subtitle, className, actions }: { title: string; subtitle?: string; className?: string; actions?: React.ReactNode }) {
  return (
    <div className={cn("relative z-10 space-y-2 mb-2", className)}>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between gap-4 flex-wrap"
      >
        <div className="flex items-center gap-4">
          <div className="h-10 w-2 bg-primary rounded-full shadow-glow" />
          <h1 className="text-4xl md:text-5xl font-black italic uppercase tracking-tighter text-white leading-none">
            {title}
          </h1>
        </div>
        {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
      </motion.div>
      {subtitle && (
        <motion.p
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="text-[10px] md:text-xs font-black uppercase tracking-[0.4em] text-white/30 pl-6"
        >
          {subtitle}
        </motion.p>
      )}
    </div>
  );
}
