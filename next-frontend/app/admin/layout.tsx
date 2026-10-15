import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Super Admin Command | Nextdor",
    template: "%s | Super Admin — Nextdor",
  },
  icons: {
    icon: "/arrow-loader.png",
    shortcut: "/arrow-loader.png",
    apple: "/arrow-loader.png",
  },
};

// app/admin/layout.tsx
// This layout wraps all /admin/* pages. StoreLayout is bypassed by middleware
// for admin routes, so this renders cleanly inside the root html/body.
export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
