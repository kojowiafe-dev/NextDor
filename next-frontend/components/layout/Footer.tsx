"use client";

import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";

const shopLinks = [
  { label: "All Products", href: "/shop" },
  { label: "Electronics", href: "/category/electronics" },
  { label: "Laptops", href: "/category/laptop" },
  { label: "Beauty & Personal Care", href: "/category/beauty-personal-care" },
  { label: "Bakery", href: "/category/bakery" },
];

const helpLinks = [
  { label: "Customer Service", href: "/contact" },
  { label: "Shipping Info", href: "/shipping-info" },
  { label: "Returns & Refunds", href: "/returns" },
  { label: "Contact Us", href: "/contact" },
];

export function Footer() {
  const { isAuthenticated, isAdmin, isVendor, logout } = useAuth();

  return (
    <footer className="mt-auto bg-[#131921] text-white">
      <div className="bg-[#37475a] py-3 text-center text-sm hover:bg-[#485769]">
        <a href="#top">Back to top</a>
      </div>

      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-3">
        <div>
          <h3 className="mb-3 font-semibold">Shop</h3>
          <ul className="space-y-2 text-sm text-zinc-300">
            {shopLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="hover:underline">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="mb-3 font-semibold">Help</h3>
          <ul className="space-y-2 text-sm text-zinc-300">
            {helpLinks.map((link) => (
              <li key={link.label}>
                <Link href={link.href} className="hover:underline">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="mb-3 font-semibold">Account</h3>
          <ul className="space-y-2 text-sm text-zinc-300">
            {isAuthenticated ? (
              <>
                <li>
                  <Link href="/account" className="hover:underline">
                    Your Account
                  </Link>
                </li>
                <li>
                  <Link href="/account/orders" className="hover:underline">
                    Your Orders
                  </Link>
                </li>
                <li>
                  <Link href="/account/wishlist" className="hover:underline">
                    Wishlist
                  </Link>
                </li>
                {isAdmin && (
                  <li>
                    <Link href="/admin" className="font-medium text-[#ff9900] hover:underline">
                      Admin Portal
                    </Link>
                  </li>
                )}
                {isVendor && (
                  <li>
                    <Link href="/vendor/dashboard" className="font-medium text-purple-400 hover:underline">
                      Vendor Dashboard
                    </Link>
                  </li>
                )}
                <li>
                  <Link href="/cart" className="hover:underline">
                    Your Cart
                  </Link>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => logout()}
                    className="text-left text-zinc-400 hover:text-white hover:underline transition"
                  >
                    Sign Out
                  </button>
                </li>
              </>
            ) : (
              <>
                <li>
                  <Link href="/login" className="hover:underline">
                    Sign In
                  </Link>
                </li>
                <li>
                  <Link href="/register" className="hover:underline">
                    Create Account
                  </Link>
                </li>
                <li>
                  <Link href="/cart" className="hover:underline">
                    Your Cart
                  </Link>
                </li>
                <li>
                  <Link href="/account/orders" className="hover:underline">
                    Track Order
                  </Link>
                </li>
                <li>
                  <Link href="/vendor/register" className="font-medium text-purple-400 hover:underline">
                    Sell on Nextdor
                  </Link>
                </li>
              </>
            )}
          </ul>
        </div>
      </div>

      <div className="border-t border-zinc-700 py-6 text-center text-sm text-zinc-400">
        <div className="flex justify-center mb-3">
          <Link href="/" className="inline-block transition hover:opacity-90">
            <Image
              src="/logo.png"
              alt="NextDor"
              width={140}
              height={38}
              className="h-8 w-auto object-contain mx-auto"
            />
          </Link>
        </div>
        <p className="mt-1">Shop More, Wait Less</p>
        <p className="mt-2">
          &copy; {new Date().getFullYear()} Nextdor. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
