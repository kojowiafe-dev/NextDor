import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting NextDor Multi-Vendor Marketplace Database Seeding...");

  // 1. Create or Find Super Admin
  const adminPasswordHash = await bcrypt.hash("Admin@NextDor2026!", 10);
  const admin = await prisma.user.upsert({
    where: { email: "admin@nextdor.com" },
    update: {
      role: "SUPER_ADMIN",
      name: "NextDor Platform Admin",
    },
    create: {
      email: "admin@nextdor.com",
      passwordHash: adminPasswordHash,
      name: "NextDor Platform Admin",
      phone: "+233200000001",
      role: "SUPER_ADMIN",
      emailVerified: true,
    },
  });
  console.log(`✅ Super Admin ready: ${admin.email} (ID: ${admin.id})`);

  // 2. Create or Find NextDor Flagship Vendor (Platform Owner Store)
  const flagshipVendor = await prisma.vendor.upsert({
    where: { slug: "nextdor" },
    update: {
      name: "NextDor Direct",
      status: "ACTIVE",
      commissionRate: 0.0, // Platform store pays 0% commission to itself
      ownerId: admin.id,
    },
    create: {
      name: "NextDor Direct",
      slug: "nextdor",
      description: "NextDor's official curated catalog of premium tech, lifestyle, and groceries.",
      email: "store@nextdor.com",
      phone: "+233200000001",
      status: "ACTIVE",
      commissionRate: 0.0,
      payoutMethod: "MOMO",
      momoNetwork: "MTN",
      momoNumber: "0240000001",
      ownerId: admin.id,
    },
  });
  console.log(`✅ Flagship Vendor ready: ${flagshipVendor.name} [slug: ${flagshipVendor.slug}]`);

  // 3. Associate all existing products without vendorId to NextDor Direct
  const updateResult = await prisma.product.updateMany({
    where: { vendorId: null },
    data: { vendorId: flagshipVendor.id },
  });
  console.log(`📦 Linked ${updateResult.count} existing WooCommerce products to '${flagshipVendor.name}'`);

  // 4. Create a Sample Marketplace Merchant ("Sweet Bakes & Treats")
  const bakerPasswordHash = await bcrypt.hash("Baker@NextDor2026!", 10);
  const bakerUser = await prisma.user.upsert({
    where: { email: "baker@sweetbakes.com" },
    update: {
      role: "VENDOR_OWNER",
      name: "Ama Mensah",
    },
    create: {
      email: "baker@sweetbakes.com",
      passwordHash: bakerPasswordHash,
      name: "Ama Mensah",
      phone: "+233241234567",
      role: "VENDOR_OWNER",
      emailVerified: true,
    },
  });

  const sampleVendor = await prisma.vendor.upsert({
    where: { slug: "sweet-bakes" },
    update: {
      name: "Sweet Bakes & Treats",
      status: "ACTIVE",
      commissionRate: 10.0, // 10% platform fee
      ownerId: bakerUser.id,
    },
    create: {
      name: "Sweet Bakes & Treats",
      slug: "sweet-bakes",
      description: "Artisan pastries, gourmet birthday cakes, and freshly baked Ghanaian meat pies.",
      email: "orders@sweetbakes.com",
      phone: "+233241234567",
      status: "ACTIVE",
      commissionRate: 10.0,
      payoutMethod: "MOMO",
      momoNetwork: "MTN",
      momoNumber: "0241234567",
      ownerId: bakerUser.id,
    },
  });

  // Link baker user to the vendor
  await prisma.user.update({
    where: { id: bakerUser.id },
    data: { vendorId: sampleVendor.id },
  });
  console.log(`✅ Sample Marketplace Vendor ready: ${sampleVendor.name} [slug: ${sampleVendor.slug}]`);

  // 5. Seed sample merchant products if they don't exist yet
  const bakerySlug = "artisan-chocolate-fudge-cake";
  const existingCake = await prisma.product.findUnique({
    where: { slug: bakerySlug },
  });

  if (!existingCake) {
    // Find or create 'Cakes & Bakery' category
    const bakeryCategory = await prisma.category.upsert({
      where: { slug: "bakery-cakes" },
      update: {},
      create: {
        name: "Bakery & Cakes",
        slug: "bakery-cakes",
        description: "Freshly baked cakes and sweet treats",
      },
    });

    await prisma.product.create({
      data: {
        slug: bakerySlug,
        name: "Artisan Chocolate Fudge Cake (8-inch)",
        description: "Decadent 3-layer dark chocolate fudge cake with Belgian chocolate ganache.",
        shortDesc: "Rich, moist 8-inch dark chocolate fudge cake.",
        price: 320.0,
        currency: "GHS",
        stockStatus: "IN_STOCK",
        stockQty: 12,
        vendorId: sampleVendor.id,
        categories: {
          connect: [{ id: bakeryCategory.id }],
        },
        images: {
          create: [
            {
              url: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800&auto=format&fit=crop&q=80",
              alt: "Artisan Chocolate Fudge Cake",
              sortOrder: 0,
            },
          ],
        },
      },
    });
    console.log(`🎂 Seeded sample vendor product: 'Artisan Chocolate Fudge Cake' under '${sampleVendor.name}'`);
  }

  console.log("🎉 Database seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
