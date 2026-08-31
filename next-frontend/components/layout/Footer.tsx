import Link from "next/link";

const footerLinks = {
  shop: [
    { label: "All Products", href: "/shop" },
    { label: "Electronics", href: "/category/electronics" },
    { label: "Laptops", href: "/category/laptop" },
    { label: "Beauty & Personal Care", href: "/category/beauty-personal-care" },
    { label: "Bakery", href: "/category/bakery" },
  ],
  help: [
    { label: "Customer Service", href: "/contact" },
    { label: "Shipping Info", href: "/shipping-info" },
    { label: "Returns & Refunds", href: "/returns" },
    { label: "Contact Us", href: "/contact" },
  ],
  account: [
    { label: "Sign In", href: "/login" },
    { label: "Create Account", href: "/register" },
    { label: "Your Cart", href: "/cart" },
    { label: "Track Order", href: "/account/orders" },
  ],
};

export function Footer() {
  return (
    <footer className="mt-auto bg-[#131921] text-white">
      <div className="bg-[#37475a] py-3 text-center text-sm hover:bg-[#485769]">
        <a href="#top">Back to top</a>
      </div>

      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-3">
        <div>
          <h3 className="mb-3 font-semibold">Shop</h3>
          <ul className="space-y-2 text-sm text-zinc-300">
            {footerLinks.shop.map((link) => (
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
            {footerLinks.help.map((link) => (
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
            {footerLinks.account.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="hover:underline">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-zinc-700 py-6 text-center text-sm text-zinc-400">
        <p className="font-semibold text-white">
          next<span className="text-[#ff9900]">dor</span>
        </p>
        <p className="mt-1">Style, Convenience, and Comfort — Nextdor to You</p>
        <p className="mt-2">
          &copy; {new Date().getFullYear()} NextDor. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
