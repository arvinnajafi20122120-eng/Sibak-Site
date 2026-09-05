"use client";

import { useState } from "react";
import { Archive, ArchiveRestore, Download, HardDriveDownload, Save, Trash2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/api-client";
import { getAuthToken } from "@/lib/session-token";
import { formatJalaliDateTime } from "@/lib/jalali";
import { formatBytes, type RgBackupMeta } from "@/lib/rg-types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
 * پشتیبان‌گیری و بازیابی — اسنپ‌شات JSON کامل و مستقل از موتور دیتابیس
 * (همین فایل بعداً روی Turso هم قابل بازگردانی است).
 */

interface BackupsResponse {
  backups: {
    fileName: string;
    sizeBytes: number;
    mtimeMs: number;
    createdAt: string;
    version: number;
    totalRows: number;
    checksum: string;
  }[];
}

async function fetchBackupBlob(path: string): Promise<Blob> {
  const token = getAuthToken();
  const res = await fetch(path, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: "same-origin",
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? "دانلود ناموفق بود");
  }
  return res.blob();
}

function triggerDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function BackupsTab({ canManage }: { canManage: boolean }) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<RgBackupMeta | null>(null);

  const listQuery = useQuery({
    queryKey: ["rg", "backups"],
    queryFn: () => api.get<BackupsResponse>("/api/rg/backups"),
  });

  const createMutation = useMutation({
    mutationFn: () => api.post<{ fileName: string; totalRows: number }>("/api/rg/backups", {}),
    onSuccess: (data) => {
      toast.success(`پشتیبان ساخته شد (${data.totalRows} رکورد) — ${data.fileName}`);
      void queryClient.invalidateQueries({ queryKey: ["rg"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const downloadMutation = useMutation({
    mutationFn: async (fileName: string) => {
      const blob = await fetchBackupBlob(`/api/rg/backups/${encodeURIComponent(fileName)}`);
      triggerDownload(blob, fileName);
      return fileName;
    },
    onSuccess: (fileName) => toast.success(`«${fileName}» دانلود شد`),
    onError: (e) => toast.error(e.message),
  });

  const saveDownloadMutation = useMutation({
    mutationFn: async () => {
      // ساخت پشتیبان تازه بدون ذخیره روی دیسک و دانلود مستقیم
      const token = getAuthToken();
      const res = await fetch("/api/rg/backups", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ mode: "download" }),
        credentials: "same-origin",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "ساخت پشتیبان ناموفق بود");
      }
      const blob = await res.blob();
      const fileName = res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ?? "sibak-backup.json";
      triggerDownload(blob, fileName);
      return fileName;
    },
    onSuccess: (fileName) => toast.success(`پشتیبان دانلود شد — ${fileName}`),
    onError: (e) => toast.error(e.message),
  });

  const restoreMutation = useMutation({
    mutationFn: (fileName: string) =>
      api.post<{ totalRows: number }>(`/api/rg/backups/${encodeURIComponent(fileName)}`, {
        confirm: "REPLACE",
      }),
    onSuccess: (data) => {
      toast.success(`بازگردانی کامل شد — ${data.totalRows} رکورد بازنشانی شد`);
      setSelected(null);
      void queryClient.invalidateQueries();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (fileName: string) =>
      api.del<{ ok: boolean }>(`/api/rg/backups/${encodeURIComponent(fileName)}`),
    onSuccess: () => {
      toast.success("فایل پشتیبان حذف شد");
      setSelected(null);
      void queryClient.invalidateQueries({ queryKey: ["rg"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const backups = listQuery.data?.backups ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="glass rounded-3xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-bold">
              <Archive className="size-4 text-primary" aria-hidden />
              پشتیبان کامل سیبک
            </h2>
            <p className="mt-1.5 max-w-2xl text-xs leading-6 text-muted-foreground">
              هر پشتیبان یک اسنپ‌شات JSON از تمام جدول‌هاست — با چک‌سام SHA-256،
              مستقل از موتور دیتابیس و قابل بازگردانی در هر محیط (لوکال، سرور یا Turso).
              بازگردانی کل دیتابیس فعلی را جایگزین می‌کند.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !canManage}
              className="min-h-11"
            >
              <Save className="size-4" aria-hidden />
              {createMutation.isPending ? "در حال ساخت..." : "پشتیبان جدید"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => saveDownloadMutation.mutate()}
              disabled={saveDownloadMutation.isPending || !canManage}
              className="min-h-11"
            >
              <HardDriveDownload className="size-4" aria-hidden />
              ساخت و دانلود
            </Button>
          </div>
        </div>
      </div>

      <div className="glass rounded-3xl p-5">
        <h3 className="mb-3 text-sm font-bold">پشتیبان‌های ذخیره‌شده</h3>
        {listQuery.isLoading && <p className="text-sm text-muted-foreground">در حال بارگذاری...</p>}
        {!listQuery.isLoading && backups.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            هنوز پشتیبانی ذخیره نشده — با دکمهٔ «پشتیبان جدید» شروع کنید.
          </p>
        )}
        <ul className="flex max-h-[440px] flex-col gap-2 overflow-y-auto rg-scroll pe-1">
          {backups.map((b) => (
            <li
              key={b.fileName}
              className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border/60 p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-xs font-bold" dir="ltr">
                  {b.fileName}
                </p>
                <p className="mt-0.5 text-[0.7rem] text-muted-foreground">
                  {formatJalaliDateTime(new Date(b.createdAt))} — {b.totalRows} رکورد — {formatBytes(b.sizeBytes)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Badge variant="outline" className="hidden text-[0.65rem] sm:inline-flex" dir="ltr">
                  {b.checksum.slice(0, 8)}…
                </Badge>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={`دانلود ${b.fileName}`}
                  onClick={() => downloadMutation.mutate(b.fileName)}
                  disabled={downloadMutation.isPending || !canManage}
                  className="size-9"
                >
                  <Download className="size-4" aria-hidden />
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button type="button" size="icon" variant="ghost" className="size-9" disabled={!canManage}>
                      <ArchiveRestore className="size-4" aria-hidden />
                      <span className="sr-only">بازگردانی {b.fileName}</span>
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent dir="rtl">
                    <AlertDialogHeader>
                      <AlertDialogTitle>بازگردانی از «{b.fileName}»؟</AlertDialogTitle>
                      <AlertDialogDescription>
                        کل دیتابیس فعلی پاک و با محتوای این پشتیبان جایگزین می‌شود ({b.totalRows} رکورد).
                        تمام تغییرات بعد از این پشتیبان از بین می‌رود. این عمل درون تراکنش امن انجام
                        می‌شود — اگر خطایی رخ دهد، دیتابیس دست‌نخورده می‌ماند.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>انصراف</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => {
                          setSelected(b);
                          restoreMutation.mutate(b.fileName);
                        }}
                        className="bg-destructive text-white hover:bg-destructive/90"
                      >
                        جایگزینی کامل
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-9 text-destructive"
                      disabled={!canManage}
                    >
                      <Trash2 className="size-4" aria-hidden />
                      <span className="sr-only">حذف {b.fileName}</span>
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent dir="rtl">
                    <AlertDialogHeader>
                      <AlertDialogTitle>حذف پشتیبان؟</AlertDialogTitle>
                      <AlertDialogDescription>
                        «{b.fileName}» برای همیشه حذف می‌شود.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>انصراف</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteMutation.mutate(b.fileName)}
                        className="bg-destructive text-white hover:bg-destructive/90"
                      >
                        حذف کن
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {selected && restoreMutation.isPending && (
        <p className="text-center text-xs text-muted-foreground">در حال بازگردانی... صفحه را نبندید.</p>
      )}
    </div>
  );
}
