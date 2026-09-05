"use client";

import { useId } from "react";
import { motion } from "framer-motion";
import { LogOut, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";
import { toFa } from "@/lib/jalali";
import { useSession } from "@/store/session";
import { useHashRoute } from "@/components/app/router";
import {
  NAV_SECTIONS,
  ROLE_BADGE_CLASSES,
  ROLE_LABELS,
  navItemsForRole,
  type NavItem,
} from "@/components/app/nav";
import { SiteBranding } from "@/components/app/logo";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/**
 * فهرست ناوبری مشترک — هم در سایدبار دسکتاپ و هم در دراور موبایل استفاده می‌شود.
 */
export function NavList({
  activeKey,
  onNavigate,
}: {
  activeKey: string;
  onNavigate: (key: string) => void;
}) {
  const role = useSession((s) => s.user?.role);
  const pillId = useId();

  // کلیدهای مجاز برای نقش فعلی (مثلاً GUEST فقط مجموعهٔ فقط‌خواندنی می‌بیند)
  const allowedKeys = new Set(
    navItemsForRole(role).map((i) => i.key),
  );

  return (
    <nav aria-label="ناوبری اصلی سیبک" className="flex flex-col gap-5">
      {NAV_SECTIONS.map((section) => {
        const items = section.items.filter((item) => {
          if (item.roles && !item.roles.includes(role ?? "MEMBER")) return false;
          if (!allowedKeys.has(item.key)) return false;
          return true;
        });
        if (items.length === 0) return null;
        return (
          <div key={section.key} className="flex flex-col gap-1">
            <span className="mb-1 px-3 text-[11px] font-bold tracking-wide text-muted-foreground">
              {section.label}
            </span>
            {items.map((item: NavItem) => {
              const isActive = activeKey === item.key;
              const Icon = item.icon;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onNavigate(item.key)}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "relative flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "text-primary-foreground"
                      : "text-foreground/75 hover:bg-accent/60 hover:text-foreground",
                  )}
                >
                  {isActive && (
                    <motion.span
                      layoutId={`nav-active-pill-${pillId}`}
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                      className="absolute inset-0 rounded-xl bg-primary shadow-md shadow-primary/30"
                    />
                  )}
                  <Icon className="relative z-10 size-[18px]" aria-hidden />
                  <span className="relative z-10">{item.label}</span>
                </button>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}

/**
 * سایدبار دسکتاپ — در چیدمان RTL سمت راست چسبیده است.
 *
 * نکته‌ی اسکرول: از ScrollArea (Radix) استفاده نمی‌کنیم چون وقتی محتوای
 * داخلش کوتاه‌تر از viewport است، رویداد wheel به parent می‌رود و صفحه‌ی
 * اصلی جابجا می‌شود. به‌جایش overflow-y-auto بومی با overscroll-contain
 * و stopPropagation روی wheel — این همیشه درست کار می‌کند.
 */
export function Sidebar() {
  const { segments, navigate } = useHashRoute();
  const user = useSession((s) => s.user);
  const logout = useSession((s) => s.logout);
  const activeKey = segments[0] ?? "home";

  // جلوگیری از bubble wheel به صفحه‌ی اصلی وقتی محتوای سایدبار کوتاه است.
  // وقتی به انتها/ابتدای اسکرول می‌رسیم هم اجازه‌ی عبور نمی‌دهیم.
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const atTop = scrollTop === 0;
    const atBottom = scrollTop + clientHeight >= scrollHeight - 1;
    const goingUp = e.deltaY < 0;
    const goingDown = e.deltaY > 0;
    if ((atTop && goingUp) || (atBottom && goingDown)) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  return (
    <aside className="glass sticky top-0 hidden h-svh w-64 shrink-0 flex-col border-l lg:flex">
      <div className="flex items-center px-5 pb-4 pt-6">
        <SiteBranding size={38} />
      </div>

      <div
        onWheel={handleWheel}
        className="sibak-scroll flex-1 overflow-y-auto px-3"
        dir="rtl"
      >
        <NavList activeKey={activeKey} onNavigate={(k) => navigate(`/${k}`)} />
      </div>

      {user && (
        <div className="border-t border-border/60 p-3">
          <div className="glass flex items-center gap-3 rounded-2xl p-3">
            <Avatar className="size-10 border border-border/60">
              <AvatarFallback className="bg-primary/10 text-lg">
                {user.avatar || user.name.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{user.name}</p>
              <div className="mt-1 flex items-center gap-1.5">
                <Badge
                  variant="outline"
                  className={cn("h-5 px-1.5 text-[10px]", ROLE_BADGE_CLASSES[user.role])}
                >
                  {ROLE_LABELS[user.role]}
                </Badge>
                <span className="flex items-center gap-0.5 text-[11px] font-semibold text-muted-foreground">
                  <Sparkles className="size-3 text-chart-2" aria-hidden />
                  {toFa(user.points)} امتیاز
                </span>
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 w-full justify-start gap-2 text-muted-foreground hover:text-destructive"
            onClick={() => {
              void logout().then(() => navigate("/login"));
            }}
          >
            <LogOut className="size-4" aria-hidden />
            خروج از حساب
          </Button>
        </div>
      )}
    </aside>
  );
}
