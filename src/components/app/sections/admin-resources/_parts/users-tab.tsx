"use client";

import { Progress } from "@/components/ui/progress";
import { SafeAvatar } from "@/components/app/sections/_shared/safe-avatar";
import { ROLE_BADGE_CLASSES } from "@/components/app/nav";
import { ROLE_LABELS } from "@/components/app/nav";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatBytes, type RgOverviewResponse, type RgUserUsage } from "@/lib/rg-types";

/**
 * مصرف کاربران — فضای فایل هر کاربر نسبت به سهمیه، پیوست چت (DB) و آپلود امروز.
 */

export function UsersTab({ data }: { data: RgOverviewResponse }) {
  const { users, config } = data;

  return (
    <div className="glass rounded-3xl p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold">مصرف هر کاربر</h2>
        <p className="text-xs text-muted-foreground">
          سهمیهٔ شخصی: {formatBytes(config.perUserStorageBytes)} — هشدار {config.warnPct}٪ / بحرانی{" "}
          {config.criticalPct}٪
        </p>
      </div>

      <div className="max-h-[480px] overflow-y-auto rg-scroll">
        <div className="flex flex-col gap-3 pe-1">
          {users.map((u) => (
            <UserUsageRow key={u.userId} user={u} quotaBytes={config.perUserStorageBytes} />
          ))}
          {users.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">کاربری یافت نشد.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function UserUsageRow({ user, quotaBytes }: { user: RgUserUsage; quotaBytes: number }) {
  const total = user.storageBytes + user.chatBytes;
  const pct = quotaBytes > 0 ? Math.min(100, (total / quotaBytes) * 100) : 0;
  const isCritical = pct >= 90;
  const isWarning = pct >= 80 && !isCritical;

  return (
    <div
      className={cn(
        "rounded-2xl border p-3",
        isCritical
          ? "border-destructive/40 bg-destructive/5"
          : isWarning
            ? "border-chart-2/40 bg-chart-2/5"
            : "border-border/60",
      )}
    >
      <div className="flex items-center gap-3">
        <SafeAvatar
          user={{ name: user.name, username: user.username, avatar: user.avatar }}
          className="size-9 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-bold">{user.name}</span>
            <span className="truncate text-xs text-muted-foreground">@{user.username}</span>
            <Badge className={cn("h-5 border text-[0.65rem]", ROLE_BADGE_CLASSES[user.role as keyof typeof ROLE_BADGE_CLASSES] ?? "")}>
              {ROLE_LABELS[user.role as keyof typeof ROLE_LABELS] ?? user.role}
            </Badge>
          </div>
          <p className="mt-0.5 text-[0.7rem] text-muted-foreground">
            {formatBytes(user.storageBytes)} فایل ({user.fileCount}) + {formatBytes(user.chatBytes)} پیوست چت
            {user.uploadsToday > 0 && ` — امروز: ${user.uploadsToday} آپلود`}
          </p>
        </div>
        <div className="shrink-0 text-left">
          <span
            className={cn(
              "text-sm font-black",
              isCritical ? "text-destructive" : isWarning ? "text-accent-foreground" : "",
            )}
          >
            {Math.round(pct)}٪
          </span>
        </div>
      </div>
      <Progress
        value={pct}
        aria-label={`مصرف ${user.name}: ${Math.round(pct)} درصد از سهمیه`}
        className={cn("mt-2 h-1.5", isCritical && "[&>div]:bg-destructive")}
      />
    </div>
  );
}
