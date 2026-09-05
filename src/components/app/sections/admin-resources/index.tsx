"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import {
  Archive,
  DatabaseBackup,
  Eraser,
  Gauge,
  History,
  ScrollText,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { useHashRoute } from "@/components/app/router";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { RG_LEVEL_LABELS, type RgOverviewResponse } from "@/lib/rg-types";

import { OverviewTab } from "./_parts/overview-tab";
import { UsersTab } from "./_parts/users-tab";
import { CleanupTab } from "./_parts/cleanup-tab";
import { EventsTab } from "./_parts/events-tab";
import { BackupsTab } from "./_parts/backups-tab";
import { SettingsTab } from "./_parts/settings-tab";

const SUB_TABS = [
  { key: "overview", label: "نمای کلی", icon: Gauge },
  { key: "users", label: "مصرف کاربران", icon: Users },
  { key: "cleanup", label: "پاک‌سازی", icon: Eraser },
  { key: "events", label: "رویدادها", icon: History },
  { key: "backups", label: "پشتیبان‌گیری", icon: Archive },
  { key: "settings", label: "سقف‌ها", icon: ScrollText },
] as const;

type SubKey = (typeof SUB_TABS)[number]["key"];

/**
 * نگهبان منابع سیبک — مدیریت مصرف دیتابیس و فایل‌ها.
 * کلیدهای هش: #/admin-resources/<overview|users|cleanup|events|backups|settings>
 */
export default function AdminResourcesSection() {
  const { segments, navigate } = useHashRoute();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["rg", "overview"],
    queryFn: () => api.get<RgOverviewResponse>("/api/rg"),
    refetchInterval: 60_000,
  });

  const sub = segments[1] ?? "overview";

  useEffect(() => {
    if (segments[1] && !SUB_TABS.some((t) => t.key === segments[1])) {
      navigate("/admin-resources/overview");
    }
  }, [segments, navigate]);

  const activeTab: SubKey = (SUB_TABS.find((t) => t.key === sub)?.key ?? "overview") as SubKey;

  return (
    <section className="flex flex-col gap-5" aria-label="نگهبان منابع سیبک">
      {/* هدر */}
      <div className="glass card-hover relative overflow-hidden rounded-3xl p-6 md:p-8">
        <div
          className="pointer-events-none absolute -top-16 -left-16 size-48 rounded-full bg-chart-1/15 blur-3xl"
          aria-hidden
        />
        <div className="flex items-start gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-chart-1/15 text-primary">
            <DatabaseBackup className="size-7" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-black md:text-3xl">نگهبان منابع سیبک</h1>
              <Badge className="bg-chart-1/15 text-primary border border-chart-1/40">
                <ShieldCheck className="ml-1 size-3.5" aria-hidden />
                دسترسی ادمین
              </Badge>
              {data && data.storage.level !== "OK" && (
                <Badge
                  className={cn(
                    "border",
                    data.storage.level === "CRITICAL"
                      ? "bg-destructive/15 text-destructive border-destructive/40"
                      : "bg-chart-2/15 text-accent-foreground border-chart-2/40",
                  )}
                >
                  {RG_LEVEL_LABELS[data.storage.level]}
                </Badge>
              )}
            </div>
            <p className="mt-1.5 max-w-2xl text-sm leading-7 text-muted-foreground">
              سهمیهٔ آپلود، مصرف دیتابیس و فایل هر کاربر، پاک‌سازی فایل‌های اضافه و
              پشتیبان‌گیری کامل — چشم‌بیدار سیبک برای رشد بلندمدت.
            </p>
          </div>
        </div>
      </div>

      {/* زیرمنو */}
      <nav
        aria-label="زیرمنوی نگهبان منابع"
        className="glass sticky top-2 z-20 flex flex-wrap gap-1.5 rounded-2xl p-1.5 backdrop-blur"
      >
        {SUB_TABS.map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => navigate(`/admin-resources/${t.key}`)}
              className={cn(
                "relative flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors",
                isActive
                  ? "text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {isActive && (
                <motion.span
                  layoutId="rg-tab-pill"
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
        {isLoading && (
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-36 rounded-3xl" />
            ))}
          </div>
        )}
        {isError && (
          <div className="glass rounded-3xl p-6 text-center text-sm text-destructive">
            خطا در بارگذاری نگهبان منابع: {error instanceof Error ? error.message : "نامشخص"}
          </div>
        )}
        {data && (
          <>
            {activeTab === "overview" && <OverviewTab data={data} />}
            {activeTab === "users" && <UsersTab data={data} />}
            {activeTab === "cleanup" && <CleanupTab canManage={data.canManage} />}
            {activeTab === "events" && <EventsTab events={data.events} />}
            {activeTab === "backups" && <BackupsTab canManage={data.canManage} />}
            {activeTab === "settings" && <SettingsTab data={data} />}
          </>
        )}
      </motion.div>
    </section>
  );
}
