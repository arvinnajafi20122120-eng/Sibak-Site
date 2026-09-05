"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Megaphone, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { cn } from "@/lib/utils";
import { api } from "@/lib/api-client";
import { useHashRoute } from "@/components/app/router";

import { Button } from "@/components/ui/button";

import type { Announcement, AnnouncementLevel } from "../../polls/_parts/types";

const BANNER_META: Record<
  AnnouncementLevel,
  { tint: string; text: string; icon: string }
> = {
  INFO: {
    tint: "bg-chart-1/10 border-chart-1/30 text-foreground",
    text: "text-foreground",
    icon: "text-chart-1",
  },
  SUCCESS: {
    tint: "bg-chart-1/15 border-chart-1/30 text-foreground",
    text: "text-foreground",
    icon: "text-chart-1",
  },
  WARNING: {
    tint: "bg-chart-2/15 border-chart-2/40 text-foreground",
    text: "text-foreground",
    icon: "text-chart-2",
  },
  URGENT: {
    tint: "bg-destructive/10 border-destructive/30 text-foreground",
    text: "text-foreground",
    icon: "text-destructive",
  },
};

const DISMISS_KEY = (id: string) => `sibak:banner-dismissed:${id}`;

/**
 * بنر بالای محتوای اصلی — آخرین پیام URGENT یا سنجاق‌شده (≤۱۴ روز).
 * ذخیره وضعیت dismissal در localStorage بر اساس شناسه پیام.
 */
export function SiteBanner() {
  const { navigate } = useHashRoute();
  const [dismissed, setDismissed] = useState(false);

  const { data } = useQuery({
    queryKey: ["site-banner"],
    queryFn: () =>
      api.get<{ announcement: Announcement | null }>("/api/announcements?banner=1"),
    select: (res) => res.announcement,
    // چک هر ۶۰ ثانیه برای گرفتن پیام جدید
    refetchInterval: 60_000,
  });

  const ann = data ?? null;

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!ann) {
      setDismissed(false);
      return;
    }
    setDismissed(typeof window !== "undefined" && !!localStorage.getItem(DISMISS_KEY(ann.id)));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [ann?.id, ann]);

  if (!ann || dismissed) return null;

  const meta = BANNER_META[ann.level as AnnouncementLevel] ?? BANNER_META.INFO;

  return (
    <AnimatePresence>
      <motion.div
        key={ann.id}
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        className={cn(
          "mb-4 flex items-center gap-3 overflow-hidden rounded-2xl border px-3 py-2",
          meta.tint,
        )}
      >
        <Megaphone className={cn("size-5 shrink-0", meta.icon)} aria-hidden />
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className={cn("line-clamp-1 text-xs font-bold sm:text-sm", meta.text)}>
            {ann.title}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1 rounded-lg px-2.5 py-1 text-xs font-bold"
            onClick={() => navigate("announcements")}
          >
            مشاهده
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 rounded-lg text-muted-foreground hover:bg-secondary"
            onClick={() => {
              if (typeof window !== "undefined") {
                localStorage.setItem(DISMISS_KEY(ann.id), "1");
              }
              setDismissed(true);
            }}
            aria-label="بستن بنر"
          >
            <X className="size-4" aria-hidden />
          </Button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
