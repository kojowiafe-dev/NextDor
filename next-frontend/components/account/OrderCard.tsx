import Link from "next/link";
import { formatPrice } from "@/lib/utils";

export type MockOrder = {
  id: string;
  date: string;
  status: "delivered" | "processing" | "cancelled" | "shipped";
  items: { name: string; quantity: number }[];
  total: number;
  currency: string;
};

const statusConfig = {
  delivered: { label: "Delivered", classes: "bg-green-100 text-green-700" },
  processing: { label: "Processing", classes: "bg-blue-100 text-blue-700" },
  shipped: { label: "Shipped", classes: "bg-amber-100 text-amber-700" },
  cancelled: { label: "Cancelled", classes: "bg-red-100 text-red-700" },
};

type OrderCardProps = {
  order: MockOrder;
};

export function OrderCard({ order }: OrderCardProps) {
  const config = statusConfig[order.status];
  const itemSummary = order.items
    .map((item) => `${item.name}${item.quantity > 1 ? ` ×${item.quantity}` : ""}`)
    .join(", ");

  return (
    <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-zinc-100 transition-shadow hover:shadow-md">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-zinc-400">Order #{order.id}</p>
          <p className="mt-0.5 text-sm text-zinc-500">{order.date}</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${config.classes}`}
        >
          {config.label}
        </span>
      </div>

      <p className="mt-3 line-clamp-1 text-sm text-zinc-700">{itemSummary}</p>

      <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-3">
        <p className="text-sm font-semibold text-zinc-900">
          {formatPrice(order.total, order.currency)}
        </p>
        <Link
          href={`/account/orders/${order.id}`}
          className="text-xs font-medium text-[#007185] hover:text-[#c7511f] hover:underline"
        >
          View details →
        </Link>
      </div>
    </div>
  );
}
