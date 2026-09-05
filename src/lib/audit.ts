import { db } from "@/lib/db";

/**
 * ممیزی سیبک — هر mutation باید رکورد AuditLog بسازد.
 * هرگز نباید درخواست اصلی را زمین بزند؛ پس try/catch داخلی دارد.
 */

export interface AuditInput {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  data?: unknown;
}

export async function logAudit(input: AuditInput): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        summary: input.summary,
        data: input.data === undefined ? null : JSON.stringify(input.data),
      },
    });
  } catch (e) {
    console.error("[audit] خطا در ثبت ممیزی:", e);
  }
}
