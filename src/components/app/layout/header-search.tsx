"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  GraduationCap,
  Lightbulb,
  Loader2,
  Megaphone,
  Search,
  UserRound,
  Users,
  Vote,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { api } from "@/lib/api-client";
import { useHashRoute } from "@/components/app/router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * جستجوی واقعی سیبک در هدر.
 *  - دسکتاپ: جعبه جستجوی همیشگی با میانبر Ctrl+K / ⌘K
 *  - موبایل: دکمه آیکنی که پاپ‌اور جستجو را باز می‌کند
 * نتایج زنده از /api/search با debounce ۳۰۰ms و گروه‌بندی بر اساس نوع.
 */

interface SearchHit {
  type: "class" | "group" | "idea" | "announcement" | "poll" | "event" | "user";
  id: string;
  title: string;
  subtitle: string;
  link: string;
}

const TYPE_META: Record<SearchHit["type"], { label: string; icon: LucideIcon }> = {
  class: { label: "کلاس", icon: GraduationCap },
  group: { label: "زیرمجموعه", icon: Users },
  idea: { label: "ایده", icon: Lightbulb },
  announcement: { label: "اطلاعیه", icon: Megaphone },
  poll: { label: "نظرسنجی", icon: Vote },
  event: { label: "رویداد", icon: CalendarDays },
  user: { label: "کاربر", icon: UserRound },
};

/* ---------- فهرست نتایج (مشترک بین دسکتاپ و موبایل) ---------- */
function ResultList({
  query,
  onPick,
}: {
  query: string;
  onPick: () => void;
}) {
  const { navigate } = useHashRoute();

  const { data, isFetching } = useQuery({
    queryKey: ["search", query],
    queryFn: () =>
      api.get<{ results: SearchHit[] }>(
        `/api/search?q=${encodeURIComponent(query)}`,
      ),
    enabled: query.trim().length >= 2,
    staleTime: 15_000,
  });

  const grouped = useMemo(() => {
    const hits = data?.results ?? [];
    const map = new Map<SearchHit["type"], SearchHit[]>();
    for (const h of hits) {
      const list = map.get(h.type) ?? [];
      list.push(h);
      map.set(h.type, list);
    }
    return Array.from(map.entries());
  }, [data]);

  if (query.trim().length < 2) {
    return (
      <p className="px-4 py-6 text-center text-xs leading-6 text-muted-foreground">
        حداقل ۲ نویسه بنویسید — در کلاس‌ها، ایده‌ها، اطلاعیه‌ها، نظرسنجی‌ها،
        رویدادها و کاربران جستجو می‌کنیم.
      </p>
    );
  }

  if (isFetching && !data) {
    return (
      <div className="flex items-center justify-center gap-2 px-4 py-6 text-xs text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        در حال جستجو…
      </div>
    );
  }

  if (grouped.length === 0) {
    return (
      <p className="px-4 py-6 text-center text-xs text-muted-foreground">
        نتیجه‌ای برای «{query}» پیدا نشد 🍃
      </p>
    );
  }

  return (
    <div className="flex max-h-80 flex-col gap-1 overflow-y-auto p-1.5" role="listbox" aria-label="نتایج جستجو">
      {grouped.map(([type, hits]) => {
        const meta = TYPE_META[type];
        const Icon = meta.icon;
        return (
          <div key={type} className="flex flex-col gap-0.5">
            <p className="px-2.5 pb-0.5 pt-1.5 text-[10px] font-black text-muted-foreground/70">
              {meta.label}
            </p>
            {hits.map((h) => (
              <button
                key={`${h.type}-${h.id}`}
                type="button"
                role="option"
                aria-selected={false}
                onClick={() => {
                  navigate(h.link);
                  onPick();
                }}
                className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-right transition-colors hover:bg-accent/60"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-bold">{h.title}</span>
                  <span className="block truncate text-[11px] text-muted-foreground" dir="auto">
                    {h.subtitle}
                  </span>
                </span>
              </button>
            ))}
          </div>
        );
      })}
    </div>
  );
}

/* ---------- نسخه دسکتاپ: جعبه جستجوی همیشگی ---------- */
function DesktopSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // میانبر Ctrl+K / ⌘K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
        requestAnimationFrame(() => inputRef.current?.focus());
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const pick = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative cursor-text">
          <Search
            className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground"
            aria-hidden
          />
          <Input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
            placeholder="جستجو در سیبک…"
            aria-label="جستجو در سیبک"
            autoComplete="off"
            className="h-10 w-56 rounded-xl bg-background/60 ps-9 text-sm lg:w-64"
          />
          <kbd className="pointer-events-none absolute inset-y-0 end-2.5 my-auto hidden h-5 items-center rounded-md border border-border/60 bg-muted/60 px-1.5 font-mono text-[10px] text-muted-foreground lg:flex">
            Ctrl K
          </kbd>
        </div>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={10}
        className="w-[22rem] p-0"
        dir="rtl"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <ResultList query={query} onPick={pick} />
      </PopoverContent>
    </Popover>
  );
}

/* ---------- نسخه موبایل: دکمه آیکنی + پاپ‌اور ---------- */
function MobileSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const pick = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="جستجو در سیبک"
          className="size-10 rounded-xl md:hidden"
        >
          <Search className="size-[18px]" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={10} className="w-[19rem] p-0" dir="rtl">
        <div className="relative border-b border-border/60">
          <Search
            className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground"
            aria-hidden
          />
          <Input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="جستجو در سیبک…"
            aria-label="جستجو در سیبک"
            autoComplete="off"
            className="h-11 rounded-none border-0 bg-transparent ps-9 text-sm focus-visible:ring-0"
          />
        </div>
        <ResultList query={query} onPick={pick} />
      </PopoverContent>
    </Popover>
  );
}

export function HeaderSearch({ variant }: { variant: "desktop" | "mobile" }) {
  return variant === "desktop" ? <DesktopSearch /> : <MobileSearch />;
}

export function HeaderSearchDivider() {
  return <span className={cn("mx-0.5 hidden h-6 w-px bg-border/60 md:block")} aria-hidden />;
}
