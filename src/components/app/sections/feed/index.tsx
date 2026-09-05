"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Bell,
  CalendarClock,
  Flame,
  Megaphone,
  Pencil,
  ScrollText,
  Sparkles,
  Star,
  Vote,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";
import { formatJalaliFullDate, formatJalaliDate, toFa, relativeTime } from "@/lib/jalali";
import { api } from "@/lib/api-client";
import { useSession } from "@/store/session";
import { useHashRoute } from "@/components/app/router";
import {
  ROLE_LABELS,
  navItemsForRole,
} from "@/components/app/nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SafeAvatar } from "@/components/app/sections/_shared/safe-avatar";
import type { SafeUser, SiteRule } from "@/lib/types";
import type { CalendarEventListItem } from "@/components/app/sections/_shared/types";
import type { Poll, Announcement } from "@/components/app/sections/polls/_parts/types";
import type { IdeaListItem } from "@/components/app/sections/_shared/types";
import type { LeaderboardRow } from "@/components/app/sections/profile/_parts/types";

const QUOTES = [
  "همکاری، برابر است با پیشرفت.",
  "یک قدم کوچک از یک ایده بزرگ، مهم‌تر از یک قدم بزرگ از هزار فکر است.",
  "هم‌کلاسی‌ات از رقیب‌هایت مهم‌ترند؛ امروز کمک، فردا اعتماد.",
  "هر تعهد جبران‌شده، یک آجر در ساختمان اعتبار توست.",
  "نظر مخالف، فرصت یادگیری است؛ نه حمله.",
];

const EVENT_TYPE_ICON: Record<string, string> = {
  EXAM: "📝",
  HOMEWORK: "📚",
  MEETING: "🗓",
  HOLIDAY: "🎉",
  PROJECT: "🚀",
  GENERAL: "📌",
};

/** قوانین پیش‌فرض — تا زمانی که settings از سرور برسد. */
const FALLBACK_RULES: SiteRule[] = [
  {
    title: "احترام متقابل، همیشه",
    body: "در سیبک همه با هم یاد می‌گیرند؛ نظر مخالف را با استدلال و ادب مطرح کنید، نه با تحقیر.",
  },
  {
    title: "شفافیت، ارز مشترک",
    body: "هر تصمیم جمعی، تغییر وضعیت و حذف محتوا در پرونده‌ها ثبت می‌شود؛ پشت پرده کاری در کار نیست.",
  },
  {
    title: "بدهکاری را جدی بگیر",
    body: "تعهد کوچک مثل «گزارش آزمایش» هم بدهی است؛ سر موعدش پس بده تا اعتماد از بین نرود.",
  },
  {
    title: "وتو، آخرین نه نه‌ی همیشگی",
    body: "وتو ابزار مسئولانه است، نه سلاح؛ هر استفاده از آن باید در دفتر وتوها قابل ردیابی باشد.",
  },
];

/** آیکون‌های تزئینی کنار شمارهٔ هر قانون. */
const RULE_GLYPHS = [
  "🤝", "📜", "⚖️", "🛡", "✨",
  "🌳", "⏳", "🤲", "🌙", "🌱",
];

/**
 * خانهٔ غنی سیبک — خوش‌آمد، آمار سریع، رویدادهای پیش‌رو، نظرسنجی‌های باز،
 * ایده‌های داغ، پیام همگانی، قوانین و دسترسی سریع.
 * همهٔ fetch ها با TanStack Query به‌صورت موازی انجام می‌شوند.
 */
export default function FeedSection() {
  const user = useSession((s) => s.user);
  const unreadCount = useSession((s) => s.unreadCount);
  const settings = useSession((s) => s.settings);
  const { navigate } = useHashRoute();
  const reduce = useReducedMotion();
  const items = navItemsForRole(user?.role).filter((i) => i.key !== "home");

  // کوئری‌های موازی
  const eventsQ = useQuery({
    queryKey: ["feed", "events"],
    queryFn: () =>
      api.get<{ events: CalendarEventListItem[]; upcoming: CalendarEventListItem[] }>(
        "/api/events?upcoming=1",
      ),
    staleTime: 60_000,
  });
  const pollsQ = useQuery({
    queryKey: ["feed", "polls"],
    queryFn: () =>
      api.get<{ polls: Poll[] }>("/api/polls?status=OPEN"),
    staleTime: 60_000,
  });
  const ideasQ = useQuery({
    queryKey: ["feed", "ideas"],
    queryFn: () =>
      api.get<{ ideas: IdeaListItem[] }>("/api/ideas?sort=top&status=APPROVED"),
    staleTime: 60_000,
  });
  const annQ = useQuery({
    queryKey: ["feed", "announcement"],
    queryFn: () =>
      api.get<{ announcements: Announcement[] }>("/api/announcements"),
    staleTime: 60_000,
  });
  const debtsStatsQ = useQuery({
    queryKey: ["feed", "debt-stats"],
    queryFn: () =>
      api.get<{ iOwe: number; owedToMe: number; openCount: number }>("/api/debts/stats"),
    staleTime: 60_000,
  });
  const lbQ = useQuery({
    queryKey: ["feed", "leaderboard"],
    queryFn: () =>
      api.get<{ users: LeaderboardRow[]; me: { rank: number } | null }>(
        "/api/leaderboard?period=all",
      ),
    staleTime: 60_000,
  });

  const upcomingEvents = (eventsQ.data?.upcoming ?? eventsQ.data?.events ?? []).slice(0, 3);
  const openPolls = (pollsQ.data?.polls ?? []).slice(0, 2);
  const hotIdeas = (ideasQ.data?.ideas ?? []).slice(0, 2);
  const lastAnnouncement = annQ.data?.announcements?.[0] ?? null;
  const debtOpen = debtsStatsQ.data?.openCount ?? 0;
  const myRank = lbQ.data?.me?.rank;

  const quote = useMemo(() => {
    const i = Math.floor(Date.now() / (1000 * 60 * 60 * 6)) % QUOTES.length;
    return QUOTES[i];
  }, []);

  // قوانین از تنظیمات سرور؛ در نبود آن، قوانین پیش‌فرض
  const rules = settings?.siteRules?.length ? settings.siteRules : FALLBACK_RULES;
  const isAdmin = user?.role === "ADMIN";

  return (
    <div className="flex flex-col gap-6">
      {/* بنر عضو مهمان — فقط برای GUEST */}
      {user?.role === "GUEST" && <GuestBanner />}

      {/* کارت خوش‌آمد */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="glass card-hover relative overflow-hidden rounded-3xl p-6 md:p-8"
        aria-label="خوش‌آمدگویی"
      >
        <div className="pointer-events-none absolute -top-20 -left-20 size-64 animate-blob rounded-full bg-primary/15 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-24 -right-16 size-56 animate-blob rounded-full bg-chart-2/15 blur-3xl [animation-delay:-6s]" aria-hidden />
        <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-black md:text-3xl">
              سلام {user?.name || "دوست"} 👋
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {formatJalaliFullDate(new Date())} · نقش شما:{" "}
              <span className="font-semibold text-foreground">
                {user ? ROLE_LABELS[user.role] : "—"}
              </span>
            </p>
            <p className="mt-2 max-w-md text-sm leading-7 text-primary/80">
              «{quote}»
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-2 lg:grid-cols-4">
            <StatChip
              icon={<Sparkles className="size-4 text-primary" aria-hidden />}
              label="امتیاز"
              value={toFa(user?.points ?? 0)}
              sub={myRank ? `رتبه ${toFa(myRank)}` : undefined}
              onClick={() => navigate("/leaderboard")}
            />
            <StatChip
              icon={<Bell className="size-4 text-chart-2" aria-hidden />}
              label="اعلان نخوانده"
              value={toFa(unreadCount)}
              onClick={() => navigate("/notifications")}
            />
            <StatChip
              icon={<Megaphone className="size-4 text-chart-5" aria-hidden />}
              label="تعهد فعال"
              value={toFa(debtOpen)}
              onClick={() => navigate("/debts")}
            />
            <StatChip
              icon={<Star className="size-4 text-chart-4" aria-hidden />}
              label="ایده‌ها"
              value="→"
              onClick={() => navigate("/ideas")}
            />
          </div>
        </div>
      </motion.section>

      {/* رویدادهای پیش‌رو + نظرسنجی‌های باز */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* رویدادها */}
        <FeedCard
          title="رویدادهای پیش‌رو"
          icon={<CalendarClock className="size-5 text-primary" aria-hidden />}
          link="#/calendar"
          linkLabel="تقویم"
          onLink={() => navigate("/calendar")}
          isLoading={eventsQ.isLoading}
          empty={
            <p className="text-sm text-muted-foreground">
              هیچ رویدادی در ۷ روز آینده نیست.
            </p>
          }
          emptyCondition={upcomingEvents.length === 0}
        >
          <div className="flex flex-col gap-2">
            {upcomingEvents.map((e) => (
              <div
                key={e.id}
                className="flex items-center gap-3 rounded-xl border border-border/40 bg-background/40 p-2.5"
              >
                <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-lg">
                  {EVENT_TYPE_ICON[e.type] ?? EVENT_TYPE_ICON.GENERAL}
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-bold">{e.title}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {formatJalaliDate(new Date(e.date))}
                    {e.group ? ` · ${e.group.name}` : ""}
                  </span>
                </div>
                <Badge variant="outline" className="text-[10px]">
                  {relativeTime(new Date(e.date))}
                </Badge>
              </div>
            ))}
          </div>
        </FeedCard>

        {/* نظرسنجی‌های باز */}
        <FeedCard
          title="نظرسنجی‌های باز"
          icon={<Vote className="size-5 text-chart-2" aria-hidden />}
          link="#/polls"
          linkLabel="نظرسنجی‌ها"
          onLink={() => navigate("/polls")}
          isLoading={pollsQ.isLoading}
          empty={
            <p className="text-sm text-muted-foreground">
              هیچ نظرسنجی باز نیست.
            </p>
          }
          emptyCondition={openPolls.length === 0}
        >
          <div className="flex flex-col gap-2">
            {openPolls.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => navigate("/polls")}
                className="flex items-center gap-3 rounded-xl border border-border/40 bg-background/40 p-2.5 text-right transition-colors hover:border-chart-2/40 hover:bg-chart-2/5"
              >
                <span className="flex size-9 items-center justify-center rounded-lg bg-chart-2/15 text-lg">
                  {p.type === "VETO_GRANT" ? "🛡" : "🗳"}
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-bold">{p.title}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {toFa(p.totalVotes)} رأی
                    {p.closesAt ? ` · تا ${formatJalaliDate(new Date(p.closesAt))}` : ""}
                  </span>
                </div>
                <ArrowLeft className="size-4 text-muted-foreground/50" aria-hidden />
              </button>
            ))}
          </div>
        </FeedCard>
      </div>

      {/* ایده‌های داغ + پیام همگانی */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* ایده‌های داغ */}
        <FeedCard
          title="ایده‌های داغ"
          icon={<Flame className="size-5 text-chart-4" aria-hidden />}
          link="#/ideas"
          linkLabel="ایده‌ها"
          onLink={() => navigate("/ideas")}
          isLoading={ideasQ.isLoading}
          empty={
            <p className="text-sm text-muted-foreground">
              هنوز ایده‌ی تأییدشده‌ای نیست.
            </p>
          }
          emptyCondition={hotIdeas.length === 0}
        >
          <div className="flex flex-col gap-2">
            {hotIdeas.map((idea) => (
              <button
                key={idea.id}
                type="button"
                onClick={() => navigate("/ideas")}
                className="flex items-center gap-3 rounded-xl border border-border/40 bg-background/40 p-2.5 text-right transition-colors hover:border-chart-4/40 hover:bg-chart-4/5"
              >
                <span className="flex size-9 items-center justify-center rounded-lg bg-chart-4/15 text-lg">
                  💡
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-bold">{idea.title}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {idea.author.name}
                    {idea.group ? ` · ${idea.group.name}` : ""}
                  </span>
                </div>
                <Badge variant="outline" className="gap-1 text-[10px]">
                  <Star className="size-3 text-chart-2" aria-hidden />
                  {toFa(idea.votesCount)}
                </Badge>
              </button>
            ))}
          </div>
        </FeedCard>

        {/* پیام همگانی */}
        <FeedCard
          title="پیام همگانی"
          icon={<Megaphone className="size-5 text-chart-5" aria-hidden />}
          link="#/announcements"
          linkLabel="پیام‌ها"
          onLink={() => navigate("/announcements")}
          isLoading={annQ.isLoading}
          empty={
            <p className="text-sm text-muted-foreground">
              پیام همگانی‌ای منتشر نشده است.
            </p>
          }
          emptyCondition={!lastAnnouncement}
        >
          {lastAnnouncement && (
            <div className="rounded-xl border border-border/40 bg-background/40 p-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold">{lastAnnouncement.title}</span>
                {lastAnnouncement.pinned && (
                  <Badge className="gap-1 bg-chart-2/15 text-accent-foreground">
                    📌 سنجاق
                  </Badge>
                )}
                {lastAnnouncement.createdBy && (
                  <span className="ms-auto flex items-center gap-1">
                    <SafeAvatar
                      user={lastAnnouncement.createdBy as SafeUser}
                      className="size-5"
                    />
                    <span className="text-[10px] text-muted-foreground">
                      {lastAnnouncement.createdBy.name}
                    </span>
                  </span>
                )}
              </div>
              <p className="mt-2 line-clamp-3 text-xs leading-6 text-foreground/80">
                {lastAnnouncement.body}
              </p>
              <span className="mt-2 block text-[10px] text-muted-foreground">
                {relativeTime(new Date(lastAnnouncement.createdAt))}
              </span>
            </div>
          )}
        </FeedCard>
      </div>

      {/* دسترسی سریع */}
      <section aria-label="دسترسی سریع">
        <h2 className="mb-3 flex items-center gap-2 text-base font-extrabold">
          <Star className="size-4 text-chart-2" aria-hidden />
          دسترسی سریع
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, i) => {
            const Icon = item.icon;
            return (
              <motion.button
                key={item.key}
                type="button"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * i, duration: 0.3 }}
                onClick={() => navigate(`/${item.key}`)}
                className="glass card-hover group flex items-start gap-4 rounded-2xl p-5 text-right"
              >
                <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <Icon className="size-6" aria-hidden />
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold">{item.label}</span>
                  </div>
                  <span className="text-xs leading-5 text-muted-foreground">
                    {item.desc}
                  </span>
                </div>
                <ArrowLeft
                  className="mt-1 size-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:-translate-x-1 group-hover:text-primary"
                  aria-hidden
                />
              </motion.button>
            );
          })}
        </div>
      </section>

      {/* قوانین سیبک — طومار کاغذی گرایانه */}
      <motion.section
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scaleY: 0.9 }}
        whileInView={
          reduce
            ? { opacity: 1 }
            : { opacity: 1, y: 0, scaleY: 1 }
        }
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: reduce ? 0.2 : 0.6, ease: [0.16, 1, 0.3, 1] }}
        aria-label="قوانین سیبک"
        className="scroll-rules"
      >
        <div className="relative rounded-2xl">
          {/* لبهٔ لوله‌شدهٔ بالای طومار */}
          <div className="parchment-edge-top" aria-hidden />
          {/* بدنهٔ طومار */}
          <div className="parchment parchment-text rounded-none px-5 py-7 md:px-9 md:py-10">
            <header className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-dashed border-current/30 pb-4">
              <div className="flex items-center gap-3">
                <span
                  className="flex size-11 shrink-0 items-center justify-center rounded-full bg-current/10 text-xl"
                  aria-hidden
                >
                  <ScrollText className="size-6" />
                </span>
                <div>
                  <h2 className="text-xl font-black tracking-tight md:text-2xl">
                    قوانین سیبک
                  </h2>
                  <p className="mt-0.5 text-[11px] font-medium opacity-70">
                    منشور همکاری و رفتار جمعی — خوانده و رعایت کن.
                  </p>
                </div>
              </div>
              {isAdmin && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="no-print h-9 min-h-9 gap-1.5 rounded-xl border-current/40 bg-current/10 text-xs font-bold hover:bg-current/20"
                  onClick={() => navigate("/admin/settings")}
                >
                  <Pencil className="size-3.5" aria-hidden />
                  ویرایش قوانین
                </Button>
              )}
            </header>

            <ol className="flex flex-col gap-5">
              {rules.map((rule, i) => {
                const glyph = RULE_GLYPHS[i % RULE_GLYPHS.length];
                return (
                  <motion.li
                    key={`${rule.title}-${i}`}
                    initial={reduce ? false : { opacity: 0, x: -10 }}
                    whileInView={
                      reduce ? { opacity: 1 } : { opacity: 1, x: 0 }
                    }
                    viewport={{ once: true }}
                    transition={{
                      duration: reduce ? 0.15 : 0.4,
                      delay: reduce ? 0 : i * 0.06,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    className="flex flex-col gap-2 border-r-2 border-current/40 pr-4 md:flex-row md:items-start md:gap-4 md:pr-6"
                  >
                    <div className="flex items-center gap-2 md:flex-col md:items-center md:gap-1">
                      <span
                        className="flex size-9 shrink-0 items-center justify-center rounded-full border-2 border-current/40 bg-current/10 text-base font-black"
                        aria-hidden
                      >
                        {toFa(i + 1)}
                      </span>
                      <span
                        className="text-lg md:mt-1"
                        aria-hidden
                      >
                        {glyph}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base font-bold leading-7 md:text-lg">
                        {rule.title}
                      </h3>
                      <p className="mt-1 text-[13px] leading-7 opacity-85 md:text-sm md:leading-8">
                        {rule.body}
                      </p>
                    </div>
                  </motion.li>
                );
              })}
            </ol>

            <footer className="mt-7 flex flex-wrap items-center justify-between gap-2 border-t border-dashed border-current/30 pt-4 text-[11px] font-medium opacity-70">
              <span>تعداد قوانین: {toFa(rules.length)} ماده</span>
              <span className="italic">سیبک · منشور همکاری</span>
            </footer>
          </div>
          {/* لبهٔ لوله‌شدهٔ پایین طومار */}
          <div className="parchment-edge-bottom" aria-hidden />
        </div>
      </motion.section>
    </div>
  );
}

function GuestBanner() {
  const user = useSession((s) => s.user);
  const expiresAt = user?.guestExpiresAt ? new Date(user.guestExpiresAt) : null;
  const isExpired = expiresAt ? expiresAt < new Date() : false;
  return (
    <motion.section
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      aria-label="بنر عضو مهمان"
      className={cn(
        "relative overflow-hidden rounded-3xl border p-5 md:p-6",
        isExpired
          ? "border-destructive/40 bg-destructive/10"
          : "border-chart-4/40 bg-chart-4/10",
      )}
    >
      <div
        className="pointer-events-none absolute -top-16 -left-10 size-44 animate-blob rounded-full bg-chart-4/15 blur-3xl"
        aria-hidden
      />
      <div className="relative flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-2xl",
              isExpired
                ? "bg-destructive/15 text-destructive"
                : "bg-chart-4/15 text-chart-4",
            )}
          >
            <CalendarClock className="size-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-extrabold md:text-lg">
              شما به‌عنوان عضو مهمان وارد شده‌اید
            </h2>
            <p className="mt-1 text-xs leading-6 text-muted-foreground">
              دسترسی شما فقط‌خواندنی است؛ برخی عملیات (ساخت ایده، رأی، بدهی، عضویت در گروه و نظرسنجی) برای اعضای مهمان محدود است.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {user?.guestScope && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-2.5 py-1">
              <ScrollText className="size-3 text-muted-foreground" aria-hidden />
              {user.guestScope}
            </span>
          )}
          {expiresAt && (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-bold",
                isExpired
                  ? "border-destructive/40 bg-destructive/10 text-destructive"
                  : "border-chart-4/40 bg-chart-4/10 text-chart-4",
              )}
            >
              <CalendarClock className="size-3" aria-hidden />
              اعتبار تا {formatJalaliDate(expiresAt)} · {relativeTime(expiresAt)}
              {isExpired && " (منقضی)"}
            </span>
          )}
        </div>
      </div>
    </motion.section>
  );
}

function StatChip({
  icon,
  label,
  value,
  sub,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "flex min-w-20 flex-col items-center gap-1 rounded-2xl border border-border/60 bg-background/60 px-3 py-3",
        onClick && "transition-colors hover:border-primary/40 hover:bg-primary/5",
      )}
    >
      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="text-lg font-black tabular-nums">{value}</span>
      {sub && <span className="text-[10px] font-semibold text-muted-foreground">{sub}</span>}
    </button>
  );
}

function FeedCard({
  title,
  icon,
  link,
  linkLabel,
  onLink,
  children,
  isLoading,
  empty,
  emptyCondition,
}: {
  title: string;
  icon: React.ReactNode;
  link?: string;
  linkLabel?: string;
  onLink?: () => void;
  children?: React.ReactNode;
  isLoading?: boolean;
  empty?: React.ReactNode;
  emptyCondition?: boolean;
}) {
  return (
    <Card className="glass flex flex-col overflow-hidden rounded-3xl border-0 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-2 border-b border-border/50 p-4">
        <CardTitle className="flex items-center gap-2 text-sm font-extrabold">
          {icon}
          {title}
        </CardTitle>
        {linkLabel && (
          <button
            type="button"
            onClick={onLink}
            className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            {linkLabel}
            <ArrowLeft className="size-3" aria-hidden />
          </button>
        )}
      </CardHeader>
      <CardContent className="flex-1 p-4">
        {isLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        ) : emptyCondition ? (
          empty
        ) : (
          children
        )}
      </CardContent>
      <span className="sr-only">{link ?? ""}</span>
    </Card>
  );
}
