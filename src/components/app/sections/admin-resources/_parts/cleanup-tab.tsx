"use client";

import { useState } from "react";
import { Eraser, SearchCheck, ShieldCheck } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/api-client";
import { formatBytes, type RgCleanupReport } from "@/lib/rg-types";
import { RG_CLEANUP_REASON_LABELS } from "@/lib/rg-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

/**
 * پاک‌سازی فایل‌های اضافه و موقت — پیش‌نمایش امن (dry-run) و سپس اجرای واقعی.
 * مسیرهای ارجاع‌شده در تکالیف/محتوای درسی هرگز حذف نمی‌شوند.
 */

export function CleanupTab({ canManage }: { canManage: boolean }) {
  const [report, setReport] = useState<RgCleanupReport | null>(null);
  const queryClient = useQueryClient();

  const previewMutation = useMutation({
    mutationFn: () => api.post<RgCleanupReport>("/api/rg/cleanup", { dryRun: true }),
    onSuccess: (data) => {
      setReport(data);
      if (data.candidates.length === 0) toast.success("همه‌چیز تمیز است — فایل بلااستفاده‌ای پیدا نشد ✨");
    },
    onError: (e) => toast.error(e.message),
  });

  const runMutation = useMutation({
    mutationFn: () => api.post<RgCleanupReport>("/api/rg/cleanup", { dryRun: false }),
    onSuccess: (data) => {
      setReport(data);
      toast.success(
        `پاک‌سازی انجام شد — ${data.removed} فایل حذف و ${formatBytes(data.freedBytes)} آزاد شد`,
      );
      void queryClient.invalidateQueries({ queryKey: ["rg"] });
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="glass rounded-3xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-bold">
              <Eraser className="size-4 text-primary" aria-hidden />
              فایل‌های اضافه و موقت
            </h2>
            <p className="mt-1.5 max-w-2xl text-xs leading-6 text-muted-foreground">
              سه دسته فایل شناسایی و پاک می‌شوند: فایل‌هایی که موجودیتشان حذف شده،
              آپلودهایی که هیچ‌وقت جایی استفاده نشده‌اند و فایل‌های بی‌صاحب قدیمی روی دیسک.
              پیوست‌های چتِ حذف‌شده هم از دیتابیس تخلیه می‌شوند.
            </p>
            <p className="mt-2 flex items-center gap-1.5 text-[0.7rem] font-semibold text-primary">
              <ShieldCheck className="size-3.5" aria-hidden />
              تضمین ایمنی: فایل‌های متصل به تکالیف، محتوای درسی یا هر ارجاع فعال هرگز حذف نمی‌شوند.
            </p>
          </div>
          <Button
            type="button"
            onClick={() => previewMutation.mutate()}
            disabled={previewMutation.isPending || !canManage}
            className="min-h-11"
          >
            <SearchCheck className="size-4" aria-hidden />
            {previewMutation.isPending ? "در حال بررسی..." : "بررسی فایل‌های بلااستفاده"}
          </Button>
        </div>
      </div>

      {report && (
        <div className="glass rounded-3xl p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-bold">
              {report.dryRun ? "پیش‌نمایش پاک‌سازی" : "نتیجه پاک‌سازی"}
              <Badge variant="secondary" className="ms-2">
                {report.candidates.length} کاندید
              </Badge>
              {report.chatPurgeCandidates > 0 && (
                <Badge variant="secondary" className="ms-1">
                  {report.chatPurgeCandidates} پیوست چت قابل تخلیه از DB
                </Badge>
              )}
            </h3>
            {report.dryRun && report.candidates.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="destructive" className="min-h-11" disabled={!canManage}>
                    <Eraser className="size-4" aria-hidden />
                    پاک‌سازی {formatBytes(report.freedBytes)}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent dir="rtl">
                  <AlertDialogHeader>
                    <AlertDialogTitle>پاک‌سازی {report.candidates.length} فایل؟</AlertDialogTitle>
                    <AlertDialogDescription>
                      {formatBytes(report.freedBytes)} آزاد می‌شود. این عمل قابل بازگشت نیست —
                      اما فایل‌های متصل به تکالیف و محتوای فعال به هیچ عنوان حذف نمی‌شوند.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>انصراف</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => runMutation.mutate()}
                      className="bg-destructive text-white hover:bg-destructive/90"
                    >
                      پاک‌سازی کن
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>

          {report.candidates.length > 0 && (
            <ul className="flex flex-col gap-2">
              {report.candidates.map((c) => (
                <li
                  key={c.pathname}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border/60 p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold" dir="ltr">
                      {c.fileName}
                    </p>
                    <p className="mt-0.5 text-[0.7rem] text-muted-foreground">
                      {RG_CLEANUP_REASON_LABELS[c.reason]} — حدود {Math.round(c.ageHours)} ساعت پیش
                    </p>
                  </div>
                  <Badge variant="outline" className="shrink-0 text-[0.65rem]">
                    {formatBytes(c.size)}
                  </Badge>
                </li>
              ))}
            </ul>
          )}

          {!report.dryRun && (
            <p className="mt-3 text-xs text-muted-foreground">
              {report.removed} فایل حذف شد ({formatBytes(report.freedBytes)} آزاد شد)
              {report.chatPurged > 0 && ` — ${report.chatPurged} پیوست چت از دیتابیس تخلیه شد`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
