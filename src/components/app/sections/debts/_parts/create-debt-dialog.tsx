"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Minus, Plus, Scale, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

import { api } from "@/lib/api-client";
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
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";

import type { SafeUser } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toFa } from "@/lib/jalali";
import { JalaliDatePicker } from "@/components/app/sections/calendar/jalali-date-picker";
import {
  VISIBILITY_META,
  type DebtVisibilityKind,
} from "./types";
import { DebtUserPicker } from "./debt-user-picker";

const EMOJI_AVATARS = ["🍎", "🦊", "🐯", "🦉", "🐧", "🦄", "🐝", "🐙", "🌸", "🚀", "📚", "🎓"];

/**
 * دیالوگ ساخت تعهد بدهی مودبانه.
 * فرم: debtor, creditor, title, project, description, amount stepper,
 *      visibility radio, dueDate (JalaliDatePicker), allowedUsers (RESTRICTED).
 */
export function CreateDebtDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}) {
  const queryClient = useQueryClient();

  const [debtor, setDebtor] = useState<SafeUser | null>(null);
  const [creditor, setCreditor] = useState<SafeUser | null>(null);
  const [title, setTitle] = useState("");
  const [projectName, setProjectName] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState(5);
  const [visibility, setVisibility] = useState<DebtVisibilityKind>("PUBLIC");
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [allowedIds, setAllowedIds] = useState<string[]>([]);
  const [allowedUsers, setAllowedUsers] = useState<SafeUser[]>([]);
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setDebtor(null);
    setCreditor(null);
    setTitle("");
    setProjectName("");
    setDescription("");
    setAmount(5);
    setVisibility("PUBLIC");
    setDueDate(null);
    setAllowedIds([]);
    setAllowedUsers([]);
    setSubmitting(false);
  }

  const createMutation = useMutation({
    mutationFn: () => {
      const payload: Record<string, unknown> = {
        debtorId: debtor!.id,
        creditorId: creditor!.id,
        title: title.trim(),
        projectName: projectName.trim() || undefined,
        description: description.trim() || undefined,
        amount,
        visibility,
      };
      if (dueDate) payload.dueDate = dueDate.toISOString();
      if (visibility === "RESTRICTED") payload.allowedUserIds = allowedIds;
      return api.post("/api/debts", payload);
    },
    onMutate: () => setSubmitting(true),
    onSuccess: () => {
      toast.success("تعهد دوستانه ثبت شد 🌱");
      queryClient.invalidateQueries({ queryKey: ["debts"] });
      queryClient.invalidateQueries({ queryKey: ["debt-stats"] });
      queryClient.invalidateQueries({ queryKey: ["debt-chart"] });
      onCreated?.();
      reset();
      onOpenChange(false);
    },
    onError: (e: Error) => {
      setSubmitting(false);
      toast.error(e.message);
    },
  });

  const canSubmit =
    debtor && creditor && title.trim().length >= 3 && amount >= 1 &&
    (visibility !== "RESTRICTED" || allowedIds.length > 0) &&
    !submitting;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-extrabold">
            <Scale className="size-5 text-primary" aria-hidden />
            تعهد دوستانهٔ جدید
          </DialogTitle>
          <DialogDescription>
            وقتی کسی به نابرابری اعتباری رسیده، این‌جا یادآوری دوستانه برای جبران است.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5 py-2">
          {/* بدهکار */}
          <div className="flex flex-col gap-2">
            <Label className="text-sm font-bold">بدهکار (متعهد)</Label>
            <DebtUserPicker
              selected={debtor}
              onSelect={setDebtor}
              onClear={() => setDebtor(null)}
              excludeIds={creditor ? [creditor.id] : []}
              placeholder="نام بدهکار…"
            />
          </div>

          {/* طلبکار */}
          <div className="flex flex-col gap-2">
            <Label className="text-sm font-bold">طلبکار (دریافت‌کنندهٔ امتیاز)</Label>
            <DebtUserPicker
              selected={creditor}
              onSelect={setCreditor}
              onClear={() => setCreditor(null)}
              excludeIds={debtor ? [debtor.id] : []}
              placeholder="نام طلبکار…"
            />
          </div>

          {/* عنوان */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="debt-title" className="text-sm font-bold">
              عنوان تعهد
            </Label>
            <Input
              id="debt-title"
              dir="rtl"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثلاً: خلاصه فصل ۳ شیمی"
              maxLength={140}
            />
          </div>

          {/* پروژه + مقدار */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="debt-project" className="text-sm font-bold">
                نام پروژه (اختیاری)
              </Label>
              <Input
                id="debt-project"
                dir="rtl"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="مثلاً: جزوه مشترک کنکور"
                maxLength={120}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-bold">مقدار امتیاز</Label>
              <div className="flex items-stretch gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-11 shrink-0 rounded-xl"
                  onClick={() => setAmount((n) => Math.max(1, n - 1))}
                  aria-label="کاهش"
                >
                  <Minus className="size-4" aria-hidden />
                </Button>
                <div className="flex flex-1 items-center justify-center rounded-xl border border-border/60 bg-background/40 text-2xl font-black tabular-nums text-primary">
                  {toFa(amount)}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-11 shrink-0 rounded-xl"
                  onClick={() => setAmount((n) => Math.min(1000, n + 1))}
                  aria-label="افزایش"
                >
                  <Plus className="size-4" aria-hidden />
                </Button>
              </div>
            </div>
          </div>

          {/* توضیحات */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="debt-desc" className="text-sm font-bold">
              یادداشت (اختیاری)
            </Label>
            <Textarea
              id="debt-desc"
              dir="rtl"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="یادداشت کوتاه دربارهٔ انتظار و موعدها…"
              maxLength={2000}
            />
          </div>

          {/* نمایش */}
          <div className="flex flex-col gap-2">
            <Label className="text-sm font-bold">نوع نمایش</Label>
            <RadioGroup
              dir="rtl"
              value={visibility}
              onValueChange={(v) => setVisibility(v as DebtVisibilityKind)}
              className="grid grid-cols-1 gap-2 sm:grid-cols-3"
            >
              {(Object.keys(VISIBILITY_META) as DebtVisibilityKind[]).map((v) => (
                <label
                  key={v}
                  className={cn(
                    "flex cursor-pointer flex-col gap-1 rounded-xl border p-3 text-right transition-colors",
                    visibility === v
                      ? "border-primary/60 bg-primary/5 ring-1 ring-primary/40"
                      : "border-border/60 hover:border-primary/40 hover:bg-primary/5",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value={v} id={`vis-${v}`} className="sr-only" />
                    <span className="text-sm font-bold">{VISIBILITY_META[v].label}</span>
                    {visibility === v && <ShieldCheck className="size-4 text-primary" aria-hidden />}
                  </div>
                  <span className="text-[11px] leading-5 text-muted-foreground">
                    {VISIBILITY_META[v].description}
                  </span>
                </label>
              ))}
            </RadioGroup>
          </div>

          {/* کاربران منتخب (RESTRICTED) */}
          {visibility === "RESTRICTED" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="flex flex-col gap-2"
            >
              <Label className="text-sm font-bold">
                کاربران منتخب (علاوه بر طرفین)
              </Label>
              {allowedUsers.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {allowedUsers.map((u) => (
                    <span
                      key={u.id}
                      className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs font-semibold"
                    >
                      {u.name}
                      <button
                        type="button"
                        onClick={() => {
                          setAllowedIds((s) => s.filter((id) => id !== u.id));
                          setAllowedUsers((s) => s.filter((x) => x.id !== u.id));
                        }}
                        className="text-muted-foreground hover:text-destructive"
                        aria-label={`حذف ${u.name}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <DebtUserPicker
                multi
                selectedIds={allowedIds}
                onToggleMulti={(u) => {
                  if (allowedIds.includes(u.id)) {
                    setAllowedIds((s) => s.filter((id) => id !== u.id));
                    setAllowedUsers((s) => s.filter((x) => x.id !== u.id));
                  } else {
                    setAllowedIds((s) => [...s, u.id]);
                    setAllowedUsers((s) => [...s, u]);
                  }
                }}
                excludeIds={[
                  ...(debtor ? [debtor.id] : []),
                  ...(creditor ? [creditor.id] : []),
                ]}
                placeholder="افزودن کاربر…"
              />
            </motion.div>
          )}

          {/* سررسید */}
          <div className="flex flex-col gap-2">
            <Label className="text-sm font-bold">سررسید جبران (اختیاری)</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 justify-start rounded-xl"
                >
                  {dueDate ? (
                    <span dir="rtl">
                      {new Intl.DateTimeFormat("fa-IR-u-ca-persian").format(dueDate)}
                    </span>
                  ) : (
                    "بدون سررسید"
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2" align="start">
                <JalaliDatePicker
                  selected={dueDate}
                  onSelect={(d) => {
                    const iso = new Date(d);
                    iso.setHours(23, 59, 0, 0);
                    setDueDate(iso);
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => { reset(); onOpenChange(false); }}
            disabled={submitting}
          >
            انصراف
          </Button>
          <Button
            type="button"
            onClick={() => createMutation.mutate()}
            disabled={!canSubmit}
            className="gap-2"
          >
            <Scale className="size-4" aria-hidden />
            ثبت تعهد
          </Button>
        </DialogFooter>

        {/* loading overlay */}
        {submitting && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/60 backdrop-blur-sm">
            <Skeleton className="h-8 w-32" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// جلوگیری از unused
void EMOJI_AVATARS;
