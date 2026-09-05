"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Award,
  CalendarClock,
  CalendarDays,
  Clock,
  FileClock,
  FileText,
  Fingerprint,
  Lightbulb,
  Megaphone,
  MessageSquare,
  Paperclip,
  RotateCcw,
  Scale,
  ShieldCheck,
  Sparkles,
  Stamp,
  Trophy,
  Users,
  Vote,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { toFa, formatJalaliDate, relativeTime } from "@/lib/jalali";
import { api } from "@/lib/api-client";
import { useHashRoute } from "@/components/app/router";
import { useSession } from "@/store/session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { EmptyState } from "@/components/app/sections/_shared/empty-state";
import { SafeAvatar } from "@/components/app/sections/_shared/safe-avatar";
import {
  ACTION_LABEL_FA,
  ACTION_TONE,
  ROLE_CHIP,
  ROLE_LABELS,
  STATUS_CHIP,
  STATUS_LABELS,
  type Dossier,
  type DossierBadge,
  type DossierDebt,
} from "./types";

const CHART_COLORS = [
  "oklch(0.72 0.16 150)",
  "oklch(0.78 0.13 95)",
  "oklch(0.7 0.18 25)",
  "oklch(0.7 0.12 200)",
  "oklch(0.7 0.18 60)",
];

export function AdminDossier({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const { navigate } = useHashRoute();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-dossier", userId],
    queryFn: () => api.get<Dossier>(`/api/admin/dossier/${userId}`),
    enabled: !!userId,
  });

  const refresh = () => {
    void refetch();
    void qc.invalidateQueries({ queryKey: ["admin-users"] });
  };

  if (isLoading || !data) {
    return <DossierSkeleton />;
  }

  return (
    <div className="flex flex-col gap-5">
      <DossierHero
        data={data}
        onRefresh={refresh}
        onOpenEditRole={() => {}}
        onGoToUsers={() => navigate("/admin/users")}
      />
      <DossierCharts data={data} />
      <DossierCounts data={data} />
      <DossierAuditHistory data={data} />
      <DossierContent data={data} onRefresh={refresh} />
      <DossierStatusHistory data={data} />
    </div>
  );
}

function DossierHero({
  data,
  onRefresh,
  onGoToUsers,
}: {
  data: Dossier;
  onRefresh: () => void;
  onOpenEditRole: () => void;
  onGoToUsers: () => void;
}) {
  const u = data.user;
  // شمارهٔ پرونده — هش پایدار از id کاربر (۴ رقم)
  let _h = 0;
  for (let i = 0; i < u.id.length; i++) {
    _h = (_h * 31 + u.id.charCodeAt(i)) % 10000;
  }
  const caseNo = String(_h).padStart(4, "0");

  // مهر وضعیت — رنگ و متن بر اساس status
  const statusStamp: Record<string, { cls: string; text: string }> = {
    ACTIVE: { cls: "case-stamp case-stamp-green", text: "ACTIVE" },
    PENDING: { cls: "case-stamp case-stamp-amber", text: "PENDING" },
    SUSPENDED: { cls: "case-stamp case-stamp-red", text: "SUSPENDED" },
    REJECTED: { cls: "case-stamp case-stamp-red", text: "REJECTED" },
  };
  const stamp = statusStamp[u.status] ?? statusStamp.PENDING!;

  return (
    <Card className="case-folder relative overflow-hidden rounded-3xl border-0">
      {/* گیرهٔ کاغذی گوشه‌ٔ راست */}
      <div className="paperclip" aria-hidden />
      {/* سوراخ‌های کاغذی لبه‌ٔ چپ */}
      <div className="case-punch-holes" aria-hidden>
        <span />
        <span />
      </div>

      <CardContent className="relative flex flex-col gap-5 p-6 md:flex-row md:items-start md:gap-6 md:p-8">
        {/* آواتار با قاب manila */}
        <div className="relative shrink-0">
          <div className="rounded-2xl border-2 border-current/20 bg-amber-900/5 p-1.5 dark:bg-amber-100/5">
            <SafeAvatar user={u} className="size-20 rounded-xl text-3xl" />
          </div>
          <div className="case-number mt-2 text-center">
            FILE № {toFa(caseNo)}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          {/* هویت — مانند سربرگ پرونده */}
          <div className="flex flex-wrap items-center gap-2">
            <h2
              className={cn(
                "typewriter text-2xl font-black tracking-tight",
                u.deletedAt && "line-through opacity-70",
              )}
            >
              {u.name}
            </h2>
            <span
              className="typewriter text-sm text-current/70"
              dir="ltr"
            >
              @{u.username}
            </span>
            <Badge className={cn("border", ROLE_CHIP[u.role])}>
              {ROLE_LABELS[u.role]}
            </Badge>
            <span className={stamp.cls}>
              <Stamp className="size-3" aria-hidden />
              {stamp.text}
            </span>
            {u.deletedAt && (
              <span className="case-stamp case-stamp-red">
                DELETED
              </span>
            )}
          </div>

          {/* خط‌چین دست‌نویس */}
          <div className="case-divider my-3" aria-hidden />

          {/* اطلاعات هویتی — ردیف‌های تایپ‌شده */}
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <div className="flex items-center gap-2">
              <Fingerprint className="size-3.5 shrink-0 text-current/60" aria-hidden />
              <span className="text-current/60">شناسه:</span>
              <span className="typewriter text-xs" dir="ltr">{u.id.slice(-12)}</span>
            </div>
            <div className="flex items-center gap-2">
              <CalendarDays className="size-3.5 shrink-0 text-current/60" aria-hidden />
              <span className="text-current/60">عضو از:</span>
              <span className="font-semibold">{formatJalaliDate(new Date(u.createdAt))}</span>
            </div>
            {u.lastLoginAt && (
              <div className="flex items-center gap-2">
                <Clock className="size-3.5 shrink-0 text-current/60" aria-hidden />
                <span className="text-current/60">آخرین ورود:</span>
                <span className="font-semibold">{relativeTime(new Date(u.lastLoginAt))}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Sparkles className="size-3.5 shrink-0 text-current/60" aria-hidden />
              <span className="text-current/60">امتیاز:</span>
              <span className="typewriter font-bold">{toFa(u.points)}</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-3.5 shrink-0 text-current/60" aria-hidden />
              <span className="text-current/60">موجودی وتو:</span>
              <span className="typewriter font-bold">{toFa(data.vetoBalance)}</span>
            </div>
          </div>

          {/* مهمان: اعتبار و محدوده */}
          {u.role === "GUEST" && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {u.guestExpiresAt && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold",
                    new Date(u.guestExpiresAt) < new Date()
                      ? "border-red-700/30 bg-red-900/10 text-red-700 dark:text-red-300"
                      : "border-amber-800/40 bg-amber-900/10 text-amber-800 dark:text-amber-200",
                  )}
                >
                  <CalendarClock className="size-3" aria-hidden />
                  اعتبار تا: {formatJalaliDate(new Date(u.guestExpiresAt))}
                  {new Date(u.guestExpiresAt) < new Date() && " (منقضی)"}
                </span>
              )}
              {u.guestScope && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-current/20 bg-current/5 px-2.5 py-1 text-[11px]">
                  <Clock className="size-3" aria-hidden />
                  محدوده: {u.guestScope}
                </span>
              )}
            </div>
          )}

          {/* بیو و مهارت‌ها — یادداشت‌های پین‌شده */}
          {u.bio && (
            <div className="pinned-note mt-4 text-sm leading-7">
              <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold text-current/60">
                <Paperclip className="size-3" aria-hidden />
                یادداشت بیوگرافی
              </div>
              {u.bio}
            </div>
          )}

          {u.skills && (
            <div className="mt-2 flex flex-wrap gap-1">
              {u.skills
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
                .map((s, i) => (
                  <span
                    key={i}
                    className="typewriter rounded-md border border-current/20 bg-current/5 px-1.5 py-0.5 text-[11px]"
                  >
                    {s}
                  </span>
                ))}
            </div>
          )}

          {/* یادداشت عضویت و رد */}
          {u.joinReason && (
            <div className="pinned-note mt-3 border-amber-800/30 text-sm leading-7">
              <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold text-current/60">
                <Paperclip className="size-3" aria-hidden />
                دلیل عضویت
              </div>
              {u.joinReason}
            </div>
          )}
          {u.rejectionNote && (
            <div className="pinned-note mt-2 border-red-800/40 text-sm leading-7">
              <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold text-red-800 dark:text-red-300">
                <Paperclip className="size-3" aria-hidden />
                یادداشت رد
              </div>
              {u.rejectionNote}
            </div>
          )}
        </div>

        <DossierQuickActions
          user={u}
          onRefresh={onRefresh}
          onGoToUsers={onGoToUsers}
        />
      </CardContent>
    </Card>
  );
}

function DossierQuickActions({
  user,
  onRefresh,
  onGoToUsers,
}: {
  user: Dossier["user"];
  onRefresh: () => void;
  onGoToUsers: () => void;
}) {
  const me = useSession((s) => s.user);
  const isMe = me?.id === user.id;
  const [pointsOpen, setPointsOpen] = useState(false);
  const [badgeOpen, setBadgeOpen] = useState(false);
  const [vetoOpen, setVetoOpen] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);

  if (isMe) {
    return (
      <p className="self-start rounded-xl bg-secondary/40 p-2 text-xs text-muted-foreground">
        این پرونده‌ی خودتان است؛ عملیات ادمین روی حساب خود محدود است.
      </p>
    );
  }

  return (
    <div className="flex shrink-0 flex-col gap-2 self-start">
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          className="h-9 gap-1.5 text-xs"
          onClick={() => setRoleOpen(true)}
        >
          <Users className="size-3.5" aria-hidden />
          تغییر نقش/وضعیت
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-9 gap-1.5 text-xs"
          onClick={() => setPointsOpen(true)}
        >
          <Sparkles className="size-3.5" aria-hidden />
          ± امتیاز
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-9 gap-1.5 text-xs"
          onClick={() => setVetoOpen(true)}
        >
          <ShieldCheck className="size-3.5" aria-hidden />
          اعطای/کسر وتو
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-9 gap-1.5 text-xs"
          onClick={() => setBadgeOpen(true)}
        >
          <Award className="size-3.5" aria-hidden />
          اعطای نشان
        </Button>
        {user.deletedAt && (
          <Button
            size="sm"
            variant="default"
            className="h-9 gap-1.5 text-xs"
            onClick={async () => {
              try {
                await api.post(`/api/admin/users/${user.id}/restore`, {});
                toast.success("کاربر بازیابی شد");
                onRefresh();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "خطا");
              }
            }}
          >
            <RotateCcw className="size-3.5" aria-hidden />
            بازیابی کاربر
          </Button>
        )}
      </div>
      <Button
        size="sm"
        variant="ghost"
        className="self-start text-xs"
        onClick={onGoToUsers}
      >
        بازگشت به لیست کاربران
      </Button>
      <RoleDialog
        open={roleOpen}
        onOpenChange={setRoleOpen}
        user={user}
        onDone={onRefresh}
      />
      <PointsDialog
        open={pointsOpen}
        onOpenChange={setPointsOpen}
        user={user}
        onDone={onRefresh}
      />
      <BadgeDialog
        open={badgeOpen}
        onOpenChange={setBadgeOpen}
        user={user}
        onDone={onRefresh}
      />
      <VetoDialog
        open={vetoOpen}
        onOpenChange={setVetoOpen}
        user={user}
        onDone={onRefresh}
      />
    </div>
  );
}

function RoleDialog({
  open,
  onOpenChange,
  user,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  user: Dossier["user"];
  onDone: () => void;
}) {
  const [role, setRole] = useState(user.role);
  const [status, setStatus] = useState(user.status);
  const [note, setNote] = useState(user.rejectionNote ?? "");
  const [busy, setBusy] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>تغییر نقش و وضعیت</DialogTitle>
          <DialogDescription>
            {user.name} — تغییرات در AuditLog ثبت و به کاربر اطلاع‌رسانی می‌شود.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-2">
          <div>
            <label className="mb-1 block text-xs font-semibold">نقش</label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MEMBER">کاربر</SelectItem>
                <SelectItem value="MANAGER">مدیر</SelectItem>
                <SelectItem value="ADMIN">ادمین</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold">وضعیت</label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PENDING">در انتظار</SelectItem>
                <SelectItem value="ACTIVE">فعال</SelectItem>
                <SelectItem value="SUSPENDED">معلق</SelectItem>
                <SelectItem value="REJECTED">ردشده</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold">
              یادداشت رد (اختیاری)
            </label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="h-11"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            انصراف
          </Button>
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api.patch(`/api/admin/users/${user.id}`, {
                  role,
                  status,
                  rejectionNote: note || null,
                });
                toast.success("به‌روزرسانی شد");
                onOpenChange(false);
                onDone();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "خطا");
              } finally {
                setBusy(false);
              }
            }}
          >
            ذخیره
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PointsDialog({
  open,
  onOpenChange,
  user,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  user: Dossier["user"];
  onDone: () => void;
}) {
  const [delta, setDelta] = useState("5");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>تنظیم دستی امتیاز</DialogTitle>
          <DialogDescription>
            {user.name} — امتیاز فعلی: {toFa(user.points)}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-2">
          <Input
            value={delta}
            onChange={(e) => setDelta(e.target.value)}
            type="number"
            className="h-11"
            dir="ltr"
          />
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="دلیل"
            className="h-11"
          />
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            انصراف
          </Button>
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api.post(`/api/admin/users/${user.id}/points`, {
                  delta: Number(delta),
                  reason: reason.trim(),
                });
                toast.success("امتیاز به‌روزرسانی شد");
                onOpenChange(false);
                setReason("");
                onDone();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "خطا");
              } finally {
                setBusy(false);
              }
            }}
          >
            ثبت
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BadgeDialog({
  open,
  onOpenChange,
  user,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  user: Dossier["user"];
  onDone: () => void;
}) {
  const [badges, setBadges] = useState<DossierBadge[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  // load badge defs lazily when dialog opens
  useEffect(() => {
    if (!open) return;
    void (async () => {
      try {
        const res = await api.get<{
          badges: {
            id: string;
            key: string;
            name: string;
            description: string;
            icon: string;
            color: string;
          }[];
        }>("/api/badges");
        setBadges(res.badges);
        if (res.badges[0]) setSelected(res.badges[0].id);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "خطا");
      }
    })();
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>اعطای نشان به {user.name}</DialogTitle>
          <DialogDescription>
            نشان‌ها برای تشویق کاربران استفاده می‌شوند.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-2">
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger className="h-11">
              <SelectValue placeholder="یک نشان انتخاب کنید" />
            </SelectTrigger>
            <SelectContent>
              {badges.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.icon} {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="یادداشت (اختیاری)"
            className="h-11"
          />
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            انصراف
          </Button>
          <Button
            disabled={busy || !selected}
            onClick={async () => {
              setBusy(true);
              try {
                await api.post("/api/badges/award", {
                  userId: user.id,
                  badgeId: selected,
                  note: note || undefined,
                });
                toast.success("نشان اعطا شد");
                onOpenChange(false);
                setNote("");
                onDone();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "خطا");
              } finally {
                setBusy(false);
              }
            }}
          >
            اعطا
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function VetoDialog({
  open,
  onOpenChange,
  user,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  user: Dossier["user"];
  onDone: () => void;
}) {
  const [amount, setAmount] = useState("1");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>اعطای/کسر وتو برای {user.name}</DialogTitle>
          <DialogDescription>
            مقدار مثبت = اعطای وتو، منفی = کسر (حداکثر ۱۰).
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-2">
          <Input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            type="number"
            className="h-11"
            dir="ltr"
          />
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="دلیل"
            className="h-11"
          />
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            انصراف
          </Button>
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api.post("/api/vetoes/grant", {
                  userId: user.id,
                  amount: Number(amount),
                  reason: reason.trim(),
                });
                toast.success("دفتر وتو به‌روزرسانی شد");
                onOpenChange(false);
                setReason("");
                onDone();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "خطا");
              } finally {
                setBusy(false);
              }
            }}
          >
            ثبت
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DossierCharts({ data }: { data: Dossier }) {
  const pointsData = data.pointsSeries.map((p) => ({
    month: p.month,
    delta: p.delta,
  }));
  const vetoData = data.vetoSeries.map((v) => ({
    month: v.month,
    اعطا: v.grants,
    مصرف: v.uses,
    موجودی: v.balance,
  }));
  const debtData = data.debtChart.map((d) => ({
    month: d.month,
    بدهی: d.iOwe,
    طلب: d.owedToMe,
    خالص: d.net,
  }));

  const countsDonut = [
    { name: "ایده‌ها", value: data.counts.ideasTotal, color: CHART_COLORS[0] },
    { name: "نظرسنجی‌ها", value: data.counts.pollsTotal, color: CHART_COLORS[1] },
    { name: "بدهی‌ها", value: data.counts.debtsTotal, color: CHART_COLORS[2] },
    { name: "رویدادها", value: data.counts.eventsTotal, color: CHART_COLORS[3] },
    { name: "پیام‌ها", value: data.counts.announcementsTotal, color: CHART_COLORS[4] },
    { name: "نظرات", value: data.counts.commentsTotal, color: "oklch(0.6 0.05 0)" },
  ].filter((d) => d.value > 0);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* نمودار امتیاز */}
      <Card className="glass rounded-3xl border-0 shadow-sm">
        <CardHeader className="border-b border-border/50 bg-gradient-to-l from-primary/10 via-transparent to-transparent p-5">
          <CardTitle className="flex items-center gap-2 text-sm font-extrabold">
            <Sparkles className="size-4 text-primary" aria-hidden />
            نمودار امتیاز (۶ ماه اخیر)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={pointsData}
                margin={{ top: 10, right: 10, bottom: 0, left: -10 }}
              >
                <defs>
                  <linearGradient id="dossierPointsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="oklch(0.72 0.16 150)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="oklch(0.72 0.16 150)" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="var(--border)"
                  opacity={0.5}
                />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 10, fontFamily: "inherit" }}
                  reversed
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fontFamily: "inherit" }}
                  tickFormatter={(v) => toFa(Number(v))}
                  axisLine={false}
                  tickLine={false}
                  width={32}
                />
                <Tooltip
                  formatter={(v: number) => toFa(v)}
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    fontFamily: "inherit",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="delta"
                  stroke="oklch(0.72 0.16 150)"
                  strokeWidth={2}
                  fill="url(#dossierPointsGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* نمودار وتو */}
      <Card className="glass rounded-3xl border-0 shadow-sm">
        <CardHeader className="border-b border-border/50 bg-gradient-to-l from-chart-5/10 via-transparent to-transparent p-5">
          <CardTitle className="flex items-center gap-2 text-sm font-extrabold">
            <ShieldCheck className="size-4 text-chart-5" aria-hidden />
            دفتر وتو (۶ ماه)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={vetoData}
                margin={{ top: 10, right: 10, bottom: 0, left: -10 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="var(--border)"
                  opacity={0.5}
                />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 10, fontFamily: "inherit" }}
                  reversed
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fontFamily: "inherit" }}
                  tickFormatter={(v) => toFa(Number(v))}
                  axisLine={false}
                  tickLine={false}
                  width={32}
                />
                <Tooltip
                  formatter={(v: number) => toFa(v)}
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    fontFamily: "inherit",
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 11, fontFamily: "inherit" }}
                />
                <Bar dataKey="اعطا" fill="oklch(0.72 0.16 150)" radius={[4, 4, 0, 0]} barSize={10} />
                <Bar dataKey="مصرف" fill="oklch(0.6 0.2 18)" radius={[4, 4, 0, 0]} barSize={10} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* نمودار بدهی */}
      <Card className="glass rounded-3xl border-0 shadow-sm">
        <CardHeader className="border-b border-border/50 bg-gradient-to-l from-chart-4/10 via-transparent to-transparent p-5">
          <CardTitle className="flex items-center gap-2 text-sm font-extrabold">
            <Scale className="size-4 text-chart-4" aria-hidden />
            تراز بدهی (۶ ماه)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={debtData}
                margin={{ top: 10, right: 10, bottom: 0, left: -10 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="var(--border)"
                  opacity={0.5}
                />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 10, fontFamily: "inherit" }}
                  reversed
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fontFamily: "inherit" }}
                  tickFormatter={(v) => toFa(Number(v))}
                  axisLine={false}
                  tickLine={false}
                  width={32}
                />
                <Tooltip
                  formatter={(v: number) => toFa(v)}
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    fontFamily: "inherit",
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 11, fontFamily: "inherit" }}
                />
                <Line
                  type="monotone"
                  dataKey="بدهی"
                  stroke="oklch(0.6 0.2 18)"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="طلب"
                  stroke="oklch(0.72 0.16 150)"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="خالص"
                  stroke="oklch(0.78 0.13 95)"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* نمودار ترکیب محتوا */}
      <Card className="glass rounded-3xl border-0 shadow-sm">
        <CardHeader className="border-b border-border/50 bg-gradient-to-l from-chart-2/10 via-transparent to-transparent p-5">
          <CardTitle className="flex items-center gap-2 text-sm font-extrabold">
            <FileClock className="size-4 text-accent-foreground" aria-hidden />
            ترکیب فعالیت‌ها
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          {countsDonut.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              این کاربر هنوز فعالیتی ندارد.
            </p>
          ) : (
            <div className="flex flex-col items-center gap-4 sm:flex-row">
              <div className="size-44 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={countsDonut}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={2}
                      stroke="none"
                    >
                      {countsDonut.map((d, i) => (
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
                {countsDonut.map((d, i) => (
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
    </div>
  );
}

function DossierCounts({ data }: { data: Dossier }) {
  const c = data.counts;
  const items = [
    { label: "ایده‌ها", value: c.ideasTotal, deleted: c.ideasDeleted, icon: Lightbulb, color: "chart-1" },
    { label: "نظرسنجی‌ها", value: c.pollsTotal, deleted: c.pollsDeleted, icon: Vote, color: "chart-5" },
    { label: "بدهی‌ها", value: c.debtsTotal, deleted: c.debtsDeleted, icon: Scale, color: "chart-4" },
    { label: "رویدادها", value: c.eventsTotal, deleted: c.eventsDeleted, icon: CalendarDays, color: "chart-2" },
    { label: "پیام‌ها", value: c.announcementsTotal, deleted: c.announcementsDeleted, icon: Megaphone, color: "chart-2" },
    { label: "نظرات", value: c.commentsTotal, deleted: c.commentsDeleted, icon: MessageSquare, color: "chart-5" },
    { label: "عضویت در گروه", value: c.groupMemberships, deleted: 0, icon: Users, color: "chart-1" },
    { label: "نشان‌ها", value: data.badges.length, deleted: 0, icon: Trophy, color: "chart-2" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((it, idx) => {
        const Icon = it.icon;
        return (
          <div
            key={it.label}
            className="glass card-hover rounded-2xl p-4"
            style={{ animationDelay: `${idx * 30}ms` }}
          >
            <div
              className={cn(
                "flex size-9 items-center justify-center rounded-xl",
                `bg-${it.color}/15`,
              )}
            >
              <Icon className={`size-4 text-chart-${it.color}`} aria-hidden />
            </div>
            <p className="mt-2 text-xl font-black tabular-nums">
              {toFa(it.value)}
            </p>
            <p className="text-xs text-muted-foreground">{it.label}</p>
            {it.deleted > 0 && (
              <p className="mt-1 text-[11px] text-destructive">
                {toFa(it.deleted)} حذف‌شده
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function DossierAuditHistory({ data }: { data: Dossier }) {
  if (data.auditHistory.length === 0) {
    return (
      <Card className="glass rounded-3xl border-0 shadow-sm">
        <CardHeader className="border-b border-border/50 p-5">
          <CardTitle className="flex items-center gap-2 text-sm font-extrabold">
            <FileClock className="size-4 text-primary" aria-hidden />
            تاریخچه فعالیت کامل
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <EmptyState
            icon={FileClock}
            title="فعالیتی ثبت نشده"
            description="این کاربر هنوز عملیاتی در سیبک انجام نداده است."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass rounded-3xl border-0 shadow-sm">
      <CardHeader className="border-b border-border/50 p-5">
        <CardTitle className="flex items-center gap-2 text-sm font-extrabold">
          <FileClock className="size-4 text-primary" aria-hidden />
          تاریخچه فعالیت کامل
          <Badge className="bg-primary/10 text-primary border-primary/30">
            {toFa(data.counts.auditActions)} (۵۰ اخیر)
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-2">
        <Accordion type="single" collapsible>
          {data.auditHistory.map((a) => {
            const tone =
              ACTION_TONE[a.action] ??
              "bg-secondary text-secondary-foreground border-border";
            const labelFa = ACTION_LABEL_FA[a.action] ?? a.action;
            return (
              <AccordionItem
                key={a.id}
                value={a.id}
                className="border-b border-border/40 last:border-b-0"
              >
                <AccordionTrigger className="flex items-center gap-3 py-3 hover:no-underline">
                  <span
                    className={cn(
                      "rounded-md border px-1.5 py-0.5 text-[10px] font-bold",
                      tone,
                    )}
                  >
                    {labelFa}
                  </span>
                  <span className="flex-1 text-right text-sm">
                    {a.summary}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {a.relative}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="pb-3">
                  <p className="text-[11px] text-muted-foreground">
                    {a.dateTimeFa}
                  </p>
                  {a.data !== null && (
                    <pre
                      dir="ltr"
                      className="mt-2 max-h-60 overflow-auto rounded-xl bg-secondary/40 p-2 text-[11px] leading-5"
                    >
                      {JSON.stringify(a.data, null, 2)}
                    </pre>
                  )}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </CardContent>
    </Card>
  );
}

function DossierContent({
  data,
  onRefresh,
}: {
  data: Dossier;
  onRefresh: () => void;
}) {
  const u = data.user;

  const handleRestore = async (
    entityType: string,
    entityId: string,
    label: string,
  ) => {
    if (!confirm(`«${label}» بازیابی شود؟`)) return;
    try {
      await api.post("/api/admin/restore", { entityType, entityId });
      toast.success("محتوا بازیابی شد");
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا");
    }
  };

  return (
    <Card className="glass rounded-3xl border-0 shadow-sm">
      <CardHeader className="border-b border-border/50 p-5">
        <CardTitle className="flex items-center gap-2 text-sm font-extrabold">
          <FileClock className="size-4 text-accent-foreground" aria-hidden />
          محتوای این کاربر
        </CardTitle>
      </CardHeader>
      <CardContent className="p-2">
        <Tabs defaultValue="ideas">
          <TabsList className="flex w-full flex-wrap gap-1">
            <TabsTrigger value="ideas" className="text-xs">
              ایده‌ها ({toFa(data.counts.ideasTotal)})
            </TabsTrigger>
            <TabsTrigger value="polls" className="text-xs">
              نظرسنجی‌ها ({toFa(data.counts.pollsTotal)})
            </TabsTrigger>
            <TabsTrigger value="debts" className="text-xs">
              بدهی‌ها ({toFa(data.counts.debtsTotal)})
            </TabsTrigger>
            <TabsTrigger value="events" className="text-xs">
              رویدادها ({toFa(data.counts.eventsTotal)})
            </TabsTrigger>
            <TabsTrigger value="announcements" className="text-xs">
              پیام‌ها ({toFa(data.counts.announcementsTotal)})
            </TabsTrigger>
            <TabsTrigger value="comments" className="text-xs">
              نظرات ({toFa(data.counts.commentsTotal)})
            </TabsTrigger>
            <TabsTrigger value="memberships" className="text-xs">
              عضویت در گروه ({toFa(data.counts.groupMemberships)})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="ideas" className="mt-3">
            <ContentList
              items={data.deletedContent.ideas.map((i) => ({
                id: i.id,
                title: i.title,
                subtitle: i.description.slice(0, 80),
                status: i.status,
                createdAt: i.createdAt,
                deletedAt: i.deletedAt,
              }))}
              restore={(id, label) => handleRestore("IDEA", id, label)}
            />
          </TabsContent>
          <TabsContent value="polls" className="mt-3">
            <ContentList
              items={data.deletedContent.polls.map((p) => ({
                id: p.id,
                title: p.title,
                subtitle: p.type === "VETO_GRANT" ? "نظرسنجی اعطای وتو" : "نظرسنجی معمولی",
                status: p.status,
                createdAt: p.createdAt,
                deletedAt: p.deletedAt,
              }))}
              restore={(id, label) => handleRestore("POLL", id, label)}
            />
          </TabsContent>
          <TabsContent value="debts" className="mt-3">
            <DebtList debts={data.deletedContent.debts} restore={handleRestore} />
          </TabsContent>
          <TabsContent value="events" className="mt-3">
            <ContentList
              items={data.deletedContent.events.map((e) => ({
                id: e.id,
                title: e.title,
                subtitle: `${e.type} — ${formatJalaliDate(new Date(e.date))}`,
                createdAt: e.date,
                deletedAt: e.deletedAt,
              }))}
              restore={(id, label) => handleRestore("EVENT", id, label)}
            />
          </TabsContent>
          <TabsContent value="announcements" className="mt-3">
            <ContentList
              items={data.deletedContent.announcements.map((a) => ({
                id: a.id,
                title: a.title,
                subtitle: `${a.level} — مخاطب: ${a.audience === "ALL" ? "همه" : "گروهی"}`,
                createdAt: a.createdAt,
                deletedAt: a.deletedAt,
              }))}
              restore={(id, label) => handleRestore("ANNOUNCEMENT", id, label)}
            />
          </TabsContent>
          <TabsContent value="comments" className="mt-3">
            <ContentList
              items={data.deletedContent.comments.map((c) => ({
                id: c.id,
                title: c.body.slice(0, 80) || "(نظر خالی)",
                subtitle: `روی ${c.entityType} ${c.entityId.slice(0, 8)}`,
                createdAt: c.createdAt,
                deletedAt: c.deletedAt,
              }))}
              restore={(id, label) => handleRestore("COMMENT", id, label)}
            />
          </TabsContent>
          <TabsContent value="memberships" className="mt-3">
            {data.memberships.length === 0 ? (
              <EmptyState
                icon={Users}
                title="عضویتی ندارد"
                description="این کاربر هنوز به هیچ گروهی نپیوسته است."
              />
            ) : (
              <ul className="flex flex-col gap-1">
                {data.memberships.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center justify-between rounded-xl p-2 hover:bg-secondary/40"
                  >
                    <div>
                      <p className="text-sm font-bold">{m.groupName}</p>
                      <p className="text-xs text-muted-foreground">
                        عضویت: {m.status === "ACTIVE" ? "فعال" : m.status === "PENDING" ? "در انتظار" : "ردشده"}
                        {m.groupDeleted && " (گروه حذف‌شده)"}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatJalaliDate(new Date(m.joinedAt))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function ContentList({
  items,
  restore,
}: {
  items: {
    id: string;
    title: string;
    subtitle?: string;
    status?: string;
    createdAt: string;
    deletedAt: string | null;
  }[];
  restore: (id: string, label: string) => void;
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={Lightbulb}
        title="موردی نیست"
        description="محتوایی در این دسته یافت نشد."
      />
    );
  }
  return (
    <ul className="flex flex-col gap-1">
      {items.map((it) => (
        <li
          key={it.id}
          className={cn(
            "flex items-start justify-between gap-3 rounded-xl p-2 hover:bg-secondary/40",
            it.deletedAt && "bg-destructive/5",
          )}
        >
          <div className="min-w-0">
            <p
              className={cn(
                "text-sm font-bold",
                it.deletedAt && "text-destructive line-through",
              )}
            >
              {it.title}
            </p>
            {it.subtitle && (
              <p className="text-xs text-muted-foreground">{it.subtitle}</p>
            )}
            <p className="mt-0.5 text-[11px] text-muted-foreground/70">
              {formatJalaliDate(new Date(it.createdAt))}
              {it.status && ` • وضعیت: ${it.status}`}
            </p>
          </div>
          {it.deletedAt && (
            <Button
              size="sm"
              variant="outline"
              className="h-9 gap-1.5 px-2 text-xs"
              onClick={() => restore(it.id, it.title)}
            >
              <RotateCcw className="size-3.5" aria-hidden />
              بازیابی
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}

function DebtList({
  debts,
  restore,
}: {
  debts: DossierDebt[];
  restore: (entityType: string, id: string, label: string) => void;
}) {
  if (debts.length === 0) {
    return (
      <EmptyState
        icon={Scale}
        title="بدهکاری ندارد"
        description="این کاربر در هیچ بدهکاری نقشی ندارد."
      />
    );
  }
  return (
    <ul className="flex flex-col gap-1">
      {debts.map((d) => (
        <li
          key={d.id}
          className={cn(
            "flex items-start justify-between gap-3 rounded-xl p-2 hover:bg-secondary/40",
            d.deletedAt && "bg-destructive/5",
          )}
        >
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                "text-sm font-bold",
                d.deletedAt && "text-destructive line-through",
              )}
            >
              {d.title}
            </p>
            <p className="text-xs text-muted-foreground">
              {toFa(d.amount)} امتیاز — {d.myRole === "debtor" ? "بدهکار" : "طلبکار"}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground/70">
              وضعیت: {d.status} • نمایش: {d.visibility}
              {" • "}
              {formatJalaliDate(new Date(d.createdAt))}
              {d.eventsCount > 0 && ` • ${toFa(d.eventsCount)} رویداد`}
            </p>
          </div>
          {d.deletedAt && (
            <Button
              size="sm"
              variant="outline"
              className="h-9 gap-1.5 px-2 text-xs"
              onClick={() => restore("DEBT", d.id, d.title)}
            >
              <RotateCcw className="size-3.5" aria-hidden />
              بازیابی
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}

function DossierStatusHistory({ data }: { data: Dossier }) {
  if (data.statusHistory.length === 0) {
    return (
      <Card className="glass rounded-3xl border-0 shadow-sm">
        <CardHeader className="border-b border-border/50 p-5">
          <CardTitle className="flex items-center gap-2 text-sm font-extrabold">
            <RotateCcw className="size-4 text-chart-5" aria-hidden />
            تغییرات حساب
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">
            تغییری در نقش یا وضعیت این کاربر ثبت نشده است.
          </p>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card className="glass rounded-3xl border-0 shadow-sm">
      <CardHeader className="border-b border-border/50 p-5">
        <CardTitle className="flex items-center gap-2 text-sm font-extrabold">
          <RotateCcw className="size-4 text-chart-5" aria-hidden />
          تغییرات حساب
        </CardTitle>
      </CardHeader>
      <CardContent className="p-2">
        <ol className="relative flex flex-col gap-0 ps-4">
          {data.statusHistory.map((a, idx) => {
            const tone =
              ACTION_TONE[a.action] ??
              "bg-secondary text-secondary-foreground border-border";
            const labelFa = ACTION_LABEL_FA[a.action] ?? a.action;
            return (
              <li
                key={a.id}
                className="relative flex flex-col gap-1 py-3 ps-4"
              >
                <span
                  className="absolute end-0 top-4 size-2.5 rounded-full bg-primary"
                  aria-hidden
                />
                {idx < data.statusHistory.length - 1 && (
                  <span
                    className="absolute end-1 top-7 h-full w-px bg-border"
                    aria-hidden
                  />
                )}
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
                <p className="text-sm leading-6">{a.summary}</p>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}

function DossierSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <Skeleton className="h-48 rounded-3xl" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-72 rounded-3xl" />
        <Skeleton className="h-72 rounded-3xl" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-96 rounded-3xl" />
    </div>
  );
}
