"use client";

import { useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";
import {
  JALALI_MONTHS,
  JALALI_WEEKDAYS_SHORT,
  currentJalali,
  formatJalaliDateTime,
  getJalaliMonthGrid,
  jalaliToGregorian,
  toFa,
  toJalali,
  toEn,
  type JalaliMonthCell,
} from "@/lib/jalali";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * انتخاب‌گر تاریخ و ساعت شمسی — پاپ‌اور با شبکه ۴۲ خانه‌ای ماه.
 * مقدار: ISO datetime string | null.
 */

interface Props {
  value: string | null;
  onChange: (iso: string | null) => void;
  label?: string;
}

const TIME_PATTERN = /^[0-2]?[0-9]:[0-5][0-9]$/;

/** تنظیم ساعت روی یک تاریخ (در صورت معتبر نبودن، به ساعت ۱۸:۰۰). */
function applyTime(date: Date, timeStr: string | null): Date {
  const d = new Date(date);
  if (timeStr && TIME_PATTERN.test(toEn(timeStr))) {
    const [h, m] = toEn(timeStr).split(":").map(Number);
    d.setHours(h, m, 0, 0);
  } else {
    d.setHours(18, 0, 0, 0);
  }
  return d;
}

export function JalaliDatePicker({ value, onChange, label = "مهلت (اختیاری)" }: Props) {
  const date = value ? new Date(value) : null;
  const initial = date ? toJalali(date) : currentJalali();
  const [viewYear, setViewYear] = useState(initial.jy);
  const [viewMonth, setViewMonth] = useState(initial.jm);
  const [timeStr, setTimeStr] = useState(
    date ? `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}` : "18:00",
  );

  const today = new Date();
  const todayJ = toJalali(today);
  const grid: JalaliMonthCell[] = getJalaliMonthGrid(viewYear, viewMonth);

  function prevMonth() {
    if (viewMonth === 1) {
      setViewMonth(12);
      setViewYear((y) => y - 1);
    } else setViewMonth((m) => (m - 1) as number);
  }
  function nextMonth() {
    if (viewMonth === 12) {
      setViewMonth(1);
      setViewYear((y) => y + 1);
    } else setViewMonth((m) => (m + 1) as number);
  }
  function pick(cell: JalaliMonthCell) {
    const base = new Date(cell.gy, cell.gm - 1, cell.gd);
    const withTime = applyTime(base, timeStr);
    onChange(withTime.toISOString());
    if (cell.jm !== viewMonth) {
      setViewYear(cell.jy);
      setViewMonth(cell.jm);
    }
  }
  function onTimeChange(v: string) {
    setTimeStr(v);
    if (date && TIME_PATTERN.test(toEn(v))) {
      const newDate = applyTime(date, v);
      onChange(newDate.toISOString());
    }
  }
  function clear() {
    onChange(null);
    setTimeStr("18:00");
  }

  const isSelected = (cell: JalaliMonthCell) =>
    !!date &&
    toJalali(date).jy === cell.jy &&
    toJalali(date).jm === cell.jm &&
    toJalali(date).jd === cell.jd;
  const isToday = (cell: JalaliMonthCell) =>
    todayJ.jy === cell.jy && todayJ.jm === cell.jm && todayJ.jd === cell.jd;

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="h-11 flex-1 justify-start gap-2 rounded-xl px-3 text-sm font-medium"
            >
              <CalendarDays className="size-4 text-primary" aria-hidden />
              {date ? formatJalaliDateTime(date) : "بدون مهلت"}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="z-50 w-[20rem] rounded-2xl border-border/60 p-3"
            align="start"
          >
            <div className="mb-2 flex items-center justify-between">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 rounded-lg"
                onClick={prevMonth}
                aria-label="ماه قبل"
              >
                <ChevronRight className="size-4" aria-hidden />
              </Button>
              <span className="text-sm font-bold">
                {JALALI_MONTHS[viewMonth - 1]} {toFa(viewYear)}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 rounded-lg"
                onClick={nextMonth}
                aria-label="ماه بعد"
              >
                <ChevronLeft className="size-4" aria-hidden />
              </Button>
            </div>
            <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-muted-foreground">
              {JALALI_WEEKDAYS_SHORT.map((w) => (
                <span key={w} className="py-1">{w}</span>
              ))}
            </div>
            <motion.div
              key={`${viewYear}-${viewMonth}`}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.18 }}
              className="grid grid-cols-7 gap-1"
            >
              {grid.map((cell, i) => {
                const sel = isSelected(cell);
                const td = isToday(cell);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => pick(cell)}
                    className={cn(
                      "flex aspect-square items-center justify-center rounded-lg text-xs font-semibold transition-colors",
                      !cell.isCurrentMonth && "text-muted-foreground/40",
                      cell.isCurrentMonth && "text-foreground hover:bg-primary/10",
                      sel && "bg-primary text-primary-foreground hover:bg-primary",
                      td && !sel && "ring-1 ring-primary/40",
                    )}
                  >
                    {toFa(cell.jd)}
                  </button>
                );
              })}
            </motion.div>
            <div className="mt-3 flex items-center gap-2 border-t border-border/60 pt-3">
              <span className="text-xs font-semibold text-muted-foreground">ساعت</span>
              <Input
                type="text"
                dir="ltr"
                value={toFa(timeStr)}
                onChange={(e) => onTimeChange(toEn(e.target.value))}
                placeholder="۱۸:۰۰"
                className="h-9 w-20 text-center font-mono"
                inputMode="numeric"
              />
            </div>
          </PopoverContent>
        </Popover>
        {date && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11 rounded-xl"
            onClick={clear}
            aria-label="حذف مهلت"
          >
            <X className="size-4" aria-hidden />
          </Button>
        )}
      </div>
    </div>
  );
}
