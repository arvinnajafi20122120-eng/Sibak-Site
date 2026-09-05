"use client";

import type { IdeaListItem } from "@/components/app/sections/_shared/types";
import {
  IDEA_STATUS_LABELS,
  IDEA_STATUS_BADGE,
} from "@/components/app/sections/ideas/status-meta";

/** برچسب و بَج وضعیت ایده. */
export function IdeaStatusBadge({
  status,
  className,
}: {
  status: IdeaListItem["status"];
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${IDEA_STATUS_BADGE[status] ?? IDEA_STATUS_BADGE.PENDING} ${className ?? ""}`}
    >
      {IDEA_STATUS_LABELS[status] ?? status}
    </span>
  );
}
