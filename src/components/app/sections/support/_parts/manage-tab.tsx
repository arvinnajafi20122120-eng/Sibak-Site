"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CreditCard, EyeOff, HandCoins, Heart, Save, Trash2, UserCheck } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/api-client";
import { formatJalaliFullDate, toEn, toFa } from "@/lib/jalali";
import type { SupportDTO, SupportResponse } from "@/lib/support";
import { EmptyState } from "@/components/app/sections/_shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";

import { SupportEditDialog } from "./support-edit-dialog";

/**
 * تب مدیریت حمایت — برای ADMIN و MANAGER:
 * - تنظیم شماره کارت و نام صاحب کارت (فقط ADMIN)
 * - صف اعلام‌های در انتظار → ثبت به‌عنوان حامی یا رد
 * - حامیان ثبت‌شده → ویرایش، سوییچ نمایش نام، حذف نرم
 */
export function ManageTab({ isAdmin }: { isAdmin: boolean }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["support"],
    queryFn: () => api.get<SupportResponse>("/api/support"),
  });

  // ---------- فرم تنظیم کارت (ادمین) ----------
  const [cardNumber, setCardNumber] = useState("");
  const [cardHolder, setCardHolder] = useState("");
  const [cardLoaded, setCardLoaded] = useState(false);
  const [savingCard, setSavingCard] = useState(false);

  // مقدار اولیه فقط یک‌بار از دیتا پر می‌شود تا تایپ ادمین پاک نشود
  useEffect(() => {
    if (data && !cardLoaded) {
      setCardNumber(data.settings.cardNumber ?? "");
      setCardHolder(data.settings.cardHolder ?? "");
      setCardLoaded(true);
    }
  }, [data, cardLoaded]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"register" | "update">("register");
  const [editing, setEditing] = useState<SupportDTO | null>(null);

  function onChanged() {
    qc.invalidateQueries({ queryKey: ["support"] });
    qc.invalidateQueries({ queryKey: ["notifications"] });
    qc.invalidateQueries({ queryKey: ["admin-overview"] });
  }

  async function saveCard() {
    if (!isAdmin) return;
    const raw = toEn(cardNumber ?? "").replace(/[\s-]/g, "");
    if (raw && raw.length !== 16) {
      toast.error("شماره کارت باید ۱۶ رقم باشد");
      return;
    }
    setSavingCard(true);
    try {
      await api.put("/api/support/settings", {
        cardNumber: raw || null,
        cardHolder: cardHolder?.trim() || null,
      });
      toast.success(raw ? "شماره کارت ذخیره شد" : "شماره کارت پاک شد");
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSavingCard(false);
    }
  }

  async function rejectSupport(s: SupportDTO) {
    if (!window.confirm(`اعلام حمایت «${s.name}» رد شود؟ به او اعلان می‌رود.`)) return;
    try {
      await api.patch(`/api/support/${s.id}`, { action: "reject" });
      toast.success("اعلام رد شد");
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function togglePublic(s: SupportDTO, value: boolean) {
    try {
      await api.patch(`/api/support/${s.id}`, { action: "update", isPublic: value });
      toast.success(value ? `نام «${s.name}» عمومی شد` : `نام «${s.name}» از فهرست عمومی پنهان شد`);
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function removeSupport(s: SupportDTO) {
    if (!window.confirm(`رکورد «${s.name}» حذف شود؟ (حذف نرم — در پرونده باقی می‌ماند)`)) return;
    try {
      await api.del(`/api/support/${s.id}`);
      toast.success("حذف شد");
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-44 rounded-3xl" />
        <Skeleton className="h-32 rounded-3xl" />
      </div>
    );
  }

  const pending = data?.pending ?? [];
  const supporters = data?.supporters ?? [];
  const rejected = data?.rejected ?? [];

  return (
    <div className="flex flex-col gap-5">
      {/* تنظیم کارت — فقط ادمین */}
      {isAdmin && (
        <div className="glass rounded-3xl p-6">
          <p className="flex items-center gap-2 text-sm font-black">
            <CreditCard className="size-4 text-primary" aria-hidden />
            شماره کارت حمایت
          </p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            این شماره در بخش عمومی نمایش داده می‌شود؛ تا وقتی خالی باشد، کاربران حالت
            «به‌زودی» می‌بینند. فقط ادمین می‌تواند تنظیمش کند.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="admin-card-number">شماره کارت (۱۶ رقم)</Label>
              <Input
                id="admin-card-number"
                dir="ltr"
                inputMode="numeric"
                className="text-start tracking-widest"
                value={cardNumber ?? ""}
                onChange={(e) => setCardNumber(e.target.value)}
                placeholder="۶۰۳۷ •••• •••• ••••"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="admin-card-holder">نام صاحب کارت (اختیاری)</Label>
              <Input
                id="admin-card-holder"
                value={cardHolder ?? ""}
                onChange={(e) => setCardHolder(e.target.value)}
                maxLength={80}
                placeholder="مثلاً به نام سیبک"
              />
            </div>
          </div>
          <Button
            type="button"
            className="mt-4 gap-2"
            onClick={() => void saveCard()}
            disabled={savingCard}
          >
            <Save className="size-4" aria-hidden />
            {savingCard ? "در حال ذخیره…" : "ذخیره تنظیمات کارت"}
          </Button>
        </div>
      )}

      {/* صف اعلام‌ها */}
      <div className="glass rounded-3xl p-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-black">
            <HandCoins className="size-4 text-accent-foreground" aria-hidden />
            اعلام‌های در انتظار بررسی
          </p>
          <Badge variant="outline" className="text-[10px]">
            {toFa(pending.length)} اعلام
          </Badge>
        </div>
        {pending.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            فعلاً اعلامی در صف نیست — همه‌چیز مرتب است.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {pending.map((s) => (
              <div
                key={s.id}
                className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/60 bg-background/40 p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-black">{s.name}</span>
                    {s.amount !== null && (
                      <Badge variant="outline" className="text-[10px]">
                        {toFa(s.amount.toLocaleString("en-US"))} تومان
                      </Badge>
                    )}
                    {s.isPublic && (
                      <Badge variant="outline" className="text-[10px]">
                        تمایل به نمایش نام
                      </Badge>
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      {formatJalaliFullDate(new Date(s.createdAt))}
                    </span>
                  </div>
                  {s.message && (
                    <p className="mt-1 truncate text-xs text-muted-foreground">«{s.message}»</p>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 gap-1.5"
                    onClick={() => {
                      setDialogMode("register");
                      setEditing(s);
                      setDialogOpen(true);
                    }}
                  >
                    <UserCheck className="size-3.5" aria-hidden />
                    ثبت حامی
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 text-destructive hover:text-destructive"
                    onClick={() => void rejectSupport(s)}
                  >
                    رد
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* حامیان ثبت‌شده */}
      <div className="glass rounded-3xl p-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-black">
            <Heart className="size-4 fill-rose-500/20 text-rose-500" aria-hidden />
            حامیان ثبت‌شده
          </p>
          <Badge variant="outline" className="text-[10px]">
            {toFa(supporters.length)} حامی
          </Badge>
        </div>
        {supporters.length === 0 ? (
          <EmptyState
            icon={Heart}
            title="هنوز حامی‌ای ثبت نشده"
            description="با اولین اعلام تأییدشده، فهرست تشکر شکل می‌گیرد."
          />
        ) : (
          <div className="flex max-h-96 flex-col gap-2 overflow-y-auto pe-1">
            {supporters.map((s) => (
              <div
                key={s.id}
                className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/60 bg-background/40 p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex items-center gap-1.5 text-sm font-black">
                      {!s.isPublic && (
                        <EyeOff className="size-3.5 text-muted-foreground" aria-hidden />
                      )}
                      {s.name}
                    </span>
                    {s.amount !== null && (
                      <Badge variant="outline" className="text-[10px]">
                        {toFa(s.amount.toLocaleString("en-US"))} تومان
                      </Badge>
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      {s.registeredAt
                        ? `ثبت در ${formatJalaliFullDate(new Date(s.registeredAt))}`
                        : ""}
                    </span>
                  </div>
                  {s.message && (
                    <p className="mt-1 truncate text-xs text-muted-foreground">«{s.message}»</p>
                  )}
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-[11px] text-muted-foreground">
                  <Switch
                    checked={s.isPublic}
                    onCheckedChange={(v) => void togglePublic(s, v)}
                    aria-label={`نمایش نام ${s.name} در فهرست حامیان`}
                  />
                  نمایش در فهرست
                </label>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8"
                    onClick={() => {
                      setDialogMode("update");
                      setEditing(s);
                      setDialogOpen(true);
                    }}
                  >
                    ویرایش
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 text-destructive hover:text-destructive"
                    onClick={() => void removeSupport(s)}
                    aria-label={`حذف حامی ${s.name}`}
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ردشده‌ها */}
      {rejected.length > 0 && (
        <div className="glass rounded-3xl p-5">
          <p className="mb-2 text-xs font-bold text-muted-foreground">
            اعلام‌های ردشده ({toFa(rejected.length)})
          </p>
          <div className="flex flex-col gap-1.5">
            {rejected.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between gap-2 rounded-xl bg-background/40 px-3 py-2"
              >
                <span className="truncate text-xs text-muted-foreground">
                  {s.name} · {formatJalaliFullDate(new Date(s.createdAt))}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 text-destructive hover:text-destructive"
                  onClick={() => void removeSupport(s)}
                  aria-label={`حذف رکورد ${s.name}`}
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <SupportEditDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={dialogMode}
        target={editing}
        onSaved={onChanged}
      />
    </div>
  );
}
