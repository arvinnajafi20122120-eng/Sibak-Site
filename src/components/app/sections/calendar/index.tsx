"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/api-client";
import {
  JALALI_MONTHS,
  JALALI_WEEKDAYS_SHORT,
  formatJalaliDate,
  formatJalaliFullDate,
  getJalaliMonthGrid,
  isToday,
  relativeTime,
  toFa,
  toJalali,
} from "@/lib/jalali";
import { useSession } from "@/store/session";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/app/sections/_shared/empty-state";
import { PrintButton } from "@/components/app/sections/_shared/print-button";
import {
  EVENT_TYPE_BADGE,
  EVENT_TYPE_LABELS,
  type EventTypeKey,
  normalizeEventType,
} from "@/components/app/sections/_shared/group-colors";
import {
  EventCard,
  EventCountdownChip,
  getEventIcon,
} from "@/components/app/sections/calendar/event-card";
import {
  CreateEditEventDialog,
} from "@/components/app/sections/calendar/create-event-dialog";
import type { CalendarEventListItem } from "@/components/app/sections/_shared/types";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * سکشن تقویم شمسی — گرید ماهانه + پنل کناری رویدادهای روز + پیش رو.
 * فقط ADMIN/MANAGER می‌توانند رویداد بسازند.
 */
export default function CalendarSection() {
  const user = useSession((s) => s.user);
  const isAdmin = user?.role === "ADMIN" || user?.role === "MANAGER";
  const queryClient = useQueryClient();
  const reduce = useReducedMotion();

  const today = new Date();
  const todayJ = toJalali(today);
  const [viewYear, setViewYear] = useState<number>(todayJ.jy);
  const [viewMonth, setViewMonth] = useState<number>(todayJ.jm);
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [navDirection, setNavDirection] = useState<1 | -1>(1);

  const monthStart = new Date(viewYear, 0, 1).getTime() + (viewMonth - 1) * 31 * DAY_MS;
  // یک بازه سرسری برای پوشش کامل ماه
  const fromIso = (() => {
    const firstCellG = getJalaliMonthGrid(viewYear, viewMonth)[0];
    return new Date(firstCellG.gy, firstCellG.gm - 1, firstCellG.gd, 0, 0, 0).toISOString();
  })();
  const toIso = (() => {
    const cells = getJalaliMonthGrid(viewYear, viewMonth);
    const lastCell = cells[cells.length - 1];
    const d = new Date(lastCell.gy, lastCell.gm - 1, lastCell.gd, 23, 59, 59);
    return d.toISOString();
  })();
  void monthStart;

  // پیش‌فرض: ۳۰ روز قبل تا ۶۰ روز بعد را هم در یک کوئری گرم نگه می‌داریم
  // برای بخش «رویدادهای پیش رو». اما برای گرید ماه، از همان کوئری استفاده می‌کنیم.
  const from30 = new Date(today.getTime() - 30 * DAY_MS);
  const to60 = new Date(today.getTime() + 60 * DAY_MS);

  const { data: eventsData, isLoading } = useQuery({
    queryKey: ["calendar", "events", fromIso, toIso],
    queryFn: () =>
      api.get<{ events: CalendarEventListItem[]; upcoming?: CalendarEventListItem[] }>(
        `/api/events?from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}`,
      ),
  });
  // کوئری جدا برای upcoming (۷ روز آینده)
  const { data: upcomingData } = useQuery({
    queryKey: ["calendar", "upcoming"],
    queryFn: () =>
      api.get<{ events: CalendarEventListItem[]; upcoming?: CalendarEventListItem[] }>(
        `/api/events?upcoming=1`,
      ),
  });

  const allEvents = eventsData?.events ?? [];
  const upcomingEvents = upcomingData?.upcoming ?? [];

  // کاربر امروز فقط امروز را به‌عنوان انتخاب‌شده می‌بیند، ولی می‌تواند روز دیگری را انتخاب کند.
  // رویدادهای روز انتخاب‌شده:
  const selectedDayEvents = useMemo(() => {
    return allEvents.filter((e) => isSameDay(new Date(e.date), selectedDate));
  }, [allEvents, selectedDate]);

  // نقشه روز → رویدادها (برای نقاط روی گرید)
  const eventsByDay = useMemo(() => {
    const m = new Map<string, CalendarEventListItem[]>();
    for (const e of allEvents) {
      const key = dayKey(new Date(e.date));
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(e);
      if (e.endDate) {
        const end = new Date(e.endDate);
        let cursor = new Date(new Date(e.date).getTime() + DAY_MS);
        while (cursor <= end) {
          const k = dayKey(cursor);
          if (!m.has(k)) m.set(k, []);
          m.get(k)!.push(e);
          cursor = new Date(cursor.getTime() + DAY_MS);
        }
      }
    }
    return m;
  }, [allEvents]);

  const cells = useMemo(
    () => getJalaliMonthGrid(viewYear, viewMonth),
    [viewYear, viewMonth],
  );

  function goToPrevMonth() {
    setNavDirection(-1);
    if (viewMonth === 1) {
      setViewMonth(12);
      setViewYear((y) => y - 1);
    } else setViewMonth((m) => m - 1);
  }
  function goToNextMonth() {
    setNavDirection(1);
    if (viewMonth === 12) {
      setViewMonth(1);
      setViewYear((y) => y + 1);
    } else setViewMonth((m) => m + 1);
  }
  function goToday() {
    setNavDirection(todayJ.jm < viewMonth || (todayJ.jm === 12 && viewMonth === 1) ? -1 : 1);
    setViewYear(todayJ.jy);
    setViewMonth(todayJ.jm);
    setSelectedDate(today);
  }

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.del(`/api/events/${id}`),
    onSuccess: () => {
      toast.success("رویداد حذف شد");
      queryClient.invalidateQueries({ queryKey: ["calendar"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "خطا در حذف رویداد"),
  });

  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<CalendarEventListItem | null>(null);

  return (
    <div className="flex flex-col gap-5">
      {/* هدر */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="card-hover relative overflow-hidden rounded-3xl p-6 md:p-8"
        style={{
          background:
            "linear-gradient(135deg, color-mix(in oklab, var(--primary) 18%, var(--card)) 0%, var(--card) 45%, color-mix(in oklab, var(--chart-2) 16%, var(--card)) 100%)",
          border: "1px solid color-mix(in oklab, var(--border) 70%, transparent)",
        }}
        aria-label="تقویم"
      >
        <div
          className="pointer-events-none absolute -top-16 -left-16 size-48 animate-blob rounded-full bg-primary/20 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-20 -right-10 size-56 animate-blob rounded-full bg-chart-2/20 blur-3xl [animation-delay:-4s]"
          aria-hidden
        />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <div className="relative flex size-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/85 to-chart-2/85 text-primary-foreground shadow-lg shadow-primary/30">
              <CalendarDays className="size-8" aria-hidden />
              <span
                className="absolute -bottom-1 -right-1 flex size-6 items-center justify-center rounded-full bg-chart-2 text-[10px] font-black text-accent-foreground ring-2 ring-background"
                aria-hidden
              >
                ✦
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              <h1 className="text-2xl font-black tracking-tight md:text-3xl">
                تقویم سیبک
              </h1>
              <p className="max-w-xl text-sm leading-7 text-muted-foreground">
                تقویم شمسی رویدادهای جمعی: جلسه‌ها، امتحان‌ها، تحویل پروژه‌ها و
                تعطیلات؛ ماه‌به‌ماه با نمای هفتگی ایرانی.
              </p>
              <p className="text-[11px] text-muted-foreground/70">
                {formatJalaliFullDate(today)} · امروز
              </p>
            </div>
          </div>
          {isAdmin && (
            <div className="no-print flex items-center gap-2">
              <PrintButton title="تقویم رویدادها" className="h-11 min-h-11" />
              <Button
                variant="default"
                className="h-11 min-h-11 gap-1.5 rounded-xl shadow-md shadow-primary/30"
                onClick={() => {
                  setEditing(null);
                  setShowCreate(true);
                }}
              >
                <Plus className="size-4" aria-hidden />
                رویداد جدید
              </Button>
            </div>
          )}
          {!isAdmin && (
            <PrintButton title="تقویم رویدادها" className="h-11 min-h-11 no-print" />
          )}
        </div>
      </motion.div>

      {/* محدودهٔ چاپ: گرید + پنل کناری + حالت خالی */}
      <div className="printable-area flex flex-col gap-5">
        {/* چیدمان: گرید + پنل کناری */}
        <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        {/* گرید ماه */}
        <div className="glass flex flex-col gap-3 rounded-3xl p-4 md:p-5">
          {/* نوار ناوبری ماه */}
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="size-11 min-h-11 rounded-xl transition-all hover:bg-primary/10 hover:text-primary active:scale-95"
              onClick={goToPrevMonth}
              aria-label="ماه قبل"
            >
              <ChevronRight className="size-5" aria-hidden />
            </Button>
            <div className="flex items-center gap-2">
              <motion.h2
                key={`${viewYear}-${viewMonth}`}
                initial={reduce ? false : { opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: reduce ? 0.15 : 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="text-lg font-extrabold md:text-xl"
              >
                {JALALI_MONTHS[viewMonth - 1]} {toFa(viewYear)}
              </motion.h2>
              <Button
                variant="outline"
                size="sm"
                className="h-9 min-h-9 gap-1.5 rounded-xl"
                onClick={goToday}
              >
                امروز
              </Button>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-11 min-h-11 rounded-xl transition-all hover:bg-primary/10 hover:text-primary active:scale-95"
              onClick={goToNextMonth}
              aria-label="ماه بعد"
            >
              <ChevronLeft className="size-5" aria-hidden />
            </Button>
          </div>

          {/* هدر روزهای هفته */}
          <div className="grid grid-cols-7 gap-1">
            {JALALI_WEEKDAYS_SHORT.map((w, i) => (
              <div
                key={`${w}-${i}`}
                className="flex h-9 items-center justify-center rounded-md text-[11px] font-bold text-muted-foreground"
              >
                {w}
              </div>
            ))}
          </div>

          {/* خانه‌ها */}
          {isLoading ? (
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 42 }).map((_, i) => (
                <Skeleton key={i} className="min-h-20 rounded-lg" />
              ))}
            </div>
          ) : (
            <AnimatePresence mode="wait" initial={false} custom={navDirection}>
              <motion.div
                key={`${viewYear}-${viewMonth}`}
                initial={
                  reduce
                    ? { opacity: 0 }
                    : { opacity: 0, x: navDirection * 24 }
                }
                animate={{ opacity: 1, x: 0 }}
                exit={
                  reduce
                    ? { opacity: 0 }
                    : { opacity: 0, x: navDirection * -24 }
                }
                transition={{
                  duration: reduce ? 0.15 : 0.32,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="grid grid-cols-7 gap-1"
              >
                {cells.map((c, idx) => {
                  const d = new Date(c.gy, c.gm - 1, c.gd);
                  const dayEvents = eventsByDay.get(dayKey(d)) ?? [];
                  const todayCell = isToday(d);
                  const selectedCell = isSameDay(d, selectedDate);
                  return (
                    <motion.button
                      key={`${c.gy}-${c.gm}-${c.gd}-${idx}`}
                      type="button"
                      whileTap={{ scale: 0.94 }}
                      onClick={() => setSelectedDate(d)}
                      className={cn(
                        "flex min-h-16 flex-col items-stretch justify-start gap-0.5 rounded-lg border p-1.5 text-[11px] transition-colors sm:min-h-20 md:min-h-24",
                        c.isCurrentMonth
                          ? "border-border/60 bg-background/40 hover:border-primary/40 hover:bg-primary/5"
                          : "border-transparent bg-transparent text-muted-foreground/40 opacity-40",
                        selectedCell &&
                          "border-primary bg-primary/10 ring-1 ring-primary/50",
                      )}
                      aria-label={`${toFa(c.jd)} ${JALALI_MONTHS[c.jm - 1]}`}
                      aria-pressed={selectedCell}
                    >
                      <span className="flex items-center justify-center">
                        <span
                          className={cn(
                            "flex size-7 items-center justify-center rounded-full text-sm font-bold tabular-nums transition-colors",
                            todayCell &&
                              "bg-primary text-primary-foreground ring-2 ring-primary/40 ring-offset-1 ring-offset-background",
                            !todayCell && selectedCell && "text-primary",
                            !todayCell &&
                              !selectedCell &&
                              c.isCurrentMonth &&
                              "hover:bg-foreground/5",
                          )}
                        >
                          {toFa(c.jd)}
                        </span>
                      </span>
                      {/* چیپ‌های رویدادها — حداکثر ۲ چیپ + +n */}
                      {dayEvents.length > 0 && (
                        <span className="mt-auto flex flex-col items-stretch gap-0.5 pb-0.5">
                          {dayEvents.slice(0, 2).map((e, i) => {
                            const t = normalizeEventType(e.type);
                            const chip = EVENT_TYPE_CHIP[t];
                            return (
                              <span
                                key={`${e.id}-${i}`}
                                className={cn(
                                  "flex items-center gap-0.5 truncate rounded-md border px-1 py-0.5 text-[9px] font-bold leading-none",
                                  chip.chip,
                                )}
                                aria-hidden
                              >
                                <span className="text-[10px]">{chip.emoji}</span>
                                <span className="truncate">{e.title}</span>
                              </span>
                            );
                          })}
                          {dayEvents.length > 2 && (
                            <span className="text-[9px] font-bold text-muted-foreground">
                              +{toFa(dayEvents.length - 2)} مورد
                            </span>
                          )}
                        </span>
                      )}
                    </motion.button>
                  );
                })}
              </motion.div>
            </AnimatePresence>
          )}

          {/* راهنمای چگالی */}
          <div className="mt-1 flex flex-wrap items-center gap-2 border-t border-border/50 pt-3">
            <span className="text-[11px] font-bold text-muted-foreground">راهنما:</span>
            {(
              ["GENERAL", "EXAM", "HOMEWORK", "MEETING", "HOLIDAY", "PROJECT"] as EventTypeKey[]
            ).map((t) => {
              const chip = EVENT_TYPE_CHIP[t];
              return (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-background/40 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground"
                >
                  <span className="text-[11px]" aria-hidden>
                    {chip.emoji}
                  </span>
                  {EVENT_TYPE_LABELS[t]}
                </span>
              );
            })}
          </div>
        </div>

        {/* پنل کناری */}
        <div className="flex flex-col gap-4">
          {/* رویدادهای روز انتخاب‌شده */}
          <div className="glass flex flex-col gap-3 rounded-3xl p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-1.5 text-sm font-extrabold">
                <Sparkles className="size-4 text-primary" aria-hidden />
                رویدادهای روز
              </h3>
              <span className="text-[11px] text-muted-foreground">
                {formatJalaliDate(selectedDate)}
              </span>
            </div>
            {selectedDayEvents.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border bg-background/30 p-4 text-center text-xs text-muted-foreground">
                رویدادی برای این روز ثبت نشده
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                <AnimatePresence initial={false}>
                  {selectedDayEvents.map((e) => {
                    const Icon = getEventIcon(e.type);
                    void Icon;
                    return (
                      <motion.div
                        key={e.id}
                        initial={{ opacity: 0, x: 8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -8 }}
                      >
                        <EventCard
                          event={e}
                          canManage={isAdmin}
                          onEdit={(ev) => {
                            setEditing(ev);
                            setShowCreate(true);
                          }}
                          onDelete={(ev) => deleteMutation.mutate(ev.id)}
                        />
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* رویدادهای پیش رو */}
          <div className="glass flex flex-col gap-3 rounded-3xl p-4">
            <h3 className="flex items-center gap-1.5 text-sm font-extrabold">
              <CalendarDays className="size-4 text-chart-2" aria-hidden />
              رویدادهای پیش رو
            </h3>
            {upcomingEvents.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border bg-background/30 p-4 text-center text-xs text-muted-foreground">
                در ۷ روز آینده رویدادی نیست
              </p>
            ) : (
              <div className="flex max-h-96 flex-col gap-2 overflow-y-auto pe-1">
                {upcomingEvents.map((e) => {
                  const Icon = getEventIcon(e.type);
                  void Icon;
                  void relativeTime;
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => {
                        const d = new Date(e.date);
                        const j = toJalali(d);
                        setViewYear(j.jy);
                        setViewMonth(j.jm);
                        setSelectedDate(d);
                      }}
                      className="group flex flex-col gap-1.5 rounded-2xl border border-border/60 bg-background/40 p-3 text-right transition-colors hover:border-primary/40 hover:bg-primary/5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold">{e.title}</span>
                        <EventCountdownChip event={e} />
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        {formatJalaliDate(new Date(e.date))}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* اگر هیچ رویدادی در بازه ماه نبود */}
      {allEvents.length === 0 && !isLoading && (
        <EmptyState
          icon={CalendarDays}
          title="هنوز رویدادی ثبت نشده"
          description="اولین رویداد سیبک را بساز — جلسه، امتحان، تحویل پروژه یا تعطیلی."
        />
      )}
      </div>

      <CreateEditEventDialog
        open={showCreate}
        onClose={() => {
          setShowCreate(false);
          setEditing(null);
        }}
        editEvent={editing}
      />
    </div>
  );
}

/** رنگ و آیکون برای چیپ رویداد داخل خانه‌های تقویم. */
const EVENT_TYPE_CHIP: Record<
  EventTypeKey,
  { emoji: string; dot: string; chip: string }
> = {
  GENERAL: {
    emoji: "📌",
    dot: "bg-chart-1",
    chip: "bg-chart-1/15 text-primary border-chart-1/30",
  },
  EXAM: {
    emoji: "📝",
    dot: "bg-chart-2",
    chip: "bg-chart-2/20 text-accent-foreground border-chart-2/40",
  },
  HOMEWORK: {
    emoji: "📚",
    dot: "bg-chart-4",
    chip: "bg-chart-4/20 text-chart-4 border-chart-4/40",
  },
  MEETING: {
    emoji: "🗓",
    dot: "bg-chart-1",
    chip: "bg-chart-1/15 text-primary border-chart-1/30",
  },
  HOLIDAY: {
    emoji: "🎉",
    dot: "bg-chart-5",
    chip: "bg-chart-5/20 text-accent-foreground border-chart-5/40",
  },
  PROJECT: {
    emoji: "🚀",
    dot: "bg-chart-3",
    chip: "bg-chart-3/15 text-destructive border-chart-3/40",
  },
};

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

void EVENT_TYPE_BADGE; // re-exported for type-completeness if needed elsewhere
