"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  HelpCircle,
  MinusCircle,
  PlusCircle,
  ShieldBan,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Vote,
} from "lucide-react";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";
import { api } from "@/lib/api-client";
import { toFa, formatJalaliDateTime, relativeTime } from "@/lib/jalali";
import { useHashRoute } from "@/components/app/router";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import type { VetoSummary } from "../polls/_parts/types";
import { UserChip } from "../polls/_parts/user-chip";
import { CountUp } from "./_parts/count-up";

const STEPS = [
  "با نظر اکثریت در نظرسنجی «اعطای وتو» می‌توانید وتو کسب کنید.",
  "هر زمان روی یک نظرسنجی باز یا بسته می‌توانید وتو بزنید تا آن را لغو کنید.",
  "تعداد وتوی مورد نیاز برای اعطا توسط ادمین تنظیم می‌شود.",
];

/**
 * دفتر وتوها — موجودی، تاریخچه، نظرسنجی‌های وتو‌شده و فرصت‌های کسب وتو.
 */
export default function VetoesSection() {
  const { navigate } = useHashRoute();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["vetoes"],
    queryFn: () => api.get<VetoSummary>("/api/vetoes"),
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["vetoes"] });
  }

  void refresh;

  const balance = data?.balance ?? 0;
  const ledger = data?.ledger ?? [];
  const vetoedPolls = data?.vetoedPolls ?? [];
  const grantPolls = data?.grantPolls ?? [];

  return (
    <section className="flex flex-col gap-6" aria-label="دفتر وتوها">
      {/* هیرو موجودی */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="glass card-hover relative overflow-hidden rounded-3xl p-6 md:p-8"
      >
        <div
          className="pointer-events-none absolute -top-24 -left-16 size-72 animate-blob rounded-full bg-primary/20 blur-3xl"
          aria-hidden
        />
        <div className="relative flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-5">
            <div className="relative flex size-20 items-center justify-center">
              <span
                className="absolute inset-0 rounded-full bg-primary/20 blur-2xl"
                aria-hidden
              />
              <ShieldCheck className="relative size-14 text-primary" aria-hidden />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-bold text-muted-foreground">
                موجودی وتوی شما
              </span>
              <span className="text-5xl font-black tabular-nums text-foreground">
                <CountUp value={balance} />
              </span>
              <span className="text-xs text-muted-foreground">
                {balance > 0
                  ? "می‌توانید همین حالا یک نظرسنجی را وتو کنید."
                  : "برای کسب وتو، در نظرسنجی اعطای وتو شرکت کنید."}
              </span>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            className="gap-2 rounded-xl"
            onClick={() => navigate("polls")}
          >
            <Vote className="size-4" aria-hidden />
            مشاهده نظرسنجی‌ها
          </Button>
        </div>
      </motion.div>

      {/* «وتو چیست؟» */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.06 }}
        className="glass rounded-3xl p-5 md:p-6"
      >
        <div className="mb-3 flex items-center gap-2">
          <HelpCircle className="size-5 text-chart-2" aria-hidden />
          <h2 className="text-base font-extrabold">وتو چیست؟</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <div
              key={i}
              className="flex gap-3 rounded-2xl bg-background/50 p-4"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-black text-primary">
                {toFa(i + 1)}
              </span>
              <p className="text-xs leading-6 text-muted-foreground">{s}</p>
            </div>
          ))}
        </div>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* تاریخچه دفتر */}
        <div className="lg:col-span-2">
          <h2 className="mb-3 flex items-center gap-2 text-base font-extrabold">
            <TrendingUp className="size-5 text-primary" aria-hidden />
            دفتر وتوهای من
          </h2>
          {isLoading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-xl" />
              ))}
            </div>
          ) : ledger.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/70 bg-background/30 p-6 text-center text-sm text-muted-foreground">
              هنوز ردیفی در دفتر وتوی شما ثبت نشده است.
            </div>
          ) : (
            <div className="relative flex flex-col gap-1 ps-4">
              {/* خط عمودی */}
              <span
                className="absolute bottom-4 right-[7px] top-2 w-0.5 bg-border"
                aria-hidden
              />
              {ledger.map((e) => {
                const positive = e.delta > 0;
                const Icon = positive ? PlusCircle : MinusCircle;
                return (
                  <motion.div
                    key={e.id}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="relative flex items-start gap-3 rounded-xl bg-background/40 p-3"
                  >
                    <span
                      className={cn(
                        "relative z-10 flex size-4 shrink-0 items-center justify-center rounded-full ring-4 ring-background",
                        positive ? "bg-chart-1/80" : "bg-destructive",
                      )}
                    >
                      <Icon className="size-3 text-background" aria-hidden />
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            "text-sm font-black tabular-nums",
                            positive ? "text-chart-1" : "text-destructive",
                          )}
                        >
                          {positive ? "+" : ""}
                          {toFa(e.delta)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {relativeTime(new Date(e.createdAt))} · {formatJalaliDateTime(new Date(e.createdAt))}
                        </span>
                      </div>
                      <p className="text-xs leading-6 text-foreground/80">
                        {e.reason}
                      </p>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="px-2 text-[10px]">
                          موجودی پس از این: {toFa(e.balanceAfter)}
                        </Badge>
                        {e.sourcePoll && (
                          <button
                            type="button"
                            onClick={() => navigate("polls")}
                            className="text-[11px] font-semibold text-primary hover:underline"
                          >
                            نظرسنجی: {e.sourcePoll.title}
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* فرصت‌های کسب وتو */}
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-base font-extrabold">
            <Sparkles className="size-5 text-chart-2" aria-hidden />
            فرصت‌های کسب وتو
          </h2>
          {isLoading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-xl" />
              ))}
            </div>
          ) : grantPolls.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/70 bg-background/30 p-6 text-center text-sm text-muted-foreground">
              در حال حاضر نظرسنجی اعطای وتوی فعالی موجود نیست.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {grantPolls.map((p) => (
                <div
                  key={p.id}
                  className="rounded-2xl border border-chart-4/30 bg-gradient-to-l from-chart-4/10 via-background/40 to-background/0 p-4"
                >
                  <div className="flex items-center gap-2">
                    <ShieldBan className="size-4 text-chart-4" aria-hidden />
                    <h3 className="line-clamp-1 text-sm font-bold">{p.title}</h3>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    {p.targetUser && (
                      <>
                        <span>هدف:</span>
                        <UserChip user={p.targetUser} />
                      </>
                    )}
                    <span>·</span>
                    <span className="font-bold text-chart-4">
                      {toFa(p.vetoAmount ?? 0)} وتو
                    </span>
                    <span>·</span>
                    <span>
                      بله: {toFa(p.yesVotes)} / خیر: {toFa(p.noVotes)}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-3 gap-1.5 self-start rounded-lg text-primary hover:bg-primary/5"
                    onClick={() => navigate("polls")}
                  >
                    شرکت در نظرسنجی
                    <ArrowLeft className="size-3.5" aria-hidden />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* نظرسنجی‌های وتو‌شده (همگانی) */}
      <div>
        <h2 className="mb-3 flex items-center gap-2 text-base font-extrabold">
          <ShieldBan className="size-5 text-destructive" aria-hidden />
          نظرسنجی‌های وتو‌شده
          <Badge className="bg-destructive/10 text-destructive">
            {toFa(vetoedPolls.length)}
          </Badge>
        </h2>
        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-xl" />
            ))}
          </div>
        ) : vetoedPolls.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/70 bg-background/30 p-6 text-center text-sm text-muted-foreground">
            هنوز نظرسنجی وتو‌شده‌ای ثبت نشده است.
            <TrendingDown className="mx-auto mt-2 size-5 text-muted-foreground/50" aria-hidden />
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {vetoedPolls.map((p) => (
              <div
                key={p.id}
                className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4"
              >
                <div className="flex items-start gap-2">
                  <ShieldBan className="size-5 shrink-0 text-destructive" aria-hidden />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <h3 className="text-sm font-bold">{p.title}</h3>
                    <p className="text-xs text-muted-foreground">
                      {relativeTime(new Date(p.updatedAt))} · {formatJalaliDateTime(new Date(p.updatedAt))}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                      {p.vetoer && <UserChip user={p.vetoer} />}
                      {p.createdBy && (
                        <span className="text-muted-foreground">
                          سازنده: {p.createdBy.name}
                        </span>
                      )}
                    </div>
                    {p.reason && (
                      <p className="mt-2 rounded-lg bg-background/60 p-2 text-[11px] leading-5 text-muted-foreground">
                        {p.reason}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
