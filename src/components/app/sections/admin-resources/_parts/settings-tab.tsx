"use client";

import { useState } from "react";
import { Info, Save } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/api-client";
import { formatBytes, MB, type RgConfig, type RgOverviewResponse } from "@/lib/rg-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";

/**
 * سقف‌ها و آستانه‌های نگهبان منابع — فقط ادمین.
 * مقادیر بایتی به‌صورت مگابایت وارد می‌شوند.
 */

interface FieldDef {
  key: keyof RgConfig;
  label: string;
  hint: string;
  /** واحد نمایش: "MB" | "count" | "pct" | "hours" */
  unit: "MB" | "count" | "pct" | "hours";
  min: number;
  max: number;
  step?: number;
}

const FIELDS: FieldDef[] = [
  {
    key: "maxFileBytes",
    label: "حداکثر حجم هر فایل آپلودی",
    hint: "فایل‌های بزرگ‌تر در تکالیف و محتوا رد می‌شوند (۱ تا ۲۰۰ مگابایت)",
    unit: "MB",
    min: 0.1,
    max: 200,
    step: 0.1,
  },
  {
    key: "chatMaxFileBytes",
    label: "حداکثر حجم پیوست چت",
    hint: "پیوست چت داخل دیتابیس ذخیره می‌شود — محافظه‌کارانه نگه دارید (حداکثر ۵۰ مگابایت)",
    unit: "MB",
    min: 0.1,
    max: 50,
    step: 0.1,
  },
  {
    key: "perUserStorageBytes",
    label: "سقف فضای هر کاربر",
    hint: "مجموع فایل‌های فعال هر کاربر؛ پیوست چت هم حساب می‌شود (۱۰ تا ۱۰۲۴۰ مگابایت)",
    unit: "MB",
    min: 10,
    max: 10240,
    step: 1,
  },
  {
    key: "perUserDailyUploads",
    label: "حداکثر آپلود روزانه هر کاربر",
    hint: "شمارش روزانه شامل فایل‌های حذف‌شده هم می‌شود — ضد اسپم (۱ تا ۱۰۰۰)",
    unit: "count",
    min: 1,
    max: 1000,
  },
  {
    key: "globalStorageBytes",
    label: "سقف کل فضای فایل‌های سایت",
    hint: "وقتی پر شود هیچ آپلودی انجام نمی‌شود تا پاک‌سازی یا افزایش سقف (۵۰ تا ۱۰۲۴۰۰ مگابایت)",
    unit: "MB",
    min: 50,
    max: 102400,
    step: 1,
  },
  {
    key: "warnPct",
    label: "آستانه هشدار مصرف (٪)",
    hint: "به کاربر و رویدادها هشدار داده می‌شود (۵۰ تا ۹۹ — باید کمتر از بحرانی باشد)",
    unit: "pct",
    min: 50,
    max: 99,
  },
  {
    key: "criticalPct",
    label: "آستانه بحرانی مصرف (٪)",
    hint: "اعلان به همهٔ ادمین‌ها + رویداد بحرانی (۵۱ تا ۱۰۰)",
    unit: "pct",
    min: 51,
    max: 100,
  },
  {
    key: "tempMaxAgeHours",
    label: "عمر فایل موقت/یتیم (ساعت)",
    hint: "فایل‌های استفاده‌نشده یا بی‌صاحب بعد از این مدت قابل پاک‌سازی می‌شوند (۱ تا ۸۷۶۰)",
    unit: "hours",
    min: 1,
    max: 8760,
  },
  {
    key: "dbWarnBytes",
    label: "هشدار حجم دیتابیس (مگابایت — 0 = خاموش)",
    hint: "وقتی حجم DB از این مقدار بگذرد رویداد هشدار ثبت می‌شود",
    unit: "MB",
    min: 0,
    max: 51200,
    step: 1,
  },
];

function toDisplay(cfg: RgConfig, field: FieldDef): string {
  const v = cfg[field.key];
  const n = typeof v === "number" ? v : 0;
  return field.unit === "MB" ? String(Math.round((n / MB) * 10) / 10) : String(n);
}

function fromDisplay(field: FieldDef, raw: string): number {
  const n = parseFloat(raw.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))));
  if (!Number.isFinite(n)) return NaN;
  return field.unit === "MB" ? Math.round(n * MB) : Math.round(n);
}

export function SettingsTab({ data }: { data: RgOverviewResponse }) {
  const { config, canManage } = data;
  // key = وضعیت config → بعد از هر ذخیره/تغییر سرور، فرم با مقادیر تازه remount می‌شود
  const configHash = JSON.stringify(config);
  return <SettingsForm key={configHash} config={config} canManage={canManage} />;
}

function SettingsForm({ config, canManage }: { config: RgConfig; canManage: boolean }) {
  const queryClient = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>(() => {
    const next: Record<string, string> = {};
    for (const f of FIELDS) next[f.key] = toDisplay(config, f);
    return next;
  });
  const [enabled, setEnabled] = useState(config.enabled);

  const saveMutation = useMutation({
    mutationFn: (body: RgConfig) => api.put<{ config: RgConfig }>("/api/rg/settings", body),
    onSuccess: (res) => {
      toast.success("سقف‌های نگهبان منابع ذخیره شد");
      void queryClient.invalidateQueries({ queryKey: ["rg"] });
      setEnabled(res.config.enabled);
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSave = () => {
    const body: Record<string, unknown> = { enabled };
    for (const f of FIELDS) {
      const n = fromDisplay(f, values[f.key] ?? "");
      if (!Number.isFinite(n)) {
        toast.error(`مقدار «${f.label}» نامعتبر است`);
        return;
      }
      body[f.key] = n;
    }
    saveMutation.mutate(body as unknown as RgConfig);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="glass rounded-3xl p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold">وضعیت نگهبان منابع</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              در حالت خاموش، مصرف همچنان ثبت می‌شود ولی هیچ سهمیه‌ای اعمال نمی‌گردد.
            </p>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={setEnabled}
            disabled={!canManage}
            aria-label="فعال/غیرفعال کردن نگهبان منابع"
          />
        </div>
        <Separator className="my-4" />
        <div className="grid gap-4 md:grid-cols-2">
          {FIELDS.map((f) => (
            <div key={f.key} className="flex flex-col gap-1.5">
              <Label htmlFor={`rg-${f.key}`} className="text-xs font-bold">
                {f.label}
              </Label>
              <Input
                id={`rg-${f.key}`}
                type="number"
                inputMode="decimal"
                min={f.min}
                max={f.max}
                step={f.step ?? 1}
                dir="ltr"
                value={values[f.key] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                disabled={!canManage}
                className="h-10"
              />
              <p className="text-[0.68rem] leading-5 text-muted-foreground">
                {f.hint}
                {f.unit === "MB" && Number(values[f.key]) > 0 && (
                  <span className="ms-1 text-primary font-semibold">
                    ({formatBytes(fromDisplay(f, values[f.key] || "0"))})
                  </span>
                )}
              </p>
            </div>
          ))}
        </div>

        {canManage && (
          <div className="mt-5 flex justify-end">
            <Button
              type="button"
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="min-h-11"
            >
              <Save className="size-4" aria-hidden />
              {saveMutation.isPending ? "در حال ذخیره..." : "ذخیره سقف‌ها"}
            </Button>
          </div>
        )}
      </div>

      <div className="glass rounded-3xl p-5">
        <h3 className="flex items-center gap-2 text-sm font-bold">
          <Info className="size-4 text-primary" aria-hidden />
          نگهبان در محیط‌های مختلف چطور کار می‌کند؟
        </h3>
        <ul className="mt-3 flex flex-col gap-2 text-xs leading-6 text-muted-foreground">
          <li>
            <b className="text-foreground">الان (لوکال):</b> فایل‌ها روی دیسک در <span dir="ltr">db/uploads</span> و
            دیتابیس SQLite — سنجش حجم DB با PRAGMA یا اندازه فایل.
          </li>
          <li>
            <b className="text-foreground">پروداکشن (Vercel):</b> فایل‌ها در Vercel Blob خصوصی با پیشوند{" "}
            <span dir="ltr">blob/</span>؛ سهمیه‌ها و رویدادها دقیقاً همین‌طور کار می‌کنند.
          </li>
          <li>
            <b className="text-foreground">دیتابیس واقعی (Turso):</b> تمام منطق روی Prisma است و بدون تغییر کد
            روی libsql هم اجرا می‌شود؛ حجم DB با PRAGMA صفحه‌شمار محاسبه می‌شود و پشتیبان JSON مستقل از موتور
            دیتابیس قابل بازگردانی است.
          </li>
        </ul>
      </div>
    </div>
  );
}
