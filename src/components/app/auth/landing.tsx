"use client";

import { useState } from "react";

import { motion, useReducedMotion } from "framer-motion";
import {
  ChevronLeft,
  Heart,
  LogIn,
  ScrollText,
  Sparkles,
  UserRoundPlus,
} from "lucide-react";

import { useHashRoute } from "@/components/app/router";
import { SibakLogo } from "@/components/app/logo";
import { RubikaBotButton } from "@/components/app/auth/rubika-bot-button";
import { RulesDialog } from "@/components/app/auth/rules-dialog";
import { useSession } from "@/store/session";
import { Button } from "@/components/ui/button";

/* ---------- لکه‌های گرادیان پس‌زمینه ---------- */
function GradientBlobs() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-background" />
      <div className="absolute -top-32 right-[8%] size-[28rem] animate-blob rounded-full bg-primary/20 blur-3xl" />
      <div className="absolute top-[35%] left-[5%] size-[24rem] animate-blob rounded-full bg-chart-2/20 blur-3xl [animation-delay:-5s]" />
      <div className="absolute bottom-[-8rem] right-[35%] size-[26rem] animate-blob rounded-full bg-chart-3/12 blur-3xl [animation-delay:-9s]" />
    </div>
  );
}

/* ---------- سیب شناور با هالهٔ نورانی ---------- */
function FloatingApple() {
  const reduce = useReducedMotion();

  return (
    <div className="relative mx-auto flex size-80 items-center justify-center md:size-96" aria-hidden>
      {/* هالهٔ نورانی پالس‌دار */}
      <motion.div
        animate={reduce ? {} : { scale: [1, 1.08, 1], opacity: [0.4, 0.6, 0.4] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        className="absolute inset-8 rounded-full bg-primary/20 blur-3xl"
      />
      {/* حلقه‌های متحدالمرکز */}
      <div className="absolute inset-0 rounded-full border border-dashed border-primary/20" />
      <div className="absolute inset-10 rounded-full border border-border/50" />
      <div className="absolute inset-20 rounded-full border border-primary/10" />

      {/* سیب مرکزی */}
      <motion.div
        animate={reduce ? {} : { y: [0, -14, 0], rotate: [0, 3, -2, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        className="relative z-10"
      >
        <SibakLogo size={128} className="drop-shadow-2xl" />
      </motion.div>

      {/* ذرات شناور کوچک */}
      {[
        { x: -150, y: -40, d: 0, s: "size-2 bg-chart-2/60" },
        { x: 150, y: 30, d: 0.6, s: "size-3 bg-primary/50" },
        { x: -90, y: 120, d: 1.2, s: "size-1.5 bg-chart-4/60" },
        { x: 110, y: -110, d: 1.8, s: "size-2 bg-chart-3/50" },
        { x: -180, y: 60, d: 2.4, s: "size-1 bg-primary/40" },
      ].map((p, i) => (
        <motion.span
          key={i}
          className={`absolute rounded-full ${p.s}`}
          style={{ x: p.x, y: p.y }}
          animate={reduce ? {} : { y: [p.y, p.y - 12, p.y], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 4 + i, repeat: Infinity, ease: "easeInOut", delay: p.d }}
          aria-hidden
        />
      ))}
    </div>
  );
}

const reveal = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0 },
};

/**
 * صفحهٔ فرود مهمان — مینیمال، شیشه‌ای و آرام.
 * بدون آمار نمایشی، بدون لیست امکانات؛ تمرکز روی دعوت به ثبت‌نام و ربات روبیکا.
 */
export function Landing() {
  const { navigate } = useHashRoute();
  const reduce = useReducedMotion();
  const settings = useSession((s) => s.settings);
  const rules = settings?.siteRules ?? [];
  const [rulesOpen, setRulesOpen] = useState(false);

  return (
    <div className="flex min-h-svh flex-col">
      <GradientBlobs />

      {/* هدر فرود */}
      <header className="glass-strong sticky top-0 z-40 border-b">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-2.5">
            <SibakLogo size={36} />
            <span className="text-xl font-black">سیبک</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              className="min-h-11 rounded-xl"
              onClick={() => navigate("/login")}
            >
              <LogIn className="size-4" aria-hidden />
              ورود
            </Button>
            <Button
              className="min-h-11 rounded-xl font-bold"
              onClick={() => navigate("/register")}
            >
              <UserRoundPlus className="size-4" aria-hidden />
              شروع کنید
            </Button>
          </div>
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        {/* قهرمان */}
        <section className="relative mx-auto grid w-full max-w-6xl flex-1 items-center gap-12 px-4 py-16 md:px-6 lg:grid-cols-2 lg:py-24">
          <motion.div
            initial={reduce ? undefined : reveal.hidden}
            animate={reduce ? undefined : reveal.show}
            transition={{ duration: 0.55 }}
            className="flex flex-col items-start gap-6"
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-bold text-primary">
              <Sparkles className="size-3.5" aria-hidden />
              بستری برای هم‌فکری و هم‌کاری
            </span>
            <h1 className="text-4xl font-black leading-[1.2] tracking-tight sm:text-5xl lg:text-6xl">
              با هم،
              <br />
              یک <span className="text-gradient">سیب شیرین</span> می‌چینیم
            </h1>
            <p className="max-w-lg text-base leading-8 text-muted-foreground md:text-lg">
              سیبک جایی است که با هم فکر می‌کنیم، برنامه‌ریزی می‌کنیم و تعهد می‌سازیم —
              شفاف، مودبانه و روان. عضو شوید و همراه ما باشید.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                size="lg"
                className="min-h-12 rounded-2xl px-7 text-base font-bold shadow-lg shadow-primary/25"
                onClick={() => navigate("/register")}
              >
                شروع کنید
                <ChevronLeft className="size-4" aria-hidden />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="min-h-12 rounded-2xl px-7 text-base"
                onClick={() => navigate("/login")}
              >
                <LogIn className="size-4" aria-hidden />
                ورود
              </Button>
              <RubikaBotButton
                size="lg"
                variant="ghost"
                className="min-h-12"
              />
            </div>
          </motion.div>

          <motion.div
            initial={reduce ? undefined : { opacity: 0, scale: 0.9 }}
            animate={reduce ? undefined : { opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.15 }}
          >
            <FloatingApple />
          </motion.div>
        </section>

        {/* قوانین باغ سیبک — هماهنگ با زبان طراحی فرود */}
        {rules.length > 0 && (
          <motion.section
            initial={reduce ? undefined : reveal.hidden}
            whileInView={reduce ? undefined : reveal.show}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.55 }}
            className="mx-auto w-full max-w-4xl px-4 pb-16 pt-4 md:px-6"
            aria-label="قوانین سیبک"
          >
            <div className="glass card-hover relative overflow-hidden rounded-3xl p-7 md:p-10">
              <div className="pointer-events-none absolute -top-14 -left-10 size-48 rounded-full bg-chart-3/15 blur-3xl" aria-hidden />
              <div className="pointer-events-none absolute -bottom-16 -right-10 size-52 rounded-full bg-primary/12 blur-3xl" aria-hidden />
              <div className="relative flex flex-col items-center gap-4">
                <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <ScrollText className="size-7" aria-hidden />
                </span>
                <h2 className="text-2xl font-black md:text-3xl">قوانین باغ سیبک</h2>
                <p className="max-w-md text-center text-sm leading-7 text-muted-foreground md:text-base">
                  قبل از عضویت بخوانید؛ با ثبت‌نام، این قوانین را می‌پذیرید.
                </p>
                <div className="grid w-full gap-3 md:grid-cols-2">
                  {rules.slice(0, 4).map((r, i) => (
                    <motion.div
                      key={`${i}-${r.title}`}
                      initial={reduce ? undefined : { opacity: 0, y: 10 }}
                      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.06 * i, duration: 0.3 }}
                      className="rounded-2xl border border-border/60 bg-background/50 p-3.5 text-start"
                    >
                      <p className="flex items-center gap-2 text-sm font-bold">
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-black text-primary-foreground">
                          {i + 1}
                        </span>
                        {r.title}
                      </p>
                      <p className="mt-1.5 line-clamp-2 ps-8.5 text-xs leading-6 text-muted-foreground">
                        {r.body}
                      </p>
                    </motion.div>
                  ))}
                </div>
                <Button
                  variant="outline"
                  className="min-h-11 rounded-2xl font-bold"
                  onClick={() => setRulesOpen(true)}
                >
                  دیدن همهٔ قوانین
                  <ChevronLeft className="size-4" aria-hidden />
                </Button>
              </div>
            </div>
          </motion.section>
        )}

        {/* دعوت به ربات روبیکا */}
        <motion.section
          initial={reduce ? undefined : reveal.hidden}
          whileInView={reduce ? undefined : reveal.show}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.55 }}
          className="mx-auto w-full max-w-4xl px-4 pb-16 pt-4 md:px-6"
        >
          <div className="glass card-hover relative overflow-hidden rounded-3xl p-7 text-center md:p-10">
            <div className="pointer-events-none absolute -top-16 -right-10 size-48 rounded-full bg-primary/15 blur-3xl" aria-hidden />
            <div className="pointer-events-none absolute -bottom-20 -left-10 size-56 rounded-full bg-chart-2/15 blur-3xl" aria-hidden />
            <div className="relative flex flex-col items-center gap-4">
              <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Sparkles className="size-7" aria-hidden />
              </span>
              <h2 className="text-2xl font-black md:text-3xl">
                عضو ربات روبیکا سیبک شوید
              </h2>
              <p className="max-w-md text-sm leading-7 text-muted-foreground md:text-base">
                پس از تأیید عضویت، اپ روبیکا را نصب کنید، وارد ربات{" "}
                <code dir="ltr" className="font-mono font-bold text-primary">@SibakBot</code>{" "}
                بشوید و فرمان <code dir="ltr" className="font-mono font-bold">/start</code> را
                بزنید تا هم‌گروه شویم.
              </p>
              <RubikaBotButton size="lg" label="رفتن به ربات روبیکا" />
            </div>
          </div>
        </motion.section>
      </main>

      {/* فوتر چسبان پایین */}
      <footer className="glass mt-auto border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-muted-foreground sm:flex-row md:px-6">
          <p className="flex items-center gap-1.5">
            <span className="font-bold text-foreground">سیبک</span>
            — ساخته‌شده با
            <Heart className="size-3.5 fill-destructive text-destructive" aria-hidden />
            برای هم‌فکری بهتر
          </p>
          <RubikaBotButton variant="link" size="sm" label="@SibakBot" showSteps={false} />
        </div>
      </footer>

      {/* دیالوگ کامل قوانین */}
      <RulesDialog open={rulesOpen} onOpenChange={setRulesOpen} rules={rules} />
    </div>
  );
}
