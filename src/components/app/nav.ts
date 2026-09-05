import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  ClipboardList,
  DatabaseBackup,
  GraduationCap,
  Heart,
  Home,
  Lightbulb,
  Medal,
  MessageSquarePlus,
  Megaphone,
  Scale,
  ShieldBan,
  ShieldCheck,
  Trophy,
  UserRound,
  Users,
  Vote,
} from "lucide-react";

import type { Role, UserStatus } from "@/lib/types";

/**
 * منبع واحد ناوبری سیبک.
 * ایجنت‌های بعدی محتوای سکشن‌ها را در پوشه‌های sections/* جایگزین می‌کنند
 * و این فایل را ویرایش نمی‌کنند.
 */

export interface NavItem {
  key: string;
  label: string;
  icon: LucideIcon;
  desc: string;
  roles?: Role[];
}

export interface NavSection {
  key: string;
  label: string;
  items: NavItem[];
}

export const NAV_ITEMS: NavItem[] = [
  {
    key: "home",
    label: "خانه",
    icon: Home,
    desc: "خلاصه فعالیت‌ها و دسترسی سریع",
  },
  {
    key: "ideas",
    label: "ایده‌ها",
    icon: Lightbulb,
    desc: "ثبت، رأی‌گیری و اجرای ایده‌های درسی",
  },
  {
    key: "polls",
    label: "نظرسنجی‌ها",
    icon: Vote,
    desc: "تصمیم‌گیری جمعی و اعطای وتو",
  },
  {
    key: "calendar",
    label: "تقویم",
    icon: CalendarDays,
    desc: "تقویم شمسی رویدادها و امتحان‌ها",
  },
  {
    key: "groups",
    label: "زیرمجموعه‌ها",
    icon: Users,
    desc: "گروه‌های مطالعاتی و تیم‌های همکاری",
  },
  {
    key: "classes",
    label: "کلاس‌ها",
    icon: GraduationCap,
    desc: "کلاس‌های درسی با استاد، دانش‌آموز و محتوا",
  },
  {
    key: "submissions",
    label: "تکالیف",
    icon: ClipboardList,
    desc: "ارسال پروژه، بازبینی استاد و محتوای کلاس",
    roles: ["ADMIN", "MANAGER", "TEACHER", "MEMBER"],
  },
  {
    key: "chat",
    label: "چت",
    icon: MessageSquarePlus,
    desc: "گفت‌وگوی زنده و اشتراک فایل با همکاران",
    roles: ["ADMIN", "MANAGER", "TEACHER", "MEMBER"],
  },
  {
    key: "announcements",
    label: "پیام‌ها",
    icon: Megaphone,
    desc: "اطلاعیه‌های همگانی و گروهی",
  },
  {
    key: "debts",
    label: "بدهکاری",
    icon: Scale,
    desc: "دفتر بدهکاری مودبانه میان اعضا",
  },
  {
    key: "vetoes",
    label: "وتوها",
    icon: ShieldBan,
    desc: "دفتر وتوها و اعطای اختیارات ویژه",
  },
  {
    key: "leaderboard",
    label: "برترین‌ها",
    icon: Trophy,
    desc: "جدول امتیازات و نشان‌ها",
  },
  {
    key: "medals",
    label: "مدال‌ها",
    icon: Medal,
    desc: "کتابخانه مدال‌ها، نایابی و دارندگانشان",
  },
  {
    key: "support",
    label: "حمایت از سیبک",
    icon: Heart,
    desc: "کمک داوطلبانه، شماره کارت و فهرست حامیان",
  },
  {
    key: "profile",
    label: "پروفایل",
    icon: UserRound,
    desc: "پروفایل، مدال‌ها و تاریخچه امتیاز",
  },
  {
  key: "teacher",
  label: "پنل استاد",
  icon: ShieldCheck,
  desc: "مدیریت کلاس‌ها و دانش‌آموزان",
  roles: ["TEACHER"],
  },
  {
    key: "admin",
    label: "پنل ادمین",
    icon: ShieldCheck,
    desc: "خلاصه وضعیت سایت",
    roles: ["ADMIN"],
  },
  {
    key: "admin-users",
    label: "کاربران",
    icon: Users,
    desc: "مدیریت اعضا و تایید عضویت‌ها",
    roles: ["ADMIN"],
  },
  {
    key: "admin-dossier",
    label: "پرونده‌ها",
    icon: ShieldCheck,
    desc: "پرونده شفافیت و ممیزی رویدادها",
    roles: ["ADMIN"],
  },
  {
    key: "admin-settings",
    label: "تنظیمات سایت",
    icon: ShieldCheck,
    desc: "نام، لوگو و سیاست ثبت‌نام",
    roles: ["ADMIN"],
  },
  {
    key: "admin-resources",
    label: "نگهبان منابع",
    icon: DatabaseBackup,
    desc: "سهمیه آپلود، مصرف دیتابیس، پاک‌سازی و پشتیبان‌گیری",
    roles: ["ADMIN"],
  },
];

export const NAV_SECTIONS: NavSection[] = [
  {
    key: "collab",
    label: "فضای همکاری",
    items: NAV_ITEMS.filter((i) =>
      ["home", "ideas", "polls", "calendar", "groups", "classes", "submissions", "chat"].includes(i.key),
    ),
  },
  {
    key: "org",
    label: "سازمان",
    items: NAV_ITEMS.filter((i) =>
      ["announcements", "debts", "vetoes", "leaderboard", "medals", "support", "profile"].includes(i.key),
    ),
  },
  {
  key: "teacher",
  label: "استاد",
  items: NAV_ITEMS.filter((i) =>
    ["teacher"].includes(i.key),
  ),
  },
  {
    key: "admin",
    label: "مدیریت",
    items: NAV_ITEMS.filter((i) =>
  i.key.startsWith("admin")
  ),
  },
];

export function getNavItem(key: string): NavItem | undefined {
  return NAV_ITEMS.find((i) => i.key === key);
}

export function navItemsForRole(role: Role | undefined): NavItem[] {
  if (!role) return [];
  // اعضای مهمان فقط به زیرمجموعه‌ی فقط‌خواندنی دسترسی دارند:
  // خانه، تقویم، زیرمجموعه‌ها، پیام‌ها، پروفایل.
  if (role === "GUEST") {
    const allowed = new Set([
      "home",
      "calendar",
      "groups",
      "classes",
      "announcements",
      "medals",
      "profile",
    ]);
    return NAV_ITEMS.filter(
      (i) => allowed.has(i.key) || (i.roles?.includes(role) ?? false),
    );
  }
  return NAV_ITEMS.filter((i) => !i.roles || i.roles.includes(role));
}

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "ادمین",
  MANAGER: "مدیر",
  TEACHER: "استاد",
  MEMBER: "کاربر",
  GUEST: "مهمان",
};

export const STATUS_LABELS: Record<UserStatus, string> = {
  PENDING: "در انتظار تایید",
  ACTIVE: "فعال",
  SUSPENDED: "غیرفعال موقت",
  REJECTED: "ردشده",
};

export const ROLE_BADGE_CLASSES: Record<Role, string> = {
  ADMIN: "bg-chart-2/20 text-accent-foreground border-chart-2/40",
  MANAGER: "bg-chart-1/15 text-primary border-chart-1/40",
  TEACHER: "bg-chart-5/15 text-chart-5 border-chart-5/40",
  MEMBER: "bg-secondary text-secondary-foreground border-border",
  GUEST: "bg-chart-4/15 text-chart-4 border-chart-4/40",
};