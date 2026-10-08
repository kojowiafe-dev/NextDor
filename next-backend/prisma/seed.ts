import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/**
 * NextDor Platform Administrator & System Initialization Script.
 *
 * DESIGN:
 * This script initializes only legitimate platform entities:
 * 1. Root Platform Super Administrator (SUPER_ADMIN)
 * 2. NextDor Direct (Root Marketplace Operator Vendor)
 *
 * ZERO mock merchants, dummy products, or synthetic reviews are injected.
 * Real marketplace merchants register legitimately through /vendor/register.
 */
async function main() {
  console.log("🛡️ Initializing NextDor Platform System Accounts...");

  // 1. Create or ensure Super Administrator exists
  const adminEmail = process.env.ADMIN_EMAIL || "admin@nextdor.com";
  const defaultPassword = process.env.ADMIN_INITIAL_PASSWORD || "Admin@NextDor2026!";
  const adminPasswordHash = await bcrypt.hash(defaultPassword, 12);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail.toLowerCase().trim() },
    update: {
      role: "SUPER_ADMIN",
      emailVerified: true,
    },
    create: {
      email: adminEmail.toLowerCase().trim(),
      passwordHash: adminPasswordHash,
      name: "NextDor Platform Admin",
      phone: "+233200000001",
      role: "SUPER_ADMIN",
      emailVerified: true,
    },
  });
  console.log(`✅ Platform Super Admin ready: ${admin.email} (Role: ${admin.role})`);

  // 2. Create or ensure Root Flagship Marketplace Vendor exists
  const flagshipVendor = await prisma.vendor.upsert({
    where: { slug: "nextdor" },
    update: {
      status: "ACTIVE",
      ownerId: admin.id,
    },
    create: {
      name: "NextDor Direct",
      slug: "nextdor",
      description: "Official NextDor flagship store for curated inventory and platform operations.",
      email: admin.email,
      phone: admin.phone || "+233200000001",
      status: "ACTIVE",
      commissionRate: 0.0, // Platform store pays 0% commission to itself
      payoutMethod: "MOMO",
      momoNetwork: "MTN",
      momoNumber: "0240000001",
      ownerId: admin.id,
    },
  });
  console.log(`✅ Flagship Platform Store ready: ${flagshipVendor.name} [slug: ${flagshipVendor.slug}]`);
  console.log("✨ Platform initialization complete. System is clean and ready for legitimate merchants and inventory.");
}

main()
  .catch((e) => {
    console.error("❌ Initialization failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
