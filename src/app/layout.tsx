import type { Metadata, Viewport } from "next";
import "vazirmatn/Vazirmatn-Variable-font-face.css";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { Providers } from "@/components/app/providers";

export const metadata: Metadata = {
  title: "سیبک | بستر همکاری درسی",
  description:
    "سیبک — پلتفرم همکاری درسی فارسی: زیرمجموعه‌ها، ایده‌پردازی، نظرسنجی و وتو، بدهکاری مودبانه، تقویم شمسی و پرونده شفاف. با هم بهتر یاد می‌گیریم.",
  keywords: ["سیبک", "همکاری درسی", "LMS", "فارسی", "زیرمجموعه", "نظرسنجی"],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4faf4" },
    { media: "(prefers-color-scheme: dark)", color: "#171d19" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body className="min-h-svh bg-background font-sans antialiased text-foreground">
        <Providers>
          {children}
          <Toaster />
          <SonnerToaster position="top-center" richColors closeButton />
        </Providers>
      </body>
    </html>
  );
}
