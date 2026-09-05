"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  Check,
  LogOut,
  Menu,
  Moon,
  Sun,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { api } from "@/lib/api-client";
import { relativeTime, toFa } from "@/lib/jalali";
import { useSession } from "@/store/session";
import { useHashRoute } from "@/components/app/router";
import { ROLE_LABELS } from "@/components/app/nav";
import { SiteBranding } from "@/components/app/logo";
import { NavList } from "@/components/app/layout/sidebar";
import { HeaderSearch } from "@/components/app/layout/header-search";
import type { AppNotification } from "@/lib/types";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={isDark ? "تم روشن" : "تم تیره"}
      className="size-10 rounded-xl"
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={isDark ? "moon" : "sun"}
          initial={{ rotate: -60, opacity: 0, scale: 0.6 }}
          animate={{ rotate: 0, opacity: 1, scale: 1 }}
          exit={{ rotate: 60, opacity: 0, scale: 0.6 }}
          transition={{ duration: 0.18 }}
        >
          {isDark ? (
            <Moon className="size-[18px]" aria-hidden />
          ) : (
            <Sun className="size-[18px]" aria-hidden />
          )}
        </motion.span>
      </AnimatePresence>
    </Button>
  );
}

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { navigate } = useHashRoute();
  const unreadCount = useSession((s) => s.unreadCount);
  const refreshUnread = useSession((s) => s.refreshUnread);

  const { data, refetch } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.get<{ notifications: AppNotification[] }>("/api/notifications"),
    enabled: open,
  });

  async function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      await refetch();
      // علامت‌گذاری همه به‌عنوان خوانده‌شده هنگام باز شدن
      try {
        await api.post("/api/notifications/read");
        await refreshUnread();
      } catch {
        /* بی‌اهمیت */
      }
    }
  }

  const notifications = data?.notifications ?? [];

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`اعلان‌ها${unreadCount > 0 ? ` — ${toFa(unreadCount)} نخوانده` : ""}`}
          className="relative size-10 rounded-xl"
        >
          <Bell className="size-[18px]" aria-hidden />
          {unreadCount > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-0.5 -left-0.5 flex min-w-5 items-center justify-center rounded-full bg-destructive px-1 py-0.5 text-[10px] font-bold leading-none text-white tabular-nums"
            >
              {toFa(Math.min(unreadCount, 99))}
            </motion.span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={10} className="w-80 p-0" dir="rtl">
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <p className="text-sm font-bold">اعلان‌های اخیر</p>
          <span className="text-[11px] text-muted-foreground">
            {unreadCount > 0 ? `${toFa(unreadCount)} نخوانده` : "همه خوانده‌شده"}
          </span>
        </div>
        <div className="max-h-80 overflow-y-auto p-1">
          {notifications.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              فعلاً اعلانی ندارید 🍏
            </p>
          ) : (
            notifications.slice(0, 12).map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => {
                  if (n.link) {
                    navigate(n.link.replace(/^#/, ""));
                    setOpen(false);
                  }
                }}
                className={cn(
                  "flex w-full flex-col items-start gap-0.5 rounded-xl px-3 py-2.5 text-right transition-colors hover:bg-accent/50",
                  !n.readAt && "bg-primary/5",
                )}
              >
                <span className="flex w-full items-center gap-1.5">
                  <span className="truncate text-[13px] font-semibold">{n.title}</span>
                  {!n.readAt && (
                    <span className="ms-auto size-2 shrink-0 rounded-full bg-primary" aria-label="نخوانده" />
                  )}
                </span>
                <span className="line-clamp-2 text-xs leading-5 text-muted-foreground">
                  {n.message}
                </span>
                <span className="text-[10px] text-muted-foreground/70">
                  {relativeTime(new Date(n.createdAt))}
                </span>
              </button>
            ))
          )}
        </div>
        <div className="border-t border-border/60 p-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="w-full gap-2 text-muted-foreground"
            onClick={() => {
              navigate("/notifications");
              setOpen(false);
            }}
          >
            <Check className="size-4" aria-hidden />
            مشاهده همه اعلان‌ها
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function UserMenu() {
  const user = useSession((s) => s.user);
  const logout = useSession((s) => s.logout);
  const { navigate } = useHashRoute();
  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-10 gap-2 rounded-xl px-2"
          aria-label="منوی کاربر"
        >
          <Avatar className="size-8 border border-border/60">
            <AvatarFallback className="bg-primary/10 text-base">
              {user.avatar || user.name.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <span className="hidden max-w-28 truncate text-sm font-semibold sm:block">
            {user.name}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56" dir="rtl">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="text-sm font-bold">{user.name}</span>
          <span className="text-xs font-normal text-muted-foreground">
            {ROLE_LABELS[user.role]} · {toFa(user.points)} امتیاز
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="gap-2 py-2.5"
          onClick={() => navigate("/profile")}
        >
          <UserRound className="size-4" aria-hidden />
          پروفایل من
        </DropdownMenuItem>
        <DropdownMenuItem
          className="gap-2 py-2.5 text-destructive focus:text-destructive"
          onClick={async () => {
            await logout();
            toast.success("از حساب خود خارج شدید");
            navigate("/login");
          }}
        >
          <LogOut className="size-4" aria-hidden />
          خروج
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * هدر سیبک — چسبان بالا با افکت شیشه‌ای؛ در موبایل دکمه منو (دراور) دارد.
 */
export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { segments, navigate } = useHashRoute();
  const activeKey = segments[0] ?? "home";

  return (
    <header className="glass-strong sticky top-0 z-40 flex h-16 items-center justify-between gap-2 border-b px-3 md:px-5">
      {/* راست: منوی موبایل + برندینگ */}
      <div className="flex items-center gap-1.5">
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="باز کردن منو"
              className="size-10 rounded-xl lg:hidden"
            >
              <Menu className="size-5" aria-hidden />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72 p-0" dir="rtl">
            <SheetHeader className="border-b border-border/60 px-5 py-4">
              <SheetTitle asChild>
                <div>
                  <SiteBranding size={34} />
                </div>
              </SheetTitle>
            </SheetHeader>
            <div className="h-[calc(100svh-5rem)] overflow-y-auto p-3">
              <NavList
                activeKey={activeKey}
                onNavigate={(k) => {
                  navigate(`/${k}`);
                  setMenuOpen(false);
                }}
              />
            </div>
          </SheetContent>
        </Sheet>

        <span className="lg:hidden">
          <SiteBranding size={30} withName />
        </span>
      </div>

      {/* چپ: جستجو، تم، اعلان، کاربر */}
      <div className="flex items-center gap-1.5">
        <div className="hidden md:block">
          <HeaderSearch variant="desktop" />
        </div>
        <div className="md:hidden">
          <HeaderSearch variant="mobile" />
        </div>
        <ThemeToggle />
        <NotificationBell />
        <UserMenu />
      </div>
    </header>
  );
}
