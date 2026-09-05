"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  FileText,
  GraduationCap,
  Megaphone,
  Rocket,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Users,
  Wrench,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useHashRoute } from "@/components/app/router";
import { Badge } from "@/components/ui/badge";
import { AdminOverview } from "./_parts/admin-overview";
import { AdminUsers } from "./_parts/admin-users";
import { AdminDossier } from "./_parts/admin-dossier";
import { AdminContent } from "./_parts/admin-content";
import { AdminSettings } from "./_parts/admin-settings";
import { AdminGuests } from "./_parts/admin-guests";
import { AdminDeploy } from "./_parts/admin-deploy";
import { AdminAssignments } from "./_parts/admin-assignments";

const SUB_TABS = [
  { key: "overview", label: "خلاصه", icon: Sparkles },
  { key: "users", label: "کاربران", icon: Users },
  { key: "guests", label: "مهمان‌ها", icon: UserPlus },
  { key: "teachers", label: "اساتید", icon: GraduationCap },
  { key: "content", label: "محتوا", icon: Megaphone },
  { key: "settings", label: "تنظیمات", icon: Wrench },
  { key: "deploy", label: "دپلوی", icon: Rocket },
] as const;

type SubKey = (typeof SUB_TABS)[number]["key"];

/**
 * پنل ادمین سیبک — مدیریت کامل کاربران، محتوا، پرونده‌ها و تنظیمات.
 * کلیدهای هش: #/admin, #/admin/users, #/admin/dossier/:userId,
 * #/admin/content, #/admin/settings.
 */
export default function AdminSection() {
  const { segments, navigate } = useHashRoute();

  // segments[0] === "admin" (این سکشن) → segments[1] = sub
  const sub = segments[1] ?? "overview";

  // همگام‌سازی هش: اگر segments[1] غیروجهت یا نامعتبر بود → overview
  // (همگام‌سازی درون effect، همیشه قبل از early-return صدا زده می‌شود)
  useEffect(() => {
    if (
      segments[1] &&
      !SUB_TABS.some((t) => t.key === segments[1]) &&
      segments[1] !== "dossier"
    ) {
      navigate("/admin/overview");
    }
  }, [segments, navigate]);

  // اگر در پرونده‌ی یک کاربر هستیم (#/admin/dossier/<id>) → full-page Dossier
  if (sub === "dossier" && segments[2]) {
    return (
      <section className="flex flex-col gap-5" aria-label="پرونده کاربر در پنل ادمین">
        <DossierHeader onBack={() => navigate("/admin/users")} />
        <AdminDossier userId={segments[2]} />
      </section>
    );
  }

  const activeTab: SubKey = (SUB_TABS.find((t) => t.key === sub)?.key ??
    "overview") as SubKey;

  return (
    <section className="flex flex-col gap-5" aria-label="پنل ادمین سیبک">
      {/* هدر */}
      <div className="glass card-hover relative overflow-hidden rounded-3xl p-6 md:p-8">
        <div
          className="pointer-events-none absolute -top-16 -left-16 size-48 rounded-full bg-chart-2/15 blur-3xl"
          aria-hidden
        />
        <div className="flex items-start gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-chart-2/15 text-accent-foreground">
            <ShieldCheck className="size-7" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-black md:text-3xl">پنل مدیریت سیبک</h1>
              <Badge className="bg-chart-2/15 text-accent-foreground border border-chart-2/40">
                دسترسی ادمین
              </Badge>
            </div>
            <p className="mt-1.5 max-w-xl text-sm leading-7 text-muted-foreground">
              مدیریت اعضا، تأیید عضویت‌ها، پرونده شفافیت رویدادها و تنظیمات سایت —
              همه‌چیز این‌جا در یک نگاه.
            </p>
          </div>
        </div>
      </div>

      {/* زیرمنو */}
      <nav
        aria-label="زیرمنوی پنل ادمین"
        className="glass sticky top-2 z-20 flex flex-wrap gap-1.5 rounded-2xl p-1.5 backdrop-blur"
      >
        {SUB_TABS.map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => navigate(`/admin/${t.key}`)}
              className={cn(
                "relative flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors",
                isActive
                  ? "text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {isActive && (
                <motion.span
                  layoutId="admin-tab-pill"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  className="absolute inset-0 rounded-xl bg-primary"
                />
              )}
              <Icon className="relative z-10 size-4" aria-hidden />
              <span className="relative z-10">{t.label}</span>
            </button>
          );
        })}
      </nav>

      {/* محتوای تب */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="min-h-[40vh]"
      >
        {activeTab === "overview" && <AdminOverview />}
        {activeTab === "users" && <AdminUsers />}
        {activeTab === "guests" && <AdminGuests />}
        {activeTab === "teachers" && <AdminAssignments />}
        {activeTab === "content" && <AdminContent />}
        {activeTab === "settings" && <AdminSettings />}
        {activeTab === "deploy" && <AdminDeploy />}
      </motion.div>
    </section>
  );
}

function DossierHeader({ onBack }: { onBack: () => void }) {
  return (
    <div className="case-folder relative overflow-hidden rounded-t-xl p-5 md:p-6">
      {/* زبانه‌ٔ پرونده */}
      <div className="case-tab absolute -top-px right-8">
        <FileText className="size-4" aria-hidden />
        <span className="typewriter">DOSSIER</span>
      </div>

      {/* مهر محرمانه */}
      <div className="case-seal" aria-hidden>
        <span className="text-[0.55rem]">CONFIDENTIAL</span>
        <span className="mt-1 text-[0.5rem]">سیبک · ADM</span>
      </div>

      <div className="flex items-center justify-between gap-3 ps-20">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-2xl bg-amber-900/15 text-amber-900 dark:text-amber-200">
            <ShieldCheck className="size-5" aria-hidden />
          </div>
          <div>
            <h2 className="text-lg font-black md:text-xl">پروندهٔ کاربر</h2>
            <p className="text-xs text-current/70">
              تمام اطلاعات کاربر، حتی محتوای حذف‌شده — شفافیت کامل ادمین.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="flex min-h-11 items-center gap-1.5 rounded-xl border border-current/20 bg-amber-900/5 px-3 py-2 text-xs font-semibold text-current hover:bg-amber-900/15 dark:text-amber-200"
        >
          <ArrowRight className="size-4" aria-hidden />
          بازگشت به کاربران
        </button>
      </div>

      {/* سوراخ‌های کاغذی */}
      <div className="case-punch-holes" aria-hidden>
        <span />
        <span />
      </div>
    </div>
  );
}
