"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Library, Medal, Plus, Settings2 } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/api-client";
import { toFa } from "@/lib/jalali";
import { RARITY_WEIGHT, type MedalDTO } from "@/lib/medals";
import { useSession } from "@/store/session";
import { EmptyState } from "@/components/app/sections/_shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { MedalCard } from "./_parts/medal-card";
import { MedalDetailDialog } from "./_parts/medal-detail-dialog";
import { MedalFormDialog } from "./_parts/medal-form-dialog";

/**
 * سکشن مدال‌های سیبک:
 * - کتابخانه مدال‌ها: همهٔ کاربران (حتی مهمان) — کلیک روی مدال → جزئیات و دارندگان.
 * - مدیریت مدال‌ها (فقط ادمین): ساخت، ویرایش، حذف.
 */
export default function MedalsSection() {
  const user = useSession((s) => s.user);
  const qc = useQueryClient();
  const isAdmin = user?.role === "ADMIN";

  const [detail, setDetail] = useState<MedalDTO | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<MedalDTO | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["medals"],
    queryFn: () => api.get<{ medals: MedalDTO[] }>("/api/medals"),
    select: (res) => res.medals,
  });

  // مرتب‌سازی: نایابی بالاتر اول، بعد امتیاز، بعد تعداد دارنده
  const medals = useMemo(() => {
    const list = [...(data ?? [])];
    list.sort((a, b) => {
      const w = RARITY_WEIGHT[b.rarity] - RARITY_WEIGHT[a.rarity];
      if (w !== 0) return w;
      if (b.points !== a.points) return b.points - a.points;
      if (b.holdersCount !== a.holdersCount) return b.holdersCount - a.holdersCount;
      return a.name.localeCompare(b.name, "fa");
    });
    return list;
  }, [data]);

  const earnedCount = medals.filter((m) => m.earned).length;

  function onChanged() {
    qc.invalidateQueries({ queryKey: ["medals"] });
    qc.invalidateQueries({ queryKey: ["me-profile"] });
    qc.invalidateQueries({ queryKey: ["public-profile"] });
    qc.invalidateQueries({ queryKey: ["admin-overview"] });
  }

  async function deleteMedal(m: MedalDTO) {
    if (!window.confirm(`مدال «${m.name}» حذف شود؟ از پروفایل همهٔ دارندگان هم محو می‌شود.`))
      return;
    try {
      await api.del(`/api/medals/${m.id}`);
      toast.success(`مدال «${m.name}» حذف شد`);
      setDetail(null);
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <section className="flex flex-col gap-5" aria-label="مدال‌ها">
      {/* سربرگ */}
      <div className="glass card-hover relative overflow-hidden rounded-3xl p-6 md:p-8">
        <div
          className="pointer-events-none absolute -top-20 -left-16 size-56 rounded-full bg-chart-2/20 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-24 -right-10 size-56 rounded-full bg-primary/15 blur-3xl"
          aria-hidden
        />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Medal className="size-7" aria-hidden />
            </div>
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl font-black md:text-3xl">مدال‌ها</h1>
              <p className="max-w-md text-sm leading-6 text-muted-foreground">
                کتابخانهٔ افتخارات سیبک — هر مدال یک داستان دارد؛ از نایابی و امتیازش باخبر شو و
                ببین چه کسانی دارندش.
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <Badge variant="outline" className="text-[10px]">
                  {toFa(medals.length)} مدال
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  {toFa(earnedCount)} برای شما
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="library" className="gap-4">
        <TabsList className={isAdmin ? "grid w-full max-w-xs grid-cols-2" : "hidden"}>
          <TabsTrigger value="library" className="gap-1.5">
            <Library className="size-4" aria-hidden />
            کتابخانه
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="manage" className="gap-1.5">
              <Settings2 className="size-4" aria-hidden />
              مدیریت
            </TabsTrigger>
          )}
        </TabsList>

        {/* ---------- کتابخانه ---------- */}
        <TabsContent value="library" className="mt-0">
          {isLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-64 rounded-3xl" />
              ))}
            </div>
          ) : medals.length === 0 ? (
            <EmptyState
              icon={Medal}
              title="هنوز مدالی در گنجینه نیست"
              description={
                isAdmin
                  ? "از تب «مدیریت» اولین مدال را بسازید."
                  : "ادمین‌ها به‌زودی مدال‌ها را اضافه می‌کنند — منتظر باش! 🌱"
              }
            />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {medals.map((m, i) => (
                <MedalCard key={m.id} medal={m} index={i} onOpen={setDetail} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ---------- مدیریت (فقط ادمین) ---------- */}
        {isAdmin && (
          <TabsContent value="manage" className="mt-0">
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="text-sm font-bold text-muted-foreground">
                ساخت، ویرایش و حذف مدال‌ها
              </p>
              <Button
                type="button"
                className="gap-2"
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                <Plus className="size-4" aria-hidden />
                مدال جدید
              </Button>
            </div>

            {isLoading ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 rounded-2xl" />
                ))}
              </div>
            ) : medals.length === 0 ? (
              <EmptyState
                icon={Medal}
                title="اولین مدال را بسازید"
                description="عکس PNG شفاف + توضیحات + نایابی و امتیاز — و به کاربران بدهید."
              />
            ) : (
              <div className="flex flex-col gap-2">
                {medals.map((m) => (
                  <div
                    key={m.id}
                    className="glass flex flex-wrap items-center gap-3 rounded-2xl p-3"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div className="size-12 shrink-0 rounded-xl border border-border/50 bg-background/50 p-1">
                        <img
                          src={m.imageUrl}
                          alt=""
                          className="size-full object-contain"
                          loading="lazy"
                        />
                      </div>
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate text-sm font-black">{m.name}</span>
                        <span className="truncate text-[11px] text-muted-foreground">
                          {toFa(m.holdersCount)} دارنده
                          {m.maxCount !== null ? ` از ${toFa(m.maxCount)}` : ""} ·{" "}
                          {toFa(m.points)} امتیاز
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8"
                        onClick={() => setDetail(m)}
                      >
                        دارندگان
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8"
                        onClick={() => {
                          setEditing(m);
                          setFormOpen(true);
                        }}
                      >
                        ویرایش
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 text-destructive hover:text-destructive"
                        onClick={() => deleteMedal(m)}
                      >
                        حذف
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        )}
      </Tabs>

      {/* دیالوگ‌ها */}
      <MedalDetailDialog
        medal={detail}
        onOpenChange={(v) => !v && setDetail(null)}
        canManage={isAdmin}
      />
      <MedalFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
        onSaved={onChanged}
      />
    </section>
  );
}
