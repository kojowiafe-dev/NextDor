import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-16 text-center">
      <h1 className="text-4xl font-bold text-zinc-900">404</h1>
      <p className="mt-4 text-zinc-500">The page you are looking for does not exist.</p>
      <Link
        href="/"
        className="mt-6 inline-block rounded-lg bg-[#ff9900] px-6 py-3 text-sm font-semibold text-zinc-900 hover:bg-[#f08804]"
      >
        Back to Home
      </Link>
    </div>
  );
}
