"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AtSign,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Eye,
  EyeOff,
  KeyRound,
  ScrollText,
  Sparkles,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { api } from "@/lib/api-client";
import type { SafeUser } from "@/lib/types";
import { useSession } from "@/store/session";
import { useHashRoute } from "@/components/app/router";
import { SibakLogo } from "@/components/app/logo";
import { RubikaBotButton } from "@/components/app/auth/rubika-bot-button";
import { RulesDialog } from "@/components/app/auth/rules-dialog";
import { setAuthToken } from "@/lib/session-token";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";

const AVATARS = ["🍏", "🍎", "🌱", "🌿", "🍀", "📚", "✏️", "🧮", "🔭", "🎨", "🧠", "⭐"];

const STEPS = ["اطلاعات پایه", "انگیزه و مهارت", "آواتار و تایید"] as const;

const MIN_TEXT = 20;

/**
 * ثبت‌نام سه‌مرحله‌ای سیبک.
 */
export function RegisterView() {
  const { navigate } = useHashRoute();
  const fetchSession = useSession((s) => s.fetchSession);
  const rules = useSession((s) => s.settings?.siteRules) ?? [];

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<SafeUser | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);

  // مرحله ۱
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // مرحله ۲
  const [joinReason, setJoinReason] = useState("");
  const [skills, setSkills] = useState("");

  // مرحله ۳
  const [avatar, setAvatar] = useState(AVATARS[0]);

  const step1Valid =
    name.trim().length >= 2 &&
    /^[a-zA-Z0-9_]{3,20}$/.test(username) &&
    password.length >= 6;
  const step2Valid =
    joinReason.trim().length >= MIN_TEXT && skills.trim().length >= MIN_TEXT;

  async function handleSubmit() {
    setLoading(true);
    try {
      const res = await api.post<{ user: SafeUser; token: string }>(
        "/api/auth/register",
        {
          name,
          username,
          password,
          joinReason,
          skills,
          avatar,
          acceptedRules: accepted,
        },
      );
      // ذخیره‌ی توکن در localStorage — ضروری برای iframe (preview panel).
      setAuthToken(res.token);
      await fetchSession();
      setDone(res.user);
      toast.success("درخواست عضویت شما ثبت شد 🍎");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا در ثبت‌نام");
    } finally {
      setLoading(false);
    }
  }

  /* ---------- صفحه موفقیت (در انتظار تایید) ---------- */
  if (done) {
    return (
      <div className="relative flex min-h-svh items-center justify-center overflow-hidden px-4 py-10">
        <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden>
          <div className="absolute inset-0 bg-background" />
          <div className="absolute -top-28 left-[15%] size-[22rem] animate-blob rounded-full bg-primary/20 blur-3xl" />
        </div>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass w-full max-w-md rounded-3xl p-8 text-center"
        >
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="mx-auto mb-4 w-fit"
          >
            <SibakLogo size={72} />
          </motion.div>
          <h1 className="text-2xl font-black">درخواست شما ثبت شد 🍎</h1>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            درخواست عضویت <b>{done.name}</b> ثبت شد و در انتظار تایید ادمین است.
            به‌محض تایید، می‌توانید وارد فضای همکاری سیبک شوید.
          </p>
          <div className="mt-5 rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-3 text-xs leading-6 text-muted-foreground">
            <p>
              <span className="font-bold text-foreground">گام بعدی:</span> پس از
              تأیید عضویت، اپ روبیکا را نصب کنید و وارد ربات{" "}
              <code dir="ltr" className="font-mono font-bold text-primary">@SibakBot</code>{" "}
              شوید و <code dir="ltr" className="font-mono font-bold">/start</code> بزنید.
            </p>
          </div>
          <div className="mt-5 flex flex-col gap-2">
            <RubikaBotButton variant="outline" className="w-full" />
            <Button
              size="lg"
              className="min-h-12 rounded-2xl font-bold"
              onClick={() => navigate("/login")}
            >
              رفتن به صفحه ورود
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  /* ---------- فرم چندمرحله‌ای ---------- */
  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden>
        <div className="absolute inset-0 bg-background" />
        <div className="absolute -top-24 right-[12%] size-[22rem] animate-blob rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -bottom-24 left-[8%] size-[22rem] animate-blob rounded-full bg-chart-2/20 blur-3xl [animation-delay:-6s]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="glass w-full max-w-lg rounded-3xl p-6 shadow-xl shadow-primary/5 md:p-8"
      >
        {/* سربرگ */}
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <SibakLogo size={52} />
          <h1 className="text-2xl font-black">عضویت در سیبک</h1>
          <p className="text-sm text-muted-foreground">
            سه قدم تا ورود به باغ همکاری 🌱
          </p>
        </div>

        {/* نوار پیشرفت */}
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between text-xs font-semibold">
            <span className="text-primary">
              مرحله {step + 1} از ۳ — {STEPS[step]}
            </span>
            <span className="text-muted-foreground">{Math.round(((step + 1) / 3) * 100)}٪</span>
          </div>
          <Progress value={((step + 1) / 3) * 100} className="h-2 rounded-full" />
        </div>

        <AnimatePresence mode="wait">
          {/* مرحله ۱: اطلاعات */}
          {step === 0 && (
            <motion.div
              key="step-1"
              initial={{ opacity: 0, x: -24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col gap-4"
            >
              <Field id="name" label="نام و نام خانوادگی" icon={UserRound}>
                <Input
                  id="name"
                  className="h-11 rounded-xl ps-9"
                  placeholder="مثلاً سارا محمدی"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
              <Field id="username" label="نام کاربری (انگلیسی)" icon={AtSign} ltr>
                <Input
                  id="username"
                  dir="ltr"
                  className="h-11 rounded-xl ps-9 text-left"
                  placeholder="sara_m"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </Field>
              <Field id="password" label="رمز عبور (حداقل ۶ کاراکتر)" icon={KeyRound} ltr>
                <div className="relative">
                  <Input
                    id="password"
                    dir="ltr"
                    type={showPassword ? "text" : "password"}
                    className="h-11 rounded-xl ps-9 pe-10 text-left"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "پنهان‌کردن رمز" : "نمایش رمز"}
                    className="absolute inset-y-0 end-2 my-auto flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? (
                      <EyeOff className="size-4" aria-hidden />
                    ) : (
                      <Eye className="size-4" aria-hidden />
                    )}
                  </button>
                </div>
              </Field>
            </motion.div>
          )}

          {/* مرحله ۲: انگیزه */}
          {step === 1 && (
            <motion.div
              key="step-2"
              initial={{ opacity: 0, x: -24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col gap-5"
            >
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="joinReason" className="gap-1.5">
                    <ClipboardList className="size-3.5 text-primary" aria-hidden />
                    چرا می‌خواهی عضو سیبک شوی؟
                  </Label>
                  <CharCounter value={joinReason} min={MIN_TEXT} />
                </div>
                <Textarea
                  id="joinReason"
                  className="min-h-28 rounded-xl leading-7"
                  placeholder="دلیل عضویتت را صادقانه بنویس؛ ادمین‌ها این را می‌خوانند…"
                  value={joinReason}
                  onChange={(e) => setJoinReason(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="skills" className="gap-1.5">
                    <Sparkles className="size-3.5 text-chart-2" aria-hidden />
                    چه کارهایی می‌توانی انجام دهی؟
                  </Label>
                  <CharCounter value={skills} min={MIN_TEXT} />
                </div>
                <Textarea
                  id="skills"
                  className="min-h-28 rounded-xl leading-7"
                  placeholder="مثلاً: خلاصه‌نویسی فیزیک، سازمان‌دهی جلسات، طراحی پوستر…"
                  value={skills}
                  onChange={(e) => setSkills(e.target.value)}
                />
              </div>
            </motion.div>
          )}

          {/* مرحله ۳: آواتار و تایید */}
          {step === 2 && (
            <motion.div
              key="step-3"
              initial={{ opacity: 0, x: -24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col gap-5"
            >
              <div className="flex flex-col gap-2.5">
                <Label>آواتارت را انتخاب کن</Label>
                <div className="grid grid-cols-6 gap-2">
                  {AVATARS.map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => setAvatar(a)}
                      aria-label={`انتخاب آواتار ${a}`}
                      aria-pressed={avatar === a}
                      className={cn(
                        "flex aspect-square items-center justify-center rounded-xl border text-2xl transition-all",
                        avatar === a
                          ? "scale-105 border-primary bg-primary/10 shadow-md shadow-primary/20"
                          : "border-border bg-background/60 hover:border-primary/40 hover:bg-accent/40",
                      )}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4">
                <div className="flex items-center justify-between gap-2">
                  <Label className="gap-1.5 text-sm">
                    <ScrollText className="size-3.5 text-primary" aria-hidden />
                    پذیرش قوانین
                  </Label>
                  <button
                    type="button"
                    onClick={() => setRulesOpen(true)}
                    className="text-xs font-bold text-primary underline-offset-4 hover:underline"
                  >
                    مشاهدهٔ قوانین
                  </button>
                </div>
                <label className="mt-3 flex cursor-pointer items-start gap-2.5">
                  <Checkbox
                    checked={accepted}
                    onCheckedChange={(v) => setAccepted(v === true)}
                    aria-label="پذیرش قوانین سیبک"
                    className="mt-0.5"
                  />
                  <span className="text-sm font-semibold leading-6">
                    قوانین سیبک را خواندم و می‌پذیرم
                  </span>
                </label>
                {!accepted && (
                  <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
                    برای ثبت نهایی درخواست، پذیرش قوانین لازم است.
                  </p>
                )}
              </div>

              <div className="rounded-2xl border border-border/70 bg-background/50 p-4 text-sm leading-7">
                <p className="mb-2 font-bold">خلاصه اطلاعات شما:</p>
                <ul className="space-y-1 text-muted-foreground">
                  <li>👤 {name} — <span dir="ltr">@{username}</span></li>
                  <li className="flex items-start gap-1.5">
                    💬 <span className="line-clamp-2">{joinReason}</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    ✨ <span className="line-clamp-2">{skills}</span>
                  </li>
                </ul>
                <p className="mt-3 rounded-xl bg-accent/50 px-3 py-2 text-xs font-semibold text-accent-foreground">
                  پس از ثبت، درخواست شما برای تایید به ادمین‌ها ارسال می‌شود.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* دکمه‌ها */}
        <div className="mt-7 flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 rounded-xl"
            onClick={() => (step === 0 ? navigate("") : setStep(step - 1))}
          >
            <ChevronRight className="size-4" aria-hidden />
            {step === 0 ? "انصراف" : "قبلی"}
          </Button>

          {step < 2 ? (
            <Button
              type="button"
              size="lg"
              className="min-h-11 rounded-2xl font-bold"
              disabled={(step === 0 && !step1Valid) || (step === 1 && !step2Valid)}
              onClick={() => setStep(step + 1)}
            >
              مرحله بعد
              <ChevronLeft className="size-4" aria-hidden />
            </Button>
          ) : (
            <Button
              type="button"
              size="lg"
              className="min-h-11 rounded-2xl font-bold shadow-lg shadow-primary/25"
              disabled={loading || !accepted}
              onClick={handleSubmit}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="size-4 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground" aria-hidden />
                  در حال ثبت…
                </span>
              ) : (
                <>
                  <Check className="size-4" aria-hidden />
                  ثبت درخواست عضویت
                </>
              )}
            </Button>
          )}
        </div>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          قبلاً ثبت‌نام کرده‌اید؟{" "}
          <button
            type="button"
            className="font-bold text-primary underline-offset-4 hover:underline"
            onClick={() => navigate("/login")}
          >
            وارد شوید
          </button>
        </p>
      </motion.div>

      {/* دیالوگ قوانین */}
      <RulesDialog open={rulesOpen} onOpenChange={setRulesOpen} rules={rules} />
    </div>
  );
}

function Field({
  id,
  label,
  icon: Icon,
  ltr,
  children,
}: {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  ltr?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Icon
          className={cn(
            "absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground",
            ltr && "start-3",
          )}
          aria-hidden
        />
        {children}
      </div>
    </div>
  );
}

function CharCounter({ value, min }: { value: string; min: number }) {
  const len = value.trim().length;
  const ok = len >= min;
  return (
    <span
      className={cn(
        "text-[11px] font-bold tabular-nums",
        ok ? "text-primary" : "text-muted-foreground",
      )}
    >
      {len}/{min}+
    </span>
  );
}
