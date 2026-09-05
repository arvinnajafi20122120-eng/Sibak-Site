"use client";

import { useState } from "react";
import { Search, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { cn } from "@/lib/utils";
import { api } from "@/lib/api-client";
import { ROLE_LABELS, ROLE_BADGE_CLASSES } from "@/components/app/nav";
import type { SafeUser } from "@/lib/types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  value: string | null;
  onChange: (userId: string, user: SafeUser) => void;
  excludeUserId?: string;
}

/**
 * انتخاب‌گر کاربر — جستجوی زنده اعضای فعال.
 */
export function UserPicker({ value, onChange, excludeUserId }: Props) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const { data: selected } = useQuery({
    queryKey: ["user", value],
    enabled: !!value && open,
    queryFn: () => api.get<{ users: SafeUser[] }>(`/api/users/search?q=${encodeURIComponent(value ?? "")}`),
    select: (res) => res.users.find((u) => u.id === value) ?? null,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["users-search", q],
    enabled: q.length >= 1,
    queryFn: () => api.get<{ users: SafeUser[] }>(`/api/users/search?q=${encodeURIComponent(q)}`),
    select: (res) => res.users.filter((u) => u.id !== excludeUserId),
  });

  if (value && selected) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-xl border border-primary/40 bg-primary/5 p-2">
        <div className="flex items-center gap-2">
          <Avatar className="size-9">
            <AvatarFallback className="bg-primary/15 text-base">
              {selected.avatar ?? selected.name.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="text-sm font-bold">{selected.name}</span>
            <span className="text-xs text-muted-foreground">@{selected.username}</span>
          </div>
          <Badge className={cn("px-2 text-[10px]", ROLE_BADGE_CLASSES[selected.role as keyof typeof ROLE_BADGE_CLASSES])}>
            {ROLE_LABELS[selected.role as keyof typeof ROLE_LABELS]}
          </Badge>
        </div>
        <button
          type="button"
          onClick={() => {
            onChange("", null as unknown as SafeUser);
            setQ("");
          }}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary"
          aria-label="حذف انتخاب"
        >
          <X className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-muted-foreground">کاربر هدف</span>
      <div className="relative">
        <Search className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="نام یا نام کاربری را بنویسید…"
          className="h-11 rounded-xl pr-9"
        />
      </div>
      {open && (
        <div className="glass relative z-30 mt-1 max-h-72 overflow-hidden rounded-xl border border-border/60 shadow-lg">
          <ScrollArea className="max-h-72">
            <div className="flex flex-col gap-1 p-1.5">
              {q.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted-foreground">
                  برای جستجوی کاربر، چیزی بنویسید.
                </div>
              ) : isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-2 p-2">
                    <Skeleton className="size-9 rounded-full" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                ))
              ) : !data || data.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted-foreground">
                  کاربری یافت نشد.
                </div>
              ) : (
                data.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      onChange(u.id, u);
                      setOpen(false);
                      setQ("");
                    }}
                    className="flex items-center gap-2 rounded-lg p-2 text-right transition-colors hover:bg-primary/5"
                  >
                    <Avatar className="size-9">
                      <AvatarFallback className="bg-primary/15 text-base">
                        {u.avatar ?? u.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-bold">{u.name}</span>
                      <span className="text-xs text-muted-foreground">@{u.username}</span>
                    </div>
                    <Badge className={cn("px-2 text-[10px]", ROLE_BADGE_CLASSES[u.role as keyof typeof ROLE_BADGE_CLASSES])}>
                      {ROLE_LABELS[u.role as keyof typeof ROLE_LABELS]}
                    </Badge>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
