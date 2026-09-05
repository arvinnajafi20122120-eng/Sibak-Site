"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Clock,
  EyeOff,
  Gavel,
  Lock,
  Pencil,
  Pin,
  Plus,
  ShieldBan,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { toFa, relativeTime } from "@/lib/jalali";
import { api } from "@/lib/api-client";
import { useSession } from "@/store/session";
import { ROLE_LABELS } from "@/components/app/nav";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import type { Poll } from "./types";
import { UserChip, VoterStack } from "./user-chip";

const GROUP_COLOR_BG: Record<string, string> = {
  emerald: "bg-chart-1/15 text-primary border-chart-1/30",
  rose: "bg-destructive/10 text-destructive border-destructive/30",
  amber: "bg-chart-2/15 text-accent-foreground border-chart-2/40",
  teal: "bg-chart-5/15 text-chart-5 border-chart-5/30",
  orange: "bg-chart-4/15 text-chart-4 border-chart-4/30",
};

const STATUS_META: Record<
  string,
  { label: string; cls: string; icon?: typeof ShieldBan }
> = {
  OPEN: { label: "باز", cls: "bg-chart-1/15 text-primary border-chart-1/40" },
  CLOSED: { label: "بسته", cls: "bg-secondary text-muted-foreground border-border" },
  VETOED: { label: "وتو شده", cls: "bg-destructive/10 text-destructive border-destructive/30", icon: ShieldBan },
};

interface Props {
  poll: Poll;
  myBalance: number;
  onChanged: () => void;
}

export function PollCard({ poll, myBalance, onChanged }: Props) {
  const user = useSession((s) => s.user);
  const queryClient = useQueryClient();
  const [confirmVeto, setConfirmVeto] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isCreator = user?.id === poll.createdBy?.id;
  const canManage = isCreator || user?.role === "ADMIN" || user?.role === "MANAGER";
  const isVetoGrant = poll.type === "VETO_GRANT";
  const showResults = poll.status !== "OPEN" || !!poll.myVote;
  const winnerId = useMemo(() => {
    if (poll.status !== "CLOSED" || poll.type !== "NORMAL" || poll.options.length === 0) return null;
    const sorted = [...poll.options].sort((a, b) => b.votesCount - a.votesCount);
    if (sorted[0].votesCount === 0) return null;
    if (sorted.length > 1 && sorted[0].votesCount === sorted[1].votesCount) return null;
    return sorted[0].id;
  }, [poll]);

  const voteMutation = useMutation({
    mutationFn: (optionId: string) =>
      api.post(`/api/polls/${poll.id}/vote`, { optionId }),
    onSuccess: () => {
      toast.success("رأی شما ثبت شد");
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const closeMutation = useMutation({
    mutationFn: () => api.post(`/api/polls/${poll.id}/close`),
    onSuccess: () => {
      toast.success("نظرسنجی بسته شد");
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const vetoMutation = useMutation({
    mutationFn: () =>
      api.post<{ ok: boolean; balance: number; vetoer: unknown }>(
        `/api/polls/${poll.id}/veto`,
      ),
    onSuccess: (res) => {
      toast.success(`وتو ثبت شد — موجودی جدید: ${toFa(res.balance)}`);
      onChanged();
      queryClient.invalidateQueries({ queryKey: ["vetoes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.del(`/api/polls/${poll.id}`),
    onSuccess: () => {
      toast.success("نظرسنجی حذف شد");
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const status = STATUS_META[poll.status] ?? STATUS_META.OPEN;
  const StatusIcon = status.icon;

  const canVote = poll.status === "OPEN";
  const canVetoPoll =
    poll.status !== "VETOED" &&
    poll.createdBy?.id !== user?.id &&
    (user?.role === "ADMIN" || user?.role === "MANAGER" || myBalance >= 1);
  const canEdit =
    poll.status === "OPEN" && isCreator && poll.totalVotes === 0;

  const deadlineText = useMemo(() => {
    if (!poll.closesAt) return null;
    const target = new Date(poll.closesAt);
    if (poll.status === "CLOSED") return { text: "پایان یافته", tone: "muted" };
    if (poll.status === "VETOED") return { text: "وتو شده", tone: "rose" };
    const diff = target.getTime() - Date.now();
    const DAY = 86_400_000;
    if (diff < 0) return { text: "پایان مهلت", tone: "muted" };
    if (diff < DAY) return { text: `${toFa(Math.ceil(diff / 3_600_000))} ساعت مانده`, tone: "amber" };
    return { text: `${toFa(Math.round(diff / DAY))} روز مانده`, tone: "amber" };
  }, [poll.closesAt, poll.status]);

  const total = poll.totalVotes || 1;

  // شمارهٔ قطعنامه برای VETO_GRANT — هش پایدار از شناسهٔ نظرسنجی
  const resolutionNumber = useMemo(() => {
    let hash = 0;
    for (let i = 0; i < poll.id.length; i++) {
      hash = (hash * 31 + poll.id.charCodeAt(i)) >>> 0;
    }
    const num = (hash % 10000).toString().padStart(4, "0");
    return toFa(num);
  }, [poll.id]);

  // تشخیص گزینهٔ «موافق» در VETO_GRANT — طبق قرارداد seed/createPoll
  const yesOptionId = useMemo(() => {
    if (!isVetoGrant) return null;
    const yes =
      poll.options.find((o) => o.text.trim().startsWith("بله")) ??
      poll.options[0] ??
      null;
    return yes?.id ?? null;
  }, [isVetoGrant, poll.options]);

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-background/60 backdrop-blur-sm",
        isVetoGrant
          ? "border-chart-4/40 bg-gradient-to-l from-chart-4/10 via-background/40 to-background/0 shadow-lg shadow-chart-4/10"
          : "border-border/60",
        poll.status === "VETOED" && "border-destructive/30 bg-destructive/5",
      )}
    >
      {isVetoGrant && (
        <>
          {/* نوار طلایی بالای قطعنامه */}
          <div
            className="relative flex items-center justify-between gap-2 border-b-2 border-double border-chart-4/40 bg-gradient-to-l from-chart-4/20 via-chart-2/15 to-chart-4/20 px-4 py-2 text-chart-4"
            aria-label="قطعنامه‌ی اعطای وتو"
          >
            <div className="flex items-center gap-2">
              <Gavel className="size-4" aria-hidden />
              <span className="text-xs font-black tracking-wider md:text-sm">
                قطعنامه‌ی اعطای وتو
              </span>
            </div>
            <span className="hidden text-[10px] font-bold tracking-wide opacity-70 sm:block">
              شورای امنیت سیبک
            </span>
          </div>
          {/* مهر رسمی در گوشه */}
          <span
            className="un-seal pointer-events-none absolute top-3 left-3 z-10 flex size-14 items-center justify-center"
            aria-hidden
          >
            <ShieldBan className="size-6" aria-hidden />
          </span>
        </>
      )}

      <div className={cn("flex flex-col gap-4 p-4 md:p-5", isVetoGrant && "parchment parchment-text border-4 border-double border-chart-4/50")}>
        {/* سربرگ */}
        <header className="flex flex-wrap items-start gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            {isVetoGrant ? (
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-chart-4/15 text-chart-4">
                <ShieldBan className="size-5" aria-hidden />
              </div>
            ) : null}
            <div className="flex min-w-0 flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h3
                  className={cn(
                    "leading-6",
                    isVetoGrant
                      ? "text-lg font-black tracking-wide md:text-xl"
                      : "text-base font-bold md:text-lg",
                  )}
                >
                  {poll.title}
                </h3>
                <Badge className={cn("border", status.cls)}>
                  {StatusIcon && <StatusIcon className="ms-0.5 size-3" aria-hidden />}
                  {status.label}
                </Badge>
                {poll.isAnonymous && (
                  <Badge className="border border-border bg-secondary text-muted-foreground">
                    <EyeOff className="ms-0.5 size-3" aria-hidden />
                    رأی مخفی
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                {poll.createdBy && <UserChip user={poll.createdBy} />}
                <span aria-hidden>·</span>
                <span>{relativeTime(new Date(poll.createdAt))}</span>
                {poll.group && (
                  <>
                    <span aria-hidden>·</span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "gap-1 px-1.5 text-[10px] font-semibold",
                        GROUP_COLOR_BG[poll.group.color] ?? GROUP_COLOR_BG.emerald,
                      )}
                    >
                      <Users className="size-3" aria-hidden />
                      {poll.group.name}
                    </Badge>
                  </>
                )}
                {deadlineText && (
                  <>
                    <span aria-hidden>·</span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 font-semibold",
                        deadlineText.tone === "amber" ? "text-chart-2" : "text-muted-foreground",
                        deadlineText.tone === "rose" && "text-destructive",
                      )}
                    >
                      <Clock className="size-3" aria-hidden />
                      {deadlineText.text}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* توضیحات */}
        {poll.description && (
          <p className="whitespace-pre-line text-sm leading-6 text-muted-foreground">
            {poll.description}
          </p>
        )}

        {/* کاربر هدف در VETO_GRANT — متن رسمی فرمان */}
        {isVetoGrant && poll.targetUser && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border-2 border-double border-chart-4/40 bg-chart-4/5 p-3 text-xs md:text-sm">
            <Gavel className="size-4 shrink-0 text-chart-4" aria-hidden />
            <span className="font-semibold leading-6">
              به موجودی ویژهٔ وتو مجهز می‌شود:
            </span>
            <UserChip user={poll.targetUser} showRole size="sm" />
            {poll.vetoAmount != null && (
              <Badge className="gap-1 border border-chart-4/40 bg-chart-4/15 px-2 py-1 text-xs font-black text-chart-4">
                <ShieldBan className="ms-0.5 size-3.5" aria-hidden />
                {toFa(poll.vetoAmount)} وتو
              </Badge>
            )}
            {poll.granted && (
              <Badge className="ms-auto gap-1 bg-chart-1/15 text-primary">
                <Check className="size-3" aria-hidden />
                اعطا شد
              </Badge>
            )}
          </div>
        )}

        {/* گزینه‌ها — برای VETO_GRANT دکمه‌های بزرگ Check/X */}
        <div className="flex flex-col gap-2">
          {isVetoGrant ? (
            // رندر ویژهٔ قطعنامه — دکمه‌های بزرگ رأی موافق/مخالف
            <div className="grid gap-3 sm:grid-cols-2">
              {poll.options.map((opt) => {
                const pct = Math.round((opt.votesCount / total) * 100);
                const isMine = poll.myVote?.optionId === opt.id;
                const isYes = opt.id === yesOptionId;
                const Icon = isYes ? Check : X;
                const label = isYes ? "رأی موافق" : "رأی مخالف";
                return (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={!canVote || voteMutation.isPending}
                    onClick={() => canVote && voteMutation.mutate(opt.id)}
                    className={cn(
                      "group relative overflow-hidden rounded-xl border-2 p-4 text-center transition-all",
                      canVote && "cursor-pointer hover:scale-[1.01]",
                      isYes
                        ? "border-chart-1/40 bg-chart-1/10 hover:bg-chart-1/15"
                        : "border-chart-3/40 bg-chart-3/5 hover:bg-chart-3/10",
                      isMine && (isYes
                        ? "ring-2 ring-chart-1/50 border-chart-1"
                        : "ring-2 ring-chart-3/50 border-chart-3"),
                    )}
                    aria-pressed={isMine}
                  >
                    {(showResults || !canVote) && (
                      <motion.div
                        className={cn(
                          "absolute inset-y-0 right-0",
                          isYes ? "bg-chart-1/15" : "bg-chart-3/15",
                        )}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                        aria-hidden
                      />
                    )}
                    <div className="relative flex flex-col items-center gap-2">
                      <span
                        className={cn(
                          "flex size-11 items-center justify-center rounded-full border-2",
                          isYes
                            ? "border-chart-1/50 bg-chart-1/15 text-chart-1"
                            : "border-chart-3/50 bg-chart-3/15 text-destructive",
                          isMine && (isYes
                            ? "bg-chart-1 text-primary-foreground"
                            : "bg-chart-3 text-destructive-foreground"),
                        )}
                      >
                        <Icon className="size-5" aria-hidden />
                      </span>
                      <span className="text-sm font-black tracking-wide md:text-base">
                        {label}
                      </span>
                      {showResults || !canVote ? (
                        <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          {!poll.isAnonymous && opt.voters.length > 0 && (
                            <VoterStack users={opt.voters} />
                          )}
                          <span className="font-bold tabular-nums">
                            {toFa(pct)}٪
                            <span className="ms-1 font-normal opacity-70">
                              ({toFa(opt.votesCount)})
                            </span>
                          </span>
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            // رندر معمولی نظرسنجی NORMAL
            poll.options.map((opt) => {
              const pct = Math.round((opt.votesCount / total) * 100);
              const isMine = poll.myVote?.optionId === opt.id;
              const isWinner = opt.id === winnerId;
              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={!canVote || voteMutation.isPending}
                  onClick={() => canVote && voteMutation.mutate(opt.id)}
                  className={cn(
                    "group relative overflow-hidden rounded-xl border text-right transition-all",
                    canVote ? "cursor-pointer hover:border-primary/50 hover:bg-primary/5" : "cursor-default",
                    isMine
                      ? "border-primary bg-primary/5"
                      : "border-border/60 bg-background/40",
                    isWinner && "ring-2 ring-chart-1/40",
                  )}
                  aria-pressed={isMine}
                >
                  {/* نوار پیشرفت */}
                  {(showResults || !canVote) && (
                    <motion.div
                      className="absolute inset-y-0 right-0 bg-primary/10"
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                      aria-hidden
                    />
                  )}
                  <div className="relative flex items-center gap-2 p-3">
                    {/* دکمه رادیویی */}
                    <span
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                        isMine
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border",
                      )}
                    >
                      {isMine && <Check className="size-3" aria-hidden />}
                    </span>
                    <span className="flex-1 text-sm font-semibold">{opt.text}</span>
                    {showResults || !canVote ? (
                      <span className="flex items-center gap-2">
                        {!poll.isAnonymous && opt.voters.length > 0 && (
                          <VoterStack users={opt.voters} />
                        )}
                        <span className="text-xs font-bold tabular-nums text-muted-foreground">
                          {toFa(pct)}٪
                          <span className="ms-1 text-[10px] font-normal text-muted-foreground/70">
                            ({toFa(opt.votesCount)})
                          </span>
                        </span>
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {poll.isAnonymous && showResults && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <EyeOff className="size-3.5" aria-hidden />
            رأی‌ها مخفی است — فقط درصد نمایش داده می‌شود.
          </p>
        )}

        {/* پاورقی و اکشن‌ها */}
        <footer
          className={cn(
            "flex flex-wrap items-center justify-between gap-2 border-t pt-3",
            isVetoGrant
              ? "border-dashed border-chart-4/40"
              : "border-border/40",
          )}
        >
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
            <span>
              {toFa(poll.totalVotes)} رأی
              {poll.type === "NORMAL" && ` · ${toFa(poll.options.length)} گزینه`}
            </span>
            {isVetoGrant && (
              <span className="inline-flex items-center gap-1 rounded-md border border-chart-4/30 bg-chart-4/5 px-1.5 py-0.5 text-[10px] font-bold text-chart-4">
                <Gavel className="size-3" aria-hidden />
                قطعنامه شماره {resolutionNumber}
              </span>
            )}
            {poll.createdBy?.role && (
              <span className="text-muted-foreground/60">
                · سازنده: {ROLE_LABELS[poll.createdBy.role as keyof typeof ROLE_LABELS]}
              </span>
            )}
          </span>
          <div className="flex items-center gap-1.5">
            {/* وتو */}
            {canVetoPoll && (
              <AlertDialog open={confirmVeto} onOpenChange={setConfirmVeto}>
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <AlertDialogTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={myBalance < 1 || vetoMutation.isPending}
                          className="gap-1.5 rounded-lg border-destructive/30 text-destructive hover:bg-destructive/10"
                        >
                          {myBalance < 1 ? (
                            <Lock className="size-3.5" aria-hidden />
                          ) : (
                            <ShieldBan className="size-3.5" aria-hidden />
                          )}
                          وتو
                        </Button>
                      </AlertDialogTrigger>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      {myBalance < 1
                        ? "موجودی وتوی شما صفر است"
                        : `موجودی شما: ${toFa(myBalance)} وتو`}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>استفاده از وتو</AlertDialogTitle>
                    <AlertDialogDescription>
                      یک واحد وتوی شما مصرف می‌شود و این نظرسنجی لغو خواهد شد. مطمئنید؟
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>انصراف</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() => vetoMutation.mutate()}
                    >
                      <ShieldBan className="ms-1 size-4" aria-hidden />
                      بله، وتو می‌زنم
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            {/* بستن */}
            {canManage && poll.status === "OPEN" && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={closeMutation.isPending}
                onClick={() => closeMutation.mutate()}
                className="gap-1.5 rounded-lg"
              >
                <X className="size-3.5" aria-hidden />
                بستن
              </Button>
            )}

            {/* ویرایش */}
            {canEdit && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => toast.info("ویرایش نظرسنجی به‌زودی فعال می‌شود")}
                className="gap-1.5 rounded-lg text-muted-foreground"
              >
                <Pencil className="size-3.5" aria-hidden />
                ویرایش
              </Button>
            )}

            {/* حذف */}
            {canManage && (
              <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 rounded-lg text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                    حذف
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>حذف نظرسنجی</AlertDialogTitle>
                    <AlertDialogDescription>
                      آیا از حذف این نظرسنجی مطمئنید؟ این عمل قابل بازگشت نیست (فقط soft-delete).
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>انصراف</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() => deleteMutation.mutate()}
                    >
                      بله، حذف کن
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </footer>
      </div>
    </motion.article>
  );
}

export function PollCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/40 p-4 md:p-5">
      <div className="flex items-center gap-3">
        <Skeleton className="size-10 rounded-xl" />
        <div className="flex w-full flex-col gap-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export function NewPollCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border/70 bg-background/30 p-6 text-muted-foreground transition-all hover:border-primary/50 hover:bg-primary/5 hover:text-primary"
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-primary/10">
        <Plus className="size-6" aria-hidden />
      </span>
      <span className="text-sm font-bold">ساخت نظرسنجی جدید</span>
      <span className="text-xs">معمولی یا اعطای وتو</span>
      <span className="mt-1 inline-flex items-center gap-1 text-[10px]">
        <Pin className="size-3" aria-hidden /> روی کاغذ بکشیم تصمیم را!
      </span>
    </button>
  );
}
