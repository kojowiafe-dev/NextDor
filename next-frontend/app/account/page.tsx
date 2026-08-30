import Link from "next/link";

export const metadata = {
  title: "Account",
};

export default function AccountPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      <div className="mx-auto max-w-md rounded-lg bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-semibold text-zinc-900">Your Account</h1>
        <p className="mt-4 text-zinc-500">
          Sign in and account features are coming soon with the new backend.
        </p>
        <Link
          href="/shop"
          className="mt-6 inline-block rounded-lg bg-[#ff9900] px-6 py-3 text-sm font-semibold text-zinc-900 hover:bg-[#f08804]"
        >
          Continue Shopping
        </Link>
      </div>
    </div>
  );
}
