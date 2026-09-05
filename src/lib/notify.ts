import { db } from "@/lib/db";

/**
 * اعلان‌های درون‌برنامه‌ای سیبک — هرگز نباید درخواست اصلی را زمین بزند.
 */

export interface NotifyPayload {
  title: string;
  message: string;
  type?: string; // INFO | SUCCESS | WARNING | DEBT | VETO | POLL | GROUP | IDEA | USER
  link?: string | null;
}

export async function notifyUser(userId: string, payload: NotifyPayload): Promise<void> {
  try {
    await db.notification.create({
      data: {
        userId,
        title: payload.title,
        message: payload.message,
        type: payload.type ?? "INFO",
        link: payload.link ?? null,
      },
    });
  } catch (e) {
    console.error("[notify] خطا در ساخت اعلان:", e);
  }
}

export async function notifyUsers(userIds: string[], payload: NotifyPayload): Promise<void> {
  if (!userIds.length) return;
  try {
    await db.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        title: payload.title,
        message: payload.message,
        type: payload.type ?? "INFO",
        link: payload.link ?? null,
      })),
    });
  } catch (e) {
    console.error("[notify] خطا در ساخت اعلان‌های گروهی:", e);
  }
}
