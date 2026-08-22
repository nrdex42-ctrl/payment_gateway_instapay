import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "InstaPay Gateway · Payment Infrastructure for Egypt",
  description:
    "Merchant payment gateway for InstaPay checkout sessions, automated payment confirmation, and secure webhook delivery.",
  keywords: [
    "InstaPay",
    "InstaPay Egypt",
    "Instant Payment Network",
    "payment gateway",
    "EGP",
  ],
  authors: [{ name: "InstaPay Gateway" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "InstaPay Gateway · Payment Infrastructure for Egypt",
    description:
      "Create checkout sessions, confirm InstaPay transfers, and receive secure merchant webhooks.",
    siteName: "InstaPay Gateway",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "InstaPay Gateway · Payment Infrastructure for Egypt",
    description:
      "Merchant payment gateway for InstaPay checkout sessions and automated payment confirmation.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
