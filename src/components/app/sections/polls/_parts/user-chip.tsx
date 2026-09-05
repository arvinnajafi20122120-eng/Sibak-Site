"use client";

import { ROLE_BADGE_CLASSES, ROLE_LABELS } from "@/components/app/nav";
import { cn } from "@/lib/utils";
import type { SafeUser } from "@/lib/types";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

/**
 * چیپ کاربر — آواتار ایموجی + نام + نقش (اختیاری).
 */
export function UserChip({
  user,
  showRole = false,
  size = "sm",
  className,
}: {
  user: SafeUser | null;
  showRole?: boolean;
  size?: "sm" | "md";
  className?: string;
}) {
  if (!user) {
    return (
      <span className={cn("text-xs text-muted-foreground", className)}>
        کاربر حذف‌شده
      </span>
    );
  }
  const isMd = size === "md";
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <Avatar className={cn(isMd ? "size-8" : "size-7")}>
        <AvatarFallback className={cn("bg-primary/15", isMd ? "text-sm" : "text-xs")}>
          {user.avatar ?? user.name.charAt(0)}
        </AvatarFallback>
      </Avatar>
      <span className={cn("font-bold", isMd ? "text-sm" : "text-xs")}>
        {user.name}
      </span>
      {showRole && (
        <Badge
          className={cn(
            "px-1.5 text-[10px]",
            ROLE_BADGE_CLASSES[user.role as keyof typeof ROLE_BADGE_CLASSES],
          )}
        >
          {ROLE_LABELS[user.role as keyof typeof ROLE_LABELS]}
        </Badge>
      )}
    </span>
  );
}

/** دسته آواتارها — برای نمایش رأی‌دهندگان هر گزینه. */
export function VoterStack({ users, max = 4 }: { users: SafeUser[]; max?: number }) {
  const shown = users.slice(0, max);
  const more = users.length - shown.length;
  return (
    <div className="flex -space-x-2 space-x-reverse items-center">
      {shown.map((u, i) => (
        <Avatar
          key={u.id}
          className={cn("size-6 ring-2 ring-background", i !== 0 && "-mr-2")}
        >
          <AvatarFallback className="bg-accent text-[10px]">
            {u.avatar ?? u.name.charAt(0)}
          </AvatarFallback>
        </Avatar>
      ))}
      {more > 0 && (
        <span className="ms-1 text-[10px] font-bold text-muted-foreground">
          +{more}
        </span>
      )}
    </div>
  );
}
