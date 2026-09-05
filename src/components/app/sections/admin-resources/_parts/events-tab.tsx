"use client";

import { ArchiveRestore, Database, Eraser, Save, Settings, TriangleAlert, UserRound } from "lucide-react";

import { relativeTime } from "@/lib/jalali";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/app/sections/_shared/empty-state";
import { Badge } from "@/components/ui/badge";
import type { RgEventDTO } from "@/lib/rg-types";

/**
 * رویدادهای نگهبان منابع — هشدار مصرف، رد آپلود، پاک‌سازی، بکاپ/بازگردانی.
 */

const TYPE_ICONS: Record<string, typeof Database> = {
  QUOTA_DENIED: TriangleAlert,
  USER_WARNING: UserRound,
  GLOBAL_WARNING: TriangleAlert,
  DB_WARNING: Database,
  CLEANUP: Eraser,
  BACKUP: Save,
  RESTORE: ArchiveRestore,
  CONFIG: Settings,
};

function levelClasses(level: string): string {
  switch (level) {
    case "CRITICAL":
      return "bg-destructive/15 text-destructive border-destructive/40";
    case "WARNING":
      return "bg-chart-2/15 text-accent-foreground border-chart-2/40";
    default:
      return "bg-secondary text-secondary-foreground border-border";
  }
}

const LEVEL_LABELS: Record<string, string> = {
  CRITICAL: "بحرانی",
  WARNING: "هشدار",
  INFO: "اطلاع",
};

export function EventsTab({ events }: { events: RgEventDTO[] }) {
  if (events.length === 0) {
    return (
      <EmptyState
        icon={Database}
        title="هنوز رویدادی ثبت نشده"
        description="وقتی مصرف از آستانه بگذرد یا آپلودی رد شود، این‌جا می‌بینید."
      />
    );
  }

  return (
    <div className="glass rounded-3xl p-5">
      <ul className="flex max-h-[520px] flex-col gap-2 overflow-y-auto rg-scroll pe-1">
        {events.map((e) => {
          const Icon = TYPE_ICONS[e.type] ?? Database;
          return (
            <li key={e.id} className="flex items-start gap-3 rounded-2xl border border-border/60 p-3">
              <div
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-xl border",
                  levelClasses(e.level),
                )}
              >
                <Icon className="size-4" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold">{e.message}</span>
                  <Badge className={cn("h-5 border text-[0.65rem]", levelClasses(e.level))}>
                    {LEVEL_LABELS[e.level] ?? e.level}
                  </Badge>
                </div>
                <p className="mt-1 text-[0.7rem] text-muted-foreground">{relativeTime(new Date(e.createdAt))}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
