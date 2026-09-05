"use client";

import { ArrowLeft, CalendarClock, Globe, Lock, MessageSquarePlus, Users } from "lucide-react";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";
import { toFa, relativeTime } from "@/lib/jalali";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SafeAvatar } from "@/components/app/sections/_shared/safe-avatar";

import { STATUS_META, type DebtListItem } from "./types";

const VIS_ICON = { PUBLIC: Globe, RESTRICTED: Users, PRIVATE: Lock } as const;

/**
 * کارت تعهد — نمایش فشرده در لیست.
 * کلیک روی کارت → باز شدن دیالوگ جزئیات.
 */
export function DebtCard({
  debt,
  onOpen,
  index = 0,
}: {
  debt: DebtListItem;
  onOpen: () => void;
  index?: number;
}) {
  const meta = STATUS_META[debt.status];
  const VisIcon = VIS_ICON[debt.visibility];
  const overdue =
    debt.dueDate &&
    new Date(debt.dueDate) < new Date() &&
    debt.status !== "SETTLED" &&
    debt.status !== "FORGIVEN";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(0.04 * index, 0.3), duration: 0.25 }}
    >
      <Card
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpen();
          }
        }}
        className={cn(
          "card-hover group relative cursor-pointer overflow-hidden rounded-2xl border border-border/60 border-e-4 p-4 transition-all hover:border-primary/40 hover:shadow-md",
          meta.border,
          meta.tint,
        )}
        aria-label={`تعهد: ${debt.title}`}
      >
        <div className="flex flex-col gap-3">
          {/* خط اول: عنوان + badges */}
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="text-base font-extrabold leading-6">{debt.title}</h3>
            <div className="flex items-center gap-1.5">
              <Badge className={cn("gap-1 px-2 text-[10px]", meta.chip)}>
                <span className={cn("size-1.5 rounded-full", meta.dot)} aria-hidden />
                {meta.label}
              </Badge>
              <Badge variant="outline" className="gap-1 px-1.5 text-[10px]">
                <VisIcon className="size-3" aria-hidden />
                <span className="sr-only">{debt.visibility}</span>
              </Badge>
            </div>
          </div>

          {/* طرفین */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <SafeAvatar user={debt.debtor} className="size-9" />
              <div className="flex flex-col">
                <span className="text-xs font-bold">{debt.debtor.name}</span>
                <span className="text-[10px] text-muted-foreground">بدهکار</span>
              </div>
            </div>
            <ArrowLeft className="size-4 text-muted-foreground" aria-hidden />
            <div className="flex items-center gap-2">
              <SafeAvatar user={debt.creditor} className="size-9" />
              <div className="flex flex-col">
                <span className="text-xs font-bold">{debt.creditor.name}</span>
                <span className="text-[10px] text-muted-foreground">طلبکار</span>
              </div>
            </div>
            <div className="ms-auto rounded-full bg-primary/10 px-2.5 py-1 text-base font-black tabular-nums text-primary">
              {toFa(debt.amount)}
            </div>
          </div>

          {/* متادیتا */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            {debt.projectName && (
              <span className="font-semibold text-foreground/80">
                {debt.projectName}
              </span>
            )}
            {debt.dueDate && (
              <span
                className={cn(
                  "inline-flex items-center gap-1",
                  overdue && "text-chart-2",
                )}
              >
                <CalendarClock className="size-3" aria-hidden />
                {overdue ? "گذشته · " : ""}
                {relativeTime(new Date(debt.dueDate))}
              </span>
            )}
            <span>{toFa(debt.eventsCount)} رویداد</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">
              {relativeTime(new Date(debt.createdAt))}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1 px-2 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                onOpen();
              }}
            >
              <MessageSquarePlus className="size-3.5" aria-hidden />
              مشاهده
            </Button>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
