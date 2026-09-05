"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { api } from "@/lib/api-client";
import { toEn } from "@/lib/jalali";
import type { SupportDTO } from "@/lib/support";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

/**
 * دیالوگ ثبت/ویرایش حامی — در حالت «register» اعلام کاربر به حامی تبدیل می‌شود
 * و در حالت «update» اطلاعات حامی ثبت‌شده اصلاح می‌شود.
 */
export function SupportEditDialog({
  open,
  onOpenChange,
  mode,
  target,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: "register" | "update";
  target: SupportDTO | null;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && target) {
      setName(target.name);
      setAmount(target.amount !== null ? target.amount.toLocaleString("en-US") : "");
      setMessage(target.message ?? "");
      // در ثبت، میل خود فرد پیش‌فرض است؛ در ویرایش، وضعیت فعلی
      setIsPublic(target.isPublic);
    }
  }, [open, target]);

  async function save() {
    if (!target) return;
    if (name.trim().length < 2) {
      toast.error("نام حداقل ۲ حرف باشد");
      return;
    }
    let parsedAmount: number | null = null;
    if (amount.trim()) {
      parsedAmount = Number.parseInt(toEn(amount).replace(/[^\d]/g, ""), 10);
      if (!parsedAmount || parsedAmount < 1) {
        toast.error("مبلغ واردشده معتبر نیست");
        return;
      }
    }
    setSaving(true);
    try {
      await api.patch(`/api/support/${target.id}`, {
        action: mode,
        name: name.trim(),
        amount: parsedAmount,
        message: message.trim() || null,
        isPublic,
      });
      toast.success(
        mode === "register"
          ? isPublic
            ? `${name.trim()} با سپاس در فهرست حامیان ثبت شد ❤️`
            : `${name.trim()} ثبت شد (نام پنهان)`
          : "تغییرات ذخیره شد",
      );
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "register" ? "ثبت به‌عنوان حامی" : "ویرایش حامی"}
          </DialogTitle>
          <DialogDescription>
            {mode === "register"
              ? "واریز را تأیید کردید؟ اطلاعات را نهایی کنید؛ به اعلام‌دهنده اعلان سپاس می‌رود."
              : "اطلاعات حامی را اصلاح کنید؛ تغییرات بلافاصله در فهرست اعمال می‌شود."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="support-edit-name">نام حامی</Label>
            <Input
              id="support-edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="support-edit-amount">مبلغ (تومان) — اختیاری</Label>
            <Input
              id="support-edit-amount"
              dir="ltr"
              inputMode="numeric"
              className="text-end"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="خالی = بدون مبلغ"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="support-edit-message">پیام (اختیاری)</Label>
            <Textarea
              id="support-edit-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={2}
              maxLength={300}
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2.5 rounded-2xl border border-border/60 bg-background/40 p-3 text-sm">
            <Switch
              checked={isPublic}
              onCheckedChange={setIsPublic}
              aria-label="نمایش نام در فهرست حامیان"
            />
            <span className="leading-6">
              نام در <span className="font-bold">فهرست حامیان</span> نمایش داده شود
              <span className="block text-[11px] text-muted-foreground">
                فقط با رضایت خود فرد — اگر مطمئن نیستید، خاموش بگذارید.
              </span>
            </span>
          </label>
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            انصراف
          </Button>
          <Button type="button" onClick={() => void save()} disabled={saving} className="gap-2">
            {mode === "register" ? "ثبت حامی" : "ذخیره تغییرات"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
