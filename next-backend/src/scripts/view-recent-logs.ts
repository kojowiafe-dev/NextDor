import { prisma } from "../lib/prisma.js";

async function main() {
  console.log("=== LATEST NOTIFICATION LOGS ===");
  const logs = await prisma.notificationLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 6,
  });
  console.log(JSON.stringify(logs, null, 2));

  console.log("\n=== LATEST ORDERS ===");
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    take: 3,
    select: {
      id: true,
      number: true,
      status: true,
      whatsappOptIn: true,
      createdAt: true,
      shippingAddress: true,
      user: {
        select: {
          name: true,
          email: true,
          phone: true,
          whatsappOptIn: true,
        },
      },
    },
  });
  console.log(JSON.stringify(orders, null, 2));
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
