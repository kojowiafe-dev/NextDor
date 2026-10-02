"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LayoutGrid, Search, ShoppingCart, User } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";

export function BottomNav() {
  const pathname = usePathname();
  const { itemCount } = useCart();
  const { user, isAuthenticated } = useAuth();

  // Hide bottom navigation on checkout to provide a distraction-free checkout experience
  if (pathname.startsWith("/checkout")) {
    return null;
  }

  const isHome = pathname === "/";
  const isShop = pathname.startsWith("/shop") || pathname.startsWith("/category");
  const isSearch = pathname.startsWith("/search");
  const isCart = pathname === "/cart";
  const isAccount = pathname.startsWith("/account") || pathname === "/login" || pathname === "/register";

  const firstName = user?.name ? user.name.split(" ")[0] : "Account";

  const navItems = [
    {
      id: "home",
      label: "Home",
      href: "/",
      icon: Home,
      active: isHome,
    },
    {
      id: "shop",
      label: "Shop",
      href: "/shop",
      icon: LayoutGrid,
      active: isShop,
    },
    {
      id: "search",
      label: "Search",
      href: "/search",
      icon: Search,
      active: isSearch,
    },
    {
      id: "cart",
      label: "Cart",
      href: "/cart",
      icon: ShoppingCart,
      active: isCart,
      badge: itemCount > 0 ? (itemCount > 99 ? "99+" : itemCount) : null,
    },
    {
      id: "account",
      label: isAuthenticated ? firstName : "Sign In",
      href: isAuthenticated ? "/account" : "/login",
      icon: User,
      active: isAccount,
    },
  ];

  return (
    <nav
      aria-label="Mobile Navigation"
      className="fixed bottom-0 inset-x-0 z-40 block md:hidden bg-[#131921]/95 backdrop-blur-md border-t border-white/10 shadow-[0_-4px_20px_rgba(0,0,0,0.25)] pb-[env(safe-area-inset-bottom)]"
    >
      <div className="flex h-15 items-center justify-around px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.active;

          return (
            <Link
              key={item.id}
              href={item.href}
              className={`relative flex flex-1 flex-col items-center justify-center py-1 transition-all duration-150 select-none ${
                isActive
                  ? "text-[#ff9900]"
                  : "text-zinc-400 hover:text-zinc-200 active:scale-95"
              }`}
            >
              <div className="relative">
                <Icon className={`h-5 w-5 transition-transform ${isActive ? "scale-110" : ""}`} />
                {item.badge !== null && item.badge !== undefined && (
                  <span className="absolute -top-1.5 -right-2.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#ff9900] px-1 text-[10px] font-extrabold text-[#131921] shadow-sm animate-pulse">
                    {item.badge}
                  </span>
                )}
              </div>
              <span
                className={`mt-1 text-[10px] tracking-tight leading-none ${
                  isActive ? "font-bold text-[#ff9900]" : "font-medium"
                }`}
              >
                {item.label}
              </span>
              {isActive && (
                <span className="absolute bottom-0 h-0.5 w-6 rounded-full bg-[#ff9900]" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
