"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bot,
  ImagePlus,
  Plus,
  RotateCcw,
  Save,
  ScrollText,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/api-client";
import { getAuthToken } from "@/lib/session-token";
import { useSession } from "@/store/session";
import type { SiteRule, SiteSettings } from "@/lib/types";
import { toFa } from "@/lib/jalali";
import { SibakLogo } from "@/components/app/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

const MAX_LOGO_BYTES = 1_500_000;
const ALLOWED_TYPES = ["image/png", "image/svg+xml", "image/jpeg"];

const MAX_RULES = 50;
const RULE_TITLE_MIN = 2;
const RULE_TITLE_MAX = 80;
const RULE_BODY_MIN = 2;
const RULE_BODY_MAX = 500;

/** ساخت یک قانون خالی جدید. */
function makeEmptyRule(): SiteRule {
  return { title: "", body: "" };
}

/** تطبیق قوانین — برای تشخیص dirty. */
function rulesEqual(a: SiteRule[], b: SiteRule[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].title !== b[i].title) return false;
    if (a[i].body !== b[i].body) return false;
  }
  return true;
}

export function AdminSettings() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.get<SiteSettings>("/api/settings"),
  });

  const [siteName, setSiteName] = useState("");
  const [siteTagline, setSiteTagline] = useState("");
  const [allowRegistration, setAllowRegistration] = useState(true);
  const [logo, setLogo] = useState<string | null>(null);
  const [rubikaBot, setRubikaBot] = useState("");
  const [rules, setRules] = useState<SiteRule[]>([makeEmptyRule()]);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (data) {
      setSiteName(data.siteName);
      setSiteTagline(data.siteTagline);
      setAllowRegistration(data.allowRegistration);
      setLogo(data.logo);
      setRubikaBot(data.rubikaBot ?? "");
      const incoming = data.siteRules?.length ? data.siteRules : [];
      setRules(incoming.length > 0 ? incoming : [makeEmptyRule()]);
    }
  }, [data]);

  const handleFile = (file: File) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("فقط فایل‌های PNG، SVG یا JPEG مجاز هستند");
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      toast.error("حجم لوگو باید کمتر از ۱.۵ مگابایت باشد");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      setLogo(result);
      toast.success("پیش‌نمایش لوگو آماده — برای ذخیره بزنید");
    };
    reader.onerror = () => toast.error("خطا در خواندن فایل");
    reader.readAsDataURL(file);
  };

  // اعتبارسنجی قوانین قبل از ارسال
  const validateRules = (list: SiteRule[]): string | null => {
    // حذف قوانین کاملاً خالی (مثلاً ردیف آخر که هنوز پر نشده)
    const filled = list.filter(
      (r) => r.title.trim() !== "" || r.body.trim() !== "",
    );
    if (filled.length === 0) {
      return "حداقل یک قانون لازم است";
    }
    if (filled.length > MAX_RULES) {
      return `حداکثر ${toFa(MAX_RULES)} قانون مجاز است`;
    }
    for (let i = 0; i < filled.length; i++) {
      const r = filled[i];
      if (r.title.trim().length < RULE_TITLE_MIN || r.title.trim().length > RULE_TITLE_MAX) {
        return `عنوان قانون ${toFa(i + 1)} باید بین ${toFa(RULE_TITLE_MIN)} تا ${toFa(RULE_TITLE_MAX)} حرف باشد`;
      }
      if (r.body.trim().length < RULE_BODY_MIN || r.body.trim().length > RULE_BODY_MAX) {
        return `متن قانون ${toFa(i + 1)} باید بین ${toFa(RULE_BODY_MIN)} تا ${toFa(RULE_BODY_MAX)} حرف باشد`;
      }
    }
    return null;
  };

  const updateRule = (idx: number, patch: Partial<SiteRule>) => {
    setRules((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };
  const removeRule = (idx: number) => {
    setRules((prev) => {
      if (prev.length <= 1) {
        toast.info("حداقل یک قانون لازم است — می‌توانید آن را ویرایش کنید");
        return prev;
      }
      return prev.filter((_, i) => i !== idx);
    });
  };
  const addRule = () => {
    setRules((prev) => {
      if (prev.length >= MAX_RULES) {
        toast.info(`حداکثر ${toFa(MAX_RULES)} قانون مجاز است`);
        return prev;
      }
      return [...prev, makeEmptyRule()];
    });
  };

  const handleSave = async () => {
    if (!siteName.trim()) {
      toast.error("نام سایت را وارد کنید");
      return;
    }
    // فیلتر قوانین خالی (ردیف آخر که هنوز پر نشده)
    const filledRules = rules
      .filter((r) => r.title.trim() !== "" || r.body.trim() !== "")
      .map((r) => ({ title: r.title.trim(), body: r.body.trim() }));
    const ruleError = validateRules(rules);
    if (ruleError) {
      toast.error(ruleError);
      return;
    }
    setSaving(true);
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      // ارسال توکن نشست از localStorage به‌عنوان Bearer header
      // (در context iframe که کوکی مسدود است، این هدر نشست را حفظ می‌کند).
      const token = getAuthToken();
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers,
        credentials: "same-origin",
        body: JSON.stringify({
          siteName: siteName.trim(),
          siteTagline: siteTagline.trim() || undefined,
          logo: logo ?? null,
          allowRegistration,
          rubikaBot: rubikaBot.trim() || undefined,
          siteRules: filledRules,
        }),
      });
      if (!res.ok) {
        let msg = "خطا در ذخیره تنظیمات";
        try {
          const data = (await res.json()) as { error?: string };
          if (data?.error) msg = data.error;
        } catch {
          /* */
        }
        throw new Error(msg);
      }
      toast.success("تنظیمات ذخیره شد");
      await qc.invalidateQueries({ queryKey: ["settings"] });
      await useSession.getState().fetchSession();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-64 rounded-3xl" />
        <Skeleton className="h-64 rounded-3xl" />
      </div>
    );
  }

  const initialRules = data.siteRules?.length
    ? data.siteRules
    : [];
  const dirty =
    siteName.trim() !== data.siteName ||
    siteTagline.trim() !== data.siteTagline ||
    allowRegistration !== data.allowRegistration ||
    logo !== data.logo ||
    (rubikaBot ?? "") !== (data.rubikaBot ?? "") ||
    !rulesEqual(rules, initialRules.length > 0 ? initialRules : [makeEmptyRule()]);

  return (
    <div className="flex flex-col gap-4">
      <Card className="glass rounded-3xl border-0 shadow-sm">
        <CardHeader className="border-b border-border/50 p-5">
          <CardTitle className="flex items-center gap-2 text-sm font-extrabold">
            هویت سایت
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 p-5">
          <div>
            <Label htmlFor="siteName" className="text-xs font-semibold">
              نام سایت
            </Label>
            <Input
              id="siteName"
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
              placeholder="مثلاً: سیبک"
              className="mt-1 h-11"
              maxLength={60}
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              این نام در هدر سایت و مرورگر نمایش داده می‌شود.
            </p>
          </div>
          <div>
            <Label htmlFor="siteTagline" className="text-xs font-semibold">
              شعار/زیرعنوان سایت
            </Label>
            <Input
              id="siteTagline"
              value={siteTagline}
              onChange={(e) => setSiteTagline(e.target.value)}
              placeholder="مثلاً: بستر همکاری درسی"
              className="mt-1 h-11"
              maxLength={140}
            />
          </div>
        </CardContent>
      </Card>

      {/* Logo */}
      <Card className="glass rounded-3xl border-0 shadow-sm">
        <CardHeader className="border-b border-border/50 p-5">
          <CardTitle className="flex items-center gap-2 text-sm font-extrabold">
            <ImagePlus className="size-4 text-primary" aria-hidden />
            لوگوی سایت
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div
              className="relative flex size-32 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border"
              style={{
                backgroundImage:
                  "linear-gradient(45deg, var(--muted) 25%, transparent 25%), linear-gradient(-45deg, var(--muted) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, var(--muted) 75%), linear-gradient(-45deg, transparent 75%, var(--muted) 75%)",
                backgroundSize: "16px 16px",
                backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0",
              }}
            >
              {logo ? (
                <img
                  src={logo}
                  alt="پیش‌نمایش لوگو"
                  className="max-h-28 max-w-28 object-contain"
                />
              ) : (
                <SibakLogo size={64} />
              )}
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <p className="text-sm text-muted-foreground">
                لوگوی PNG با پس‌زمینه شفاف بهترین نتیجه را می‌دهد 🍎
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 gap-1.5 text-xs"
                  onClick={() => fileRef.current?.click()}
                >
                  <ImagePlus className="size-3.5" aria-hidden />
                  انتخاب فایل
                </Button>
                {logo && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-10 gap-1.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => {
                      setLogo(null);
                      toast.info("لوگو حذف می‌شود — برای ذخیره بزنید");
                    }}
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                    حذف لوگو
                  </Button>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/svg+xml,image/jpeg"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                  e.target.value = "";
                }}
              />
              <p className="text-[11px] text-muted-foreground/70">
                فرمت مجاز: PNG، SVG، JPEG • حداکثر ۱.۵ مگابایت
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Registration policy */}
      <Card className="glass rounded-3xl border-0 shadow-sm">
        <CardHeader className="border-b border-border/50 p-5">
          <CardTitle className="flex items-center gap-2 text-sm font-extrabold">
            <Bot className="size-4 text-chart-4" aria-hidden />
            ربات روبیکا
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 p-5">
          <div>
            <Label htmlFor="rubikaBot" className="text-xs font-semibold">
              یوزرنیم ربات
            </Label>
            <Input
              id="rubikaBot"
              value={rubikaBot}
              onChange={(e) => setRubikaBot(e.target.value)}
              placeholder="مثلاً: SibakBot"
              className="mt-1 h-11"
              dir="ltr"
              maxLength={40}
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              یوزرنیم ربات روبیکا برای دکمه عضویت. پیشوند @ لازم نیست.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Site rules editor — طومار قوانین */}
      <Card className="glass overflow-hidden rounded-3xl border-0 shadow-sm">
        <CardHeader className="border-b border-border/50 bg-gradient-to-l from-primary/10 via-transparent to-chart-2/10 p-5">
          <CardTitle className="flex items-center justify-between gap-2 text-sm font-extrabold">
            <span className="flex items-center gap-2">
              <ScrollText className="size-4 text-primary" aria-hidden />
              قوانین سایت
            </span>
            <span className="text-[11px] font-bold text-muted-foreground">
              {toFa(rules.length)} از {toFa(MAX_RULES)} قانون
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 p-5">
          <p className="text-[11px] leading-5 text-muted-foreground">
            قوانین در طومار صفحهٔ خانه نمایش داده می‌شوند. حداقل یک قانون لازم
            است. عنوان بین {toFa(RULE_TITLE_MIN)} تا {toFa(RULE_TITLE_MAX)} حرف
            و متن بین {toFa(RULE_BODY_MIN)} تا {toFa(RULE_BODY_MAX)} حرف.
          </p>
          <div className="flex flex-col gap-3">
            {rules.map((rule, idx) => (
              <div
                key={idx}
                className="flex flex-col gap-2 rounded-2xl border border-border/60 bg-background/40 p-3"
              >
                <div className="flex items-center gap-2">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-accent/70 text-xs font-black text-accent-foreground">
                    {toFa(idx + 1)}
                  </span>
                  <Input
                    value={rule.title}
                    onChange={(e) => updateRule(idx, { title: e.target.value })}
                    placeholder="عنوان قانون (مثلاً: احترام متقابل)"
                    className="h-10 flex-1 text-sm"
                    maxLength={RULE_TITLE_MAX}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-9 shrink-0 rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => removeRule(idx)}
                    aria-label={`حذف قانون ${toFa(idx + 1)}`}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </div>
                <Textarea
                  value={rule.body}
                  onChange={(e) => updateRule(idx, { body: e.target.value })}
                  placeholder="متن قانون — توضیح کوتاه و روشن."
                  className="min-h-20 resize-y text-sm leading-6"
                  maxLength={RULE_BODY_MAX}
                />
                <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                  <span>
                    عنوان: {toFa(rule.title.length)} / {toFa(RULE_TITLE_MAX)}
                  </span>
                  <span>
                    متن: {toFa(rule.body.length)} / {toFa(RULE_BODY_MAX)}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-10 gap-1.5 self-start text-xs"
            onClick={addRule}
            disabled={rules.length >= MAX_RULES}
          >
            <Plus className="size-3.5" aria-hidden />
            افزودن قانون جدید
          </Button>
        </CardContent>
      </Card>

      {/* Registration policy */}
      <Card className="glass rounded-3xl border-0 shadow-sm">
        <CardHeader className="border-b border-border/50 p-5">
          <CardTitle className="flex items-center gap-2 text-sm font-extrabold">
            سیاست ثبت‌نام
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 p-5">
          <label className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold">ثبت‌نام کاربران جدید</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {allowRegistration
                  ? "ثبت‌نام باز است — کاربران جدید می‌توانند حساب بسازند."
                  : "ثبت‌نام بسته است — فقط ادمین می‌تواند کاربر اضافه کند."}
              </p>
            </div>
            <Switch
              checked={allowRegistration}
              onCheckedChange={setAllowRegistration}
              aria-label="ثبت‌نام کاربران جدید"
            />
          </label>
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3">
            <p className="text-xs font-bold text-destructive">
              ناحیه خطر — بستن ثبت‌نام
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground/80">
              اگر ثبت‌نام را ببندید، صفحه ثبت‌نام غیرفعال می‌شود و فقط ادمین
              می‌تواند کاربر اضافه کند. این تنظیم روی همه صفحه‌ها تأثیر می‌گذارد.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Sticky save bar */}
      <div className="sticky bottom-2 z-20">
        <Card className="glass-strong rounded-2xl border border-border/60 shadow-lg backdrop-blur">
          <CardContent className="flex items-center justify-between gap-3 p-3">
            <p className="text-xs text-muted-foreground">
              {dirty ? "تغییرات ذخیره‌نشده." : "همه‌چیز ذخیره شده است."}
            </p>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                className="h-10 gap-1.5 text-xs"
                disabled={!dirty || saving}
                onClick={() => {
                  setSiteName(data.siteName);
                  setSiteTagline(data.siteTagline);
                  setAllowRegistration(data.allowRegistration);
                  setLogo(data.logo);
                  setRubikaBot(data.rubikaBot ?? "");
                  const incoming = data.siteRules?.length ? data.siteRules : [];
                  setRules(incoming.length > 0 ? incoming : [makeEmptyRule()]);
                }}
              >
                <RotateCcw className="size-3.5" aria-hidden />
                بازنشانی
              </Button>
              <Button
                disabled={!dirty || saving}
                onClick={handleSave}
                className="h-10 gap-1.5 text-xs"
              >
                {saving ? (
                  "در حال ذخیره…"
                ) : (
                  <>
                    <Save className="size-3.5" aria-hidden />
                    ذخیره تنظیمات
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
