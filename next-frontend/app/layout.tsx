import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import StoreLayout from "@/components/layout/StoreLayout";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "NextDor — Style, Convenience, and Comfort",
    template: "%s | NextDor",
  },
  description:
    "Shop electronics, laptops, beauty, bakery and more at NextDor. Quality products delivered across Ghana.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <StoreLayout>{children}</StoreLayout>
      </body>
    </html>
  );
}
