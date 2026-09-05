"use client";

import { motion } from "framer-motion";
import { Users } from "lucide-react";

import { cn } from "@/lib/utils";
import { relativeTime, toFa } from "@/lib/jalali";
import { RARITY_CLASSES, RARITY_LABELS, type MedalDTO } from "@/lib/medals";
import { SafeAvatar } from "@/components/app/sections/_shared/safe-avatar";
import { Badge } from "@/components/ui/badge";

import { MedalImage } from "./medal-image";

/**
 * کارت مدال در کتابخانه — کلیک → جزئیات و دارندگان.
 */
export function MedalCard({
  medal,
  index,
  onOpen,
}: {
  medal: MedalDTO;
  index: number;
  onOpen: (medal: MedalDTO) => void;
}) {
  const limited = medal.maxCount !== null;
  const soldOut = limited && medal.remaining === 0;

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(0.04 * index, 0.3), duration: 0.25 }}
      onClick={() => onOpen(medal)}
      className={cn(
        "glass card-hover group flex flex-col items-center gap-3 rounded-3xl p-4 text-center",
        medal.earned && "border-primary/40 ring-1 ring-primary/25",
        soldOut && "opacity-75",
      )}
      aria-label={`مدال ${medal.name}`}
    >
      {/* ردیف بالای کارت */}
      <div className="flex w-full items-center justify-between gap-2">
        <Badge variant="outline" className={cn("text-[10px]", RARITY_CLASSES[medal.rarity])}>
          {RARITY_LABELS[medal.rarity]}
        </Badge>
        {medal.points > 0 && (
          <span className="rounded-full bg-chart-2/15 px-2 py-0.5 text-[10px] font-black text-accent-foreground">
            +{toFa(medal.points)} امتیاز
          </span>
        )}
      </div>

      {/* عکس مدال */}
      <MedalImage
        src={medal.imageUrl}
        alt={medal.name}
        className={cn(
          "size-24 rounded-2xl border border-border/50 bg-background/40 p-1.5 transition-transform duration-300 group-hover:scale-105",
          soldOut && "grayscale",
        )}
      />

      {/* نام و توضیح */}
      <div className="flex w-full flex-col gap-1">
        <span className="flex items-center justify-center gap-1.5 text-sm font-black">
          {medal.name}
          {medal.earned && (
            <span className="rounded-full bg-primary px-1.5 py-px text-[9px] font-black text-primary-foreground">
              دارمش
            </span>
          )}
        </span>
        <p className="line-clamp-2 text-[11px] leading-5 text-muted-foreground">
          {medal.description}
        </p>
      </div>

      {/* دارندگان */}
      <div className="mt-auto flex w-full items-center justify-between border-t border-border/40 pt-2.5">
        <span className="flex items-center gap-1 text-[11px] font-bold text-muted-foreground">
          <Users className="size-3" aria-hidden />
          {toFa(medal.holdersCount)} دارنده
          {limited && (
            <span className="font-normal">
              {" "}از {toFa(medal.maxCount!)}
            </span>
          )}
        </span>
        <div className="flex -space-x-2" dir="ltr">
          {medal.holders.slice(0, 4).map((h) => (
            <span key={h.id} title={`${h.name} — از ${relativeTime(new Date(h.awardedAt))}`}>
              <SafeAvatar
                user={{ id: h.id, name: h.name, username: h.username, avatar: h.avatar }}
                className="size-6 border-2 border-background"
              />
            </span>
          ))}
          {medal.holdersCount > 4 && (
            <span className="flex size-6 items-center justify-center rounded-full border-2 border-background bg-muted text-[9px] font-black text-muted-foreground">
              +{toFa(medal.holdersCount - 4)}
            </span>
          )}
        </div>
      </div>
    </motion.button>
  );
}
