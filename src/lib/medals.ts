/**
 * کانفیگ و تایپ‌های مشترک مدال‌های سیبک.
 * بین API، سکشن «مدال‌ها» و پروفایل استفاده می‌شود.
 */

export type MedalRarity = "COMMON" | "RARE" | "EPIC" | "LEGENDARY";

export const MEDAL_RARITIES: MedalRarity[] = ["COMMON", "RARE", "EPIC", "LEGENDARY"];

export const RARITY_LABELS: Record<MedalRarity, string> = {
  COMMON: "معمولی",
  RARE: "کمیاب",
  EPIC: "حماسی",
  LEGENDARY: "افسانه‌ای",
};

/** کلاس‌های ظاهری چیپ نایابی — هماهنگ با پالت سیبک. */
export const RARITY_CLASSES: Record<MedalRarity, string> = {
  COMMON: "bg-secondary text-secondary-foreground border-border",
  RARE: "bg-chart-4/15 text-chart-4 border-chart-4/40",
  EPIC: "bg-chart-5/15 text-chart-5 border-chart-5/40",
  LEGENDARY: "bg-chart-2/20 text-accent-foreground border-chart-2/50",
};

/** وزن مرتب‌سازی — افسانه‌ای اول. */
export const RARITY_WEIGHT: Record<MedalRarity, number> = {
  COMMON: 0,
  RARE: 1,
  EPIC: 2,
  LEGENDARY: 3,
};

export function isMedalRarity(v: string): v is MedalRarity {
  return (MEDAL_RARITIES as string[]).includes(v);
}

/** دارندهٔ مدال — نمای عمومی و سبک. */
export interface MedalHolderDTO {
  id: string;
  name: string;
  username: string;
  avatar: string | null;
  awardedAt: string;
}

/** مدال در کتابخانه — شامل دارندگان. */
export interface MedalDTO {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  rarity: MedalRarity;
  points: number;
  maxCount: number | null;
  holdersCount: number;
  remaining: number | null;
  earned: boolean;
  awardedAt: string | null;
  createdAt: string;
  holders: MedalHolderDTO[];
}

/** مدال کسب‌شده — نمای خلاصه برای پروفایل. */
export interface EarnedMedalDTO {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  rarity: MedalRarity;
  points: number;
  awardedAt: string;
}

/** سقف حجم data URL عکس مدال (~۶۵۰ کیلوبایت باینری). */
export const MEDAL_IMAGE_MAX_LENGTH = 900_000;

/** بعد فشرده‌سازی سمت کلاینت — مربع حداکثر ۲۵۶ پیکسل. */
export const MEDAL_IMAGE_MAX_SIDE = 256;
