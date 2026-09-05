"use client";

/**
 * ابزار خروجی PDF/چاپ سیبک — با استفاده از چاپ بومی مرورگر.
 *
 * راهبرد: یک element با کلاس `.printable-area` به‌عنوان محدودهٔ چاپ
 * مشخص می‌شود. سپس `window.print()` فراخوانی می‌شود و استایل چاپ در
 * globals.css فقط همان محدوده (و نوادگانش) را نمایش می‌دهد. کاربر
 * در دیالوگ چاپ مرورگر می‌تواند گزینهٔ «Save as PDF» را برگزیند.
 *
 * این روش: سبک (بدون پکیج اضافی)، خروجی وکتور باکیفیت، پشتیبانی کامل
 * از فارسی و RTL، و احترام به رنگ‌ها/فونت/نمودار.
 *
 * @param title عنوان موقت سند هنگام چاپ (پس از ۵۰۰ms به مقدار قبلی برمی‌گردد)
 */
export function printArea(title?: string): void {
  if (typeof window === "undefined") return;
  const prevTitle = document.title;
  if (title) document.title = title;

  // فراخوانی چاپ بومی مرورگر — مرورگر دیالوگ چاپ را نمایش می‌دهد.
  window.print();

  // بازگرداندن عنوان سند پس از یک تیک (زمان برای شروع چاپ)
  window.setTimeout(() => {
    document.title = prevTitle;
  }, 500);
}
