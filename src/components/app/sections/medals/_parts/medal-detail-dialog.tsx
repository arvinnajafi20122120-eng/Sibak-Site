"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Award, Gift, Search, Sparkles, Undo2, Users } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/api-client";
import { relativeTime, toFa } from "@/lib/jalali";
import type { SafeUser } from "@/lib/types";
import {
  RARITY_CLASSES,
  RARITY_LABELS,
  type MedalDTO,
} from "@/lib/medals";
import { SafeAvatar } from "@/components/app/sections/_shared/safe-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

import { MedalImage } from "./medal-image";

/**
 * دیالوگ جزئیات مدال — توضیحات، سقف، دارندگان و (برای ادمین) اعطا/سلب.
 */
export function MedalDetailDialog({
  medal,
  onOpenChange,
  canManage,
}: {
  medal: MedalDTO | null;
  onOpenChange: (v: boolean) => void;
  canManage: boolean;
}) {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  // جستجوی کاربر برای اعطا — فقط وقتی ادمین، دیالوگ باز و ظرفیت مانده باشد
  const canAward =
    canManage &&
    !!medal &&
    (medal.maxCount === null || medal.remaining! > 0);

  const { data: searchData, isFetching: searching } = useQuery({
    queryKey: ["medal-award-search", medal?.id, q],
    queryFn: () =>
      api.get<{ users: SafeUser[] }>(`/api/users/search?q=${encodeURIComponent(q)}`),
    enabled: canAward && q.trim().length >= 1,
    placeholderData: (prev) => prev,
  });

  if (!medal) return null;

  const holderIds = new Set(medal.holders.map((h) => h.id));
  const candidates = (searchData?.users ?? []).filter((u) => !holderIds.has(u.id));

  function refresh() {
    qc.invalidateQueries({ queryKey: ["medals"] });
    qc.invalidateQueries({ queryKey: ["me-profile"] });
    qc.invalidateQueries({ queryKey: ["public-profile"] });
    qc.invalidateQueries({ queryKey: ["notifications"] });
  }

  async function award(u: SafeUser) {
    if (!medal) return;
    setBusyUserId(u.id);
    try {
      await api.post(`/api/medals/${medal.id}/award`, { userId: u.id });
      toast.success(`مدال «${medal.name}» به ${u.name} اهدا شد 🎖`);
      refresh();
      setQ("");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyUserId(null);
    }
  }

  async function revoke(userId: string, name: string) {
    if (!medal) return;
    setBusyUserId(userId);
    try {
      await api.del(`/api/medals/${medal.id}/award`, { userId });
      toast.success(`مدال از ${name} سلب شد`);
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyUserId(null);
    }
  }

  return (
    <Dialog open={!!medal} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-3xl p-0 overflow-hidden">
        {/* سرشیر مدال */}
        <DialogHeader className="border-b border-border/50 bg-gradient-to-l from-primary/10 via-transparent to-chart-2/10 p-6 text-center">
          <div className="flex items-center justify-center gap-4">
            <MedalImage
              src={medal.imageUrl}
              alt={medal.name}
              className="size-20 shrink-0 rounded-2xl border border-border/50 bg-background/60 p-1.5"
            />
            <div className="flex flex-col items-start gap-1.5 text-start">
              <DialogTitle className="text-xl font-black">{medal.name}</DialogTitle>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge
                  variant="outline"
                  className={`text-[10px] ${RARITY_CLASSES[medal.rarity]}`}
                >
                  {RARITY_LABELS[medal.rarity]}
                </Badge>
                {medal.points > 0 && (
                  <Badge variant="outline" className="gap-1 text-[10px]">
                    <Sparkles className="size-3 text-chart-2" aria-hidden />
                    +{toFa(medal.points)} امتیاز
                  </Badge>
                )}
                {medal.earned && (
                  <Badge className="bg-primary text-[10px] text-primary-foreground">
                    دارمش
                  </Badge>
                )}
              </div>
              <DialogDescription className="text-xs text-muted-foreground">
                {medal.maxCount === null
                  ? "نسخهٔ نامحدود"
                  : medal.remaining === 0
                    ? `نسخهٔ محدود — تمام شد (${toFa(medal.maxCount)} از ${toFa(medal.maxCount)})`
                    : `نسخهٔ محدود — ${toFa(medal.remaining)} باقی‌مانده از ${toFa(medal.maxCount)}`}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex max-h-[55vh] flex-col gap-4 overflow-y-auto p-5">
          {/* توضیحات */}
          <p className="rounded-2xl border border-border/50 bg-background/50 p-3.5 text-sm leading-7 text-foreground/85">
            {medal.description}
          </p>

          {medal.earned && medal.awardedAt && (
            <p className="text-xs font-bold text-primary">
              🎉 این مدال {relativeTime(new Date(medal.awardedAt))} به شما اهدا شده.
            </p>
          )}

          {/* اعطا — فقط ادمین */}
          {canAward && (
            <div className="rounded-2xl border border-primary/30 bg-primary/5 p-3.5">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-black text-primary">
                <Gift className="size-3.5" aria-hidden />
                اعطای مدال به کاربر
              </p>
              <div className="relative">
                <Search
                  className="absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  dir="rtl"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="نام یا نام کاربری…"
                  className="h-10 bg-background ps-9 text-sm"
                  aria-label="جستجوی کاربر برای اعطای مدال"
                />
              </div>
              {q.trim().length >= 1 && (
                <div className="mt-2 flex flex-col gap-1.5">
                  {searching && candidates.length === 0 ? (
                    <Skeleton className="h-10 rounded-xl" />
                  ) : candidates.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-border p-2.5 text-center text-xs text-muted-foreground">
                      کاربرِ واجد شرایطی پیدا نشد
                    </p>
                  ) : (
                    candidates.slice(0, 6).map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        disabled={busyUserId === u.id}
                        onClick={() => award(u)}
                        className="flex items-center gap-2.5 rounded-xl border border-border/50 bg-background/60 p-2 text-right transition-colors hover:border-primary/40 hover:bg-primary/5 disabled:opacity-50"
                      >
                        <SafeAvatar user={u} className="size-8" />
                        <div className="flex flex-1 flex-col items-start">
                          <span className="text-xs font-bold">{u.name}</span>
                          <span className="text-[10px] text-muted-foreground" dir="ltr">
                            @{u.username}
                          </span>
                        </div>
                        <Award className="size-4 text-primary" aria-hidden />
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          <Separator />

          {/* دارندگان */}
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-sm font-black">
              <Users className="size-4 text-primary" aria-hidden />
              دارندگان ({toFa(medal.holdersCount)}
              {medal.maxCount !== null ? ` از ${toFa(medal.maxCount)}` : ""})
            </p>
            {medal.holders.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                هنوز هیچ‌کس این مدال را ندارد — اولین نفر باش! 🌱
              </p>
            ) : (
              <ScrollArea className="max-h-56">
                <ul className="flex flex-col gap-1.5 pe-2">
                  {medal.holders.map((h) => (
                    <li
                      key={h.id}
                      className="flex items-center gap-2.5 rounded-xl border border-border/40 bg-background/40 p-2"
                    >
                      <SafeAvatar
                        user={{ id: h.id, name: h.name, username: h.username, avatar: h.avatar }}
                        className="size-8"
                      />
                      <div className="flex min-w-0 flex-1 flex-col items-start">
                        <span className="truncate text-xs font-bold">{h.name}</span>
                        <span className="text-[10px] text-muted-foreground">
                          از {relativeTime(new Date(h.awardedAt))}
                        </span>
                      </div>
                      {canManage && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={busyUserId === h.id}
                          onClick={() => revoke(h.id, h.name)}
                          className="h-7 gap-1 px-2 text-[10px] text-destructive hover:text-destructive"
                          aria-label={`سلب مدال از ${h.name}`}
                        >
                          <Undo2 className="size-3" aria-hidden />
                          سلب
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
