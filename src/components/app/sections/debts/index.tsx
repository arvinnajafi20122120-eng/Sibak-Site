"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Scale, Sparkles, HandHeart, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";
import { toFa } from "@/lib/jalali";
import { api } from "@/lib/api-client";
import { useSession } from "@/store/session";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";

import { EmptyState } from "@/components/app/sections/_shared/empty-state";
import { PrintButton } from "@/components/app/sections/_shared/print-button";
import { CreateDebtDialog } from "./_parts/create-debt-dialog";
import { DebtCard } from "./_parts/debt-card";
import { DebtDetailDialog } from "./_parts/debt-detail-dialog";
import type { DebtDetail, DebtListItem, DebtStats } from "./_parts/types";

type Tab = "mine" | "public" | "pending" | "forgiven";

/**
 * بخش بدهکاری مودبانه سیبک.
 * واژگان: تعهد / جبران / بخشش — هرگز تحقیرآمیز نیست.
 */
export default function DebtsSection() {
  const user = useSession((s) => s.user);
  const [tab, setTab] = useState<Tab>("mine");
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const isAdmin = user?.role === "ADMIN";
  const canCreate = user?.role === "ADMIN" || user?.role === "MANAGER";

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (tab === "mine") p.set("mine", "1");
    else if (tab === "pending") p.set("status", "SETTLE_PENDING");
    else if (tab === "forgiven") p.set("status", "FORGIVEN");
    return p.toString();
  }, [tab]);

  const { data, isLoading } = useQuery({
    queryKey: ["debts", params],
    queryFn: () => api.get<{ debts: DebtListItem[] }>(`/api/debts?${params}`),
    select: (res) => {
      let list = res.debts;
      if (tab === "public") list = list.filter((d) => d.visibility === "PUBLIC");
      return list;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["debt-stats"],
    queryFn: () => api.get<DebtStats>("/api/debts/stats"),
  });

  const detailQ = useQuery({
    queryKey: ["debt", selected],
    queryFn: () =>
      selected
        ? api.get<{ debt: DebtDetail }>(`/api/debts/${selected}`)
        : Promise.resolve(null as unknown as { debt: DebtDetail }),
    enabled: !!selected,
  });

  const items = data ?? [];
  const iOwe = stats?.iOwe ?? 0;
  const owedToMe = stats?.owedToMe ?? 0;
  const openCount = stats?.openCount ?? 0;

  return (
    <section className="flex flex-col gap-5" aria-label="بدهکاری مودبانه">
      {/* سربرگ */}
      <div className="glass card-hover relative overflow-hidden rounded-3xl p-6 md:p-8">
        <div
          className="pointer-events-none absolute -top-20 -left-16 size-56 rounded-full bg-primary/15 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-24 -right-16 size-56 animate-blob rounded-full bg-chart-5/15 blur-3xl [animation-delay:-6s]"
          aria-hidden
        />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Scale className="size-7" aria-hidden />
            </div>
            <div>
              <h1 className="text-2xl font-black md:text-3xl">بدهکاری مودبانه 🌱</h1>
              <p className="mt-1.5 max-w-xl text-sm leading-7 text-muted-foreground">
                وقتی کسی به نابرابری اعتباری رسیده، این‌جا یادآوری دوستانه برای جبران است — نه تحقیر.
                تعهد کوچک ثبت کنید، سر موعد جبران کنید، یا مودبانه ببخشید.
              </p>
            </div>
          </div>
          {canCreate && (
            <div className="no-print flex items-center gap-2">
              <PrintButton title="دفتر بدهکاری" className="h-11 min-h-11" />
              <Button
                type="button"
                className="gap-2 rounded-xl"
                onClick={() => setCreateOpen(true)}
              >
                <Plus className="size-4" aria-hidden />
                تعهد جدید
              </Button>
            </div>
          )}
          {!canCreate && (
            <PrintButton title="دفتر بدهکاری" className="h-11 min-h-11 no-print" />
          )}
        </div>
      </div>

      {/* محدودهٔ چاپ: آمار + تب‌ها + لیست */}
      <div className="printable-area flex flex-col gap-5">
      {/* آمار من */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatPill
          tint="rose"
          icon={<AlertTriangle className="size-4" aria-hidden />}
          label="بدهی من"
          value={toFa(iOwe)}
          suffix="امتیاز"
        />
        <StatPill
          tint="emerald"
          icon={<Sparkles className="size-4" aria-hidden />}
          label="طلب من"
          value={toFa(owedToMe)}
          suffix="امتیاز"
        />
        <StatPill
          tint="amber"
          icon={<Scale className="size-4" aria-hidden />}
          label="تعهد فعال"
          value={toFa(openCount)}
          suffix="مورد"
          className="col-span-2 sm:col-span-1"
        />
      </div>

      {/* تب‌ها */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="no-print">
        <TabsList className="flex h-11 w-full flex-wrap justify-start gap-1 rounded-2xl bg-secondary/50 p-1">
          <TabsTrigger value="mine" className="rounded-xl">تعهدات من</TabsTrigger>
          <TabsTrigger value="public" className="rounded-xl">همهٔ عمومی</TabsTrigger>
          <TabsTrigger value="pending" className="rounded-xl">در انتظار تأیید</TabsTrigger>
          <TabsTrigger value="forgiven" className="rounded-xl">بخشیده‌شده</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* لیست */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-2xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={HandHeart}
          title="همه چیز صفر است 🎉"
          description={
            tab === "mine"
              ? "تعهدی روی دوش شما نیست. عالی! وقت پروژه‌های خودتان."
              : tab === "pending"
                ? "هیچ جبرانی در انتظار تأیید نیست."
                : tab === "forgiven"
                  ? "هنوز بدهی بخشیده‌شده‌ای وجود ندارد."
                  : "هنوز تعهد عمومی‌ای ثبت نشده است."
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {items.map((d, i) => (
            <DebtCard
              key={d.id}
              debt={d}
              index={i}
              onOpen={() => setSelected(d.id)}
            />
          ))}
        </div>
      )}
      </div>

      <CreateDebtDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
      />

      <DebtDetailDialog
        debt={detailQ.data?.debt ?? null}
        onClose={() => setSelected(null)}
      />

      {/* isAdmin flag unused suppressor */}
      <span className="sr-only">{isAdmin ? "admin" : "user"}</span>
    </section>
  );
}

function StatPill({
  tint,
  icon,
  label,
  value,
  suffix,
  className,
}: {
  tint: "rose" | "emerald" | "amber";
  icon: React.ReactNode;
  label: string;
  value: string;
  suffix: string;
  className?: string;
}) {
  const TINTS: Record<string, string> = {
    rose: "border-destructive/30 bg-destructive/5 text-destructive",
    emerald: "border-chart-1/30 bg-chart-1/5 text-primary",
    amber: "border-chart-2/40 bg-chart-2/5 text-accent-foreground",
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn(
        "glass flex items-center gap-3 rounded-2xl border p-3",
        TINTS[tint],
        className,
      )}
    >
      <span className="flex size-9 items-center justify-center rounded-xl bg-background/60">
        {icon}
      </span>
      <div className="flex flex-col">
        <span className="text-[11px] text-muted-foreground">{label}</span>
        <span className="text-lg font-black tabular-nums">
          {value} <span className="text-[10px] font-medium text-muted-foreground">{suffix}</span>
        </span>
      </div>
    </motion.div>
  );
}

// جهت جلوگیری از import پاک‌شدن
void Card;
void CardContent;
