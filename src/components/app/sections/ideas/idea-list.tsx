"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Lightbulb, Plus, Search } from "lucide-react";

import { api } from "@/lib/api-client";
import { toFa } from "@/lib/jalali";
import { useSession } from "@/store/session";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/app/sections/_shared/empty-state";
import { IdeaCard, IdeaCardSkeleton } from "@/components/app/sections/ideas/idea-card";
import { IdeaDetailDialog } from "@/components/app/sections/ideas/idea-detail-dialog";
import { CreateEditIdeaDialog } from "@/components/app/sections/ideas/create-idea-dialog";
import { IDEA_FILTER_TABS } from "@/components/app/sections/ideas/status-meta";
import type { IdeaListItem } from "@/components/app/sections/_shared/types";

/**
 * لیست ایده‌های قابل استفاده‌مجدد.
 * - groupId: اگر تنظیم شود، فقط ایده‌های آن گروه را نشان می‌دهد (برای گروه-جزئیات).
 * - heading: اختیاری، برای نمایش عنوان/توضیح بالای لیست.
 */
export function IdeaList({
  groupId,
  heading,
  hideCreate,
}: {
  groupId?: string;
  heading?: React.ReactNode;
  hideCreate?: boolean;
}) {
  const user = useSession((s) => s.user);
  const isAdmin = user?.role === "ADMIN" || user?.role === "MANAGER";

  const [activeTab, setActiveTab] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"new" | "top">("new");
  const [detail, setDetail] = useState<IdeaListItem | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<IdeaListItem | null>(null);

  const params = new URLSearchParams();
  if (activeTab === "mine") {
    params.set("mine", "1");
  } else if (activeTab !== "all") {
    params.set("status", activeTab);
  }
  if (groupId) params.set("groupId", groupId);
  if (search) params.set("search", search);
  if (sort === "top") params.set("sort", "top");

  const { data, isLoading } = useQuery({
    queryKey: ["ideas", activeTab, search, sort, groupId ?? ""],
    queryFn: () => api.get<{ ideas: IdeaListItem[] }>(`/api/ideas?${params.toString()}`),
  });

  const ideas = data?.ideas ?? [];

  return (
    <section className="flex flex-col gap-4" aria-label="ایده‌ها">
      {heading}
      {/* نوار بالا: جستجو + مرتب‌سازی + ساخت */}
      {!hideCreate && (
        <div className="glass flex flex-col gap-3 rounded-2xl p-4 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search
              className="absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground"
              aria-hidden
            />
            <Input
              dir="rtl"
              className="h-11 ps-9"
              placeholder="جستجو در عنوان یا توضیحات…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant={sort === "new" ? "default" : "outline"}
              size="sm"
              className="h-11 min-h-11 gap-1.5 rounded-xl"
              onClick={() => setSort("new")}
            >
              جدیدترین
            </Button>
            <Button
              variant={sort === "top" ? "default" : "outline"}
              size="sm"
              className="h-11 min-h-11 gap-1.5 rounded-xl"
              onClick={() => setSort("top")}
            >
              محبوب‌ترین
            </Button>
          </div>
          <Button
            variant="default"
            size="sm"
            className="h-11 min-h-11 gap-1.5 rounded-xl"
            onClick={() => {
              setEditing(null);
              setShowCreate(true);
            }}
          >
            <Plus className="size-4" aria-hidden />
            ایده جدید
          </Button>
        </div>
      )}

      {/* تب‌های وضعیت */}
      <div className="glass flex flex-wrap gap-1.5 rounded-2xl p-1.5">
        {IDEA_FILTER_TABS.map((t) => {
          const isActive = activeTab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key)}
              className={cn(
                "relative flex min-h-10 items-center gap-1.5 rounded-xl px-3.5 text-sm font-semibold transition-colors",
                isActive
                  ? "text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {isActive && (
                <motion.span
                  layoutId="ideas-tab-pill"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  className="absolute inset-0 rounded-xl bg-primary"
                />
              )}
              <span className="relative z-10">{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* لیست */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <IdeaCardSkeleton key={i} />
          ))}
        </div>
      ) : ideas.length === 0 ? (
        <EmptyState
          icon={Lightbulb}
          title="هنوز ایده‌ای ثبت نشده"
          description="اولین نفر باش! ایده‌ای برای یادگیری بهتر، کارگاه، ابزار یا هر چیز دیگری ثبت کن."
          action={
            !hideCreate && (
              <Button
                onClick={() => {
                  setEditing(null);
                  setShowCreate(true);
                }}
                className="h-11 gap-1.5 rounded-xl"
              >
                <Plus className="size-4" aria-hidden />
                ثبت اولین ایده
              </Button>
            )
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ideas.map((idea) => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              onOpenDetail={(i) => setDetail(i)}
              onEdit={(i) => {
                setEditing(i);
                setShowCreate(true);
              }}
            />
          ))}
        </div>
      )}

      {/* دیالوگ جزئیات */}
      <IdeaDetailDialog idea={detail} onClose={() => setDetail(null)} />

      {/* دیالوگ ساخت/ویرایش */}
      <CreateEditIdeaDialog
        open={showCreate}
        onClose={() => {
          setShowCreate(false);
          setEditing(null);
        }}
        editIdea={editing}
        fixedGroupId={groupId ?? null}
      />

      {isAdmin && ideas.length > 0 && (
        <p className="mt-1 text-center text-[11px] text-muted-foreground">
          ایده‌های در انتظار بررسی با حلقه کهربایی مشخص شده‌اند.
        </p>
      )}
      <span className="sr-only">{toFa(ideas.length)} ایده نمایش داده شده</span>
    </section>
  );
}
