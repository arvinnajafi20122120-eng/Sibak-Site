"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence } from "framer-motion";
import {
  Ban,
  ListChecks,
  Plus,
  ShieldBan,
  Sparkles,
  Vote,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { api } from "@/lib/api-client";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { CreatePollDialog } from "./_parts/create-poll-dialog";
import { NewPollCard, PollCard, PollCardSkeleton } from "./_parts/poll-card";
import type { Poll } from "./_parts/types";

const TABS = [
  { key: "OPEN", label: "باز", icon: Sparkles },
  { key: "CLOSED", label: "بسته", icon: ListChecks },
  { key: "VETOED", label: "وتو شده", icon: Ban },
  { key: "VETO_GRANT", label: "اعطای وتو", icon: ShieldBan },
  { key: "MINE", label: "نظرسنجی‌های من", icon: Vote },
] as const;

type TabKey = (typeof TABS)[number]["key"];

/**
 * نظرسنجی‌های سیبک — لیست با تب‌فیلتر و کارت ساخت.
 */
export default function PollsSection() {
  const [tab, setTab] = useState<TabKey>("OPEN");
  const [createOpen, setCreateOpen] = useState(false);
  const queryClient = useQueryClient();

  const params = new URLSearchParams();
  if (tab === "OPEN") params.set("status", "OPEN");
  else if (tab === "CLOSED") params.set("status", "CLOSED");
  else if (tab === "VETOED") params.set("status", "VETOED");
  else if (tab === "VETO_GRANT") params.set("type", "VETO_GRANT");
  else if (tab === "MINE") params.set("mine", "1");

  const { data, isLoading } = useQuery({
    queryKey: ["polls", tab],
    queryFn: () => api.get<{ polls: Poll[] }>(`/api/polls?${params.toString()}`),
    select: (res) => res.polls,
  });

  // موجودی وتوی فعلی — برای دکمه وتو
  const { data: veto } = useQuery({
    queryKey: ["vetoes"],
    queryFn: () => api.get<{ balance: number }>("/api/vetoes"),
    select: (res) => res.balance,
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["polls"] });
    queryClient.invalidateQueries({ queryKey: ["vetoes"] });
  }

  const polls = data ?? [];
  const myBalance = veto ?? 0;

  return (
    <section className="flex flex-col gap-5" aria-label="نظرسنجی‌ها">
      {/* سربرگ */}
      <div className="glass card-hover relative overflow-hidden rounded-3xl p-6 md:p-8">
        <div
          className="pointer-events-none absolute -top-20 -left-16 size-56 rounded-full bg-primary/15 blur-3xl"
          aria-hidden
        />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Vote className="size-7" aria-hidden />
            </div>
            <div>
              <h1 className="text-2xl font-black md:text-3xl">نظرسنجی‌ها</h1>
              <p className="mt-1.5 max-w-xl text-sm leading-7 text-muted-foreground">
                تصمیم‌گیری جمعی با رأی‌گیری شفاف — از انتخاب روز جلسه تا اعطای اختیار وتو به اعضای شایسته.
              </p>
            </div>
          </div>
          <Button
            type="button"
            className="gap-2 rounded-xl"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="size-4" aria-hidden />
            ساخت نظرسنجی
          </Button>
        </div>
      </div>

      {/* تب‌فیلتر */}
      <nav
        aria-label="فیلتر نظرسنجی‌ها"
        className="glass flex flex-wrap gap-1.5 rounded-2xl p-1.5"
      >
        {TABS.map((t) => {
          const Icon = t.icon;
          const isActive = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                "flex min-h-11 items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-colors sm:text-sm",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              <Icon className="size-4" aria-hidden />
              {t.label}
            </button>
          );
        })}
      </nav>

      {/* لیست */}
      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <PollCardSkeleton key={i} />
          ))}
        </div>
      ) : polls.length === 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <NewPollCard onClick={() => setCreateOpen(true)} />
          <EmptyState tab={tab} />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <AnimatePresence mode="popLayout">
            {polls.map((p) => (
              <PollCard
                key={p.id}
                poll={p}
                myBalance={myBalance}
                onChanged={refresh}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      <CreatePollDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={refresh}
      />
    </section>
  );
}

function EmptyState({ tab }: { tab: TabKey }) {
  const text =
    tab === "OPEN"
      ? "هیچ نظرسنجی باز وجود ندارد. یکی بسازید!"
      : tab === "CLOSED"
        ? "هنوز نظرسنجی بسته‌شده‌ای نداریم."
        : tab === "VETOED"
          ? "هیچ نظرسنجی وتو‌شده‌ای ثبت نشده است."
          : tab === "VETO_GRANT"
            ? "هیچ نظرسنجی اعطای وتوی فعالی موجود نیست."
            : "هنوز نظرسنجی نساخته‌اید.";
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/70 bg-background/30 p-8 text-center">
      <Skeleton className="hidden" />
      <span className="flex size-12 items-center justify-center rounded-2xl bg-secondary/60">
        <Vote className="size-6 text-muted-foreground" aria-hidden />
      </span>
      <p className="text-sm font-bold">{text}</p>
    </div>
  );
}
