"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Bot, Check, ExternalLink, Send } from "lucide-react";

import { cn } from "@/lib/utils";
import { useSession } from "@/store/session";
import { Button, type ButtonProps } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * دکمهٔ ربات روبیکا سیبک — با تأیید کاربر، لینک ربات را در تب جدید باز می‌کند.
 * یوزرنیم ربات از تنظیمات سایت (rubikaBot) خوانده می‌شود، پیش‌فرض SibakBot.
 *
 * مراحل راهنما برای کاربر:
 * ۱. نصب اپ روبیکا
 * ۲. ورود به اپ
 * ۳. باز کردن ربات @SibakBot
 * ۴. زدن /start
 */
const RUBIKA_BASE = "https://rubika.ir";

export interface RubikaBotButtonProps {
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
  label?: string;
  showSteps?: boolean;
}

export function RubikaBotButton({
  variant = "outline",
  size = "default",
  className,
  label = "ربات روبیکا",
  showSteps = true,
}: RubikaBotButtonProps) {
  const settings = useSession((s) => s.settings);
  const [open, setOpen] = useState(false);

  const bot = (settings?.rubikaBot || "SibakBot").replace(/^@/, "");
  const url = `${RUBIKA_BASE}/${bot}`;

  function handleConfirm() {
    setOpen(false);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={cn(
          "gap-2 rounded-2xl font-bold",
          variant === "default" && "shadow-lg shadow-primary/20",
          className,
        )}
        onClick={() => setOpen(true)}
      >
        <Bot className="size-4" aria-hidden />
        {label}
        <ExternalLink className="size-3.5 opacity-70" aria-hidden />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader className="text-center">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="mx-auto mb-3 flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary"
            >
              <Bot className="size-8" aria-hidden />
            </motion.div>
            <DialogTitle className="text-xl font-black">
              ورود به ربات روبیکا
            </DialogTitle>
            <DialogDescription className="text-sm leading-7 text-muted-foreground">
              شما در حال خروج از سایت و رفتن به ربات روبیکا هستید. برای ادامه:
            </DialogDescription>
          </DialogHeader>

          {showSteps && (
            <ol className="my-2 space-y-2.5">
              {[
                {
                  t: "نصب روبیکا",
                  d: "ابتدا اپلیکیشن روبیکا را روی گوشی خود نصب کنید.",
                },
                {
                  t: "ورود به اپ",
                  d: "با شمارهٔ موبایل خود وارد روبیکا شوید.",
                },
                {
                  t: "باز کردن ربات",
                  d: (
                    <>
                      روی لینک بزنید تا ربات{" "}
                      <code dir="ltr" className="font-mono font-bold text-primary">
                        @{bot}
                      </code>{" "}
                      باز شود.
                    </>
                  ),
                },
                {
                  t: "زدن /start",
                  d: "دکمهٔ شروع یا فرمان /start را بزنید تا عضو ربات شوید.",
                },
              ].map((s, i) => (
                <motion.li
                  key={s.t}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.06 * i, duration: 0.25 }}
                  className="flex items-start gap-3 rounded-2xl border border-border/60 bg-background/50 p-3"
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-black text-primary-foreground">
                    {i + 1}
                  </span>
                  <div className="flex-1 text-sm">
                    <p className="font-bold">{s.t}</p>
                    <p className="mt-0.5 text-xs leading-6 text-muted-foreground">
                      {s.d}
                    </p>
                  </div>
                </motion.li>
              ))}
            </ol>
          )}

          <div className="rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-3 text-xs leading-6 text-muted-foreground">
            <p>
              <span className="font-bold text-foreground">نکته:</span> عضویت در ربات
              روبیکا پس از تأیید ادمین در سایت انجام می‌شود؛ اگر هنوز عضویت شما
              تأیید نشده، منتظر بمانید.
            </p>
          </div>

          <DialogFooter className="mt-2 flex-row gap-2 sm:gap-2">
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 flex-1 rounded-xl"
              onClick={() => setOpen(false)}
            >
              انصراف
            </Button>
            <Button
              type="button"
              size="lg"
              className="min-h-11 flex-1 gap-2 rounded-xl font-bold shadow-lg shadow-primary/25"
              onClick={handleConfirm}
            >
              <Send className="size-4" aria-hidden />
              بزن بریم
              <Check className="size-4" aria-hidden />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
