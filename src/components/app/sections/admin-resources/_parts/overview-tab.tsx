"use client";

import {
  Database,
  Files,
  HardDrive,
  MessageSquare,
  TriangleAlert,
  UserRound,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  formatBytes,
  RG_LEVEL_LABELS,
  type RgOverviewResponse,
  type RgUserUsage,
} from "@/lib/rg-types";

/**
 * نمای کلی نگهبان منابع — سنجنده‌های مصرف فایل/دیتابیس/دیسک + بزرگ‌ترین مصرف‌کننده‌ها.
 */

export function OverviewTab({ data }: { data: RgOverviewResponse }) {
  const { storage, disk, database, users, config } = data;
  const level = storage.level;

  return (
    <div className="flex flex-col gap-4">
      {/* هشدار سطح مصرف */}
      {level !== "OK" && (
        <div
          role="alert"
          className={cn(
            "flex items-start gap-3 rounded-3xl border p-4",
            level === "CRITICAL"
              ? "border-destructive/40 bg-destructive/10 text-destructive"
              : "border-chart-2/40 bg-chart-2/10 text-accent-foreground",
          )}
        >
          <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
          <div className="text-sm leading-6">
            <p className="font-bold">
              وضعیت فضای فایل‌ها: {RG_LEVEL_LABELS[level]} ({Math.round(storage.pct)}٪ سقف)
            </p>
            <p className="mt-0.5 opacity-80">
              {level === "CRITICAL"
                ? "سقف در آستانهٔ پرشدن است — از تب پاک‌سازی فایل‌های اضافه را آزاد کنید یا در تب سقف‌ها ظرفیت را افزایش دهید."
                : "مصرف فایل‌ها به آستانهٔ هشدار رسیده — روند مصرف را زیر نظر بگیرید."}
            </p>
          </div>
        </div>
      )}

      {/* سنجنده‌ها */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* فضای فایل‌ها */}
        <div className="glass rounded-3xl p-5">
          <div className="flex items-center gap-2 text-sm font-bold">
            <HardDrive className="size-4 text-primary" aria-hidden />
            فضای فایل‌های سایت
          </div>
          <p className="mt-2 text-2xl font-black">
            {formatBytes(storage.usedBytes)}
            <span className="text-sm font-medium text-muted-foreground">
              {" "}
              از {formatBytes(storage.quotaBytes)}
            </span>
          </p>
          <Progress
            value={storage.pct}
            aria-label={`${Math.round(storage.pct)} درصد فضای فایل مصرف شده`}
            className={cn("mt-3 h-2.5", level === "CRITICAL" && "[&>div]:bg-destructive")}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            {storage.fileCount} فایل فعال — سقف {config.globalStorageBytes > 0 ? formatBytes(config.globalStorageBytes) : "نامحدود"}
          </p>
        </div>

        {/* دیتابیس */}
        <div className="glass rounded-3xl p-5">
          <div className="flex items-center gap-2 text-sm font-bold">
            <Database className="size-4 text-chart-3" aria-hidden />
            دیتابیس
          </div>
          <p className="mt-2 text-2xl font-black">
            {database.dbBytes != null ? formatBytes(database.dbBytes) : "—"}
          </p>
          <div className="mt-3 flex flex-col gap-1 text-xs text-muted-foreground">
            <span>
              پیوست‌های چت داخل دیتابیس: {formatBytes(database.chatAttachBytes)} ({database.chatAttachCount} پیام)
            </span>
            {config.dbWarnBytes > 0 && (
              <span>آستانهٔ هشدار حجم DB: {formatBytes(config.dbWarnBytes)}</span>
            )}
          </div>
        </div>

        {/* دیسک محلی */}
        <div className="glass rounded-3xl p-5">
          <div className="flex items-center gap-2 text-sm font-bold">
            <Files className="size-4 text-chart-4" aria-hidden />
            پوشهٔ آپلود (دیسک)
          </div>
          {disk ? (
            <>
              <p className="mt-2 text-2xl font-black">{formatBytes(disk.bytes)}</p>
              <p className="mt-2 text-xs text-muted-foreground">{disk.count} فایل روی دیسک</p>
            </>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              در این محیط فایل‌ها روی دیسک محلی ذخیره نمی‌شوند (Blob).
            </p>
          )}
        </div>

        {/* کاربران */}
        <div className="glass rounded-3xl p-5">
          <div className="flex items-center gap-2 text-sm font-bold">
            <UserRound className="size-4 text-chart-5" aria-hidden />
            کاربران و سهمیه
          </div>
          <p className="mt-2 text-2xl font-black">{users.length}</p>
          <div className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
            <span>
              سقف هر کاربر: {formatBytes(config.perUserStorageBytes)} — {config.perUserDailyUploads} آپلود در روز
            </span>
            <span>
              سقف هر فایل: {formatBytes(config.maxFileBytes)} — چت: {formatBytes(config.chatMaxFileBytes)}
            </span>
          </div>
        </div>
      </div>

      {/* بزرگ‌ترین مصرف‌کننده‌ها */}
      <div className="glass rounded-3xl p-5">
        <div className="mb-3 flex items-center gap-2 text-sm font-bold">
          <MessageSquare className="size-4 text-primary" aria-hidden />
          بزرگ‌ترین مصرف‌کننده‌ها
        </div>
        <TopConsumers users={users.slice(0, 5)} perUserBytes={config.perUserStorageBytes} />
      </div>
    </div>
  );
}

function TopConsumers({
  users,
  perUserBytes,
}: {
  users: RgUserUsage[];
  perUserBytes: number;
}) {
  const active = users.filter((u) => u.storageBytes > 0 || u.chatBytes > 0);
  if (active.length === 0) {
    return <p className="text-sm text-muted-foreground">هنوز مصرفی ثبت نشده است.</p>;
  }
  return (
    <ul className="flex flex-col gap-3">
      {active.map((u) => {
        const total = u.storageBytes + u.chatBytes;
        const pct = perUserBytes > 0 ? Math.min(100, (total / perUserBytes) * 100) : 0;
        return (
          <li key={u.userId} className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-semibold">
                {u.name} <span className="text-muted-foreground">@{u.username}</span>
              </span>
              <span className="text-muted-foreground">
                {formatBytes(total)} {pct >= 80 && <span className="text-destructive font-bold">({Math.round(pct)}٪)</span>}
              </span>
            </div>
            <Progress
              value={pct}
              className={cn("h-1.5", pct >= 90 && "[&>div]:bg-destructive")}
              aria-label={`مصرف ${u.name}: ${Math.round(pct)} درصد`}
            />
          </li>
        );
      })}
    </ul>
  );
}
