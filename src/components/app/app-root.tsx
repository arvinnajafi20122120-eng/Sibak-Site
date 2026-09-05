"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { useSession } from "@/store/session";
import { useHashRoute } from "@/components/app/router";
import { SibakLogo } from "@/components/app/logo";
import { AppShell } from "@/components/app/layout/app-shell";
import { Landing } from "@/components/app/auth/landing";
import { LoginView } from "@/components/app/auth/login";
import { RegisterView } from "@/components/app/auth/register";
import { GateScreen } from "@/components/app/auth/gate-screen";

/* ---------- بارگذاری تنبل سکشن‌ها ---------- */
const sections: Record<string, React.ComponentType> = {
  home: dynamic(() => import("@/components/app/sections/feed")),
  ideas: dynamic(() => import("@/components/app/sections/ideas")),
  polls: dynamic(() => import("@/components/app/sections/polls")),
  calendar: dynamic(() => import("@/components/app/sections/calendar")),
  groups: dynamic(() => import("@/components/app/sections/groups")),
  classes: dynamic(() => import("@/components/app/sections/classes")),
  chat: dynamic(() => import("@/components/app/sections/chat")),
  submissions: dynamic(() => import("@/components/app/sections/submissions")),
  announcements: dynamic(() => import("@/components/app/sections/announcements")),
  debts: dynamic(() => import("@/components/app/sections/debts")),
  vetoes: dynamic(() => import("@/components/app/sections/vetoes")),
  leaderboard: dynamic(() => import("@/components/app/sections/leaderboard")),
  medals: dynamic(() => import("@/components/app/sections/medals")),
  support: dynamic(() => import("@/components/app/sections/support")),
  profile: dynamic(() => import("@/components/app/sections/profile")),
  teacher: dynamic(() => import("@/components/app/sections/teacher")),
  notifications: dynamic(() => import("@/components/app/sections/notifications")),
  admin: dynamic(() => import("@/components/app/sections/admin")),
  "admin-users": dynamic(() => import("@/components/app/sections/admin")),
  "admin-dossier": dynamic(() => import("@/components/app/sections/admin")),
  "admin-content": dynamic(() => import("@/components/app/sections/admin")),
  "admin-settings": dynamic(() => import("@/components/app/sections/admin")),
  "admin-resources": dynamic(() => import("@/components/app/sections/admin-resources")),
};

/* ---------- لودر تمام‌صفحه ---------- */
function BootLoader() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-5 bg-background">
      <motion.div
        animate={{ y: [0, -14, 0], rotate: [0, 4, -3, 0] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
      >
        <SibakLogo size={84} />
      </motion.div>
      <div className="flex flex-col items-center gap-2">
        <p className="text-3xl font-black tracking-tight">سیبک</p>
        <p className="text-xs text-muted-foreground">بستر همکاری درسی</p>
      </div>
      <div className="shimmer-bar h-1.5 w-44 rounded-full" aria-hidden />
    </div>
  );
}

/**
 * ریشه اپ سیبک — مسیرهای حالت: لودینگ / مهمان (فرود، ورود، ثبت‌نام) /
 * دروازه وضعیت / اپ اصلی با سکشن‌های هش‌محور.
 */
export default function AppRoot() {
  const { loading, user } = useSession();
  const { segments, navigate } = useHashRoute();
  const reduce = useReducedMotion();

  // کاربر واردشده بدون هش → هوم
  useEffect(() => {
    if (!loading && user && user.status === "ACTIVE" && segments.length === 0) {
      navigate("home");
    }
  }, [loading, user, segments.length, navigate]);

  if (loading) return <BootLoader />;

  /* ---------- مهمان ---------- */
  if (!user) {
    const view = segments[0];
    if (view === "login") return <LoginView />;
    if (view === "register") return <RegisterView />;
    return <Landing />;
  }

  /* ---------- دروازه وضعیت ---------- */
  if (user.status !== "ACTIVE") return <GateScreen />;

  /* ---------- اپ اصلی ---------- */
  const sectionKey = segments[0] ?? "home";
  const Section = sections[sectionKey] ?? sections.home;
  const sectionId = sections[sectionKey] ? sectionKey : "home";

  return (
    <AppShell>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={sectionId}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14 }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -10 }}
          transition={{
            duration: reduce ? 0.15 : 0.3,
            ease: [0.16, 1, 0.3, 1],
          }}
        >
          <Section />
        </motion.div>
      </AnimatePresence>
    </AppShell>
  );
}
