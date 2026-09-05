"use client";

import { createElement } from "react";
import { CalendarDays, Pencil, Trash2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  CalendarCheck,
  FileWarning,
  PartyPopper,
  Rocket,
  Users,
} from "lucide-react";

import { formatJalaliDateTime, toFa } from "@/lib/jalali";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SafeAvatar } from "@/components/app/sections/_shared/safe-avatar";
import {
  EVENT_TYPE_BADGE,
  EVENT_TYPE_LABELS,
  GROUP_COLOR_BADGE,
  normalizeColor,
  normalizeEventType,
} from "@/components/app/sections/_shared/group-colors";
import type { CalendarEventListItem } from "@/components/app/sections/_shared/types";

const EVENT_ICONS: Record<string, LucideIcon> = {
  GENERAL: CalendarCheck,
  EXAM: FileWarning,
  HOMEWORK: BookOpen,
  MEETING: Users,
  HOLIDAY: PartyPopper,
  PROJECT: Rocket,
};

export function getEventIcon(type: string): LucideIcon {
  return EVENT_ICONS[type] ?? CalendarDays;
}

/** رندرر آیکون نوع رویداد — createElement به‌جای JSX برای رعایت لینت استاتیک-کامپوننت. */
export function EventTypeIcon({ type, className }: { type: string; className?: string }) {
  const Icon = getEventIcon(type);
  return createElement(Icon, { className, "aria-hidden": true });
}

/**
 * کارت رویداد تقویم — در پنل کناری و لیست‌های «رویدادهای پیش رو».
 */
export function EventCard({
  event,
  onEdit,
  onDelete,
  canManage,
}: {
  event: CalendarEventListItem;
  onEdit?: (event: CalendarEventListItem) => void;
  onDelete?: (event: CalendarEventListItem) => void;
  canManage?: boolean;
}) {
  const type = normalizeEventType(event.type);
  const groupColor = normalizeColor(event.group?.color);

  return (
    <div className="glass card-hover flex flex-col gap-2.5 rounded-2xl p-4">
      <div className="flex items-start gap-2.5">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-xl border",
            EVENT_TYPE_BADGE[type],
          )}
          aria-hidden
        >
          <EventTypeIcon type={event.type} className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-sm font-extrabold leading-6">{event.title}</h4>
            <Badge
              variant="outline"
              className={cn("shrink-0 text-[10px]", EVENT_TYPE_BADGE[type])}
            >
              {EVENT_TYPE_LABELS[type]}
            </Badge>
          </div>
          {event.description && (
            <p className="mt-1 text-xs leading-5 text-muted-foreground line-clamp-2">
              {event.description}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        <span className="font-semibold text-foreground/80">
          📅 {formatJalaliDateTime(new Date(event.date))}
        </span>
        {event.endDate && (
          <span className="text-muted-foreground/70">
            تا {formatJalaliDateTime(new Date(event.endDate))}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {event.group && (
          <Badge
            variant="outline"
            className={cn("text-[10px]", GROUP_COLOR_BADGE[groupColor])}
          >
            {event.group.name}
          </Badge>
        )}
        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <SafeAvatar user={event.createdBy} className="size-5" />
          {event.createdBy.name}
        </span>
        {canManage && (onEdit || onDelete) && (
          <div className="ms-auto flex items-center gap-1">
            {onEdit && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 rounded-md"
                onClick={() => onEdit(event)}
                aria-label="ویرایش رویداد"
              >
                <Pencil className="size-3.5" aria-hidden />
              </Button>
            )}
            {onDelete && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 rounded-md text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => onDelete(event)}
                aria-label="حذف رویداد"
              >
                <Trash2 className="size-3.5" aria-hidden />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** چیپ شمارش معکوس روزهای پیش رو. */
export function EventCountdownChip({ event }: { event: CalendarEventListItem }) {
  const day = new Date(event.date);
  const today = new Date();
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const targetMidnight = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  const diffDays = Math.round(
    (targetMidnight.getTime() - todayMidnight.getTime()) / (24 * 60 * 60 * 1000),
  );

  let label: string;
  if (diffDays === 0) label = "امروز";
  else if (diffDays === 1) label = "فردا";
  else if (diffDays === -1) label = "دیروز";
  else if (diffDays < 0) label = `${toFa(Math.abs(diffDays))} روز پیش`;
  else label = `${toFa(diffDays)} روز دیگر`;

  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px] font-bold",
        diffDays <= 1 && diffDays >= 0
          ? "bg-chart-3/15 text-destructive"
          : "bg-secondary text-secondary-foreground",
      )}
    >
      {label}
    </span>
  );
}
