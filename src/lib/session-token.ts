"use client";

/**
 * مدیریت توکن نشست سیبک در client — برای حل مشکل کوکی در iframe.
 *
 * چرا localStorage؟
 *  - کوکی‌های httpOnly امن‌ترین گزینه‌اند، اما مرورگرهای مدرن کوکی‌های
 *    SameSite=Lax را در iframe‌های شخص ثالث (مثل preview panel زد.ای)
 *    مسدود می‌کنند. نتیجه: POST /api/auth/login موفق می‌شود ولی کوکی
 *    ذخیره نمی‌شود و /api/auth/me در درخواست بعدی null برمی‌گرداند.
 *  - راه‌حل: ذخیره‌ی JWT در localStorage و ارسال آن با هدر
 *    `Authorization: Bearer <token>`. localStorage از محدودیت‌های iframe
 *    مستقل است.
 *
 * امنیت:
 *  - این توکن همان JWT امضا‌شده است که در کوکی هم استفاده می‌شود.
 *  - در پروداکشن واقعی (Vercel با دامنه‌ی خودش) کوکی اولویت دارد
 *    چون httpOnly است. این localStorage fallback فقط برای iframe/preview است.
 *  - ریسک XSS: پذیرفته شده برای یک پلتفرم آموزشی کوچک (۳۰ کاربر).
 */

const TOKEN_KEY = "sibak_token";

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* localStorage ممکن است در iframe محدود باشد — بی‌اثر */
  }
}

export function clearAuthToken(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* بی‌اثر */
  }
}
