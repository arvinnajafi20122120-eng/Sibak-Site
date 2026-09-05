import {
  toJalaali,
  toGregorian,
  jalaaliMonthLength,
  type JalaaliDate,
} from "jalaali-js";

/**
 * ابزارهای تاریخ شمسی (جلالی) سیبک — توابع خالص و قطعی، بدون وابستگی به date-fns.
 */

export type { JalaaliDate };

export const JALALI_MONTHS = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
] as const;

/** هفته ایرانی: شنبه … جمعه */
export const JALALI_WEEKDAYS = [
  "شنبه",
  "یکشنبه",
  "دوشنبه",
  "سه‌شنبه",
  "چهارشنبه",
  "پنجشنبه",
  "جمعه",
] as const;

export const JALALI_WEEKDAYS_SHORT = ["ش", "ی", "د", "س", "چ", "پ", "ج"] as const;

const FA_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
const EN_DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

/** تبدیل ارقام لاتین به فارسی */
export function toFa(input: string | number): string {
  return String(input).replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)]);
}

/** تبدیل ارقام فارسی/عربی به لاتین */
export function toEn(input: string | number): string {
  return String(input)
    .replace(/[۰-۹]/g, (d) => EN_DIGITS[FA_DIGITS.indexOf(d)])
    .replace(/[٠-٩]/g, (d) => EN_DIGITS["٠١٢٣٤٥٦٧٨٩".indexOf(d)]);
}

/** تبدیل تاریخ میلادی به جلالی */
export function toJalali(date: Date): JalaaliDate {
  return toJalaali(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

/** تبدیل تاریخ جلالی به میلادی */
export function jalaliToGregorian(jy: number, jm: number, jd: number): Date {
  const g = toGregorian(jy, jm, jd);
  return new Date(g.gy, g.gm - 1, g.gd);
}

/** «۱۲ آبان ۱۴۰۴» */
export function formatJalaliDate(date: Date): string {
  const { jy, jm, jd } = toJalali(date);
  return `${toFa(jd)} ${JALALI_MONTHS[jm - 1]} ${toFa(jy)}`;
}

/** «شنبه، ۱۲ آبان ۱۴۰۴» */
export function formatJalaliFullDate(date: Date): string {
  const wd = JALALI_WEEKDAYS[persianDayOfWeek(date)];
  return `${wd}، ${formatJalaliDate(date)}`;
}

/** «۱۲ آبان ۱۴۰۴، ۱۴:۳۰» */
export function formatJalaliDateTime(date: Date): string {
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${formatJalaliDate(date)}، ${toFa(`${hh}:${mm}`)}`;
}

/** «۱۴:۳۰» */
export function formatTime(date: Date): string {
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return toFa(`${hh}:${mm}`);
}

/** شماره روز هفته ایرانی: شنبه=۰ … جمعه=۶ */
export function persianDayOfWeek(date: Date): number {
  return (date.getDay() + 1) % 7;
}

export function jalaliDayOfWeek(jy: number, jm: number, jd: number): number {
  return persianDayOfWeek(jalaliToGregorian(jy, jm, jd));
}

export interface JalaliMonthCell {
  gy: number;
  gm: number;
  gd: number;
  jy: number;
  jm: number;
  jd: number;
  isCurrentMonth: boolean;
}

/**
 * شبکه ۴۲ خانه‌ای ماه شمسی (۶ هفته × ۷ روز)، شروع از شنبه.
 * خانه‌های قبل/بعد متعلق به ماه‌های مجاورند (isCurrentMonth=false).
 */
export function getJalaliMonthGrid(jy: number, jm: number): JalaliMonthCell[] {
  const firstG = toGregorian(jy, jm, 1);
  const firstDow = persianDayOfWeek(new Date(firstG.gy, firstG.gm - 1, firstG.gd));

  const prevMonth = jm === 1 ? 12 : jm - 1;
  const prevYear = jm === 1 ? jy - 1 : jy;
  const prevLen = jalaaliMonthLength(prevYear, prevMonth);

  const nextMonth = jm === 12 ? 1 : jm + 1;
  const nextYear = jm === 12 ? jy + 1 : jy;

  const cells: JalaliMonthCell[] = [];

  // روزهای انتهای ماه قبل
  for (let d = prevLen - firstDow + 1; d <= prevLen; d++) {
    const g = toGregorian(prevYear, prevMonth, d);
    cells.push({ ...g, jy: prevYear, jm: prevMonth, jd: d, isCurrentMonth: false });
  }

  // روزهای خود ماه
  const len = jalaaliMonthLength(jy, jm);
  for (let d = 1; d <= len; d++) {
    const g = toGregorian(jy, jm, d);
    cells.push({ ...g, jy, jm, jd: d, isCurrentMonth: true });
  }

  // روزهای ابتدای ماه بعد تا ۴۲ خانه
  let nd = 1;
  while (cells.length < 42) {
    const g = toGregorian(nextYear, nextMonth, nd);
    cells.push({ ...g, jy: nextYear, jm: nextMonth, jd: nd, isCurrentMonth: false });
    nd++;
  }

  return cells;
}

/** آیا تاریخ شمسی «امروز» است؟ */
export function isToday(date: Date): boolean {
  const a = toJalali(date);
  const b = toJalali(new Date());
  return a.jy === b.jy && a.jm === b.jm && a.jd === b.jd;
}

/** «۳ روز پیش» / «۵ ساعت بعد» / «همین حالا» */
export function relativeTime(date: Date): string {
  const diff = date.getTime() - Date.now();
  const past = diff < 0;
  const abs = Math.abs(diff);

  const MIN = 60_000;
  const HOUR = 3_600_000;
  const DAY = 86_400_000;

  let text: string;
  if (abs < MIN) {
    text = "همین حالا";
    return text;
  } else if (abs < HOUR) {
    text = `${toFa(Math.round(abs / MIN))} دقیقه`;
  } else if (abs < DAY) {
    text = `${toFa(Math.round(abs / HOUR))} ساعت`;
  } else if (abs < 30 * DAY) {
    text = `${toFa(Math.round(abs / DAY))} روز`;
  } else if (abs < 365 * DAY) {
    text = `${toFa(Math.max(1, Math.round(abs / (30 * DAY))))} ماه`;
  } else {
    text = `${toFa(Math.max(1, Math.round(abs / (365 * DAY))))} سال`;
  }

  return past ? `${text} پیش` : `${text} بعد`;
}

/** سال و ماه شمسی امروز */
export function currentJalali(): JalaaliDate & { monthName: string; yearFa: string } {
  const j = toJalali(new Date());
  return { ...j, monthName: JALALI_MONTHS[j.jm - 1], yearFa: toFa(j.jy) };
}
