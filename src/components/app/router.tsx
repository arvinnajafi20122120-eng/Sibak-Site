"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * هش‌روتر سیبک — ناوبری SPA فقط با hash.
 * `#/polls/abc` → segments: ['polls', 'abc']
 */

function parseHash(hash: string): string[] {
  const clean = hash.replace(/^#\/?/, "").trim();
  if (!clean) return [];
  return clean.split("/").filter(Boolean).map(decodeURIComponent);
}

export interface HashRoute {
  segments: string[];
  path: string;
  navigate: (path: string) => void;
  back: () => void;
}

export function useHashRoute(): HashRoute {
  const [segments, setSegments] = useState<string[]>(() =>
    typeof window === "undefined" ? [] : parseHash(window.location.hash),
  );

  useEffect(() => {
    const onChange = () => setSegments(parseHash(window.location.hash));
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  const navigate = useCallback((path: string) => {
    const clean = path.replace(/^#?\/?/, "");
    const target = `#/${clean}`;
    if (window.location.hash === target) {
      // حتی وقتی هش یکسان است، وضعیت را همگام می‌کنیم
      setSegments(parseHash(target));
    } else {
      window.location.hash = target;
    }
  }, []);

  const back = useCallback(() => {
    window.history.back();
  }, []);

  return { segments, path: `/${segments.join("/")}`, navigate, back };
}
