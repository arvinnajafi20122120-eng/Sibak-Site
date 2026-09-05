"use client";

import { cn } from "@/lib/utils";

/**
 * نمایش عکس مدال (PNG شفاف) روی پس‌زمینهٔ شطرنجی خیلی ملایم
 * تا شفافیت عکس حس شود — هماهنگ با زبان شیشه‌ای سیبک.
 */
export function MedalImage({
  src,
  alt,
  className,
  imgClassName,
}: {
  src: string;
  alt: string;
  className?: string;
  imgClassName?: string;
}) {
  return (
    <div
      role="img"
      aria-label={alt}
      className={cn(
        "relative flex items-center justify-center overflow-hidden",
        className,
      )}
      style={{
        backgroundImage:
          "linear-gradient(45deg, var(--secondary) 25%, transparent 25%), linear-gradient(-45deg, var(--secondary) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, var(--secondary) 75%), linear-gradient(-45deg, transparent 75%, var(--secondary) 75%)",
        backgroundSize: "14px 14px",
        backgroundPosition: "0 0, 0 7px, 7px -7px, -7px 0px",
      }}
    >
      <img
        src={src}
        alt=""
        aria-hidden
        loading="lazy"
        className={cn("max-h-full max-w-full object-contain drop-shadow-sm", imgClassName)}
      />
    </div>
  );
}
