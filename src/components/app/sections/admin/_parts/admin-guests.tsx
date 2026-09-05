"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarClock,
  Clock,
  ExternalLink,
  KeyRound,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";
import { toFa, formatJalaliDate, relativeTime } from "@/lib/jalali";
import { api } from "@/lib/api-client";
import { useHashRoute } from "@/components/app/router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
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
import { JalaliDatePicker } from "@/components/app/sections/calendar/jalali-date-picker";
import type { AdminUser } from "./types";

const AVATARS = [
  "🍏", "🍎", "🌱", "🌿", "🍀", "📚", "✏️", "🧮",
  "🔭", "🎨", "🧠", "⭐",
];

interface GuestForm {
  name: string;
  username: string;
  password: string;
  guestScope: string;
  guestExpiresAt: Date | null;
  avatar: string;
  bio: string;
}

function emptyForm(): GuestForm {
  return {
    name: "",
    username: "",
    password: "",
    guestScope: "",
    guestExpiresAt: null,
    avatar: AVATARS[0]!,
    bio: "",
  };
}

/**
 * پنل مدیریت اعضای مهمان سیبک — ساخت، لیست و عملیات.
 * اعضای مهمان (GUEST) کاربرانی با دسترسی فقط‌خواندنی و انقضای زمانی هستند.
 */
export function AdminGuests() {
  const qc = useQueryClient();
  const { navigate } = useHashRoute();
  const [q, setQ] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<GuestForm>(emptyForm());
  const [saving, setSaving] = useState(false);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["admin-guests"],
    queryFn: () => api.get<{ guests: AdminUser[] }>("/api/admin/guests"),
  });

  const guests = (data?.guests ?? []) as AdminUser[];
  const filtered = q.trim()
    ? guests.filter((g) => {
        const t = q.trim().toLowerCase();
        return (
          g.name.toLowerCase().includes(t) ||
          g.username.toLowerCase().includes(t) ||
          (g.guestScope ?? "").toLowerCase().includes(t)
        );
      })
    : guests;

  const expiredCount = guests.filter(
    (g) => g.guestExpiresAt && new Date(g.guestExpiresAt) < new Date(),
  ).length;

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["admin-guests"] });
    void qc.invalidateQueries({ queryKey: ["admin-overview"] });
    void qc.invalidateQueries({ queryKey: ["admin-users"] });
  };

  const handleCreate = async () => {
    if (form.name.trim().length < 2) {
      toast.error("نام مهمان را وارد کنید");
      return;
    }
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(form.username.trim())) {
      toast.error("نام کاربری باید بین ۳ تا ۲۰ نویسه (حروف انگلیسی/عدد/زیرخط) باشد");
      return;
    }
    if (form.password.length < 6) {
      toast.error("رمز عبور حداقل ۶ نویسه باشد");
      return;
    }
    setSaving(true);
    try {
      await api.post("/api/admin/guests", {
        name: form.name.trim(),
        username: form.username.trim(),
        password: form.password,
        guestScope: form.guestScope.trim() || undefined,
        guestExpiresAt: form.guestExpiresAt
          ? form.guestExpiresAt.toISOString()
          : undefined,
        avatar: form.avatar || undefined,
        bio: form.bio.trim() || undefined,
      });
      toast.success("عضو مهمان ساخته شد");
      setCreateOpen(false);
      setForm(emptyForm());
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا در ساخت عضو مهمان");
    } finally {
      setSaving(false);
    }
  };

  const handleStatus = async (
    userId: string,
    action: "suspend" | "activate" | "delete" | "restore",
  ) => {
    try {
      if (action === "delete") {
        if (!confirm("حساب این مهمان حذف شود؟ (soft delete — قابل بازیابی)")) {
          return;
        }
        await api.del(`/api/admin/users/${userId}`);
        toast.success("مهمان حذف شد");
      } else if (action === "restore") {
        await api.post(`/api/admin/users/${userId}/restore`, {});
        toast.success("مهمان بازیابی شد");
      } else {
        await api.post(`/api/admin/users/${userId}/${action}`, {});
        toast.success("عملیات با موفقیت انجام شد");
      }
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* کارت خلاصه */}
      <Card className="glass card-hover rounded-3xl border-0 shadow-sm">
        <CardContent className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-chart-4/15 text-chart-4">
              <UserPlus className="size-6" aria-hidden />
            </div>
            <div>
              <h2 className="text-lg font-black">مدیریت اعضای مهمان</h2>
              <p className="text-xs text-muted-foreground">
                مهمان‌ها کاربرانی موقت با دسترسی فقط‌خواندنی و انقضای زمانی هستند.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-chart-4/15 text-chart-4 border-chart-4/40">
              <Users className="ms-1 size-3" aria-hidden />
              {toFa(guests.length)} مهمان
            </Badge>
            {expiredCount > 0 && (
              <Badge className="bg-destructive/15 text-destructive border-destructive/30">
                <Clock className="ms-1 size-3" aria-hidden />
                {toFa(expiredCount)} منقضی
              </Badge>
            )}
            <Button
              onClick={() => setCreateOpen(true)}
              className="h-10 gap-1.5 text-xs"
            >
              <Plus className="size-4" aria-hidden />
              افزودن عضو مهمان
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* فیلتر + جدول */}
      <Card className="glass rounded-3xl border-0 shadow-sm">
        <CardHeader className="flex-row items-center justify-between border-b border-border/50 p-5">
          <CardTitle className="flex items-center gap-2 text-sm font-extrabold">
            لیست اعضای مهمان
            <Badge className="bg-primary/10 text-primary border-primary/30">
              {toFa(filtered.length)}
            </Badge>
            {isFetching && (
              <span className="text-[11px] text-muted-foreground">
                به‌روزرسانی…
              </span>
            )}
          </CardTitle>
          <div className="relative w-44 md:w-64">
            <Search
              className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="جستجو…"
              className="h-10 pr-9"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-xl" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={UserPlus}
                title="هنوز عضو مهمانی دعوت نشده است."
                description="با دکمه «افزودن عضو مهمان» یک کاربر موقت با دسترسی فقط‌خواندنی بسازید."
                action={
                  <Button
                    onClick={() => setCreateOpen(true)}
                    className="h-10 gap-1.5 text-xs"
                  >
                    <Plus className="size-4" aria-hidden />
                    افزودن عضو مهمان
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="sibak-scrollbar max-h-[36rem] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-background/95 backdrop-blur">
                  <TableRow className="hover:bg-transparent">
                    <TableHead>مهمان</TableHead>
                    <TableHead>محدوده</TableHead>
                    <TableHead>انقضا</TableHead>
                    <TableHead>ورود اخیر</TableHead>
                    <TableHead className="text-left">عملیات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((g) => {
                    const expired = !!(
                      g.guestExpiresAt &&
                      new Date(g.guestExpiresAt) < new Date()
                    );
                    return (
                      <TableRow
                        key={g.id}
                        className={cn(
                          "group",
                          expired && "bg-destructive/5",
                        )}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <SafeAvatar user={g} className="size-9" />
                            <div className="min-w-0">
                              <p
                                className={cn(
                                  "truncate text-sm font-bold",
                                  g.deletedAt && "text-destructive line-through",
                                )}
                              >
                                {g.name}
                              </p>
                              <p
                                className="truncate text-xs text-muted-foreground"
                                dir="ltr"
                              >
                                @{g.username}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {g.guestScope ? (
                            <span className="text-xs text-foreground/80">
                              {g.guestScope}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground/60">
                              —
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {g.guestExpiresAt ? (
                            <div className="flex flex-col">
                              <span
                                className={cn(
                                  "text-xs font-bold",
                                  expired ? "text-destructive" : "text-chart-4",
                                )}
                              >
                                {formatJalaliDate(new Date(g.guestExpiresAt))}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {relativeTime(new Date(g.guestExpiresAt))}
                              </span>
                              {expired && (
                                <Badge className="mt-0.5 w-fit border border-destructive/30 bg-destructive/10 text-destructive">
                                  منقضی
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground/60">
                              بدون انقضا
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">
                            {g.lastLoginAt
                              ? relativeTime(new Date(g.lastLoginAt))
                              : "بدون ورود"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-9 gap-1 px-2 text-xs"
                              onClick={() => navigate(`/admin/dossier/${g.id}`)}
                            >
                              <ExternalLink className="size-3.5" aria-hidden />
                              پرونده
                            </Button>
                            <GuestActionsMenu
                              guest={g}
                              onSuspend={() => handleStatus(g.id, "suspend")}
                              onActivate={() => handleStatus(g.id, "activate")}
                              onDelete={() => handleStatus(g.id, "delete")}
                              onRestore={() => handleStatus(g.id, "restore")}
                              onDossier={() => navigate(`/admin/dossier/${g.id}`)}
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

      <CreateGuestDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        form={form}
        setForm={setForm}
        onSubmit={handleCreate}
        saving={saving}
      />
    </div>
  );
}

function CreateGuestDialog({
  open,
  onOpenChange,
  form,
  setForm,
  onSubmit,
  saving,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  form: GuestForm;
  setForm: (updater: (f: GuestForm) => GuestForm) => void;
  onSubmit: () => void;
  saving: boolean;
}) {
  const update = <K extends keyof GuestForm>(key: K, value: GuestForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="size-4 text-chart-4" aria-hidden />
            افزودن عضو مهمان
          </DialogTitle>
          <DialogDescription>
            عضو مهمان دسترسی فقط‌خواندنی دارد و پس از تاریخ انقضا دیگر نمی‌تواند وارد شود.
          </DialogDescription>
        </DialogHeader>
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="flex flex-col gap-3 py-2"
        >
          <div>
            <Label htmlFor="g-name" className="text-xs font-semibold">
              نام کامل
            </Label>
            <Input
              id="g-name"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="مثلاً: سارا محمدی"
              className="mt-1 h-11"
              maxLength={60}
            />
          </div>
          <div>
            <Label htmlFor="g-username" className="text-xs font-semibold">
              نام کاربری
            </Label>
            <Input
              id="g-username"
              value={form.username}
              onChange={(e) =>
                update("username", e.target.value.replace(/\s/g, ""))
              }
              placeholder="sara_m"
              className="mt-1 h-11"
              dir="ltr"
              maxLength={20}
            />
          </div>
          <div>
            <Label htmlFor="g-password" className="text-xs font-semibold">
              رمز عبور موقت
            </Label>
            <div className="relative mt-1">
              <KeyRound
                className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                id="g-password"
                value={form.password}
                onChange={(e) => update("password", e.target.value)}
                placeholder="حداقل ۶ نویسه"
                className="h-11 pr-9"
                dir="ltr"
              />
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              این رمز موقت به مهمان داده می‌شود؛ می‌تواند بعداً از پروفایل تغییرش دهد.
            </p>
          </div>
          <div>
            <Label htmlFor="g-scope" className="text-xs font-semibold">
              محدوده عضویت (توضیحی)
            </Label>
            <Input
              id="g-scope"
              value={form.guestScope}
              onChange={(e) => update("guestScope", e.target.value)}
              placeholder="مثلاً: پروژه علمی پاییز / دو هفته اعتبار"
              className="mt-1 h-11"
              maxLength={200}
            />
          </div>
          <div>
            <Label className="text-xs font-semibold">تاریخ انقضای عضویت</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-1 h-11 w-full justify-start font-normal"
                >
                  <CalendarClock className="ms-2 size-4" aria-hidden />
                  {form.guestExpiresAt
                    ? formatJalaliDate(form.guestExpiresAt)
                    : "بدون انقضا (دائمی)"}
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-auto min-w-72 rounded-2xl p-3"
                align="start"
              >
                <JalaliDatePicker
                  selected={form.guestExpiresAt}
                  onSelect={(d) => update("guestExpiresAt", d)}
                />
                <div className="mt-2 flex justify-between gap-2 border-t border-border/50 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-9 text-xs"
                    onClick={() => update("guestExpiresAt", null)}
                  >
                    بدون انقضا
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-9 text-xs"
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() + 14);
                      update("guestExpiresAt", d);
                    }}
                  >
                    دو هفته بعد
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
            <p className="mt-1 text-[11px] text-muted-foreground">
              پس از این تاریخ، ورود مهمان غیرفعال می‌شود.
            </p>
          </div>
          <div>
            <Label className="text-xs font-semibold">آواتار</Label>
            <div className="mt-1 grid grid-cols-6 gap-2">
              {AVATARS.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => update("avatar", a)}
                  aria-label={`انتخاب آواتار ${a}`}
                  aria-pressed={form.avatar === a}
                  className={cn(
                    "flex aspect-square items-center justify-center rounded-xl border text-2xl transition-all",
                    form.avatar === a
                      ? "scale-105 border-primary bg-primary/10 shadow-md shadow-primary/20"
                      : "border-border bg-background/60 hover:border-primary/40 hover:bg-accent/40",
                  )}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label htmlFor="g-bio" className="text-xs font-semibold">
              یادداشت کوتاه (اختیاری)
            </Label>
            <Input
              id="g-bio"
              value={form.bio}
              onChange={(e) => update("bio", e.target.value)}
              placeholder="توضیح کوتاه درباره این مهمان"
              className="mt-1 h-11"
              maxLength={500}
            />
          </div>
        </motion.div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            انصراف
          </Button>
          <Button onClick={onSubmit} disabled={saving} className="gap-1.5">
            {saving ? (
              "در حال ذخیره…"
            ) : (
              <>
                <UserPlus className="size-4" aria-hidden />
                ساختن عضو مهمان
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GuestActionsMenu({
  guest,
  onSuspend,
  onActivate,
  onDelete,
  onRestore,
  onDossier,
}: {
  guest: AdminUser;
  onSuspend: () => void;
  onActivate: () => void;
  onDelete: () => void;
  onRestore: () => void;
  onDossier: () => void;
}) {
  return (
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
        <DropdownMenuLabel>عملیات مهمان</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onDossier}>
          <ExternalLink className="ms-2 size-3.5" aria-hidden />
          مشاهده پرونده کامل
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {guest.status === "ACTIVE" && (
          <DropdownMenuItem
            onClick={onSuspend}
            className="text-chart-4 focus:text-chart-4"
          >
            <RotateCcw className="ms-2 size-3.5" aria-hidden />
            معلق‌سازی
          </DropdownMenuItem>
        )}
        {(guest.status === "SUSPENDED" || guest.status === "REJECTED") && (
          <DropdownMenuItem
            onClick={onActivate}
            className="text-primary focus:text-primary"
          >
            <RotateCcw className="ms-2 size-3.5" aria-hidden />
            فعال‌سازی
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        {guest.deletedAt ? (
          <DropdownMenuItem
            onClick={onRestore}
            className="text-primary focus:text-primary"
          >
            <RotateCcw className="ms-2 size-3.5" aria-hidden />
            بازیابی مهمان
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            onClick={onDelete}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="ms-2 size-3.5" aria-hidden />
            حذف نرم
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// جلوگیری از unused-variable در زمانی که همه آیکن‌ها لزوماً استفاده نمی‌شوند
void X;
