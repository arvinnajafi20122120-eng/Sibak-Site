/**
 * پالت رنگ‌های گروه — از توکن‌های پالت سیبک استفاده می‌کند.
 * این فایل فقط ثابت‌هاست؛ کلاینت ایمپورت می‌کند.
 */
export type GroupColorKey = "emerald" | "rose" | "amber" | "teal" | "orange";

export const GROUP_COLOR_OPTIONS: GroupColorKey[] = [
  "emerald",
  "rose",
  "amber",
  "teal",
  "orange",
];

/** نام مستعار برای سازگاری با کدهایی که از GROUP_COLORS استفاده می‌کنند. */
export const GROUP_COLORS: readonly GroupColorKey[] = GROUP_COLOR_OPTIONS;

export const GROUP_COLOR_LABELS: Record<GroupColorKey, string> = {
  emerald: "سبز سیبی",
  rose: "گل‌سرخی",
  amber: "کهربایی",
  teal: "فیروزه‌ای",
  orange: "نارنجی",
};

/** کلاس‌های پس‌زمینه گرادیانی برای هدر کارت/هیرو. */
export const GROUP_COLOR_GRADIENT: Record<GroupColorKey, string> = {
  emerald: "from-chart-1/85 via-chart-1/55 to-chart-1/15",
  rose: "from-chart-3/85 via-chart-3/55 to-chart-3/15",
  amber: "from-chart-2/85 via-chart-2/55 to-chart-2/15",
  teal: "from-chart-4/85 via-chart-4/55 to-chart-4/15",
  orange: "from-chart-5/85 via-chart-5/55 to-chart-5/15",
};

/** رنگ متن روی گرادیان — همیشه روشن. */
export const GROUP_COLOR_TEXT_ON_GRADIENT = "text-white";

/** بَج رنگ سیال کوچک. */
export const GROUP_COLOR_BADGE: Record<GroupColorKey, string> = {
  emerald: "bg-chart-1/15 text-primary border-chart-1/40",
  rose: "bg-chart-3/15 text-destructive border-chart-3/40",
  amber: "bg-chart-2/20 text-accent-foreground border-chart-2/50",
  teal: "bg-chart-4/20 text-foreground border-chart-4/50",
  orange: "bg-chart-5/20 text-accent-foreground border-chart-5/50",
};

/** برچسب فارسی سیاست عضویت گروه. */
export const JOIN_POLICY_LABELS: Record<string, string> = {
  OPEN: "باز",
  REQUEST: "درخواستی",
  INVITE: "دعوتی",
};

/** نقاط رنگی تقویم بر اساس نوع رویداد. */
export type EventTypeKey =
  | "GENERAL"
  | "EXAM"
  | "HOMEWORK"
  | "MEETING"
  | "HOLIDAY"
  | "PROJECT";

export const EVENT_TYPE_COLOR: Record<EventTypeKey, string> = {
  GENERAL: "bg-chart-1",
  EXAM: "bg-chart-2",
  HOMEWORK: "bg-chart-4",
  MEETING: "bg-chart-1",
  HOLIDAY: "bg-chart-5",
  PROJECT: "bg-chart-3",
};

export const EVENT_TYPE_LABELS: Record<EventTypeKey, string> = {
  GENERAL: "عمومی",
  EXAM: "امتحان",
  HOMEWORK: "تکلیف",
  MEETING: "جلسه",
  HOLIDAY: "تعطیلی",
  PROJECT: "پروژه",
};

/** کلاس رنگی برای بَج نوع رویداد. */
export const EVENT_TYPE_BADGE: Record<EventTypeKey, string> = {
  GENERAL: "bg-chart-1/15 text-primary border-chart-1/40",
  EXAM: "bg-chart-2/20 text-accent-foreground border-chart-2/50",
  HOMEWORK: "bg-chart-4/20 text-foreground border-chart-4/50",
  MEETING: "bg-chart-1/15 text-primary border-chart-1/40",
  HOLIDAY: "bg-chart-5/20 text-accent-foreground border-chart-5/50",
  PROJECT: "bg-chart-3/15 text-destructive border-chart-3/40",
};

export function normalizeColor(c: string | null | undefined): GroupColorKey {
  if (!c) return "emerald";
  if (GROUP_COLOR_OPTIONS.includes(c as GroupColorKey)) return c as GroupColorKey;
  return "emerald";
}

export function normalizeEventType(t: string | null | undefined): EventTypeKey {
  if (!t) return "GENERAL";
  if (t in EVENT_TYPE_LABELS) return t as EventTypeKey;
  return "GENERAL";
}
