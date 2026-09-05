"use client";

import { useEffect, useRef, useState } from "react";

/**
 * انیمیشن شمارش‌به‌بالا — برای عدد بزرگ موجودی وتو.
 * از requestAnimationFrame استفاده می‌کند و prefers-reduced-motion را محترم می‌شمارد.
 */
export function CountUp({
  value,
  duration = 900,
  className,
}: {
  value: number;
  duration?: number;
  className?: string;
}) {
  const [display, setDisplay] = useState(value);
  const rafRef = useRef<number | null>(null);
  const lastValueRef = useRef(value);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    /* eslint-disable react-hooks/set-state-in-effect */
    if (reduce) {
      setDisplay(value);
      lastValueRef.current = value;
      return;
    }
    /* eslint-enable react-hooks/set-state-in-effect */

    const from = lastValueRef.current;
    const delta = value - from;
    if (delta === 0) return;

    const start = performance.now();

    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      const current = Math.round(from + delta * eased);
      setDisplay(current);
      lastValueRef.current = current;
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        setDisplay(value);
        lastValueRef.current = value;
      }
    };

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration]);

  return <span className={className}>{toFaDigits(display)}</span>;
}

function toFaDigits(n: number): string {
  return String(n).replace(/[0-9]/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
}
