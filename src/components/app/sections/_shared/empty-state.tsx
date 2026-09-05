"use client";

import type { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";

/**
 * حالت خالی زیبا با آیکون و CTA اختیاری.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="glass flex flex-col items-center gap-3 rounded-3xl p-10 text-center"
    >
      <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="size-8" aria-hidden />
      </div>
      <p className="text-lg font-bold">{title}</p>
      {description && (
        <p className="max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </motion.div>
  );
}
