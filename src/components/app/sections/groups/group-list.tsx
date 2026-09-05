"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Lightbulb,
  Loader2,
  Plus,
  Search,
  UserCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/api-client";
import { toFa } from "@/lib/jalali";
import { useSession } from "@/store/session";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/app/sections/_shared/empty-state";
import { SafeAvatar } from "@/components/app/sections/_shared/safe-avatar";
import {
  CreateEditGroupDialog,
} from "@/components/app/sections/groups/create-group-dialog";
import {
  GROUP_COLOR_BADGE,
  GROUP_COLOR_GRADIENT,
  GROUP_COLOR_TEXT_ON_GRADIENT,
  JOIN_POLICY_LABELS,
  normalizeColor,
} from "@/components/app/sections/_shared/group-colors";
import { GroupIcon } from "@/components/app/sections/_shared/lucide-icons";
import type { GroupListItem } from "@/components/app/sections/_shared/types";

/**
 * فهرست گروه‌ها با جستجو، فیلتر «گروه‌های من» و کارت‌های رنگی.
 */
export function GroupList({
  onOpenDetail,
}: {
  onOpenDetail: (id: string) => void;
}) {
  const user = useSession((s) => s.user);
  const canCreate = user?.role === "ADMIN" || user?.role === "MANAGER";
  const queryClient = useQueryClient();

  const [mineOnly, setMineOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  // همیشه کوئری برچسب «mine» را include می‌کنیم و فیلتر سمت کلاینت اعمال می‌شود
  // کلاس‌های درسی (گروه‌های دارای استاد) از فهرست زیرمجموعه‌ها حذف می‌شوند
  const { data, isLoading } = useQuery({
    queryKey: ["groups", mineOnly ? "mine" : "all"],
    queryFn: () =>
      api.get<{ groups: GroupListItem[] }>(
        `/api/groups?excludeClasses=1${mineOnly ? "&mine=1" : ""}`,
      ),
  });

  const allGroups = data?.groups ?? [];
  const filtered = search
    ? allGroups.filter(
        (g) =>
          g.name.includes(search) ||
          (g.description ?? "").includes(search),
      )
    : allGroups;

  const joinMutation = useMutation({
    mutationFn: ({ id }: { id: string }) => api.post(`/api/groups/${id}/join`),
    onSuccess: (res, vars) => {
      toast.success(res.status === "ACTIVE" ? "به گروه پیوستید!" : "درخواست عضویت ثبت شد");
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      queryClient.invalidateQueries({ queryKey: ["group", vars.id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "خطا در عضویت"),
  });

  return (
    <div className="flex flex-col gap-5" aria-label="زیرمجموعه‌ها">
      {/* نوار بالا */}
      <div className="glass card-hover relative overflow-hidden rounded-3xl p-6 md:p-8">
        <div
          className="pointer-events-none absolute -top-16 -left-16 size-48 rounded-full bg-chart-1/15 blur-3xl"
          aria-hidden
        />
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Users className="size-7" aria-hidden />
            </div>
            <div className="flex flex-col gap-1.5">
              <h1 className="text-2xl font-black md:text-3xl">زیرمجموعه‌ها</h1>
              <p className="max-w-xl text-sm leading-7 text-muted-foreground">
                گروه‌های مطالعاتی و تیم‌های درسی سیبک؛ با سیاست عضویت آزاد،
                درخواستی یا دعوت‌نامه و رهبری مشخص برای هر گروه.
              </p>
            </div>
          </div>
          {canCreate && (
            <Button
              variant="default"
              size="sm"
              className="h-11 min-h-11 gap-1.5 rounded-xl"
              onClick={() => setShowCreate(true)}
            >
              <Plus className="size-4" aria-hidden />
              گروه جدید
            </Button>
          )}
        </div>
      </div>

      {/* جستجو + فیلتر */}
      <div className="glass flex flex-col gap-3 rounded-2xl p-4 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search
            className="absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground"
            aria-hidden
          />
          <Input
            dir="rtl"
            className="h-11 ps-9"
            placeholder="جستجو در نام یا توضیحات گروه‌ها…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button
          variant={mineOnly ? "default" : "outline"}
          size="sm"
          className="h-11 min-h-11 gap-1.5 rounded-xl"
          onClick={() => setMineOnly((v) => !v)}
        >
          <UserCheck className="size-4" aria-hidden />
          گروه‌های من
        </Button>
      </div>

      {/* لیست گروه‌ها */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-3xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title={mineOnly ? "هنوز عضو هیچ گروهی نشده‌اید" : "هنوز گروهی ساخته نشده"}
          description={
            mineOnly
              ? "به یک گروه باز بپیوندید یا درخواست عضویت ثبت کنید."
              : "اولین گروه سیبک را بساز — تیم مطالعاتی، کاری یا پروژه‌محور."
          }
          action={
            canCreate && !mineOnly ? (
              <Button
                onClick={() => setShowCreate(true)}
                className="h-11 gap-1.5 rounded-xl"
              >
                <Plus className="size-4" aria-hidden />
                ساخت اولین گروه
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence initial={false}>
            {filtered.map((g, idx) => (
              <GroupCard
                key={g.id}
                group={g}
                index={idx}
                onOpenDetail={() => onOpenDetail(g.id)}
                onJoin={() => joinMutation.mutate({ id: g.id })}
                pendingJoin={joinMutation.isPending && joinMutation.variables?.id === g.id}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      <CreateEditGroupDialog open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
}

/** کارت گروه — هدر گرادیانی رنگی + اعضا + ایده‌ها + CTA. */
function GroupCard({
  group,
  index,
  onOpenDetail,
  onJoin,
  pendingJoin,
}: {
  group: GroupListItem;
  index: number;
  onOpenDetail: () => void;
  onJoin: () => void;
  pendingJoin: boolean;
}) {
  const color = normalizeColor(group.color);
  const isMember = group.myMembership === "ACTIVE";
  const isPending = group.myMembership === "PENDING";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.2) }}
      className="glass card-hover group flex flex-col overflow-hidden rounded-3xl"
    >
      {/* هدر گرادیانی */}
      <button
        type="button"
        onClick={onOpenDetail}
        className={cn(
          "relative flex items-center gap-3 bg-gradient-to-l p-5 text-right",
          GROUP_COLOR_GRADIENT[color],
          GROUP_COLOR_TEXT_ON_GRADIENT,
        )}
        aria-label={`باز کردن گروه ${group.name}`}
      >
        <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/15">
          <GroupIcon name={group.icon} className="size-6" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-black">{group.name}</h3>
          <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold">
            {JOIN_POLICY_LABELS[group.joinPolicy]}
          </span>
        </div>
      </button>

      {/* توضیحات */}
      <div className="flex flex-1 flex-col gap-3 p-5">
        <p className="line-clamp-2 min-h-10 text-sm leading-6 text-muted-foreground">
          {group.description ?? "—"}
        </p>

        {/* رهبر */}
        {group.leader && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <SafeAvatar user={group.leader} className="size-6" />
            <span>رهبر: <b className="text-foreground/80">{group.leader.name}</b></span>
          </div>
        )}

        {/* آمار */}
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <Badge variant="outline" className="gap-1">
            <Users className="size-3" aria-hidden />
            {toFa(group.memberCount)} عضو
          </Badge>
          <Badge variant="outline" className="gap-1">
            <Lightbulb className="size-3" aria-hidden />
            {toFa(group.ideasCount)} ایده
          </Badge>
          {group.myMembership && (
            <Badge
              variant="outline"
              className={cn(
                "gap-1",
                isMember && GROUP_COLOR_BADGE[color],
                isPending && "bg-chart-2/20 text-accent-foreground border-chart-2/50",
              )}
            >
              {isMember ? "عضو" : isPending ? "در انتظار" : "—"}
            </Badge>
          )}
        </div>

        {/* CTA */}
        <div className="mt-1 flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-10 min-h-10 flex-1 gap-1.5 rounded-xl"
            onClick={onOpenDetail}
          >
            مشاهده
            <ArrowLeft className="size-4" aria-hidden />
          </Button>
          {!isMember && !isPending && group.joinPolicy !== "INVITE" && (
            <Button
              type="button"
              variant="default"
              size="sm"
              className="h-10 min-h-10 gap-1.5 rounded-xl"
              onClick={onJoin}
              disabled={pendingJoin}
            >
              {pendingJoin ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <>
                  <UserCheck className="size-4" aria-hidden />
                  {group.joinPolicy === "OPEN" ? "پیوستن" : "درخواست"}
                </>
              )}
            </Button>
          )}
          {isMember && (
            <span className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-chart-1/10 px-3 text-xs font-bold text-primary">
              <UserCheck className="size-4" aria-hidden />
              عضو هستید
            </span>
          )}
          {isPending && (
            <span className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-chart-2/10 px-3 text-xs font-bold text-accent-foreground">
              در انتظار تایید
            </span>
          )}
          {group.joinPolicy === "INVITE" && !isMember && (
            <span className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-secondary px-3 text-xs font-bold text-muted-foreground">
              فقط با دعوت
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
