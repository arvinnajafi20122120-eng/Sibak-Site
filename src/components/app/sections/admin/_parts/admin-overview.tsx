"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Check,
  ClipboardList,
  Clock,
  Inbox,
  Lightbulb,
  Megaphone,
  Scale,
  ShieldCheck,
  ShieldQuestion,
  Sparkles,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { toFa, formatJalaliDate } from "@/lib/jalali";
import { api } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/app/sections/_shared/empty-state";
import { SafeAvatar } from "@/components/app/sections/_shared/safe-avatar";
import {
  ACTION_LABEL_FA,
  ACTION_TONE,
  type AdminOverview,
  type AuditRow,
} from "./types";

const COUNTS_CARDS: {
  key: keyof AdminOverview["counts"];
  label: string;
  icon: typeof Users;
  tint: string;
}[] = [
  { key: "usersActive", label: "کاربران فعال", icon: Users, tint: "chart-1" },
  { key: "usersPending", label: "در انتظار تأیید", icon: UserPlus, tint: "chart-2" },
  { key: "guestsCount", label: "اعضای مهمان", icon: Clock, tint: "chart-4" },
  { key: "groups", label: "زیرمجموعه‌ها", icon: Users, tint: "chart-5" },
  { key: "ideasPending", label: "ایده‌های در انتظار", icon: Lightbulb, tint: "chart-4" },
  { key: "pollsOpen", label: "نظرسنجی‌های باز", icon: ShieldQuestion, tint: "chart-5" },
  { key: "debtsOpen", label: "بدهی‌های باز", icon: Scale, tint: "chart-4" },
  { key: "announcements", label: "پیام‌های همگانی", icon: Megaphone, tint: "chart-2" },
  { key: "vetoesGrantedTotal", label: "مجموع وتو داده‌شده", icon: ShieldCheck, tint: "chart-1" },
];

const CHART_COLORS = [
  "oklch(0.72 0.16 150)",
  "oklch(0.78 0.13 95)",
  "oklch(0.7 0.18 25)",
  "oklch(0.7 0.12 200)",
  "oklch(0.7 0.18 60)",
];

const USER_STATUS_DONUT = [
  { key: "usersActive", label: "فعال", color: CHART_COLORS[0] },
  { key: "usersPending", label: "در انتظار", color: CHART_COLORS[1] },
  { key: "usersRejected", label: "ردشده", color: CHART_COLORS[2] },
  { key: "usersSuspended", label: "معلق", color: CHART_COLORS[3] },
] as const;

export function AdminOverview() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => api.get<AdminOverview>("/api/admin/overview"),
  });

  const handleAction = async (
    userId: string,
    action: "approve" | "reject",
  ) => {
    try {
      if (action === "approve") {
        await api.post(`/api/admin/users/${userId}/approve`, {});
        toast.success("عضویت کاربر تأیید شد");
      } else {
        await api.post(`/api/admin/users/${userId}/reject`, {
          note: "درخواست شما در تأیید نهایی نشد. در صورت تمایل دوباره درخواست دهید.",
        });
        toast.success("عضویت کاربر رد شد");
      }
      await qc.invalidateQueries({ queryKey: ["admin-overview"] });
      await qc.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا در انجام عملیات");
    }
  };

  const handleGroupRequest = async (
    groupId: string,
    userId: string,
    action: "approve" | "reject",
  ) => {
    try {
      await api.post(`/api/groups/${groupId}/requests`, { userId, action });
      toast.success(action === "approve" ? "درخواست عضویت تأیید شد" : "درخواست عضویت رد شد");
      await qc.invalidateQueries({ queryKey: ["admin-overview"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا در انجام عملیات");
    }
  };

  if (isLoading || !data) {
    return <OverviewSkeleton />;
  }

  const userStatusData = USER_STATUS_DONUT.map((d) => ({
    name: d.label,
    value: data.counts[d.key],
    color: d.color,
  })).filter((d) => d.value > 0);

  const contentData = [
    { name: "ایده‌ها", value: data.counts.ideasTotal, color: CHART_COLORS[0] },
    { name: "نظرسنجی‌ها", value: data.counts.pollsOpen, color: CHART_COLORS[1] },
    { name: "گروه‌ها", value: data.counts.groups, color: CHART_COLORS[2] },
    { name: "بدهی‌ها", value: data.counts.debtsOpen, color: CHART_COLORS[3] },
    { name: "پیام‌ها", value: data.counts.announcements, color: CHART_COLORS[4] },
  ];

  return (
    <div className="flex flex-col gap-5">
      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {COUNTS_CARDS.map((card, idx) => {
          const value = data.counts[card.key];
          const Icon = card.icon;
          return (
            <motion.div
              key={card.key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.03 }}
              className="glass card-hover rounded-2xl p-4"
            >
              <div className="flex items-center justify-between">
                <div
                  className={cn(
                    "flex size-10 items-center justify-center rounded-xl",
                    `bg-${card.tint}/15`,
                  )}
                >
                  <Icon className={`size-5 text-chart-${card.tint}`} aria-hidden />
                </div>
                <Sparkles className="size-3.5 text-muted-foreground/60" aria-hidden />
              </div>
              <p className="mt-3 text-2xl font-black tabular-nums">
                {toFa(value)}
              </p>
              <p className="text-xs text-muted-foreground">{card.label}</p>
            </motion.div>
          );
        })}
      </div>

      {/* نمودارها */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="glass rounded-3xl border-0 shadow-sm">
          <CardHeader className="border-b border-border/50 bg-gradient-to-l from-primary/10 via-transparent to-transparent p-5">
            <CardTitle className="flex items-center gap-2 text-sm font-extrabold">
              <Users className="size-4 text-primary" aria-hidden />
              ترکیب کاربران بر اساس وضعیت
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {userStatusData.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                کاربری ثبت نشده است.
              </p>
            ) : (
              <div className="flex flex-col items-center gap-4 sm:flex-row">
                <div className="size-44 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={userStatusData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={45}
                        outerRadius={70}
                        paddingAngle={2}
                        stroke="none"
                      >
                        {userStatusData.map((d, i) => (
                          <Cell key={i} fill={d.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v: number) => toFa(v)}
                        contentStyle={{
                          borderRadius: 12,
                          border: "1px solid var(--border)",
                          fontFamily: "inherit",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="flex flex-col gap-2 text-sm">
                  {userStatusData.map((d, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span
                        className="size-3 rounded-full"
                        style={{ backgroundColor: d.color }}
                        aria-hidden
                      />
                      <span className="font-semibold">{d.name}</span>
                      <span className="text-muted-foreground tabular-nums">
                        {toFa(d.value)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass rounded-3xl border-0 shadow-sm">
          <CardHeader className="border-b border-border/50 bg-gradient-to-l from-chart-2/10 via-transparent to-transparent p-5">
            <CardTitle className="flex items-center gap-2 text-sm font-extrabold">
              <ClipboardList className="size-4 text-accent-foreground" aria-hidden />
              شمارش محتواها
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={contentData}
                  margin={{ top: 8, right: 8, bottom: 0, left: -16 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="var(--border)"
                    opacity={0.5}
                  />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fontFamily: "inherit" }}
                    reversed
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fontFamily: "inherit" }}
                    tickFormatter={(v) => toFa(Number(v))}
                    axisLine={false}
                    tickLine={false}
                    width={32}
                  />
                  <Tooltip
                    formatter={(v: number) => toFa(v)}
                    cursor={{ fill: "var(--muted)" }}
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid var(--border)",
                      fontFamily: "inherit",
                    }}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={32}>
                    {contentData.map((d, i) => (
                      <Cell key={i} fill={d.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* در انتظار تأیید + درخواست‌های عضویت گروه */}
      <div className="grid gap-4 lg:grid-cols-2">
        <PendingUsersCard
          users={data.recentPending}
          onApprove={(id) => handleAction(id, "approve")}
          onReject={(id) => handleAction(id, "reject")}
        />
        <GroupRequestsCard
          requests={data.pendingJoinRequests}
          onApprove={(gid, uid) => handleGroupRequest(gid, uid, "approve")}
          onReject={(gid, uid) => handleGroupRequest(gid, uid, "reject")}
        />
      </div>

      {/* audit log */}
      <AuditLogCard rows={data.recentAudit} />
    </div>
  );
}

function PendingUsersCard({
  users,
  onApprove,
  onReject,
}: {
  users: AdminOverview["recentPending"];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);

  if (users.length === 0) {
    return (
      <Card className="glass rounded-3xl border-0 shadow-sm">
        <CardHeader className="border-b border-border/50 p-5">
          <CardTitle className="flex items-center gap-2 text-sm font-extrabold">
            <Inbox className="size-4 text-primary" aria-hidden />
            در انتظار تأیید عضویت
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <EmptyState
            icon={Check}
            title="صف خالی است"
            description="هیچ کاربر جدیدی در انتظار تأیید ادمین نیست."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass rounded-3xl border-0 shadow-sm">
      <CardHeader className="border-b border-border/50 p-5">
        <CardTitle className="flex items-center gap-2 text-sm font-extrabold">
          <Inbox className="size-4 text-primary" aria-hidden />
          در انتظار تأیید عضویت
          <Badge className="bg-chart-2/15 text-accent-foreground border-chart-2/40">
            {toFa(users.length)}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="max-h-96 overflow-y-auto p-2">
        <ul className="flex flex-col gap-1">
          {users.map((u) => (
            <li
              key={u.id}
              className="flex items-center justify-between gap-3 rounded-xl p-2 hover:bg-secondary/50"
            >
              <div className="flex min-w-0 items-center gap-2">
                <SafeAvatar user={u} className="size-9" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{u.name}</p>
                  <p className="truncate text-xs text-muted-foreground" dir="ltr">
                    @{u.username}
                  </p>
                  {u.joinReason && (
                    <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground/80">
                      {u.joinReason}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Button
                  size="sm"
                  variant="default"
                  className="h-9 gap-1.5 px-3 text-xs"
                  disabled={busyId === u.id}
                  onClick={async () => {
                    setBusyId(u.id);
                    await onApprove(u.id);
                    setBusyId(null);
                  }}
                >
                  <Check className="size-3.5" aria-hidden />
                  تأیید
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-9 gap-1.5 px-3 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                  disabled={busyId === u.id}
                  onClick={async () => {
                    setBusyId(u.id);
                    await onReject(u.id);
                    setBusyId(null);
                  }}
                >
                  <X className="size-3.5" aria-hidden />
                  رد
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function GroupRequestsCard({
  requests,
  onApprove,
  onReject,
}: {
  requests: AdminOverview["pendingJoinRequests"];
  onApprove: (groupId: string, userId: string) => void;
  onReject: (groupId: string, userId: string) => void;
}) {
  const [busyKey, setBusyKey] = useState<string | null>(null);

  if (requests.length === 0) {
    return (
      <Card className="glass rounded-3xl border-0 shadow-sm">
        <CardHeader className="border-b border-border/50 p-5">
          <CardTitle className="flex items-center gap-2 text-sm font-extrabold">
            <Users className="size-4 text-chart-5" aria-hidden />
            درخواست‌های عضویت گروه
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <EmptyState
            icon={Check}
            title="صف خالی است"
            description="هیچ درخواست عضویت گروهی در انتظار بررسی نیست."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass rounded-3xl border-0 shadow-sm">
      <CardHeader className="border-b border-border/50 p-5">
        <CardTitle className="flex items-center gap-2 text-sm font-extrabold">
          <Users className="size-4 text-chart-5" aria-hidden />
          درخواست‌های عضویت گروه
          <Badge className="bg-chart-5/15 text-chart-5 border-chart-5/30">
            {toFa(requests.length)}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="max-h-96 overflow-y-auto p-2">
        <ul className="flex flex-col gap-1">
          {requests.map((r) => {
            const key = `${r.groupId}-${r.userId}`;
            return (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 rounded-xl p-2 hover:bg-secondary/50"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <SafeAvatar user={r.user} className="size-9" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{r.user.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      درخواست عضویت در «{r.groupName}»
                    </p>
                    <p className="text-[11px] text-muted-foreground/80">
                      {r.relative}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="default"
                    className="h-9 gap-1.5 px-3 text-xs"
                    disabled={busyKey === key}
                    onClick={async () => {
                      setBusyKey(key);
                      await onApprove(r.groupId, r.userId);
                      setBusyKey(null);
                    }}
                  >
                    <Check className="size-3.5" aria-hidden />
                    پذیرفتن
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-9 gap-1.5 px-3 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                    disabled={busyKey === key}
                    onClick={async () => {
                      setBusyKey(key);
                      await onReject(r.groupId, r.userId);
                      setBusyKey(null);
                    }}
                  >
                    <X className="size-3.5" aria-hidden />
                    رد
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

function AuditLogCard({ rows }: { rows: AuditRow[] }) {
  if (rows.length === 0) {
    return (
      <Card className="glass rounded-3xl border-0 shadow-sm">
        <CardHeader className="border-b border-border/50 p-5">
          <CardTitle className="flex items-center gap-2 text-sm font-extrabold">
            <ClipboardLogIcon />
            فعالیت‌های اخیر ادمین
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <EmptyState
            icon={ClipboardList}
            title="هنوز فعالیتی ثبت نشده"
            description="به‌محض انجام اولین عملیات ادمین، این‌جا نمایش داده می‌شود."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass rounded-3xl border-0 shadow-sm">
      <CardHeader className="border-b border-border/50 p-5">
        <CardTitle className="flex items-center gap-2 text-sm font-extrabold">
          <ClipboardLogIcon />
          فعالیت‌های اخیر ادمین
        </CardTitle>
      </CardHeader>
      <CardContent className="max-h-[28rem] overflow-y-auto p-2">
        <ul className="flex flex-col gap-1">
          {rows.map((a) => {
            const tone =
              ACTION_TONE[a.action] ??
              "bg-secondary text-secondary-foreground border-border";
            const labelFa =
              ACTION_LABEL_FA[a.action] ?? a.action.replace(/_/g, " ");
            return (
              <li
                key={a.id}
                className="flex items-start gap-3 rounded-xl p-2 hover:bg-secondary/40"
              >
                <div className="mt-0.5 shrink-0">
                  {a.actor ? (
                    <SafeAvatar user={a.actor} className="size-8" />
                  ) : (
                    <div className="flex size-8 items-center justify-center rounded-full bg-secondary text-xs">
                      🗿
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={cn(
                        "rounded-md border px-1.5 py-0.5 text-[10px] font-bold",
                        tone,
                      )}
                    >
                      {labelFa}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {a.relative}
                    </span>
                  </div>
                  <p className="mt-1 text-sm leading-6 text-foreground/90">
                    {a.summary}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground/70">
                    {formatJalaliDate(new Date(a.createdAt))}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

function ClipboardLogIcon() {
  return (
    <span className="flex size-4 items-center justify-center text-primary">
      <ClipboardList className="size-4" aria-hidden />
    </span>
  );
}

function OverviewSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            className="glass card-hover rounded-2xl p-4"
            style={{ opacity: 1 - i * 0.05 }}
          >
            <Skeleton className="mb-3 size-10 rounded-xl" />
            <Skeleton className="mb-2 h-7 w-16" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-64 rounded-3xl" />
        <Skeleton className="h-64 rounded-3xl" />
      </div>
      <Skeleton className="h-72 rounded-3xl" />
    </div>
  );
}
