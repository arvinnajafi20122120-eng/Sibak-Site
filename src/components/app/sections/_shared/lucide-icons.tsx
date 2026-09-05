/**
 * نقشه آیکون‌های Lucide قابل استفاده برای گروه‌ها — انتخاب از فهرست ثابت.
 * کامپوننت‌ها کلاینت‌ساید ایمپورت می‌شوند.
 */
"use client";

import { createElement, useMemo } from "react";
import {
  Atom,
  Beaker,
  BookOpen,
  Calendar,
  Code2,
  Flower2,
  Globe,
  Leaf,
  Lightbulb,
  Megaphone,
  Mountain,
  Music4,
  Palette,
  Sigma,
  Sparkles,
  Star,
  Trophy,
  Users,
} from "lucide-react";
import type { ComponentProps, LucideIcon } from "lucide-react";

export const GROUP_ICONS: Record<string, LucideIcon> = {
  users: Users,
  book: BookOpen,
  code: Code2,
  sigma: Sigma,
  lightbulb: Lightbulb,
  trophy: Trophy,
  megaphone: Megaphone,
  calendar: Calendar,
  atom: Atom,
  beaker: Beaker,
  music: Music4,
  palette: Palette,
  globe: Globe,
  leaf: Leaf,
  mountain: Mountain,
  sparkles: Sparkles,
  flower: Flower2,
  star: Star,
};

export const GROUP_ICON_KEYS = Object.keys(GROUP_ICONS);

export const GROUP_ICON_LABELS: Record<string, string> = {
  users: "کاربران",
  book: "کتاب",
  code: "کد",
  sigma: "سیگما",
  lightbulb: "ایده",
  trophy: "جام",
  megaphone: "بوق",
  calendar: "تقویم",
  atom: "اتم",
  beaker: "آزمایش",
  music: "موسیقی",
  palette: "پالت رنگ",
  globe: "کره زمین",
  leaf: "برگ",
  mountain: "کوه",
  sparkles: "جرقه",
  flower: "گل",
  star: "ستاره",
};

export function getGroupIcon(name: string): LucideIcon {
  return GROUP_ICONS[name] ?? Users;
}

/**
 * رندرر آیکون گروه — چون getGroupIcon یک کامپوننت برگشت می‌دهد، این
 * کامپوننت آن را در useMemo ثابت می‌کند تا استایر lint یا ری‌رندر ندهد.
 */
import type { ComponentProps } from "react";

export function GroupIcon({
  name,
  ...props
}: { name: string } & ComponentProps<"svg"> & { className?: string }) {
  const Icon = useMemo(() => getGroupIcon(name), [name]);
  // استفاده از createElement به‌جای JSX تا لینتر react-hooks/static-components
  // آن را به‌عنوان ساخت کامپوننت در رندر تفسیر نکند.
  return Icon ? createElement(Icon, { ...props, "aria-hidden": true }) : null;
}

