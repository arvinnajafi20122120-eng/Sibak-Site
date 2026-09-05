"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, UserPlus } from "lucide-react";

import { api } from "@/lib/api-client";
import type { SafeUser } from "@/lib/types";
import { SafeAvatar } from "@/components/app/sections/_shared/safe-avatar";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ROLE_LABELS, ROLE_BADGE_CLASSES } from "@/components/app/nav";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * انتخاب‌گر کاربر برای دعوت/افزودن عضو.
 * - groupId: اعضای فعال این گروه از فهرست حذف می‌شوند (از سرور).
 * - onSelect: وقتی کاربر انتخاب شد.
 */
export function UserPicker({
  groupId,
  onSelect,
}: {
  groupId: string;
  onSelect: (user: SafeUser) => void;
}) {
  const [q, setQ] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["groups", groupId, "eligible", q],
    queryFn: () => {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      return api.get<{ users: SafeUser[] }>(
        `/api/groups/${groupId}/members/eligible?${params.toString()}`,
      );
    },
    placeholderData: (prev) => prev,
  });

  const users = data?.users ?? [];

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search
          className="absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground"
          aria-hidden
        />
        <Input
          dir="rtl"
          className="h-11 ps-9"
          placeholder="نام یا نام کاربری جستجو…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
        />
      </div>
      <ScrollArea className="max-h-72">
        <div className="flex flex-col gap-1.5 pe-1">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-xl border border-border/50 p-2"
              >
                <Skeleton className="size-9 rounded-full" />
                <div className="flex flex-1 flex-col gap-1">
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-2 w-1/3" />
                </div>
              </div>
            ))
          ) : users.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
              کاربری یافت نشد
            </p>
          ) : (
            users.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => onSelect(u)}
                className="group flex items-center gap-3 rounded-xl border border-border/50 bg-background/40 p-2 text-right transition-colors hover:border-primary/40 hover:bg-primary/5"
              >
                <SafeAvatar user={u} className="size-9" />
                <div className="flex flex-1 flex-col items-start">
                  <span className="text-sm font-bold">{u.name}</span>
                  <span className="text-[11px] text-muted-foreground" dir="ltr">
                    @{u.username}
                  </span>
                </div>
                <Badge
                  variant="outline"
                  className={cn("text-[10px]", ROLE_BADGE_CLASSES[u.role])}
                >
                  {ROLE_LABELS[u.role]}
                </Badge>
                <UserPlus
                  className="size-4 text-muted-foreground transition-colors group-hover:text-primary"
                  aria-hidden
                />
              </button>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
