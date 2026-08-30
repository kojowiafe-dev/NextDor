import { Package } from "lucide-react";
import Link from "next/link";
import { AccountLayout } from "@/components/account/AccountLayout";
import { OrderCard, type MockOrder } from "@/components/account/OrderCard";

export const metadata = { title: "My Orders" };


// Mock orders — replace with API fetch when backend is ready
const MOCK_ORDERS: MockOrder[] = [
  {
    id: "ND-00123",
    date: "Aug 25, 2026",
    status: "delivered",
    items: [{ name: "JBL Wireless Speaker", quantity: 1 }],
    total: 450,
    currency: "GHS",
  },
  {
    id: "ND-00118",
    date: "Aug 14, 2026",
    status: "processing",
    items: [
      { name: "Nivea Body Lotion", quantity: 2 },
      { name: "Dove Shampoo", quantity: 1 },
    ],
    total: 120,
    currency: "GHS",
  },
  {
    id: "ND-00101",
    date: "Jul 30, 2026",
    status: "shipped",
    items: [{ name: "HP Laptop 15", quantity: 1 }],
    total: 3800,
    currency: "GHS",
  },
  {
    id: "ND-00094",
    date: "Jul 10, 2026",
    status: "cancelled",
    items: [{ name: "Sony Headphones", quantity: 1 }],
    total: 280,
    currency: "GHS",
  },
];

export default function OrdersPage() {
  return (
    <AccountLayout>
      <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-zinc-100">
        <h2 className="mb-1 text-lg font-semibold text-zinc-900">My Orders</h2>
        <p className="mb-5 text-sm text-zinc-500">
          {MOCK_ORDERS.length} order{MOCK_ORDERS.length !== 1 ? "s" : ""}
        </p>

        {MOCK_ORDERS.length > 0 ? (
          <div className="space-y-4">
            {MOCK_ORDERS.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        ) : (
          <div className="py-12 text-center">
            <Package className="mx-auto mb-3 h-12 w-12 text-zinc-200" />
            <p className="font-medium text-zinc-700">No orders yet</p>
            <p className="mt-1 text-sm text-zinc-500">
              When you place an order, it will appear here.
            </p>
            <Link
              href="/shop"
              className="mt-4 inline-block rounded-lg bg-[#ff9900] px-5 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-[#f08804]"
            >
              Browse Products
            </Link>
          </div>
        )}
      </div>
    </AccountLayout>
  );
}
