"use client";

import type { ReactNode } from "react";
import { Heart } from "lucide-react";

import { formatJalaliFullDate } from "@/lib/jalali";
import { Sidebar } from "@/components/app/layout/sidebar";
import { Header } from "@/components/app/layout/header";
import { SiteBanner } from "@/components/app/sections/announcements/_parts/site-banner";

/**
 * پوسته اپ سیبک — سایدبار راست (RTL) + هدر چسبان + بنر بالای محتوا + فوتر چسبان پایین.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh">
      <Sidebar />

      <div className="flex min-h-svh w-full min-w-0 flex-1 flex-col">
        <Header />

        <main className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-6">
          <SiteBanner />
          {children}
        </main>

        <footer className="glass mt-auto border-t">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-1.5 px-4 py-4 text-xs text-muted-foreground sm:flex-row">
            <p className="flex items-center gap-1.5">
              <span className="font-bold text-foreground">سیبک</span>
              — ساخته‌شده با
              <Heart className="size-3.5 fill-destructive text-destructive" aria-hidden />
              برای همکاری بهتر
            </p>
            <p>{formatJalaliFullDate(new Date())}</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
