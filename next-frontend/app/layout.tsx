import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import StoreLayout from "@/components/layout/StoreLayout";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
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
    <html lang="en" className={`${outfit.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">
        <StoreLayout>{children}</StoreLayout>
      </body>
    </html>
  );
}
