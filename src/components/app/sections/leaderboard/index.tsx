"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Trophy, Sparkles, Star } from "lucide-react";

import { cn } from "@/lib/utils";
import { toFa } from "@/lib/jalali";
import { api } from "@/lib/api-client";
import { useSession } from "@/store/session";
import { useHashRoute } from "@/components/app/router";
import { ROLE_BADGE_CLASSES, ROLE_LABELS } from "@/components/app/nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SafeAvatar } from "@/components/app/sections/_shared/safe-avatar";
import { EmptyState } from "@/components/app/sections/_shared/empty-state";
import { PrintButton } from "@/components/app/sections/_shared/print-button";
import type { LeaderboardRow } from "../profile/_parts/types";

const MEDAL = ["🥇", "🥈", "🥉"];
const PODIUM_BG = [
  "from-chart-2/30 to-chart-2/5 ring-chart-2/40", // ۱
  "from-chart-5/20 to-chart-5/5 ring-chart-5/30", // ۲
  "from-chart-4/20 to-chart-4/5 ring-chart-4/30", // ۳
];
const PODIUM_HEIGHT = ["h-44", "h-36", "h-32"];

type Period = "all" | "month";

export default function LeaderboardSection() {
  const user = useSession((s) => s.user);
  const { navigate } = useHashRoute();
  const [period, setPeriod] = useState<Period>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["leaderboard", period],
    queryFn: () =>
      api.get<{ users: LeaderboardRow[]; me: { rank: number; points: number; monthlyPoints: number } | null }>(
        `/api/leaderboard?period=${period}`,
      ),
  });

  const users = data?.users ?? [];
  const me = data?.me;
  const inTop20 = users.some((u) => u.user.id === user?.id);

  return (
    <section className="flex flex-col gap-5" aria-label="جدول برترین‌ها">
      {/* سربرگ */}
      <div className="glass card-hover relative overflow-hidden rounded-3xl p-6 md:p-8">
        <div className="pointer-events-none absolute -top-20 -left-16 size-56 rounded-full bg-chart-2/20 blur-3xl" aria-hidden />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-chart-2/15 text-chart-2">
              <Trophy className="size-7" aria-hidden />
            </div>
            <div>
              <h1 className="text-2xl font-black md:text-3xl">
                با همکاری، هم بالا می‌ریم 🌟
              </h1>
              <p className="mt-1.5 max-w-xl text-sm leading-7 text-muted-foreground">
                امتیازها شفاف و قابل‌ردیابی‌اند. کارهایی مثل ثبت و تأیید ایده، تسویه بدهی و
                فعالیت در نظرسنجی‌ها امتیاز می‌آورند.
              </p>
            </div>
          </div>
          <div className="no-print flex items-center gap-2">
            <PrintButton title="جدول برترین‌ها" className="h-11 min-h-11" />
            <Tabs
              value={period}
              onValueChange={(v) => setPeriod(v as Period)}
              className="w-fit"
            >
              <TabsList className="flex h-11 gap-1 rounded-2xl bg-secondary/50 p-1">
                <TabsTrigger value="all" className="rounded-xl">همهٔ دوران</TabsTrigger>
                <TabsTrigger value="month" className="rounded-xl">این ماه</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </div>

      {/* محدودهٔ چاپ: podium + لیست + رتبهٔ من + پاورقی */}
      <div className="printable-area flex flex-col gap-5">
      {/* Podium */}
      {!isLoading && users.length >= 3 ? (
        <Podium top3={users.slice(0, 3)} period={period} />
      ) : isLoading ? (
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-3xl" />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Trophy}
          title="هنوز برتری تعیین نشده"
          description="فعالیت‌های درسی انجام دهید تا در این جدول بدرخشید."
        />
      )}

      {/* لیست ۴..۲۰ */}
      {users.length > 3 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-extrabold text-muted-foreground">
            ادامهٔ جدول
          </h2>
          {users.slice(3).map((row, i) => {
            const isMe = row.user.id === user?.id;
            return (
              <motion.button
                key={row.user.id}
                type="button"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(0.03 * i, 0.3), duration: 0.25 }}
                onClick={() => navigate(`/profile/${row.user.id}`)}
                className={cn(
                  "card-hover flex items-center gap-3 rounded-2xl border p-3 text-right transition-colors",
                  isMe
                    ? "border-primary/50 bg-primary/5 ring-1 ring-primary/30"
                    : "border-border/50 bg-background/40 hover:border-primary/40",
                )}
              >
                <span className="w-8 shrink-0 text-center text-lg font-black tabular-nums text-muted-foreground">
                  {toFa(row.rank)}
                </span>
                <SafeAvatar user={row.user} className="size-10" />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-bold">{row.user.name}</span>
                    <Badge className={cn("px-1 text-[9px]", ROLE_BADGE_CLASSES[row.user.role])}>
                      {ROLE_LABELS[row.user.role]}
                    </Badge>
                  </div>
                  <span className="text-[10px] text-muted-foreground" dir="ltr">
                    @{row.user.username}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Star className="size-3 text-chart-2" aria-hidden />
                    {toFa(row.ideasCount)}
                  </span>
                  <span className="rounded-full bg-chart-2/15 px-2.5 py-0.5 text-sm font-black tabular-nums text-accent-foreground">
                    {toFa(row.points)}
                  </span>
                </div>
              </motion.button>
            );
          })}
        </div>
      )}

      {/* رتبه من اگر خارج ۲۰ */}
      {me && !inTop20 && (
        <div className="sticky bottom-3 z-20">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass flex items-center gap-3 rounded-2xl border border-primary/50 bg-primary/10 p-3 shadow-lg"
          >
            <span className="w-8 text-center text-lg font-black tabular-nums text-primary">
              {toFa(me.rank)}
            </span>
            <SafeAvatar user={user!} className="size-10" />
            <div className="flex flex-1 flex-col">
              <span className="text-sm font-bold">شما</span>
              <span className="text-[11px] text-muted-foreground">رتبه‌ی من</span>
            </div>
            <span className="rounded-full bg-primary/15 px-3 py-1 text-base font-black tabular-nums text-primary">
              {toFa(me.points)}
            </span>
          </motion.div>
        </div>
      )}

      {/* پاورقی */}
      <div className="glass rounded-2xl border border-border/40 p-4 text-[11px] leading-6 text-muted-foreground">
        <p className="mb-1 font-bold text-foreground">امتیاز از فعالیت‌ها:</p>
        تأیید ایده +۵ · اجرای ایده +۱۵ · رأی‌گیری فعال +۲ · تسویه بدهی +۱۰ · اهدای نشان +۱۰ ·
        گزارش دیرکرد −۵.
      </div>
      </div>
    </section>
  );
}

function Podium({
  top3,
  period,
}: {
  top3: LeaderboardRow[];
  period: Period;
}) {
  // چینش RTL: ۲ - ۱ - ۳ (وسط بلندتر)
  const order = [top3[1], top3[0], top3[2]]; // ۲, ۱, ۳
  const heights = [PODIUM_HEIGHT[1], PODIUM_HEIGHT[0], PODIUM_HEIGHT[2]];
  const podiumBg = [PODIUM_BG[1], PODIUM_BG[0], PODIUM_BG[2]];
  const { navigate } = useHashRoute();

  return (
    <div className="grid grid-cols-3 items-end gap-2 sm:gap-4">
      {order.map((row, i) => {
        const realRank = row.rank;
        return (
          <motion.div
            key={row.user.id}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 * i, duration: 0.4 }}
            className="flex flex-col items-center gap-2"
          >
            <span className="text-3xl">{MEDAL[realRank - 1]}</span>
            <button
              type="button"
              onClick={() => navigate(`/profile/${row.user.id}`)}
              className="flex flex-col items-center gap-1.5"
            >
              <SafeAvatar user={row.user} className="size-14 text-xl" />
              <span className="max-w-[100px] truncate text-sm font-bold">
                {row.user.name}
              </span>
            </button>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Sparkles className="size-3" aria-hidden />
              <span className="font-black tabular-nums text-foreground">
                {toFa(period === "month" ? row.monthlyPoints : row.points)}
              </span>
              امتیاز
            </div>
            <div
              className={cn(
                "flex w-full items-start justify-center rounded-t-2xl bg-gradient-to-b ring-1",
                podiumBg[i],
                heights[i],
              )}
            >
              <span className="mt-2 text-2xl font-black tabular-nums text-foreground/80">
                {toFa(realRank)}
              </span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

// جلوگیری از حذف
void Button;
