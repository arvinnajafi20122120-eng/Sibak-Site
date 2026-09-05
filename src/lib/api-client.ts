"use client";

import { getAuthToken } from "@/lib/session-token";

/**
 * کلاینت API تایپ‌شده سیبک — فقط مسیرهای نسبی، خطاها با پیام فارسی پرتاب می‌شوند.
 * توکن نشست (اگر باشد) از localStorage خوانده و در هدر Authorization ارسال می‌شود.
 */

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";

  // ارسال توکن نشست از localStorage به‌عنوان Bearer header.
  // این در کنار کوکی httpOnly کار می‌کند — سرور اول کوکی را بررسی می‌کند،
  // سپس هدر Authorization را. در iframe (که کوکی مسدود است)، این هدر نشست را حفظ می‌کند.
  const token = getAuthToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: "same-origin",
  });

  if (!res.ok) {
    let message = "خطایی رخ داد؛ دوباره تلاش کنید";
    try {
      const data = (await res.json()) as { error?: string };
      if (data?.error) message = data.error;
    } catch {
      /* بدنه JSON نبود */
    }
    throw new Error(message);
  }

  return (await res.json()) as T;
}

export const api = {
  get<T>(path: string): Promise<T> {
    return request<T>("GET", path);
  },
  post<T>(path: string, body?: unknown): Promise<T> {
    return request<T>("POST", path, body);
  },
  patch<T>(path: string, body?: unknown): Promise<T> {
    return request<T>("PATCH", path, body);
  },
  put<T>(path: string, body?: unknown): Promise<T> {
    return request<T>("PUT", path, body);
  },
  del<T>(path: string, body?: unknown): Promise<T> {
    return request<T>("DELETE", path, body);
  },
};
