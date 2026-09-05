"use client";

import { motion } from "framer-motion";
import { ScrollText } from "lucide-react";

import type { SiteRule } from "@/lib/types";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

/**
 * دیالوگ مشترک قوانین سیبک — در صفحهٔ فرود و مرحلهٔ آخر ثبت‌نام استفاده می‌شود.
 * ظاهر با زبان طراحی لندینگ هماهنگ است: شیشه‌ای، گرد، سبز سیبی و با حرکت ملایم.
 */
export function RulesDialog({
  open,
  onOpenChange,
  rules,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  rules: SiteRule[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-3xl p-6">
        <DialogHeader className="text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="mx-auto mb-3 flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary"
          >
            <ScrollText className="size-8" aria-hidden />
          </motion.div>
          <DialogTitle className="text-xl font-black">قوانین باغ سیبک</DialogTitle>
          <DialogDescription className="text-sm leading-7 text-muted-foreground">
            با ثبت‌نام و حضور در سیبک، این قوانین را می‌پذیرید. کوتاه خواندنی‌اند 🍎
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[52vh] rounded-2xl">
          <ol className="flex flex-col gap-3 pe-3">
            {rules.map((r, i) => (
              <motion.li
                key={`${i}-${r.title}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * i, duration: 0.25 }}
                className="rounded-2xl border border-border/60 bg-background/60 p-3.5"
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-black text-primary-foreground">
                    {i + 1}
                  </span>
                  <p className="text-sm font-bold">{r.title}</p>
                </div>
                <p className="mt-1.5 ps-8.5 text-xs leading-6 text-muted-foreground">
                  {r.body}
                </p>
              </motion.li>
            ))}
          </ol>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
