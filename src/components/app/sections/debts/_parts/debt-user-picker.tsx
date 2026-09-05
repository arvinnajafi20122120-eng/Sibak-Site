"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Search, X } from "lucide-react";

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
 * انتخاب‌گر کاربر برای تعهد بدهی — جستجو در همه اعضای فعال.
 * - selected?: SafeUser | null — مقدار فعلی
 * - onSelect: وقتی کاربر انتخاب شد
 * - onClear: پاک کردن انتخاب
 * - multi?: اگر true، حالت چند-انتخاب (برای allowedUserIds)
 * - selectedIds?: برای حالت multi، id های انتخاب‌شده
 * - onToggleMulti: برای حالت multi
 * - excludeIds?: id های غیرمجاز (مثلاً بدهکار در انتخاب طلبکار)
 */
export function DebtUserPicker({
  selected,
  onSelect,
  onClear,
  multi = false,
  selectedIds,
  onToggleMulti,
  excludeIds = [],
  placeholder = "جستجوی کاربر…",
}: {
  selected?: SafeUser | null;
  onSelect?: (user: SafeUser) => void;
  onClear?: () => void;
  multi?: boolean;
  selectedIds?: string[];
  onToggleMulti?: (user: SafeUser) => void;
  excludeIds?: string[];
  placeholder?: string;
}) {
  const [q, setQ] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["debt-user-search", q],
    queryFn: () => {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      return api.get<{ users: SafeUser[] }>(
        `/api/users/search?${params.toString()}`,
      );
    },
    placeholderData: (prev) => prev,
  });

  const users = (data?.users ?? []).filter((u) => !excludeIds.includes(u.id));
  const multiSel = new Set(selectedIds ?? []);

  // حالت تک‌انتخاب: اگر انتخاب شده، چیپ را نشان بده
  if (!multi && selected) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-background/40 p-2.5">
        <div className="flex items-center gap-2.5">
          <SafeAvatar user={selected} className="size-9" />
          <div className="flex flex-col">
            <span className="text-sm font-bold">{selected.name}</span>
            <span className="text-[11px] text-muted-foreground" dir="ltr">
              @{selected.username}
            </span>
          </div>
          <Badge
            variant="outline"
            className={cn("text-[10px]", ROLE_BADGE_CLASSES[selected.role])}
          >
            {ROLE_LABELS[selected.role]}
          </Badge>
        </div>
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            aria-label="پاک کردن انتخاب"
          >
            <X className="size-4" aria-hidden />
          </button>
        )}
      </div>
    );
  }

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
          placeholder={placeholder}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
        />
      </div>
      <ScrollArea className="max-h-64">
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
            users.map((u) => {
              const isSel = multiSel.has(u.id);
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() =>
                    multi ? onToggleMulti?.(u) : onSelect?.(u)
                  }
                  className={cn(
                    "group flex items-center gap-3 rounded-xl border bg-background/40 p-2 text-right transition-colors",
                    isSel
                      ? "border-primary/50 bg-primary/5"
                      : "border-border/50 hover:border-primary/40 hover:bg-primary/5",
                  )}
                >
                  <SafeAvatar user={u} className="size-9" />
                  <div className="flex flex-1 flex-col items-start">
                    <span className="text-sm font-bold">{u.name}</span>
                    <span
                      className="text-[11px] text-muted-foreground"
                      dir="ltr"
                    >
                      @{u.username}
                    </span>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn("text-[10px]", ROLE_BADGE_CLASSES[u.role])}
                  >
                    {ROLE_LABELS[u.role]}
                  </Badge>
                  {multi && isSel && (
                    <Check className="size-4 text-primary" aria-hidden />
                  )}
                </button>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
