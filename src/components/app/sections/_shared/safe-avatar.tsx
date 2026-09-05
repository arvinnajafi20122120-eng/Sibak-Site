"use client";

import type { SafeUser } from "@/lib/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

/** آیا avatar یک URL تصویر است (نه ایموجی)؟ */
function isImageUrl(avatar: string): boolean {
  return avatar.startsWith("/") || avatar.startsWith("http") || avatar.startsWith("data:");
}

/** آواتار امن از روی SafeUser — تصویر avatar (اگر URL باشد) یا حرف اول. */
export function SafeAvatar({
  user,
  className,
}: {
  user: Pick<SafeUser, "name" | "username" | "avatar">;
  className?: string;
}) {
  const initial = (user.name || user.username || "؟").charAt(0).toUpperCase();
  const showImage = !!user.avatar && isImageUrl(user.avatar);
  const showEmoji = !!user.avatar && !isImageUrl(user.avatar);
  return (
    <Avatar className={cn("size-9", className)}>
      {showImage && <AvatarImage src={user.avatar!} alt={user.name} />}
      {showEmoji ? (
        <AvatarFallback className="bg-primary/10 text-base">
          {user.avatar}
        </AvatarFallback>
      ) : (
        <AvatarFallback className="bg-primary/15 text-primary text-sm font-bold">
          {initial}
        </AvatarFallback>
      )}
    </Avatar>
  );
}

/** چیپ آواتار + نام کوچک — برای نمایش نویسنده، رهبر و غیره. */
export function UserChip({
  user,
  className,
  showName = true,
}: {
  user: Pick<SafeUser, "id" | "name" | "username" | "avatar">;
  className?: string;
  showName?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <SafeAvatar user={user} className="size-6" />
      {showName && (
        <span className="text-xs font-semibold text-foreground/90">
          {user.name}
        </span>
      )}
    </span>
  );
}
