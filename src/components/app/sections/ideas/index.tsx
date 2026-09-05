"use client";

import { motion } from "framer-motion";
import { Lightbulb } from "lucide-react";

import { IdeaList } from "@/components/app/sections/ideas/idea-list";

/**
 * سکشن ایده‌ها — ورودی #/ideas.
 * قابل توجه Task 3/4: این سکشن فقط IdeaList را رندر می‌کند، که خودش
 * شامل جستجو، تب‌ها، دیالوگ ساخت/ویرایش و دیالوگ جزئیات است.
 * برای استفاده در گروه‌ها: `<IdeaList groupId={group.id} heading={<h2/>} />`
 */
export default function IdeasSection() {
  return (
    <div className="flex flex-col gap-5">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="glass card-hover relative overflow-hidden rounded-3xl p-6 md:p-8"
        aria-label="ایده‌ها"
      >
        <div
          className="pointer-events-none absolute -top-16 -left-16 size-48 rounded-full bg-chart-1/15 blur-3xl"
          aria-hidden
        />
        <div className="flex items-start gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Lightbulb className="size-7" aria-hidden />
          </div>
          <div className="flex flex-col gap-1.5">
            <h1 className="text-2xl font-black md:text-3xl">ایده‌ها</h1>
            <p className="max-w-xl text-sm leading-7 text-muted-foreground">
              ثبت ایده‌های درسی، رأی‌گیری اعضا و پیگیری ایده از «در انتظار بررسی» تا
              «انجام‌شده». هر ایده می‌تواند به یک زیرمجموعه متصل باشد و با امتیاز
              هم‌افزایی شود.
            </p>
          </div>
        </div>
      </motion.div>

      <IdeaList />
    </div>
  );
}
