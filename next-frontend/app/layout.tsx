import { Suspense } from "react";
import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import StoreLayout from "@/components/layout/StoreLayout";
import { NavigationProgressBar } from "@/components/ui/NavigationProgressBar";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Nextdor — Style, Convenience, and Comfort",
    template: "%s | Nextdor",
  },
  description:
    "Shop electronics, laptops, beauty, bakery and more at Nextdor. Quality products delivered across Ghana.",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${outfit.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">
        <Suspense fallback={null}>
          <NavigationProgressBar />
        </Suspense>
        <StoreLayout>{children}</StoreLayout>
      </body>
    </html>
  );
}
