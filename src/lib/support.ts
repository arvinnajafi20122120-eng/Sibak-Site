/**
 * حمایت از سیبک — انواع مشترک و برچسب‌ها.
 * جریان کار: کاربر واریز می‌کند → «اعلام حمایت» ثبت می‌کند (PENDING)
 * → مدیر/ادمین بررسی و با رضایت فرد در فهرست حامیان ثبتش می‌کند (REGISTERED + isPublic).
 */

export type SupportStatus = "PENDING" | "REGISTERED" | "REJECTED";

export interface SupportDTO {
  id: string;
  name: string;
  amount: number | null;
  message: string | null;
  status: SupportStatus;
  /** آیا فرد راضی به نمایش نامش در فهرست حامیان است */
  isPublic: boolean;
  userId: string | null;
  createdAt: string;
  registeredAt: string | null;
}

export interface SupportSettingsDTO {
  /** شماره کارت — تا وقتی ادمین تنظیم نکرده خالی/null است */
  cardNumber: string | null;
  cardHolder: string | null;
}

/** پاسخ GET /api/support — بسته به نقش، فیلدهای مدیریتی هم می‌آیند */
export interface SupportResponse {
  settings: SupportSettingsDTO;
  /** فهرست حامیان — برای عموم فقط isPublic=true ها */
  supporters: SupportDTO[];
  /** اعلام‌های در انتظار بررسی (فقط مدیر/ادمین) */
  pending: SupportDTO[];
  /** اعلام‌های ردشده (فقط مدیر/ادمین) */
  rejected: SupportDTO[];
  /** اعلامِ در انتظارِ خود کاربر (برای جلوگیری از اسپم) */
  myPending: SupportDTO | null;
  canManage: boolean;
}

export const SUPPORT_STATUS_LABELS: Record<SupportStatus, string> = {
  PENDING: "در انتظار بررسی",
  REGISTERED: "ثبت شده",
  REJECTED: "رد شده",
};

/** کلیدهای Setting که تنظیمات حمایت در آن‌ها ذخیره می‌شوند */
export const SUPPORT_SETTING_KEYS = {
  cardNumber: "supportCardNumber",
  cardHolder: "supportCardHolder",
} as const;

/** اعتبارسنجی سبک شماره کارت بانکی ایران (۱۶ رقم، با یا بدون خط تیره/فاصله/اعداد فارسی) */
export function normalizeCardNumber(raw: string): string | null {
  const digits = raw
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[^\d]/g, "");
  return digits.length === 16 ? digits : null;
}
