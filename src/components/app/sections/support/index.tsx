"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Copy,
  CreditCard,
  HandCoins,
  Heart,
  Info,
  Send,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/api-client";
import { formatJalaliFullDate, toEn, toFa } from "@/lib/jalali";
import type { SupportResponse } from "@/lib/support";
import { useSession } from "@/store/session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

import { ManageTab } from "./_parts/manage-tab";

/** «۶۰37997512345678» → «۶۰۳۷ ۹۹۷۵ ۱۲۳۴ ۵۶۷۸» */
function formatCard(raw: string): string {
  const grouped = raw.replace(/(\d{4})(?=\d)/g, "$1 ");
  return toFa(grouped);
}

/**
 * سکشن «حمایت از سیبک»:
 * - عموم: شماره کارت (اگر ادمین تنظیم کرده باشد)، راهنمای سه‌گامی، فرم اعلام حمایت
 *   و فهرست تشکریِ حامیان (کم‌رنگ و صمیمی، نه پرریا).
 * - مدیر/ادمین: تب مدیریت برای ثبت و ویرایش حامیان؛ تنظیم کارت فقط ادمین.
 */
export default function SupportSection() {
  const user = useSession((s) => s.user);
  const qc = useQueryClient();
  const canManage = user?.role === "ADMIN" || user?.role === "MANAGER";
  const isAdmin = user?.role === "ADMIN";

  const { data, isLoading } = useQuery({
    queryKey: ["support"],
    queryFn: () => api.get<SupportResponse>("/api/support"),
  });

  // ---------- فرم اعلام ----------
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [wantsPublic, setWantsPublic] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const supporters = useMemo(() => data?.supporters ?? [], [data]);

  async function submitDeclaration() {
    const finalName = name.trim() || user?.name || "";
    if (finalName.length < 2) {
      toast.error("نام خود را وارد کنید");
      return;
    }
    let parsedAmount: number | null = null;
    if (amount.trim()) {
      parsedAmount = Number.parseInt(toEn(amount).replace(/[^\d]/g, ""), 10);
      if (!parsedAmount || parsedAmount < 1) {
        toast.error("مبلغ واردشده معتبر نیست");
        return;
      }
    }
    setSubmitting(true);
    try {
      await api.post("/api/support", {
        name: finalName,
        amount: parsedAmount,
        message: message.trim() || undefined,
        isPublic: wantsPublic,
      });
      toast.success("اعلام شما ارسال شد ❤️ پس از تأیید واریز، مدیر ثبتش می‌کند");
      setName("");
      setAmount("");
      setMessage("");
      qc.invalidateQueries({ queryKey: ["support"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function copyCard(raw: string) {
    try {
      await navigator.clipboard.writeText(raw);
      toast.success("شماره کارت کپی شد");
    } catch {
      toast.error("کپی نشد — شماره را دستی بردارید");
    }
  }

  const cardNumber = data?.settings.cardNumber ?? null;
  const cardHolder = data?.settings.cardHolder ?? null;

  return (
    <section className="flex flex-col gap-5" aria-label="حمایت از سیبک">
      {/* سربرگ */}
      <div className="glass card-hover relative overflow-hidden rounded-3xl p-6 md:p-8">
        <div
          className="pointer-events-none absolute -top-20 -left-16 size-56 rounded-full bg-rose-400/20 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-24 -right-10 size-56 rounded-full bg-primary/15 blur-3xl"
          aria-hidden
        />
        <div className="relative flex items-start gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500">
            <Heart className="size-7 fill-rose-500/20" aria-hidden />
          </div>
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-black md:text-3xl">حمایت از سیبک</h1>
            <p className="max-w-lg text-sm leading-6 text-muted-foreground">
              سیبک با دل‌گرمی شما گرم می‌ماند — هزینهٔ سرور، ابزارها و ربات. هر کمکِ کوچکی،
              صمیمانه سپاس داشته می‌شود.
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <Badge variant="outline" className="gap-1 text-[10px]">
                <Heart className="size-3 fill-rose-500/30 text-rose-500" aria-hidden />
                {toFa(supporters.length)} حامی
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                داوطلبانه و کاملاً اختیاری
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="public" className="gap-4">
        <TabsList className={canManage ? "grid w-full max-w-xs grid-cols-2" : "hidden"}>
          <TabsTrigger value="public" className="gap-1.5">
            <Heart className="size-4" aria-hidden />
            حمایت
          </TabsTrigger>
          {canManage && (
            <TabsTrigger value="manage" className="gap-1.5">
              <HandCoins className="size-4" aria-hidden />
              مدیریت
            </TabsTrigger>
          )}
        </TabsList>

        {/* ---------- نمای عمومی ---------- */}
        <TabsContent value="public" className="mt-0 flex flex-col gap-5">
          {isLoading ? (
            <>
              <Skeleton className="h-40 rounded-3xl" />
              <Skeleton className="h-64 rounded-3xl" />
            </>
          ) : (
            <>
              {/* شماره کارت */}
              <div className="grid gap-4 md:grid-cols-2">
                {cardNumber ? (
                  <div className="glass relative overflow-hidden rounded-3xl p-6">
                    <div
                      className="pointer-events-none absolute -top-10 -right-10 size-32 rounded-full bg-primary/10 blur-2xl"
                      aria-hidden
                    />
                    <div className="relative flex flex-col gap-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                          <CreditCard className="size-4" aria-hidden />
                          شماره کارت سیبک
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1.5"
                          onClick={() => copyCard(cardNumber)}
                        >
                          <Copy className="size-3.5" aria-hidden />
                          کپی
                        </Button>
                      </div>
                      <p
                        dir="ltr"
                        className="text-start font-black tracking-[0.18em] text-primary"
                        style={{ fontSize: "1.5rem" }}
                      >
                        {formatCard(cardNumber)}
                      </p>
                      {cardHolder && (
                        <p className="text-xs text-muted-foreground">
                          به نام <span className="font-bold">{cardHolder}</span>
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2 rounded-3xl border border-dashed border-border/70 bg-background/40 p-6 text-center">
                    <CreditCard className="size-8 text-muted-foreground/50" aria-hidden />
                    <p className="text-sm font-bold text-muted-foreground">
                      شماره کارت به‌زودی این‌جا قرار می‌گیرد
                    </p>
                    <p className="text-xs text-muted-foreground/70">
                      تا وقتی ادمین شماره کارت را تنظیم نکرده، این بخش خالی می‌ماند.
                    </p>
                  </div>
                )}

                {/* سه گام */}
                <div className="glass rounded-3xl p-6">
                  <p className="mb-3 flex items-center gap-2 text-sm font-black">
                    <Sparkles className="size-4 text-accent-foreground" aria-hidden />
                    حمایت در سه گام
                  </p>
                  <ol className="flex flex-col gap-3">
                    {[
                      { t: "واریز", d: "هر مبلغی که دوست دارید به کارت بالا واریز کنید." },
                      {
                        t: "اعلام",
                        d: "از فرم پایین به مدیر خبر بدهید تا حمایت شما ثبت شود.",
                      },
                      {
                        t: "سپاس",
                        d: "با رضایت خودتان، نامتان در فهرست حامیان درج می‌شود.",
                      },
                    ].map((step, i) => (
                      <li key={step.t} className="flex items-start gap-3">
                        <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-black text-primary">
                          {toFa(i + 1)}
                        </span>
                        <div>
                          <p className="text-sm font-bold leading-6">{step.t}</p>
                          <p className="text-xs leading-5 text-muted-foreground">{step.d}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>

              {/* فرم اعلام حمایت */}
              <div className="glass rounded-3xl p-6">
                <p className="flex items-center gap-2 text-sm font-black">
                  <Send className="size-4 text-primary" aria-hidden />
                  اعلام حمایت پس از واریز
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  بعد از واریز، همین‌جا به مدیر اطلاع بدهید تا پس از بررسی، حمایت شما ثبت شود.
                </p>

                {data?.myPending ? (
                  <div className="mt-4 flex items-start gap-3 rounded-2xl border border-chart-2/40 bg-chart-2/10 p-4">
                    <Info className="mt-0.5 size-5 shrink-0 text-chart-2" aria-hidden />
                    <div className="text-sm leading-6">
                      <p className="font-bold">اعلام شما در انتظار بررسی است</p>
                      <p className="text-xs text-muted-foreground">
                        {formatJalaliFullDate(new Date(data.myPending.createdAt))} ارسال شد —
                        پس از تأیید مدیر، از طریق اعلان باخبر می‌شوید.
                      </p>
                    </div>
                  </div>
                ) : (
                  <form
                    className="mt-4 flex flex-col gap-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void submitDeclaration();
                    }}
                  >
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="support-name">نام شما</Label>
                        <Input
                          id="support-name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder={user?.name ?? "نام دلخواه"}
                          maxLength={60}
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="support-amount">مبلغ (تومان) — اختیاری</Label>
                        <Input
                          id="support-amount"
                          dir="ltr"
                          inputMode="numeric"
                          className="text-end"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          placeholder="مثلاً ۵۰۰۰۰"
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="support-message">پیام شما (اختیاری)</Label>
                      <Textarea
                        id="support-message"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="اگر حرفی برای تشکر یا دل‌گرمی دارید…"
                        rows={2}
                        maxLength={300}
                      />
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <label className="flex cursor-pointer items-center gap-2.5 text-sm">
                        <Switch
                          checked={wantsPublic}
                          onCheckedChange={setWantsPublic}
                          aria-label="نمایش نامم در فهرست حامیان"
                        />
                        <span className="leading-6">
                          نامم در <span className="font-bold">فهرست حامیان</span> بیاید
                        </span>
                      </label>
                      <Button type="submit" className="gap-2" disabled={submitting}>
                        <Send className="size-4" aria-hidden />
                        {submitting ? "در حال ارسال…" : "ارسال اعلام حمایت"}
                      </Button>
                    </div>
                  </form>
                )}
              </div>

              {/* فهرست حامیان — عمداً کم‌رنگ و صمیمی */}
              <div className="glass rounded-3xl p-5">
                <p className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                  <Heart className="size-3.5 fill-rose-500/30 text-rose-500" aria-hidden />
                  با سپاس از حامیان سیبک
                </p>
                {supporters.length === 0 ? (
                  <p className="mt-2 text-[11px] text-muted-foreground/70">
                    هنوز حامی‌ای ثبت نشده — شاید اولین نفر شما باشید.
                  </p>
                ) : (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {supporters.map((s) => (
                      <Badge
                        key={s.id}
                        variant="outline"
                        className="gap-1 border-border/60 bg-background/40 px-2.5 py-1 text-[11px] font-semibold text-foreground/80"
                        title={s.message ?? undefined}
                      >
                        {s.name}
                        {s.amount !== null && (
                          <span className="text-[10px] font-normal text-muted-foreground">
                            {toFa(s.amount.toLocaleString("en-US"))} ت
                          </span>
                        )}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </TabsContent>

        {/* ---------- مدیریت (مدیر/ادمین) ---------- */}
        {canManage && (
          <TabsContent value="manage" className="mt-0">
            <ManageTab isAdmin={isAdmin} />
          </TabsContent>
        )}
      </Tabs>
    </section>
  );
}
