"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";

import {
  JALALI_MONTHS,
  JALALI_WEEKDAYS_SHORT,
  getJalaliMonthGrid,
  toFa,
  toJalali,
  isToday,
} from "@/lib/jalali";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * انتخاب‌گر تاریخ شمسی داخل Popover — قابل استفاده‌مجدد.
 * به محض کلیک روی روز، `onSelect(isoDate)` صدا زده می‌شود.
 */
export function JalaliDatePicker({
  selected,
  onSelect,
}: {
  selected?: Date | null;
  onSelect: (isoDate: Date) => void;
}) {
  const today = new Date();
  const todayJ = toJalali(today);
  const [viewYear, setViewYear] = useState<number>(todayJ.jy);
  const [viewMonth, setViewMonth] = useState<number>(todayJ.jm);

  const cells = useMemo(
    () => getJalaliMonthGrid(viewYear, viewMonth),
    [viewYear, viewMonth],
  );

  function goToPrevMonth() {
    if (viewMonth === 1) {
      setViewMonth(12);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  }
  function goToNextMonth() {
    if (viewMonth === 12) {
      setViewMonth(1);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  }
  function goToday() {
    setViewYear(todayJ.jy);
    setViewMonth(todayJ.jm);
  }

  function isCellSelected(c: { gy: number; gm: number; gd: number }) {
    if (!selected) return false;
    return (
      c.gy === selected.getFullYear() &&
      c.gm === selected.getMonth() + 1 &&
      c.gd === selected.getDate()
    );
  }

  return (
    <div className="flex w-full flex-col gap-3 p-1" dir="rtl">
      {/* عنوان ماه + ناوبری */}
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="size-9 rounded-lg"
          onClick={goToPrevMonth}
          aria-label="ماه قبل"
        >
          <ChevronRight className="size-4" aria-hidden />
        </Button>
        <div className="flex flex-col items-center">
          <span className="text-sm font-extrabold">
            {JALALI_MONTHS[viewMonth - 1]} {toFa(viewYear)}
          </span>
          <button
            type="button"
            onClick={goToday}
            className="text-[10px] text-primary hover:underline"
          >
            امروز
          </button>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-9 rounded-lg"
          onClick={goToNextMonth}
          aria-label="ماه بعد"
        >
          <ChevronLeft className="size-4" aria-hidden />
        </Button>
      </div>

      {/* هدر روزهای هفته */}
      <div className="grid grid-cols-7 gap-1">
        {JALALI_WEEKDAYS_SHORT.map((w, i) => (
          <div
            key={`${w}-${i}`}
            className="flex h-7 items-center justify-center text-[11px] font-bold text-muted-foreground"
          >
            {w}
          </div>
        ))}
      </div>

      {/* خانه‌های روز */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((c, idx) => {
          const d = new Date(c.gy, c.gm - 1, c.gd);
          const selectedCell = isCellSelected(c);
          const todayCell = isToday(d);
          return (
            <motion.button
              key={`${c.gy}-${c.gm}-${c.gd}-${idx}`}
              type="button"
              whileTap={{ scale: 0.92 }}
              onClick={() => onSelect(d)}
              className={cn(
                "flex h-9 items-center justify-center rounded-lg text-sm font-semibold tabular-nums transition-colors",
                c.isCurrentMonth ? "text-foreground" : "text-muted-foreground/50",
                selectedCell
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : todayCell
                    ? "bg-primary/10 text-primary ring-1 ring-primary/40"
                    : "hover:bg-accent/70 hover:text-accent-foreground",
              )}
              aria-label={`${toFa(c.jd)} ${JALALI_MONTHS[c.jm - 1]}`}
              aria-pressed={selectedCell}
            >
              {toFa(c.jd)}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
