import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { getAppBaseUrl } from "@/lib/appUrl";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const DESCRIPTION = "See which leads and quotations are at risk before revenue is lost.";

export const metadata: Metadata = {
  metadataBase: new URL(getAppBaseUrl()),
  title: {
    default: "SalesLeak — Sales Leakage Prevention",
    template: "%s | SalesLeak",
  },
  description: DESCRIPTION,
  openGraph: {
    title: "SalesLeak",
    description: DESCRIPTION,
    siteName: "SalesLeak by NobleArc",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full bg-slate-50">{children}</body>
    </html>
  );
}
