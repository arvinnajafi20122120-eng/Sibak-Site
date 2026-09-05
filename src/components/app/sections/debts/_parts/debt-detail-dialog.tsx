"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  HandHeart,
  Lock,
  MessageSquarePlus,
  Plus,
  RotateCcw,
  Users,
  Globe,
  Hash,
  Coins,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";
import { toFa, relativeTime, formatJalaliDateTime } from "@/lib/jalali";
import { api } from "@/lib/api-client";
import { useSession } from "@/store/session";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SafeAvatar, UserChip } from "@/components/app/sections/_shared/safe-avatar";

import {
  STATUS_META,
  VISIBILITY_META,
  type DebtDetail,
  type DebtEventDTO,
} from "./types";

const EVENT_META: Record<
  DebtEventDTO["type"],
  { label: string; icon: typeof Plus; color: string }
> = {
  CREATE: { label: "ثبت تعهد", icon: Plus, color: "text-primary" },
  SETTLE_REQUEST: { label: "اعلام جبران", icon: CheckCircle2, color: "text-chart-2" },
  SETTLE_CONFIRM: { label: "تأیید جبران", icon: CheckCircle2, color: "text-chart-1" },
  FORGIVE: { label: "بخشش", icon: HandHeart, color: "text-chart-5" },
  REOPEN: { label: "بازگشایش", icon: RotateCcw, color: "text-chart-4" },
  ADJUST: { label: "ویرایش", icon: Plus, color: "text-muted-foreground" },
  COMMENT: { label: "یادداشت", icon: MessageSquarePlus, color: "text-chart-2" },
};

const VIS_ICON: Record<string, typeof Globe> = {
  PUBLIC: Globe,
  RESTRICTED: Users,
  PRIVATE: Lock,
};

/**
 * دیالوگ جزئیات کامل تعهد: تایم‌لاین + اکشن‌ها + یادداشت.
 */
export function DebtDetailDialog({
  debt,
  onClose,
  onMutated,
}: {
  debt: DebtDetail | null;
  onClose: () => void;
  onMutated?: () => void;
}) {
  const user = useSession((s) => s.user);
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  if (!debt) return null;

  const statusMeta = STATUS_META[debt.status];
  const VisIcon = VIS_ICON[debt.visibility] ?? Globe;
  const isDebtor = debt.debtor.id === user?.id;
  const isCreditor = debt.creditor.id === user?.id;
  const isAdmin = user?.role === "ADMIN";
  const canSettleRequest = isDebtor && debt.status === "OPEN";
  const canConfirm = isCreditor || isAdmin;
  const canForgive = isCreditor || isAdmin;

  async function doAction(
    path: string,
    successMsg: string,
    body?: Record<string, unknown>,
  ) {
    setActionLoading(true);
    try {
      await api.post(`/api/debts/${debt!.id}/${path}`, body ?? {});
      toast.success(successMsg);
      queryClient.invalidateQueries({ queryKey: ["debts"] });
      queryClient.invalidateQueries({ queryKey: ["debt", debt!.id] });
      queryClient.invalidateQueries({ queryKey: ["debt-stats"] });
      queryClient.invalidateQueries({ queryKey: ["debt-chart"] });
      onMutated?.();
    } catch (e: unknown) {
      toast.error((e as Error).message);
    } finally {
      setActionLoading(false);
    }
  }

  async function sendComment() {
    if (!note.trim()) {
      toast.error("متن یادداشت را وارد کنید");
      return;
    }
    setActionLoading(true);
    try {
      await api.post(`/api/debts/${debt.id}/comment`, { note: note.trim() });
      toast.success("یادداشت ثبت شد");
      setNote("");
      queryClient.invalidateQueries({ queryKey: ["debt", debt.id] });
      queryClient.invalidateQueries({ queryKey: ["debts"] });
      onMutated?.();
    } catch (e: unknown) {
      toast.error((e as Error).message);
    } finally {
      setActionLoading(false);
    }
  }

  const overdue =
    debt.dueDate &&
    new Date(debt.dueDate) < new Date() &&
    debt.status !== "SETTLED" &&
    debt.status !== "FORGIVEN";

  return (
    <Dialog open={!!debt} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[92vh] overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-border/50 bg-gradient-to-l from-primary/5 via-transparent to-chart-2/5 p-5">
          <DialogTitle className="flex flex-wrap items-center gap-2 text-xl font-extrabold">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Coins className="size-5" aria-hidden />
            </span>
            {debt.title}
            <Badge className={cn("gap-1", statusMeta.chip)}>
              <span className={cn("size-1.5 rounded-full", statusMeta.dot)} aria-hidden />
              {statusMeta.label}
            </Badge>
            <Badge variant="outline" className="gap-1 text-[11px]">
              <VisIcon className="size-3" aria-hidden />
              {VISIBILITY_META[debt.visibility].label}
            </Badge>
          </DialogTitle>
          <DialogDescription className="text-xs">
            {debt.projectName ? `پروژه: ${debt.projectName}` : "بدون پروژهٔ مشخص"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 overflow-y-auto p-5">
          {/* طرفین */}
          <Card className="rounded-2xl border-border/50 bg-background/40 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-col items-center gap-1.5">
                <span className="text-[11px] font-bold text-destructive">بدهکار</span>
                <SafeAvatar user={debt.debtor} className="size-12 text-lg" />
                <span className="text-sm font-bold">{debt.debtor.name}</span>
                <span className="text-[10px] text-muted-foreground" dir="ltr">
                  @{debt.debtor.username}
                </span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <ArrowLeft className="size-5 text-muted-foreground" aria-hidden />
                <span className="rounded-full bg-primary/10 px-2.5 py-1 text-base font-black tabular-nums text-primary">
                  {toFa(debt.amount)} امتیاز
                </span>
              </div>
              <div className="flex flex-col items-center gap-1.5">
                <span className="text-[11px] font-bold text-primary">طلبکار</span>
                <SafeAvatar user={debt.creditor} className="size-12 text-lg" />
                <span className="text-sm font-bold">{debt.creditor.name}</span>
                <span className="text-[10px] text-muted-foreground" dir="ltr">
                  @{debt.creditor.username}
                </span>
              </div>
            </div>
          </Card>

          {/* توضیحات */}
          {debt.description && (
            <div className="rounded-xl border border-border/40 bg-background/30 p-3 text-sm leading-7 text-foreground/80">
              {debt.description}
            </div>
          )}

          {/* متادیتا */}
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            {debt.dueDate && (
              <Badge
                variant="outline"
                className={cn(
                  "gap-1",
                  overdue && "border-chart-2/40 bg-chart-2/10 text-accent-foreground",
                )}
              >
                <CalendarClock className="size-3" aria-hidden />
                سررسید: {formatJalaliDateTime(new Date(debt.dueDate))}
                {overdue && " · گذشته"}
              </Badge>
            )}
            <Badge variant="outline" className="gap-1">
              <Hash className="size-3" aria-hidden />
              {debt.eventsCount} رویداد
            </Badge>
            <Badge variant="outline">
              {relativeTime(new Date(debt.createdAt))} ثبت شده
            </Badge>
          </div>

          {/* اکشن‌ها */}
          <div className="flex flex-wrap gap-2">
            {canSettleRequest && (
              <Button
                size="sm"
                variant="default"
                disabled={actionLoading}
                onClick={() => doAction("settle-request", "اعلام جبران ثبت شد 🌱")}
                className="gap-1.5"
              >
                <CheckCircle2 className="size-4" aria-hidden />
                اعلام جبران
              </Button>
            )}
            {canConfirm && debt.status === "SETTLE_PENDING" && (
              <Button
                size="sm"
                variant="default"
                disabled={actionLoading}
                onClick={() => doAction("confirm", "🎉 جبران تأیید شد")}
                className="gap-1.5"
              >
                <CheckCircle2 className="size-4" aria-hidden />
                تأیید جبران
              </Button>
            )}
            {canForgive && debt.status !== "FORGIVEN" && debt.status !== "SETTLED" && (
              <Button
                size="sm"
                variant="outline"
                disabled={actionLoading}
                onClick={() => doAction("forgive", "🤝 بدهی بخشیده شد")}
                className="gap-1.5 text-chart-5"
              >
                <HandHeart className="size-4" aria-hidden />
                بخشش
              </Button>
            )}
            {isAdmin && debt.status !== "OPEN" && (
              <Button
                size="sm"
                variant="ghost"
                disabled={actionLoading}
                onClick={() => doAction("reopen", "تعهد مجدداً باز شد")}
                className="gap-1.5 text-chart-4"
              >
                <RotateCcw className="size-4" aria-hidden />
                بازگشایش
              </Button>
            )}
          </div>

          {/* یادداشت جدید */}
          <div className="flex flex-col gap-2 rounded-xl border border-border/50 bg-background/30 p-3">
            <Textarea
              dir="rtl"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="یادداشت کوتاه برای طرفین…"
              maxLength={500}
            />
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="outline"
                disabled={actionLoading || !note.trim()}
                onClick={sendComment}
                className="gap-1.5"
              >
                <MessageSquarePlus className="size-4" aria-hidden />
                ثبت یادداشت
              </Button>
            </div>
          </div>

          {/* تایم‌لاین */}
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-extrabold">تایم‌لاین</h3>
            {debt.events.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
                هنوز رویدادی ثبت نشده
              </p>
            ) : (
              <ScrollArea className="max-h-72">
                <ol className="relative flex flex-col gap-3 ps-4 pe-1">
                  <span
                    className="absolute inset-y-2 start-1 w-px bg-border/60"
                    aria-hidden
                  />
                  {debt.events.map((ev, i) => {
                    const meta = EVENT_META[ev.type] ?? EVENT_META.COMMENT;
                    const Icon = meta.icon;
                    return (
                      <motion.li
                        key={ev.id}
                        initial={{ opacity: 0, x: 8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.03 * i, duration: 0.25 }}
                        className="relative"
                      >
                        <span
                          className={cn(
                            "absolute -start-3.5 top-1 flex size-3 items-center justify-center rounded-full",
                            meta.color,
                          )}
                          aria-hidden
                        >
                          <span className="size-2 rounded-full bg-current" />
                        </span>
                        <div className="rounded-xl border border-border/40 bg-background/40 p-2.5">
                          <div className="flex items-center gap-2 text-[11px]">
                            <Icon className={cn("size-3.5", meta.color)} aria-hidden />
                            <span className="font-bold">{meta.label}</span>
                            <UserChip user={ev.actor} showName />
                            <span className="ms-auto text-muted-foreground">
                              {relativeTime(new Date(ev.createdAt))}
                            </span>
                          </div>
                          {ev.note && (
                            <p className="mt-1.5 text-xs leading-6 text-foreground/80">
                              {ev.note}
                            </p>
                          )}
                        </div>
                      </motion.li>
                    );
                  })}
                </ol>
              </ScrollArea>
            )}
          </div>

          {/* کاربران منتخب (RESTRICTED) */}
          {debt.visibility === "RESTRICTED" && debt.allowedUsers.length > 0 && (
            <div className="flex flex-col gap-2 rounded-xl border border-chart-2/30 bg-chart-2/5 p-3">
              <span className="text-xs font-bold">کاربران منتخب</span>
              <div className="flex flex-wrap gap-2">
                {debt.allowedUsers.map((u) => (
                  <UserChip key={u.id} user={u} className="text-xs" />
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function DebtDetailSkeleton() {
  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle><Skeleton className="h-6 w-48" /></DialogTitle>
        <DialogDescription><Skeleton className="h-4 w-32" /></DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-3 p-4">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-8 w-40 rounded-lg" />
      </div>
    </DialogContent>
  );
}
