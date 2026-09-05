"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Ban,
  Hourglass,
  LogOut,
  PauseCircle,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

import type { SafeUser } from "@/lib/types";
import { useSession } from "@/store/session";
import { useHashRoute } from "@/components/app/router";
import { SibakLogo } from "@/components/app/logo";
import { RubikaBotButton } from "@/components/app/auth/rubika-bot-button";

import { Button } from "@/components/ui/button";

/**
 * دروازه وضعیت کاربر — PENDING / REJECTED / SUSPENDED.
 * هر ۳۰ ثانیه وضعیت به‌طور خودکار بررسی می‌شود.
 */
export function GateScreen() {
  const user = useSession((s) => s.user);
  const fetchSession = useSession((s) => s.fetchSession);
  const logout = useSession((s) => s.logout);
  const { navigate } = useHashRoute();
  const [checking, setChecking] = useState(false);

  // بررسی خودکار هر ۳۰ ثانیه
  useEffect(() => {
    const timer = setInterval(() => {
      void fetchSession();
    }, 30_000);
    return () => clearInterval(timer);
  }, [fetchSession]);

  if (!user) return null;

  async function recheck() {
    setChecking(true);
    try {
      await fetchSession();
      toast.success("وضعیت حساب شما دوباره بررسی شد");
    } catch {
      toast.error("بررسی مجدد ناموفق بود");
    } finally {
      setChecking(false);
    }
  }

  const isPending = user.status === "PENDING";
  const isRejected = user.status === "REJECTED";
  const isSuspended = user.status === "SUSPENDED";

  const config = isPending
    ? {
        icon: Hourglass,
        title: "در انتظار تایید ادمین",
        color: "text-chart-2",
        bg: "bg-chart-2/15",
        message:
          "درخواست عضویت شما ثبت شده و ادمین‌های سیبک در حال بررسی آن هستند. معمولاً این کار بیشتر از چند ساعت طول نمی‌کشد. این صفحه هر ۳۰ ثانیه خودکار به‌روزرسانی می‌شود.",
      }
    : isRejected
      ? {
          icon: Ban,
          title: "درخواست عضویت رد شد",
          color: "text-destructive",
          bg: "bg-destructive/10",
          message:
            "متاسفانه درخواست عضویت شما تایید نشده است. اگر فکر می‌کنید اشتباهی رخ داده، با ادمین سایت تماس بگیرید.",
        }
      : {
          icon: PauseCircle,
          title: "حساب شما موقتاً غیرفعال است",
          color: "text-chart-5",
          bg: "bg-chart-5/15",
          message:
            "حساب شما توسط ادمین موقتاً غیرفعال شده است. برای فعال‌سازی مجدد با ادمین سایت در ارتباط باشید.",
        };

  const Icon = config.icon;

  return (
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden>
        <div className="absolute inset-0 bg-background" />
        <div className="absolute -top-24 left-[12%] size-[22rem] animate-blob rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute -bottom-24 right-[10%] size-[22rem] animate-blob rounded-full bg-chart-2/15 blur-3xl [animation-delay:-6s]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 22, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45 }}
        className="glass w-full max-w-md rounded-3xl p-8 text-center shadow-xl shadow-primary/5"
      >
        {/* ساعت شنی انیمیشنی برای حالت انتظار */}
        {isPending ? (
          <motion.div
            animate={{ rotate: [0, 0, 180, 180, 360, 360] }}
            transition={{ duration: 4.5, repeat: Infinity, times: [0, 0.4, 0.5, 0.85, 0.9, 1], ease: "easeInOut" }}
            className={`mx-auto mb-5 flex size-20 w-fit items-center justify-center rounded-3xl ${config.bg} ${config.color}`}
          >
            <Icon className="size-10" aria-hidden />
          </motion.div>
        ) : (
          <div
            className={`mx-auto mb-5 flex size-20 w-fit items-center justify-center rounded-3xl ${config.bg} ${config.color}`}
          >
            <Icon className="size-10" aria-hidden />
          </div>
        )}

        <SibakLogo size={40} className="mx-auto mb-3 opacity-80" />
        <h1 className="text-2xl font-black">{config.title}</h1>

        <p className="mx-auto mt-3 max-w-sm text-sm leading-7 text-muted-foreground">
          {config.message}
        </p>

        <div className="mt-5 rounded-2xl border border-border/70 bg-background/50 p-4 text-right text-sm">
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="size-2 rounded-full bg-primary/60" aria-hidden />
            {user.name} — <span dir="ltr">@{user.username}</span>
          </p>
          {isPending && user.joinReason && (
            <p className="mt-2.5 leading-6 text-muted-foreground">
              <span className="font-bold text-foreground">دلیل عضویت شما: </span>
              {user.joinReason}
            </p>
          )}
          {isRejected && user.rejectionNote && (
            <p className="mt-2.5 rounded-xl bg-destructive/10 px-3 py-2 leading-6 text-destructive">
              <span className="font-bold">یادداشت ادمین: </span>
              {user.rejectionNote}
            </p>
          )}
        </div>

        <div className="mt-6 flex flex-col gap-2.5">
          {isPending && (
            <Button
              size="lg"
              className="min-h-12 rounded-2xl font-bold"
              onClick={recheck}
              disabled={checking}
            >
              <RefreshCw className={checking ? "size-4 animate-spin" : "size-4"} aria-hidden />
              {checking ? "در حال بررسی…" : "بررسی مجدد وضعیت"}
            </Button>
          )}
          {isPending && (
            <div className="mt-1 rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-3 text-xs leading-6 text-muted-foreground">
              <p>
                <span className="font-bold text-foreground">گام بعدی پس از تأیید:</span>{" "}
                اپ روبیکا را نصب کنید، وارد ربات{" "}
                <code dir="ltr" className="font-mono font-bold text-primary">@SibakBot</code>{" "}
                بشوید و <code dir="ltr" className="font-mono font-bold">/start</code> بزنید.
              </p>
            </div>
          )}
          {isPending && (
            <RubikaBotButton variant="outline" className="w-full" />
          )}
          <Button
            size="lg"
            variant="outline"
            className="min-h-12 rounded-2xl"
            onClick={async () => {
              await logout();
              navigate("/login");
            }}
          >
            <LogOut className="size-4" aria-hidden />
            خروج از حساب
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
