"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";
import { useSession } from "@/store/session";

/**
 * لوگوی سیبک — سیب SVG دست‌ساز با گرادیان سبز→رز و برگ.
 * در تم روشن و تیره هر دو کار می‌کند.
 */
export function SibakLogo({
  size = 36,
  className,
}: {
  size?: number;
  className?: string;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const bodyId = `sibak-body-${uid}`;
  const leafId = `sibak-leaf-${uid}`;
  const shineId = `sibak-shine-${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      role="img"
      aria-label="لوگوی سیبک"
      className={cn("shrink-0 drop-shadow-sm", className)}
    >
      <defs>
        <linearGradient id={bodyId} x1="10" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="oklch(0.78 0.15 145)" />
          <stop offset="0.55" stopColor="oklch(0.62 0.155 150)" />
          <stop offset="1" stopColor="oklch(0.63 0.185 22)" />
        </linearGradient>
        <linearGradient id={leafId} x1="36" y1="4" x2="56" y2="16" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="oklch(0.8 0.13 140)" />
          <stop offset="1" stopColor="oklch(0.66 0.14 150)" />
        </linearGradient>
        <radialGradient id={shineId} cx="0.32" cy="0.24" r="0.6">
          <stop offset="0" stopColor="white" stopOpacity="0.55" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* ساقه */}
      <path
        d="M32 19c0-5 1.2-8.4 4.5-11"
        stroke="oklch(0.5 0.08 70)"
        strokeWidth="3"
        strokeLinecap="round"
      />
      {/* برگ */}
      <path
        d="M36.8 11.5C43.5 4.8 53.5 4.4 57 6.5c-.6 5.5-5 12.6-14.8 12.6-2.6 0-4.8-.7-5.4-3-0.4-1.6-0.9-3.3 0-4.6Z"
        fill={`url(#${leafId})`}
      />
      {/* بدنه سیب */}
      <path
        d="M32 20.5c-4.6-4.3-12-5.6-17.4-.9C8.6 24.8 7.5 33 10.4 40.3c2.6 6.6 8.3 12.2 14.6 14.9 2.3 1 4.6 1.4 7 1.4s4.7-.4 7-1.4c6.3-2.7 12-8.3 14.6-14.9 2.9-7.3 1.8-15.5-4.2-20.7-5.4-4.7-12.8-3.4-17.4.9Z"
        fill={`url(#${bodyId})`}
      />
      {/* برق سیب */}
      <path
        d="M32 20.5c-4.6-4.3-12-5.6-17.4-.9C8.6 24.8 7.5 33 10.4 40.3c2.6 6.6 8.3 12.2 14.6 14.9 2.3 1 4.6 1.4 7 1.4s4.7-.4 7-1.4c6.3-2.7 12-8.3 14.6-14.9 2.9-7.3 1.8-15.5-4.2-20.7-5.4-4.7-12.8-3.4-17.4.9Z"
        fill={`url(#${shineId})`}
      />
    </svg>
  );
}

/**
 * برندینگ سایت — اگر در تنظیمات لوگو آپلود شده باشد همان تصویر،
 * در غیر این صورت سیب SVG + نام سایت.
 */
export function SiteBranding({
  size = 34,
  withName = true,
  className,
  textClassName,
}: {
  size?: number;
  withName?: boolean;
  className?: string;
  textClassName?: string;
}) {
  const settings = useSession((s) => s.settings);
  const siteName = settings?.siteName ?? "سیبک";
  const logo = settings?.logo ?? null;

  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      {logo ? (
        <img
          src={logo}
          alt={`لوگوی ${siteName}`}
          width={size}
          height={size}
          className="shrink-0 rounded-lg object-contain"
          style={{ width: size, height: size }}
        />
      ) : (
        <SibakLogo size={size} />
      )}
      {withName && (
        <span className="flex flex-col leading-none">
          <span
            className={cn(
              "font-black tracking-tight text-foreground text-lg",
              textClassName,
            )}
          >
            {siteName}
          </span>
          {settings?.siteTagline && (
            <span className="mt-1 hidden text-[10px] text-muted-foreground sm:block">
              {settings.siteTagline}
            </span>
          )}
        </span>
      )}
    </span>
  );
}
