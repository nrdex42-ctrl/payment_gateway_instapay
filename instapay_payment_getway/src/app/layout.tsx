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
  title: "InstaPay Egypt · Sandbox Payment Gateway",
  description:
    "Sandbox payment gateway that simulates InstaPay Egypt instant transfers and renders the success push notification in your browser. Demo only — no real money moves.",
  keywords: [
    "InstaPay",
    "InstaPay Egypt",
    "Instant Payment Network",
    "payment gateway",
    "sandbox",
    "demo",
    "EGP",
  ],
  authors: [{ name: "InstaPay Sandbox" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "InstaPay Egypt · Sandbox Payment Gateway",
    description:
      "Simulate InstaPay Egypt instant transfers and view the success notification. Demo only.",
    siteName: "InstaPay Sandbox",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "InstaPay Egypt · Sandbox Payment Gateway",
    description:
      "Simulate InstaPay Egypt instant transfers and view the success notification. Demo only.",
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
