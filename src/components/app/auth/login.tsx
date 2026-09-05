"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff, KeyRound, LogIn, UserRound } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/api-client";
import type { SafeUser } from "@/lib/types";
import { useSession } from "@/store/session";
import { useHashRoute } from "@/components/app/router";
import { SibakLogo } from "@/components/app/logo";
import { RubikaBotButton } from "@/components/app/auth/rubika-bot-button";
import { setAuthToken } from "@/lib/session-token";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * فرم ورود — کارت شیشه‌ای وسط‌چین.
 */
export function LoginView() {
  const { navigate } = useHashRoute();
  const fetchSession = useSession((s) => s.fetchSession);

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.post<{ user: SafeUser; token: string }>(
        "/api/auth/login",
        { identifier, password },
      );
      // ذخیره‌ی توکن در localStorage — ضروری برای iframe (preview panel)
      // که کوکی httpOnly در آن مسدود می‌شود.
      setAuthToken(res.token);
      await fetchSession();
      toast.success(`خوش آمدی ${res.user.name}! 🍏`);
      navigate("/home");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "خطا در ورود";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden px-4 py-10">
      {/* پس‌زمینه */}
      <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden>
        <div className="absolute inset-0 bg-background" />
        <div className="absolute -top-28 left-[10%] size-[24rem] animate-blob rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -bottom-24 right-[8%] size-[22rem] animate-blob rounded-full bg-chart-2/20 blur-3xl [animation-delay:-6s]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 22, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="glass w-full max-w-md rounded-3xl p-7 shadow-xl shadow-primary/5 md:p-9"
      >
        <div className="mb-7 flex flex-col items-center gap-3 text-center">
          <motion.div
            animate={{ y: [0, -7, 0] }}
            transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
          >
            <SibakLogo size={64} />
          </motion.div>
          <div>
            <h1 className="text-2xl font-black">ورود به سیبک</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              خوش برگشتی! باغ منتظر توست 🌱
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-2">
            <Label htmlFor="identifier">نام کاربری</Label>
            <div className="relative">
              <UserRound
                className="absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground"
                aria-hidden
              />
              <Input
                id="identifier"
                dir="ltr"
                className="h-11 rounded-xl ps-9 text-left"
                placeholder="نام کاربری"
                autoComplete="username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="password">رمز عبور</Label>
            <div className="relative">
              <KeyRound
                className="absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground"
                aria-hidden
              />
              <Input
                id="password"
                dir="ltr"
                type={showPassword ? "text" : "password"}
                className="h-11 rounded-xl ps-9 pe-10 text-left"
                placeholder="••••••••"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "پنهان‌کردن رمز" : "نمایش رمز"}
                className="absolute inset-y-0 end-2 my-auto flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground"
              >
                {showPassword ? (
                  <EyeOff className="size-4" aria-hidden />
                ) : (
                  <Eye className="size-4" aria-hidden />
                )}
              </button>
            </div>
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm font-semibold text-destructive"
            >
              {error}
            </p>
          )}

          <Button
            type="submit"
            size="lg"
            disabled={loading}
            className="mt-1 min-h-12 rounded-2xl text-base font-bold shadow-lg shadow-primary/25"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="size-4 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground" aria-hidden />
                در حال ورود…
              </span>
            ) : (
              <>
                <LogIn className="size-4" aria-hidden />
                ورود
              </>
            )}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          هنوز عضو نشده‌اید؟{" "}
          <button
            type="button"
            className="font-bold text-primary underline-offset-4 hover:underline"
            onClick={() => navigate("/register")}
          >
            ثبت‌نام کنید
          </button>
        </p>

        <div className="mt-4 flex items-center gap-3">
          <span className="h-px flex-1 bg-border/70" aria-hidden />
          <span className="text-[11px] text-muted-foreground">یا</span>
          <span className="h-px flex-1 bg-border/70" aria-hidden />
        </div>

        <div className="mt-3 flex justify-center">
          <RubikaBotButton variant="outline" className="w-full" />
        </div>

        <button
          type="button"
          onClick={() => navigate("")}
          className="mx-auto mt-4 block text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          ← بازگشت به صفحه اصلی
        </button>
      </motion.div>
    </div>
  );
}
