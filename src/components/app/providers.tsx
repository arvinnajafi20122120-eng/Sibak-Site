"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useEffect } from "react";

import { useSession } from "@/store/session";

/**
 * Providers سیبک — ThemeProvider (next-themes) + QueryClientProvider (TanStack Query)
 * + بوت‌استرپ نشست (فراخوانی fetchSession هنگام بارگذاری).
 */

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  const fetchSession = useSession((s) => s.fetchSession);

  useEffect(() => {
    void fetchSession();
  }, [fetchSession]);

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
    >
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ThemeProvider>
  );
}
