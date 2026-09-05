"use client";

import { getAuthToken } from "@/lib/session-token";

/**
 * آپلود فایل سمت کلاینت سیبک — همیشه توکن نشست را به‌صورت Bearer می‌فرستد
 * (در iframe که کوکی مسدود است، نشست حفظ می‌شود).
 */

export interface UploadResult {
  url: string;
  pathname: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

export async function uploadFile(file: File): Promise<UploadResult> {
  const formData = new FormData();
  formData.append("file", file);

  const headers: Record<string, string> = {};
  const token = getAuthToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch("/api/upload", {
    method: "POST",
    body: formData,
    headers,
    credentials: "same-origin",
  });

  const data = (await res.json().catch(() => ({}))) as Partial<UploadResult> & {
    error?: string;
  };

  if (!res.ok || !data.pathname) {
    throw new Error(data.error ?? "خطا در آپلود فایل");
  }

  return data as UploadResult;
}
