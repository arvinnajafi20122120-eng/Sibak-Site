"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  ExternalLink,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  X,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { EmptyState } from "@/components/app/sections/_shared/empty-state";
import { SafeAvatar } from "@/components/app/sections/_shared/safe-avatar";
import {
  ROLE_CHIP,
  ROLE_LABELS,
  STATUS_CHIP,
  STATUS_LABELS,
  type AdminUser,
} from "./types";

const STATUS_FILTERS = [
  { key: "all", label: "همه" },
  { key: "PENDING", label: "در انتظار" },
  { key: "ACTIVE", label: "فعال" },
  { key: "SUSPENDED", label: "معلق" },
  { key: "REJECTED", label: "ردشده" },
  { key: "deleted", label: "حذفشده" },
] as const;

const ROLE_FILTERS = [
  { key: "all", label: "همه" },
  { key: "ADMIN", label: "ادمین" },
  { key: "MANAGER", label: "مدیر" },
  { key: "TEACHER", label: "استاد" },
  { key: "MEMBER", label: "کاربر" },
] as const;

export function AdminUsers() {
  const qc = useQueryClient();
  const me = useSession((s) => s.user);
  const { navigate } = useHashRoute();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [role, setRole] = useState<string>("all");
  const [includeDeleted, setIncludeDeleted] = useState(true);

  const params = new URLSearchParams();
  if (q.trim()) params.set("q", q.trim());
  if (status !== "all" && status !== "deleted") {
    params.set("status", status);
  }
  if (role !== "all") params.set("role", role);
  if (includeDeleted) params.set("deleted", "1");

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["admin-users", q, status, role, includeDeleted],
    queryFn: () => api.get<{ users: AdminUser[] }>(`/api/admin/users?${params.toString()}`),
  });

  const users = data?.users ?? [];

  const filtered =
    status === "deleted" ? users.filter((u) => u.deletedAt) : users;

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["admin-users"] });
    void qc.invalidateQueries({ queryKey: ["admin-overview"] });
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await api.patch(`/api/admin/users/${userId}`, { role: newRole });
      toast.success("نقش کاربر به‌روزرسانی شد");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا");
    }
  };

  const handleStatus = async (
    userId: string,
    action: "approve" | "reject" | "suspend" | "activate",
  ) => {
    try {
      if (action === "reject") {
        await api.post(`/api/admin/users/${userId}/reject`, {
          note: "درخواست شما در تأیید نهایی نشد.",
        });
      } else {
        await api.post(`/api/admin/users/${userId}/${action}`, {});
      }
      toast.success("عملیات با موفقیت انجام شد");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا");
    }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm("حساب این کاربر حذف شود؟ (soft delete — قابل بازیابی)")) return;
    try {
      await api.del(`/api/admin/users/${userId}`);
      toast.success("کاربر حذف شد");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا");
    }
  };

  const handleRestore = async (userId: string) => {
    try {
      await api.post(`/api/admin/users/${userId}/restore`, {});
      toast.success("کاربر بازیابی شد");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* فیلترها */}
      <Card className="glass rounded-3xl border-0 shadow-sm">
        <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:flex-wrap">
          <div className="relative flex-1 md:min-w-64">
            <Search
              className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="جستجو بر اساس نام یا کاربری…"
              className="h-11 pr-9"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {STATUS_FILTERS.map((s) => (
              <FilterPill
                key={s.key}
                active={status === s.key}
                onClick={() => setStatus(s.key)}
              >
                {s.label}
              </FilterPill>
            ))}
          </div>
          <div className="hidden h-6 w-px bg-border md:block" />
          <div className="flex flex-wrap items-center gap-1.5">
            {ROLE_FILTERS.map((r) => (
              <FilterPill
                key={r.key}
                active={role === r.key}
                onClick={() => setRole(r.key)}
              >
                {r.label}
              </FilterPill>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="glass rounded-3xl border-0 shadow-sm">
        <CardHeader className="flex-row items-center justify-between border-b border-border/50 p-5">
          <CardTitle className="flex items-center gap-2 text-sm font-extrabold">
            لیست کاربران
            <Badge className="bg-primary/10 text-primary border-primary/30">
              {toFa(filtered.length)}
            </Badge>
            {isFetching && (
              <span className="text-[11px] text-muted-foreground">به‌روزرسانی…</span>
            )}
          </CardTitle>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={includeDeleted}
              onChange={(e) => setIncludeDeleted(e.target.checked)}
              className="size-4"
            />
            شامل حذف‌شده‌ها
          </label>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-xl" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={Search}
                title="کاربری یافت نشد"
                description="با فیلتر/جستجوی دیگری امتحان کنید."
              />
            </div>
          ) : (
            <div className="sibak-scrollbar max-h-[36rem] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-background/95 backdrop-blur">
                  <TableRow className="hover:bg-transparent">
                    <TableHead>کاربر</TableHead>
                    <TableHead>نقش</TableHead>
                    <TableHead>وضعیت</TableHead>
                    <TableHead>امتیاز</TableHead>
                    <TableHead>عضو از</TableHead>
                    <TableHead>ورود اخیر</TableHead>
                    <TableHead className="text-left">عملیات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((u) => {
                    const isMe = u.id === me?.id;
                    return (
                      <TableRow
                        key={u.id}
                        className={cn(
                          "group",
                          u.deletedAt && "bg-destructive/5",
                        )}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <SafeAvatar user={u} className="size-9" />
                            <div className="min-w-0">
                              <p
                                className={cn(
                                  "truncate text-sm font-bold",
                                  u.deletedAt && "text-destructive line-through",
                                )}
                              >
                                {u.name}
                              </p>
                              <p
                                className="truncate text-xs text-muted-foreground"
                                dir="ltr"
                              >
                                @{u.username}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {isMe ? (
                              <Badge
                                className={cn(
                                  "border",
                                  ROLE_CHIP[u.role],
                                )}
                              >
                                {ROLE_LABELS[u.role]}
                              </Badge>
                            ) : (
                              <Select
                                value={u.role}
                                onValueChange={(v) => handleRoleChange(u.id, v)}
                              >
                                <SelectTrigger className="h-8 w-24 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="MEMBER">کاربر</SelectItem>
                                  <SelectItem value="MANAGER">مدیر</SelectItem>
                                  <SelectItem value="TEACHER">استاد</SelectItem>
                                  <SelectItem value="ADMIN">ادمین</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={cn("border", STATUS_CHIP[u.status])}
                          >
                            {STATUS_LABELS[u.status]}
                          </Badge>
                          {u.deletedAt && (
                            <Badge className="ms-1 border border-destructive/30 bg-destructive/10 text-destructive">
                              حذف‌شده
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-bold tabular-nums">
                              {toFa(u.points)}
                            </span>
                            <PointsButton userId={u.id} onDone={refresh} />
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">
                            {formatJalaliDate(new Date(u.createdAt))}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">
                            {u.lastLoginAt
                              ? relativeTime(new Date(u.lastLoginAt))
                              : "—"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-9 gap-1 px-2 text-xs"
                              onClick={() => navigate(`/admin/dossier/${u.id}`)}
                            >
                              <ExternalLink className="size-3.5" aria-hidden />
                              پرونده
                            </Button>
                            <UserActionsMenu
                              user={u}
                              isMe={isMe}
                              onApprove={() => handleStatus(u.id, "approve")}
                              onReject={() => handleStatus(u.id, "reject")}
                              onSuspend={() => handleStatus(u.id, "suspend")}
                              onActivate={() => handleStatus(u.id, "activate")}
                              onDelete={() => handleDelete(u.id)}
                              onRestore={() => handleRestore(u.id)}
                              onDossier={() => navigate(`/admin/dossier/${u.id}`)}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "min-h-9 rounded-full px-3 text-xs font-semibold transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-secondary/60 text-muted-foreground hover:bg-secondary",
      )}
    >
      {children}
    </button>
  );
}

function PointsButton({
  userId,
  onDone,
}: {
  userId: string;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [delta, setDelta] = useState("5");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const n = Number(delta);
    if (!n || Number.isNaN(n) || n < -1000 || n > 1000) {
      toast.error("مقدار باید عدد صحیح بین ۱۰۰۰- تا ۱۰۰۰ باشد");
      return;
    }
    if (reason.trim().length < 3) {
      toast.error("دلیل را حداقل ۳ نویسه وارد کنید");
      return;
    }
    setBusy(true);
    try {
      await api.post(`/api/admin/users/${userId}/points`, {
        delta: n,
        reason: reason.trim(),
      });
      toast.success("امتیاز به‌روزرسانی شد");
      setOpen(false);
      setReason("");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="تنظیم امتیاز"
        className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary hover:bg-primary/20"
      >
        <Plus className="size-3.5" aria-hidden />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>تنظیم دستی امتیاز</DialogTitle>
            <DialogDescription>
              امتیاز مثبت برای پاداش، منفی برای کسر. این تغییر در PointLog و
              AuditLog ثبت می‌شود.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <div className="flex items-center gap-2">
              <Input
                value={delta}
                onChange={(e) => setDelta(e.target.value)}
                type="number"
                inputMode="numeric"
                className="h-11 w-32"
                dir="ltr"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDelta(String(Number(delta) * -1 || -5))}
                className="h-11"
              >
                {Number(delta) >= 0 ? "→ منفی" : "→ مثبت"}
              </Button>
            </div>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="دلیل (مثلاً: پاداش فعالیت)"
              className="h-11"
            />
            <div className="flex flex-wrap gap-1.5">
              {[5, 10, 15, 20].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setDelta(String(n))}
                  className="min-h-9 rounded-full bg-primary/10 px-3 text-xs font-bold text-primary"
                >
                  +{toFa(n)}
                </button>
              ))}
              {[-5, -10].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setDelta(String(n))}
                  className="min-h-9 rounded-full bg-destructive/10 px-3 text-xs font-bold text-destructive"
                >
                  {toFa(n)}
                </button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={busy}
            >
              انصراف
            </Button>
            <Button onClick={submit} disabled={busy}>
              {busy ? "در حال ذخیره…" : "ثبت"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function UserActionsMenu({
  user,
  isMe,
  onApprove,
  onReject,
  onSuspend,
  onActivate,
  onDelete,
  onRestore,
  onDossier,
}: {
  user: AdminUser;
  isMe: boolean;
  onApprove: () => void;
  onReject: () => void;
  onSuspend: () => void;
  onActivate: () => void;
  onDelete: () => void;
  onRestore: () => void;
  onDossier: () => void;
}) {
  const [reasonOpen, setReasonOpen] = useState(false);
  const [reason, setReason] = useState("");

  return (
    <div className="flex items-center gap-1">
      {user.status === "PENDING" && (
        <Button
          size="sm"
          variant="default"
          className="h-9 px-2 text-xs"
          onClick={onApprove}
          title="تأیید"
        >
          <Check className="size-3.5" aria-hidden />
        </Button>
      )}
      <Popover open={reasonOpen} onOpenChange={setReasonOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            title="دلیل عضویت"
            className="hidden size-7 items-center justify-center rounded-md bg-secondary/60 text-foreground hover:bg-secondary sm:flex"
          >
            <span className="text-xs">؟</span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-80 text-sm" align="start">
          <p className="mb-1 font-bold text-xs">دلیل عضویت</p>
          {user.joinReason ? (
            <p className="text-xs leading-6 text-muted-foreground">
              {user.joinReason}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              کاربر دلیل عضویت پر نکرده است.
            </p>
          )}
          {user.rejectionNote && (
            <div className="mt-2 rounded-md border border-destructive/30 bg-destructive/5 p-2">
              <p className="mb-0.5 text-[11px] font-bold text-destructive">
                یادداشت رد
              </p>
              <p className="text-xs text-muted-foreground">{user.rejectionNote}</p>
            </div>
          )}
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="ویرایش یادداشت رد (اختیاری)…"
            className="mt-2 w-full rounded-md border bg-background p-2 text-xs"
            rows={2}
          />
          <Button
            size="sm"
            variant="outline"
            className="mt-2 h-9 w-full text-xs"
            onClick={async () => {
              try {
                await api.patch(`/api/admin/users/${user.id}`, {
                  rejectionNote: reason || null,
                });
                toast.success("یادداشت به‌روزرسانی شد");
                setReasonOpen(false);
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "خطا");
              }
            }}
          >
            ذخیره یادداشت
          </Button>
        </PopoverContent>
      </Popover>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            title="عملیات بیشتر"
            className="flex size-9 items-center justify-center rounded-md bg-secondary/60 hover:bg-secondary"
          >
            <MoreHorizontal className="size-4" aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>عملیات کاربر</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onDossier}>
            <ExternalLink className="ms-2 size-3.5" aria-hidden />
            مشاهده پرونده کامل
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {user.status === "PENDING" && (
            <>
              <DropdownMenuItem
                onClick={onApprove}
                className="text-primary focus:text-primary"
              >
                <Check className="ms-2 size-3.5" aria-hidden />
                تأیید عضویت
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={onReject}
                className="text-destructive focus:text-destructive"
              >
                <X className="ms-2 size-3.5" aria-hidden />
                رد عضویت
              </DropdownMenuItem>
            </>
          )}
          {user.status === "ACTIVE" && !isMe && (
            <DropdownMenuItem
              onClick={onSuspend}
              className="text-chart-4 focus:text-chart-4"
            >
              <RotateCcw className="ms-2 size-3.5" aria-hidden />
              معلق‌سازی
            </DropdownMenuItem>
          )}
          {(user.status === "SUSPENDED" || user.status === "REJECTED") && (
            <DropdownMenuItem
              onClick={onActivate}
              className="text-primary focus:text-primary"
            >
              <Check className="ms-2 size-3.5" aria-hidden />
              فعال‌سازی
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          {user.deletedAt ? (
            <DropdownMenuItem
              onClick={onRestore}
              className="text-primary focus:text-primary"
            >
              <RotateCcw className="ms-2 size-3.5" aria-hidden />
              بازیابی کاربر
            </DropdownMenuItem>
          ) : (
            !isMe && (
              <DropdownMenuItem
                onClick={onDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="ms-2 size-3.5" aria-hidden />
                حذف نرم
              </DropdownMenuItem>
            )
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
