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
