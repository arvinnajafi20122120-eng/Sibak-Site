"use client";

import { create } from "zustand";

import { api } from "@/lib/api-client";
import { clearAuthToken } from "@/lib/session-token";
import type { AppNotification, SafeUser, SiteSettings } from "@/lib/types";

/**
 * استور نشست سیبک — کاربر جاری + تنظیمات عمومی سایت.
 * fetchSession همزمان /api/auth/me و /api/settings را می‌گیرد.
 */

interface SessionState {
  user: SafeUser | null;
  settings: SiteSettings | null;
  loading: boolean;
  unreadCount: number;
  fetchSession: () => Promise<void>;
  refreshUnread: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useSession = create<SessionState>((set, get) => ({
  user: null,
  settings: null,
  loading: true,
  unreadCount: 0,

  fetchSession: async () => {
    try {
      const [meRes, settings] = await Promise.all([
        api.get<{ user: SafeUser | null; unreadCount: number }>("/api/auth/me"),
        api.get<SiteSettings>("/api/settings"),
      ]);
      set({
        user: meRes.user,
        unreadCount: meRes.unreadCount ?? 0,
        settings,
        loading: false,
      });
    } catch {
      // در خطای شبکه هم اپ باید بالا بیاید (حالت مهمان)
      set({ user: null, settings: get().settings, loading: false });
    }
  },

  refreshUnread: async () => {
    if (!get().user) return;
    try {
      const res = await api.get<{ user: SafeUser | null; unreadCount: number }>("/api/auth/me");
      set({ unreadCount: res.unreadCount ?? 0 });
    } catch {
      /* بی‌اهمیت */
    }
  },

  logout: async () => {
    try {
      await api.post("/api/auth/logout");
    } catch {
      /* حتی در خطا هم کلاینت را خروج می‌کنیم */
    }
    // پاک‌کردن توکن localStorage — در iframe که کوکی مسدود است، این نشست را قطع می‌کند.
    clearAuthToken();
    set({ user: null, unreadCount: 0 });
  },
}));

/** تایپ کمکی برای لیست اعلان‌ها (همان تایپ سمت سرور) */
export type { AppNotification };
