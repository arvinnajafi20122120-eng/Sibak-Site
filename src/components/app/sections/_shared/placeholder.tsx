"use client";

import type { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * جای‌نگهدار عمومی سکشن‌ها — ایجنت‌های تسک ۲/۳/۴ محتوای این پوشه‌ها را
 * با پیاده‌سازی واقعی جایگزین می‌کنند.
 */
export function SectionPlaceholder({
  icon: Icon,
  title,
  description,
  hint,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  hint?: string;
}) {
  return (
    <section className="flex flex-col gap-6" aria-label={title}>
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="card-hover glass relative overflow-hidden rounded-3xl p-6 md:p-8"
      >
        <div
          className="pointer-events-none absolute -top-16 -left-16 size-48 rounded-full bg-primary/10 blur-3xl"
          aria-hidden
        />
        <div className="flex items-start gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Icon className="size-7" aria-hidden />
          </div>
          <div className="flex flex-col gap-1.5">
            <h1 className="text-2xl font-black md:text-3xl">{title}</h1>
            <p className="max-w-xl text-sm leading-7 text-muted-foreground">
              {description}
            </p>
            {hint && (
              <p className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-full bg-accent/60 px-3 py-1 text-xs font-semibold text-accent-foreground">
                {hint}
              </p>
            )}
          </div>
        </div>
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="glass card-hover rounded-2xl p-5"
            style={{ opacity: 1 - i * 0.09 }}
          >
            <Skeleton className="mb-4 size-10 rounded-xl" />
            <Skeleton className="mb-2 h-4 w-3/4" />
            <Skeleton className="mb-4 h-3 w-1/2" />
            <Skeleton className="h-2.5 w-full" />
            <Skeleton className={cn("mt-1.5 h-2.5", i % 2 ? "w-5/6" : "w-2/3")} />
          </div>
        ))}
      </div>
    </section>
  );
}
