"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Award,
  Edit3,
  Hash,
  Lightbulb,
  Lock,
  Shield,
  Sparkles,
  Trophy,
  UserRound,
} from "lucide-react";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";
import { toFa, formatJalaliDate, relativeTime } from "@/lib/jalali";
import { RARITY_CLASSES, RARITY_LABELS, type EarnedMedalDTO } from "@/lib/medals";
import { api } from "@/lib/api-client";
import { useSession } from "@/store/session";
import { useHashRoute } from "@/components/app/router";
import { ROLE_BADGE_CLASSES, ROLE_LABELS, STATUS_LABELS } from "@/components/app/nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EmptyState } from "@/components/app/sections/_shared/empty-state";
import { PrintButton } from "@/components/app/sections/_shared/print-button";
import { MedalImage } from "@/components/app/sections/medals/_parts/medal-image";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import {
  ACTION_ICONS,
  BADGE_COLOR,
  type BadgeDTO,
  type ActivityItem,
  type LeaderboardRow,
} from "./_parts/types";
import { EditProfileDialog } from "./_parts/edit-profile-dialog";
import type { MyProfile, PublicProfile } from "./_parts/types";

/**
 * بخش پروفایل — اگر segments[1] باشد پروفایل کاربر دیگر؛ وگرنه خودم.
 */
export default function ProfileSection() {
  const { segments } = useHashRoute();
  const userId = segments[1];

  if (userId) {
    return <PublicProfileView key={userId} userId={userId} />;
  }
  return <MyProfileView />;
}

function MyProfileView() {
  const user = useSession((s) => s.user);
  const [editOpen, setEditOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["me-profile"],
    queryFn: () => api.get<MyProfile>("/api/users/me"),
    enabled: !!user,
  });

  const { data: lb } = useQuery({
    queryKey: ["leaderboard", "all"],
    queryFn: () => api.get<{ users: LeaderboardRow[]; me: { rank: number; points: number } | null }>("/api/leaderboard?period=all"),
    enabled: !!user,
  });
  const myRank = lb?.me?.rank;

  if (isLoading || !data) {
    return <ProfileSkeleton />;
  }

  const skills = (data.user.skills ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const avatar = data.user.avatar || "🍎";

  return (
    <section className="flex flex-col gap-5" aria-label="پروفایل من">
      {/* محدودهٔ چاپ: hero + آمار + نمودار + نشان‌ها + فعالیت */}
      <div className="printable-area flex flex-col gap-5">
        {/* Hero */}
        <Hero
          user={data.user}
          avatar={avatar}
          skills={skills}
          rank={myRank}
          own
          onEdit={() => setEditOpen(true)}
          printButton={<PrintButton title={`پروفایل ${data.user.name}`} />}
        />

        {/* آمار */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            icon={<Sparkles className="size-4 text-primary" aria-hidden />}
            label="امتیاز"
            value={toFa(data.stats.points)}
            sub={myRank ? `رتبه ${toFa(myRank)}` : "—"}
            tint="primary"
          />
          <StatCard
            icon={<Shield className="size-4 text-chart-5" aria-hidden />}
            label="موجودی وتو"
            value={toFa(data.stats.vetoBalance)}
            tint="teal"
          />
          <StatCard
            icon={<Trophy className="size-4 text-chart-2" aria-hidden />}
            label="تعهد خالص"
            value={
              data.stats.netDebt > 0
                ? `+${toFa(data.stats.netDebt)}`
                : data.stats.netDebt < 0
                  ? toFa(data.stats.netDebt)
                  : toFa(0)
            }
            sub={data.stats.netDebt > 0 ? "طلبکار" : data.stats.netDebt < 0 ? "بدهکار" : "تسویه"}
            tint={data.stats.netDebt >= 0 ? "emerald" : "rose"}
          />
          <StatCard
            icon={<Award className="size-4 text-chart-4" aria-hidden />}
            label="مدال‌ها"
            value={toFa(data.stats.medalsCount)}
            sub={`${toFa(data.stats.badgesCount)} نشان`}
            tint="amber"
          />
        </div>

        {/* نمودار امتیاز */}
        <Card className="glass overflow-hidden rounded-3xl border-0 shadow-sm">
          <CardHeader className="border-b border-border/50 bg-gradient-to-l from-primary/10 via-transparent to-chart-2/10 p-5">
            <CardTitle className="flex items-center gap-2 text-base font-extrabold">
              <Sparkles className="size-4 text-primary" aria-hidden />
              نمودار امتیاز (۶ ماه اخیر)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <PointsChart data={data.pointsSeries} />
          </CardContent>
        </Card>

        {/* نشان‌ها */}
        <BadgesGrid badges={data.badges} />

        {/* مدال‌ها */}
        <MedalsStrip medals={data.medals} />

        {/* فعالیت اخیر */}
        <ActivityTimeline activity={data.activity} />
      </div>

      <EditProfileDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        initial={{
          name: data.user.name,
          bio: data.user.bio,
          skills: data.user.skills,
          avatar: data.user.avatar,
        }}
      />
    </section>
  );
}

function PublicProfileView({ userId }: { userId: string }) {
  const me = useSession((s) => s.user);
  const { data, isLoading } = useQuery({
    queryKey: ["public-profile", userId],
    queryFn: () => api.get<PublicProfile>(`/api/users/${userId}`),
  });
  const { data: lb } = useQuery({
    queryKey: ["leaderboard", "all"],
    queryFn: () => api.get<{ users: LeaderboardRow[]; me: { rank: number; points: number } | null }>("/api/leaderboard?period=all"),
  });
  const targetRow = lb?.users.find((u) => u.user.id === userId);
  const rank = targetRow?.rank;

  if (isLoading || !data) return <ProfileSkeleton />;
  if (!data.user) {
    return (
      <EmptyState
        icon={UserRound}
        title="کاربر یافت نشد"
        description="این کاربر حذف یا غیرفعال شده است."
      />
    );
  }

  const skills = (data.user.skills ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const avatar = data.user.avatar || "🍎";

  return (
    <section className="flex flex-col gap-5" aria-label="پروفایل کاربر">
      <div className="printable-area flex flex-col gap-5">
        <Hero
          user={data.user}
          avatar={avatar}
          skills={skills}
          rank={rank}
          own={data.isMe}
          printButton={<PrintButton title={`پروفایل ${data.user.name}`} />}
        />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            icon={<Sparkles className="size-4 text-primary" aria-hidden />}
            label="امتیاز"
            value={toFa(data.stats.points)}
            sub={rank ? `رتبه ${toFa(rank)}` : "—"}
            tint="primary"
          />
          <StatCard
            icon={<Award className="size-4 text-chart-4" aria-hidden />}
            label="مدال‌ها"
            value={toFa(data.stats.medalsCount)}
            sub={`${toFa(data.stats.badgesCount)} نشان`}
            tint="amber"
          />
          <StatCard
            icon={<Lightbulb className="size-4 text-chart-2" aria-hidden />}
            label="ایده‌ها"
            value={toFa(data.stats.ideasCount)}
            tint="amber"
          />
          <StatCard
            icon={<Hash className="size-4 text-chart-5" aria-hidden />}
            label="نظرسنجی‌ها"
            value={toFa(data.stats.pollsCount)}
            tint="teal"
          />
        </div>

        <BadgesGrid badges={data.badges} />
        <MedalsStrip medals={data.medals} />
        <ActivityTimeline activity={data.activity} />
      </div>

      {/* نشان دادن «من» در پروفایل دیگر */}
      <span className="sr-only">{me ? me.id : ""}</span>
    </section>
  );
}

function Hero({
  user,
  avatar,
  skills,
  rank,
  own,
  onEdit,
  printButton,
}: {
  user: MyProfile["user"] | PublicProfile["user"];
  avatar: string;
  skills: string[];
  rank?: number;
  own: boolean;
  onEdit?: () => void;
  printButton?: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="glass card-hover relative overflow-hidden rounded-3xl p-6 md:p-8"
    >
      <div className="pointer-events-none absolute -top-20 -left-16 size-56 rounded-full bg-primary/15 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-24 -right-16 size-56 rounded-full bg-chart-2/15 blur-3xl" aria-hidden />
      <div className="relative flex flex-col items-start gap-5 md:flex-row md:items-center">
        <div className="flex size-24 shrink-0 items-center justify-center rounded-3xl bg-primary/15 text-6xl shadow-sm">
          {avatar}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-black md:text-3xl">{user.name}</h1>
            <Badge className={cn("text-[11px]", ROLE_BADGE_CLASSES[user.role])}>
              {ROLE_LABELS[user.role]}
            </Badge>
            <Badge variant="outline" className="text-[11px]">
              {STATUS_LABELS[user.status]}
            </Badge>
            {rank && (
              <Badge variant="outline" className="gap-1 text-[11px]">
                <Trophy className="size-3 text-chart-2" aria-hidden />
                رتبه {toFa(rank)}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground" dir="ltr">
            @{user.username}
          </p>
          <p className="text-xs text-muted-foreground">
            عضو از {formatJalaliDate(new Date(user.createdAt))}
          </p>
          {user.bio && (
            <p className="mt-1 text-sm leading-7 text-foreground/80">{user.bio}</p>
          )}
          {skills.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {skills.map((s) => (
                <span
                  key={s}
                  className="rounded-full border border-border/60 bg-background/40 px-2.5 py-0.5 text-[11px] font-semibold"
                >
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>
        {own && onEdit ? (
          <div className="no-print flex items-center gap-2 self-start">
            {printButton}
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={onEdit}
            >
              <Edit3 className="size-4" aria-hidden />
              ویرایش
            </Button>
          </div>
        ) : printButton ? (
          <div className="no-print self-start">{printButton}</div>
        ) : null}
      </div>
    </motion.div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  tint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  tint: "primary" | "teal" | "amber" | "emerald" | "rose";
}) {
  const TINTS: Record<string, string> = {
    primary: "border-primary/30 bg-primary/5",
    teal: "border-chart-5/30 bg-chart-5/5",
    amber: "border-chart-2/40 bg-chart-2/5",
    emerald: "border-chart-1/30 bg-chart-1/5",
    rose: "border-destructive/30 bg-destructive/5",
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn(
        "glass flex flex-col gap-1.5 rounded-2xl border p-4",
        TINTS[tint],
      )}
    >
      <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="text-2xl font-black tabular-nums">{value}</span>
      {sub && (
        <span className="text-[10px] font-semibold text-muted-foreground">{sub}</span>
      )}
    </motion.div>
  );
}

function PointsChart({ data }: { data: { month: string; delta: number }[] }) {
  if (data.length === 0 || data.every((d) => d.delta === 0)) {
    return (
      <div className="flex h-32 flex-col items-center justify-center gap-1 text-sm text-muted-foreground">
        <Sparkles className="size-6 text-muted-foreground/50" aria-hidden />
        هنوز امتیازی در ۶ ماه اخیر جمع نشده.
      </div>
    );
  }
  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
          <defs>
            <linearGradient id="pointsFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.55} />
              <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.3} />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            reversed
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            width={32}
            orientation="right"
            tickFormatter={(v) => toFa(v)}
          />
          <Tooltip
            contentStyle={{
              background: "var(--background)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              fontSize: 12,
            }}
            labelStyle={{ fontWeight: 700 }}
            formatter={(value: number) => [`${toFa(value)} امتیاز`, "این ماه"]}
          />
          <Area
            type="monotone"
            dataKey="delta"
            stroke="var(--chart-1)"
            strokeWidth={2.5}
            fill="url(#pointsFill)"
            dot={{ r: 3, fill: "var(--chart-1)" }}
            activeDot={{ r: 5 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function BadgesGrid({ badges }: { badges: BadgeDTO[] }) {
  return (
    <Card className="glass overflow-hidden rounded-3xl border-0 shadow-sm">
      <CardHeader className="border-b border-border/50 bg-gradient-to-l from-chart-2/10 via-transparent to-chart-4/10 p-5">
        <CardTitle className="flex items-center gap-2 text-base font-extrabold">
          <Award className="size-4 text-chart-2" aria-hidden />
          نشان‌ها
        </CardTitle>
      </CardHeader>
      <CardContent className="p-5">
        {badges.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            هنوز نشان‌ای تعریف نشده.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {badges.map((b, i) => (
              <motion.div
                key={b.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: Math.min(0.04 * i, 0.3), duration: 0.25 }}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-2xl border p-3 text-center",
                  b.earned
                    ? cn("border-border/50 bg-background/40", BADGE_COLOR[b.color] ?? BADGE_COLOR.emerald)
                    : "border-dashed border-border/40 bg-muted/30 opacity-70",
                )}
              >
                <TooltipProvider delayDuration={150}>
                  <UITooltip>
                    <TooltipTrigger asChild>
                      <div className="relative cursor-help">
                        <span className={cn("text-3xl", !b.earned && "grayscale")}>
                          {b.icon}
                        </span>
                        {!b.earned && (
                          <span className="absolute -bottom-1 -left-1 flex size-5 items-center justify-center rounded-full bg-muted-foreground text-background">
                            <Lock className="size-3" aria-hidden />
                          </span>
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[200px] text-center">
                      <p className="text-xs font-bold">{b.name}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {b.description}
                      </p>
                    </TooltipContent>
                  </UITooltip>
                </TooltipProvider>
                <span className="text-xs font-bold">{b.name}</span>
                {b.earned && b.awardedAt && (
                  <span className="text-[10px] text-muted-foreground">
                    {relativeTime(new Date(b.awardedAt))}
                  </span>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MedalsStrip({ medals }: { medals: EarnedMedalDTO[] }) {
  return (
    <Card className="glass overflow-hidden rounded-3xl border-0 shadow-sm">
      <CardHeader className="border-b border-border/50 bg-gradient-to-l from-chart-2/10 via-transparent to-primary/10 p-5">
        <CardTitle className="flex items-center gap-2 text-base font-extrabold">
          <Award className="size-4 text-chart-4" aria-hidden />
          مدال‌ها
        </CardTitle>
      </CardHeader>
      <CardContent className="p-5">
        {medals.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            هنوز مدالی نگرفته — سر به «کتابخانهٔ مدال‌ها» بزن و ببین چه چیزهایی در انتظار توست! 🎖
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {medals.map((m, i) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: Math.min(0.04 * i, 0.3), duration: 0.25 }}
                className="flex flex-col items-center gap-2 rounded-2xl border border-border/50 bg-background/40 p-3 text-center"
              >
                <MedalImage
                  src={m.imageUrl}
                  alt={m.name}
                  className="size-16 rounded-xl border border-border/50 bg-background/60 p-1"
                />
                <span className="text-xs font-black">{m.name}</span>
                <Badge
                  variant="outline"
                  className={cn("text-[9px]", RARITY_CLASSES[m.rarity])}
                >
                  {RARITY_LABELS[m.rarity]}
                </Badge>
                <span className="text-[10px] text-muted-foreground">
                  {relativeTime(new Date(m.awardedAt))}
                </span>
              </motion.div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ActivityTimeline({ activity }: { activity: ActivityItem[] }) {
  return (
    <Card className="glass overflow-hidden rounded-3xl border-0 shadow-sm">
      <CardHeader className="border-b border-border/50 bg-gradient-to-l from-primary/10 via-transparent to-chart-5/10 p-5">
        <CardTitle className="flex items-center gap-2 text-base font-extrabold">
          <Sparkles className="size-4 text-primary" aria-hidden />
          فعالیت اخیر
        </CardTitle>
      </CardHeader>
      <CardContent className="p-5">
        {activity.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title="هنوز فعالیتی نداشته — اولین قدم را بردار! 🌱"
            description="کارهایی مثل ثبت ایده، رأی‌گیری یا ثبت تعهد این‌جا نمایش داده می‌شوند."
          />
        ) : (
          <ScrollArea className="max-h-96">
            <ol className="relative flex flex-col gap-3 ps-4">
              <span className="absolute inset-y-2 start-1 w-px bg-border/60" aria-hidden />
              {activity.map((a, i) => {
                const emoji = ACTION_ICONS[a.action] ?? "•";
                return (
                  <motion.li
                    key={a.id}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(0.03 * i, 0.3), duration: 0.2 }}
                    className="relative"
                  >
                    <span className="absolute -start-3 top-1 flex size-3 items-center justify-center rounded-full bg-primary/30" aria-hidden />
                    <div className="rounded-xl border border-border/40 bg-background/40 p-2.5">
                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="text-base">{emoji}</span>
                        <span className="font-bold">{a.summary}</span>
                        <span className="ms-auto text-muted-foreground">
                          {a.relative}
                        </span>
                      </div>
                    </div>
                  </motion.li>
                );
              })}
            </ol>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

function ProfileSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <Skeleton className="h-48 w-full rounded-3xl" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-64 w-full rounded-3xl" />
      <Skeleton className="h-64 w-full rounded-3xl" />
    </div>
  );
}
