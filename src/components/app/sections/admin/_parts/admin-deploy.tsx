"use client";

import { useState } from "react";
import {
  Check,
  ClipboardCopy,
  Database,
  ExternalLink,
  HardDrive,
  KeyRound,
  Rocket,
  Server,
  Shield,
  Terminal,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/**
 * تب «دپلوی» در پنل ادمین — فقط برای ادمین.
 *
 * راه‌نمای دپلوی رایگان و پایدار برای ۱ تا چند سال با حداکثر ۳۰ کاربر:
 *   1) Vercel (Next.js)  — هاستینگ رایگان + HTTPS خودکار
 *   2) Turso (libSQL)    — دیتابیس hosted رایگان ۹GB
 *   3) Render (WebSocket) — سرویس چت رایگان (خواب بعد از ۱۵ دقیقه)
 *
 * این تب در صفحه‌های عمومی دیده نمی‌شود — فقط ادمین به آن دسترسی دارد.
 */

function CopyBlock({ label, code }: { label: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard ممکن است در iframe بسته باشد */
    }
  };
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-[#0b0f14] text-zinc-100">
      <div className="flex items-center justify-between gap-2 border-b border-white/10 bg-white/5 px-3 py-2">
        <span className="font-mono text-xs text-zinc-300">{label}</span>
        <button
          onClick={copy}
          className="flex items-center gap-1.5 rounded-md bg-white/10 px-2 py-1 text-[11px] font-bold text-zinc-200 hover:bg-white/20"
        >
          {copied ? <Check className="size-3.5 text-emerald-400" aria-hidden /> : <ClipboardCopy className="size-3.5" aria-hidden />}
          {copied ? "کپی شد" : "کپی"}
        </button>
      </div>
      <pre dir="ltr" className="overflow-x-auto p-3 text-[12px] leading-relaxed">
        <code className="font-mono">{code}</code>
      </pre>
    </div>
  );
}

function StepCard({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-black text-primary-foreground">
        {n}
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-sm font-bold">{title}</p>
        <div className="text-sm leading-7 text-muted-foreground">{children}</div>
      </div>
    </div>
  );
}

const VERCEL_JSON = `{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "prisma generate && next build",
  "installCommand": "bun install",
  "framework": "nextjs",
  "regions": ["iad1"]
}`;

const ENV_VARS = `# در Vercel: Settings → Environment Variables
AUTH_SECRET="رشته‌ی تصادفی ۳۲ نویسه‌ای (openssl rand -hex 32)"
DATABASE_URL="libsql://your-db.turso.io?authToken=your-token"
NEXT_PUBLIC_SITE_NAME="سیبک"
NEXT_PUBLIC_CHAT_URL="https://sibak-chat.onrender.com"`;

const TURSO_CLI = `# ۱) نصب Turso CLI
curl -sSfL https://get.tur.so/install.sh | bash

# ۲) ورود و ساخت دیتابیس
turso auth login
turso db create sibak

# ۳) گرفتن URL
turso db show sibak --url
# خروجی: libsql://sibak-<your-handle>.turso.io

# ۴) ساخت توکن دسترسی
turso db tokens create sibak
# خروجی: eyJhbGciOi... (یک رشته‌ی بلند)

# ۵) تنظیم در Vercel
#    DATABASE_URL = "libsql://sibak-<handle>.turso.io?authToken=<token>"`;

const RENDER_BLUEPRINT = `# فایل render.yaml در ریشه‌ی repo — در Render: New → Blueprint
services:
  - type: web
    name: sibak-chat
    runtime: node
    plan: free
    rootDir: mini-services/chat-service
    buildCommand: bun install
    startCommand: bun run index.ts
    autoDeploy: true
    healthCheckPath: /health
    envVars:
      - key: NODE_ENV
        value: production`;

const DEPLOY_BUTTON_URL = "https://vercel.com/new";

export function AdminDeploy() {
  return (
    <div className="flex flex-col gap-5" aria-label="راهنمای دپلوی">
      {/* بنر intro */}
      <div className="glass card-hover relative overflow-hidden rounded-3xl p-5 md:p-6">
        <div className="pointer-events-none absolute -top-12 -left-12 size-40 rounded-full bg-chart-1/15 blur-3xl" aria-hidden />
        <div className="flex items-start gap-3">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-chart-1/15 text-primary">
            <Rocket className="size-6" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-black md:text-2xl">دپلوی رایگان و پایدار</h2>
              <Badge className="border-chart-2/40 bg-chart-2/15 text-accent-foreground">فقط ادمین</Badge>
            </div>
            <p className="mt-1.5 max-w-2xl text-sm leading-7 text-muted-foreground">
              این راه‌نما برای دپلوی رایگان و پایدار تا چند سال با حداکثر ۳۰ کاربر طراحی شده است.
              هر سه پلتفرم زیر پلن رایگان پایدار دارند و برای یک تیم کوچک کاملاً کافی هستند.
            </p>
          </div>
        </div>
      </div>

      {/* معماری پیشنهادی */}
      <div className="glass rounded-3xl p-5 md:p-6">
        <h3 className="mb-4 flex items-center gap-2 text-base font-black">
          <Server className="size-4" aria-hidden />
          معماری سه‌لایه
        </h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-chart-1/30 bg-chart-1/5 p-4">
            <div className="flex items-center gap-2">
              <Rocket className="size-4 text-primary" aria-hidden />
              <p className="text-sm font-black">Vercel</p>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">هاست اپ Next.js — رایگان، HTTPS خودکار، استقرار با git push</p>
          </div>
          <div className="rounded-2xl border border-chart-2/30 bg-chart-2/5 p-4">
            <div className="flex items-center gap-2">
              <Database className="size-4 text-accent-foreground" aria-hidden />
              <p className="text-sm font-black">Turso</p>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">دیتابیس libSQL hosted — رایگان ۹GB، ۱ میلیارد خواندن در ماه</p>
          </div>
          <div className="rounded-2xl border border-chart-3/30 bg-chart-3/5 p-4">
            <div className="flex items-center gap-2">
              <Terminal className="size-4 text-primary" aria-hidden />
              <p className="text-sm font-black">Render</p>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">سرویس چت WebSocket — رایگان (خواب بعد از ۱۵ دقیقه غیرفعالی)</p>
          </div>
        </div>
      </div>

      {/* دکمه‌های دپلوی سریع */}
      <div className="grid gap-3 sm:grid-cols-2">
        <a
          href={DEPLOY_BUTTON_URL}
          target="_blank"
          rel="noreferrer"
          className="glass card-hover flex items-center gap-3 rounded-2xl p-4 transition-colors hover:bg-secondary/40"
        >
          <div className="flex size-11 items-center justify-center rounded-2xl bg-foreground text-background">
            <Rocket className="size-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black">دپلوی روی Vercel</p>
            <p className="text-xs text-muted-foreground">رایگان، خودکار، بهترین گزینه برای Next.js</p>
          </div>
          <ExternalLink className="size-4 text-muted-foreground" aria-hidden />
        </a>
        <a
          href="https://turso.tech/signup"
          target="_blank"
          rel="noreferrer"
          className="glass card-hover flex items-center gap-3 rounded-2xl p-4 transition-colors hover:bg-secondary/40"
        >
          <div className="flex size-11 items-center justify-center rounded-2xl bg-foreground text-background">
            <Database className="size-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black">ساخت دیتابیس Turso</p>
            <p className="text-xs text-muted-foreground">رایگان ۹GB، سازگار با SQLite</p>
          </div>
          <ExternalLink className="size-4 text-muted-foreground" aria-hidden />
        </a>
      </div>

      {/* مراحل دپلوی */}
      <div className="glass rounded-3xl p-5 md:p-6">
        <h3 className="mb-4 text-base font-black">مراحل گام‌به‌گام</h3>
        <div className="flex flex-col gap-5">
          <StepCard n={1} title="repo را در GitHub قرار دهید">
            کد پروژه را به یک repo گیت‌هاب push کنید. Vercel از این repo استقرار خواهد کرد.
            اگر پروژه در محیط sandbox است، ابتدا آن را به‌صورت دستی یا با <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[11px]">git clone</code> به گیت‌هاب منتقل کنید.
          </StepCard>
          <StepCard n={2} title="دیتابیس Turso را بسازید">
            در turso.tech ثبت‌نام کنید و یک دیتابیس جدید بسازید. URL و توکن دسترسی را یادداشت کنید.
            <div className="mt-2">
              <CopyBlock label="Turso CLI" code={TURSO_CLI} />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              سپس اسکیمای Prisma را به دیتابیس Turso push کنید:
              <code className="mx-1 rounded bg-secondary px-1.5 py-0.5 font-mono text-[11px]">DATABASE_URL=&quot;libsql://...&quot; bun run db:push</code>
            </p>
          </StepCard>
          <StepCard n={3} title="سرویس چت را روی Render دپلوی کنید">
            در render.com یک Web Service جدید بسازید. فایل <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[11px]">render.yaml</code> در ریشه‌ی repo همه‌چیز را خودکار پیکربندی می‌کند.
            <div className="mt-2">
              <CopyBlock label="render.yaml" code={RENDER_BLUEPRINT} />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              پس از دپلوی، URL سرویس چت (مانند <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[11px]">https://sibak-chat.onrender.com</code>) را کپی کنید.
            </p>
          </StepCard>
          <StepCard n={4} title="در Vercel ثبت‌نام و repo را وصل کنید">
            به vercel.com بروید، با گیت‌هاب وارد شوید، «New Project» را بزنید و repo خود را import کنید.
            Vercel به‌صورت خودکار Next.js را شناسایی می‌کند. قبل از دکمه‌ی Deploy، متغیرهای محیطی را تنظیم کنید:
            <div className="mt-2">
              <CopyBlock label=".env" code={ENV_VARS} />
            </div>
          </StepCard>
          <StepCard n={5} title="دکمه‌ی Deploy را بزنید">
            Vercel در ۲-۳ دقیقه build و deploy را انجام می‌دهد. پس از اتمام، URL عمومی (مثل <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[11px]">https://sibak.vercel.app</code>) در دسترس خواهد بود.
            آن URL را با دیگران به اشتراک بگذارید تا ثبت‌نام و تست کنند.
          </StepCard>
        </div>
      </div>

      {/* فایل‌های پیکربندی */}
      <div className="glass rounded-3xl p-5 md:p-6">
        <h3 className="mb-4 flex items-center gap-2 text-base font-black">
          <HardDrive className="size-4" aria-hidden />
          فایل‌های پیکربندی موجود در repo
        </h3>
        <p className="mb-3 text-xs text-muted-foreground">
          این فایل‌ها از قبل در ریشه‌ی repo قرار دارند و برای دپلوی روی Vercel لازم هستند:
        </p>
        <div className="grid gap-3 lg:grid-cols-1">
          <CopyBlock label="vercel.json" code={VERCEL_JSON} />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          فایل‌های <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[11px]">.env.example</code> (نمونه‌ی متغیرها) و <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[11px]">render.yaml</code> (Blueprint سرویس چت) نیز در repo هستند.
        </p>
      </div>

      {/* متغیرهای محیطی */}
      <div className="glass rounded-3xl p-5 md:p-6">
        <h3 className="mb-4 flex items-center gap-2 text-base font-black">
          <KeyRound className="size-4" aria-hidden />
          متغیرهای محیطی Vercel
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="border-b border-border text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-bold">نام</th>
                <th className="px-3 py-2 font-bold">ضروری</th>
                <th className="px-3 py-2 font-bold">توضیح</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              <tr>
                <td className="px-3 py-2.5 font-mono text-xs" dir="ltr">AUTH_SECRET</td>
                <td className="px-3 py-2.5"><Badge className="bg-destructive/10 text-destructive border-destructive/30">بله</Badge></td>
                <td className="px-3 py-2.5 text-muted-foreground">رشته‌ی تصادفی برای امضای JWT (تولید: openssl rand -hex 32)</td>
              </tr>
              <tr>
                <td className="px-3 py-2.5 font-mono text-xs" dir="ltr">DATABASE_URL</td>
                <td className="px-3 py-2.5"><Badge className="bg-destructive/10 text-destructive border-destructive/30">بله</Badge></td>
                <td className="px-3 py-2.5 text-muted-foreground">URL دیتابیس Turso (libsql://...?authToken=...)</td>
              </tr>
              <tr>
                <td className="px-3 py-2.5 font-mono text-xs" dir="ltr">NEXT_PUBLIC_CHAT_URL</td>
                <td className="px-3 py-2.5"><Badge className="bg-amber-500/10 text-amber-600 border-amber-500/30">برای چت</Badge></td>
                <td className="px-3 py-2.5 text-muted-foreground">URL سرویس چت روی Render (بدون این، چت در پروداکشن کار نمی‌کند)</td>
              </tr>
              <tr>
                <td className="px-3 py-2.5 font-mono text-xs" dir="ltr">NEXT_PUBLIC_SITE_NAME</td>
                <td className="px-3 py-2.5"><Badge variant="outline">اختیاری</Badge></td>
                <td className="px-3 py-2.5 text-muted-foreground">نام سایت (پیش‌فرض: «سیبک»)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* اعتبارنامه ادمین + امنیت */}
      <div className="glass rounded-3xl border border-chart-4/30 bg-chart-4/5 p-5 md:p-6">
        <h3 className="mb-2 flex items-center gap-2 text-base font-black">
          <Shield className="size-4 text-chart-4" aria-hidden />
          یادآوری‌های امنیتی (مهم)
        </h3>
        <div className="space-y-2 text-sm leading-7 text-muted-foreground">
          <p>
            <strong className="text-foreground">۱. تغییر رمز ادمین:</strong> پس از اولین ورود با اعتبارنامه‌ی پیش‌فرض،
            حتماً از پروفایل رمز را تغییر دهید. رمز پیش‌فرض فقط برای راه‌اندازی است.
          </p>
          <p>
            <strong className="text-foreground">۲. AUTH_SECRET قوی:</strong> این رشته را با <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[11px]">openssl rand -hex 32</code> تولید کنید
            و در Vercel تنظیم کنید. هرگز آن را در repo نگذارید.
          </p>
          <p>
            <strong className="text-foreground">۳. محدودیت Render:</strong> پلن رایگان Render پس از ۱۵ دقیقه غیرفعالی به‌خواب می‌رود.
            درخواست بعدی ۳۰ ثانیه طول می‌کشد تا سرویس بیدار شود. برای ۳۰ کاربر این قابل‌قبول است.
          </p>
        </div>
      </div>

      {/* درباره پایداری */}
      <div className="glass rounded-3xl border border-chart-2/20 p-5 md:p-6">
        <h3 className="mb-3 flex items-center gap-2 text-base font-black">
          <Users className="size-4 text-accent-foreground" aria-hidden />
          درباره پایداری بلندمدت
        </h3>
        <div className="space-y-2 text-sm leading-7 text-muted-foreground">
          <p>
            این معماری برای <strong className="text-foreground">۱ تا چند سال با حداکثر ۳۰ کاربر</strong> مناسب است.
            هر سه پلتفرم پلن رایگان پایدار دارند:
          </p>
          <ul className="ml-4 list-disc space-y-1">
            <li><strong className="text-foreground">Vercel</strong>: ۱۰۰ گیگابایت پهنای باند ماهانه، ۱۰۰ ساعت build</li>
            <li><strong className="text-foreground">Turso</strong>: ۹ گیگابایت فضای ذخیره‌سازی، ۱ میلیارد خواندن در ماه</li>
            <li><strong className="text-foreground">Render</strong>: ۷۵۰ ساعت اجرا در ماه (کافی برای سرویس چت)</li>
          </ul>
          <p>
            اگر در آینده تعداد کاربران بیشتر شد یا نیاز به پایداری بالاتر بود، می‌توانید به پلن‌های پولی ارتقا دهید (Vercel Pro، Turso scaler، Render starter) که همگی ارزان‌قیمت هستند.
          </p>
        </div>
      </div>
    </div>
  );
}
