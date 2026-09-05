"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Bell,
  BellOff,
  Check,
  CheckCircle2,
  ChevronLeft,
  Filter,
  Inbox,
  Lightbulb,
  Scale,
  ShieldBan,
  UserRound,
  Users,
  Vote,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { api } from "@/lib/api-client";
import {
  formatJalaliDateTime,
  relativeTime,
  toFa,
  toJalali,
} from "@/lib/jalali";
import { useSession } from "@/store/session";
import { useHashRoute } from "@/components/app/router";
import type { AppNotification } from "@/lib/types";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const TYPE_META: Record<
  string,
  { label: string; icon: typeof Bell; cls: string; chip: string }
> = {
  INFO: { label: "اطلاعیه", icon: Bell, cls: "bg-secondary text-secondary-foreground", chip: "bg-secondary text-secondary-foreground border-border" },
  SUCCESS: { label: "موفقیت", icon: CheckCircle2, cls: "bg-chart-1/15 text-primary", chip: "bg-chart-1/10 text-primary border-chart-1/30" },
  WARNING: { label: "هشدار", icon: AlertTriangle, cls: "bg-chart-2/20 text-accent-foreground", chip: "bg-chart-2/15 text-accent-foreground border-chart-2/40" },
  URGENT: { label: "فوری", icon: AlertTriangle, cls: "bg-destructive/15 text-destructive", chip: "bg-destructive/10 text-destructive border-destructive/30" },
  DEBT: { label: "بدهکاری", icon: Scale, cls: "bg-chart-5/15 text-chart-5", chip: "bg-chart-5/15 text-chart-5 border-chart-5/30" },
  VETO: { label: "وتو", icon: ShieldBan, cls: "bg-chart-3/15 text-destructive", chip: "bg-chart-3/10 text-destructive border-chart-3/30" },
  POLL: { label: "نظرسنجی", icon: Vote, cls: "bg-chart-4/15 text-foreground", chip: "bg-chart-4/15 text-foreground border-chart-4/30" },
  GROUP: { label: "گروه", icon: Users, cls: "bg-chart-1/10 text-primary", chip: "bg-chart-1/10 text-primary border-chart-1/30" },
  IDEA: { label: "ایده", icon: Lightbulb, cls: "bg-chart-2/15 text-accent-foreground", chip: "bg-chart-2/15 text-accent-foreground border-chart-2/40" },
  USER: { label: "کاربر", icon: UserRound, cls: "bg-accent text-accent-foreground", chip: "bg-accent text-accent-foreground border-accent-foreground/20" },
};

const FILTER_TABS = [
  { key: "all", label: "همه" },
  { key: "unread", label: "خوانده‌نشده" },
] as const;
type FilterKey = (typeof FILTER_TABS)[number]["key"];

/**
 * اعلان‌های کاربر — غنی‌شده با متای نوع، فیلتر و گروه‌بندی زمانی.
 */
export default function NotificationsSection() {
  const { navigate } = useHashRoute();
  const refreshUnread = useSession((s) => s.refreshUnread);
  const queryClient = useQueryClient();

  const [filter, setFilter] = useState<FilterKey>("all");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["notifications", "page"],
    queryFn: () => api.get<{ notifications: AppNotification[] }>("/api/notifications"),
  });

  const all = data?.notifications ?? [];
  const typesPresent = useMemo(() => {
    const s = new Set<string>();
    all.forEach((n) => s.add(n.type));
    return Array.from(s);
  }, [all]);

  const filtered = useMemo(() => {
    return all.filter((n) => {
      if (filter === "unread" && n.readAt) return false;
      if (typeFilter && n.type !== typeFilter) return false;
      return true;
    });
  }, [all, filter, typeFilter]);

  const unreadCount = all.filter((n) => !n.readAt).length;

  // گروه‌بندی زمانی: امروز / این هفته / قدیمی‌تر
  const groups = useMemo(() => {
    const now = new Date();
    const today = toJalali(now);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const weekAgo = todayStart - 7 * 86_400_000;

    const buckets: { key: string; label: string; items: AppNotification[] }[] = [
      { key: "today", label: "امروز", items: [] },
      { key: "week", label: "این هفته", items: [] },
      { key: "older", label: "قدیمی‌تر", items: [] },
    ];

    filtered.forEach((n) => {
      const t = new Date(n.createdAt).getTime();
      const j = toJalali(new Date(n.createdAt));
      if (j.jy === today.jy && j.jm === today.jm && j.jd === today.jd) {
        buckets[0].items.push(n);
      } else if (t >= weekAgo) {
        buckets[1].items.push(n);
      } else {
        buckets[2].items.push(n);
      }
    });

    return buckets.filter((b) => b.items.length > 0);
  }, [filtered]);

  const markAllMutation = useMutation({
    mutationFn: () => api.post("/api/notifications/read"),
    onSuccess: async () => {
      await refreshUnread();
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("همه اعلان‌ها خوانده‌شده علامت خوردند");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const markOneMutation = useMutation({
    mutationFn: (id: string) =>
      api.post("/api/notifications/read", { ids: [id] }),
    onSuccess: async () => {
      await refreshUnread();
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function open(n: AppNotification) {
    if (!n.readAt) markOneMutation.mutate(n.id);
    if (n.link) navigate(n.link.replace(/^#/, ""));
  }

  return (
    <section className="flex flex-col gap-5" aria-label="اعلان‌ها">
      {/* سربرگ */}
      <div className="glass card-hover flex flex-wrap items-center justify-between gap-3 rounded-3xl p-6">
        <div className="flex items-center gap-4">
          <div className="relative flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Inbox className="size-7" aria-hidden />
            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                {toFa(unreadCount)}
              </span>
            )}
          </div>
          <div>
            <h1 className="text-2xl font-black">اعلان‌های من</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              آخرین رویدادهای مرتبط با شما — گروه‌بندی‌شده بر اساس زمان.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          className="gap-2 rounded-xl"
          onClick={() => markAllMutation.mutate()}
          disabled={unreadCount === 0 || markAllMutation.isPending}
        >
          <Check className="size-4" aria-hidden />
          علامت‌زدن همه به‌عنوان خوانده‌شده
        </Button>
      </div>

      {/* فیلترها */}
      <div className="glass flex flex-wrap items-center gap-2 rounded-2xl p-2">
        <nav className="flex gap-1" aria-label="فیلتر وضعیت">
          {FILTER_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setFilter(t.key)}
              className={cn(
                "flex min-h-9 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors",
                filter === t.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              {t.label}
              {t.key === "unread" && unreadCount > 0 && (
                <span className="rounded-full bg-destructive px-1.5 text-[10px] text-destructive-foreground">
                  {toFa(unreadCount)}
                </span>
              )}
            </button>
          ))}
        </nav>
        <span className="mx-1 h-5 w-px bg-border" aria-hidden />
        <div className="flex items-center gap-1 text-muted-foreground">
          <Filter className="size-3.5" aria-hidden />
          <span className="text-[11px]">نوع:</span>
        </div>
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => setTypeFilter(null)}
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-[11px] font-bold transition-colors",
              !typeFilter
                ? "border-primary bg-primary/10 text-primary"
                : "border-border/60 text-muted-foreground hover:bg-secondary",
            )}
          >
            همه
          </button>
          {typesPresent.map((t) => {
            const meta = TYPE_META[t] ?? TYPE_META.INFO;
            const Icon = meta.icon;
            const active = typeFilter === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTypeFilter(active ? null : t)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold transition-colors",
                  active
                    ? meta.chip
                    : "border-border/60 text-muted-foreground hover:bg-secondary",
                )}
              >
                <Icon className="size-3" aria-hidden />
                {meta.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* لیست گروه‌بندی‌شده */}
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="glass flex items-center gap-4 rounded-2xl p-4">
              <Skeleton className="size-11 rounded-xl" />
              <div className="flex w-full flex-col gap-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="glass flex flex-col items-center gap-3 rounded-3xl p-12 text-center">
          <BellOff className="size-12 text-muted-foreground/50" aria-hidden />
          <p className="text-lg font-bold">هیچ اعلانی ندارید</p>
          <p className="text-sm text-muted-foreground">
            رویدادهای مهم سیبک — مثل تایید عضویت، رأی جدید یا بدهکاری — اینجا نمایش داده می‌شوند.
          </p>
        </div>
      ) : (
        <div className="flex max-h-[72vh] flex-col gap-4 overflow-y-auto pe-1">
          {groups.map((g) => (
            <div key={g.key} className="flex flex-col gap-2">
              <div className="sticky top-0 z-10 -mx-1 flex items-center gap-2 bg-background/80 px-1 py-1 backdrop-blur">
                <span className="h-1.5 w-1.5 rounded-full bg-primary/40" aria-hidden />
                <span className="text-xs font-bold text-muted-foreground">
                  {g.label}
                </span>
                <span className="text-[10px] text-muted-foreground/60">
                  ({toFa(g.items.length)})
                </span>
              </div>
              {g.items.map((n) => {
                const meta = TYPE_META[n.type] ?? TYPE_META.INFO;
                const Icon = meta.icon;
                return (
                  <motion.button
                    layout
                    key={n.id}
                    type="button"
                    onClick={() => open(n)}
                    whileTap={{ scale: 0.99 }}
                    className={cn(
                      "glass card-hover flex w-full items-start gap-3 rounded-2xl p-4 text-right",
                      !n.readAt && "border-primary/40 bg-primary/5",
                    )}
                  >
                    <span
                      className={cn(
                        "relative mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-xl",
                        meta.cls,
                      )}
                      aria-hidden
                    >
                      <Icon className="size-5" />
                      {!n.readAt && (
                        <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-primary ring-2 ring-background" aria-hidden />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold">{n.title}</span>
                        {!n.readAt && (
                          <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                            جدید
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs leading-6 text-muted-foreground">
                        {n.message}
                      </p>
                      <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground/70">
                        {relativeTime(new Date(n.createdAt))}
                        <span aria-hidden>·</span>
                        {formatJalaliDateTime(new Date(n.createdAt))}
                      </p>
                    </div>
                    {n.link && (
                      <ChevronLeft className="mt-1 size-4 shrink-0 text-muted-foreground/50" aria-hidden />
                    )}
                  </motion.button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
